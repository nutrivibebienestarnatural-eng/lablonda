export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, cfg, eventoActual } = req.body;
  const bar = cfg?.bar || {};
  const mesas = cfg?.mesas || [];
  const derecho = cfg?.derecho || {};
  const mensajes = cfg?.mensajes || {};

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  // Leer eventos activos desde Supabase
  let eventosActivos = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/eventos?activo=eq.true&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    eventosActivos = await r.json();
  } catch(e) {}

  // Leer reservas activas para estado de mesas
  let reservasActivas = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/reservas?estado=eq.reservada&select=mesa,fecha,hora,nombre,personas`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    reservasActivas = await r.json();
  } catch(e) {}

  const mesasSummary = mesas.map(m => {
    const ocupada = reservasActivas.find(r => r.mesa === m.num);
    return `Mesa ${m.num} (hasta ${m.cap} pers.): ${ocupada ? 'RESERVADA — ' + ocupada.nombre + ' ' + ocupada.fecha + ' ' + ocupada.hora + 'hs' : 'LIBRE'}`;
  }).join('\n');

  const eventosStr = eventosActivos.length > 0
    ? eventosActivos.map(e => {
        const[y,m,d] = (e.fecha||'').split('-');
        return `- "${e.nombre}" (${e.tipo}) — ${d||'?'}/${m||'?'}/${y||'?'} ${e.hora||''}hs${e.precio > 0 ? ' — Entrada: $'+e.precio : ' — Entrada libre'}${e.cupos > 0 ? ' — '+e.cupos+' cupos' : ''}${e.claude_msg ? '\n  Instrucciones: '+e.claude_msg : ''}`;
      }).join('\n')
    : 'Sin eventos especiales esta semana';

  const eventoInfo = eventoActual
    ? `\n\nEL CLIENTE LLEGÓ POR EL LINK DEL EVENTO: "${eventoActual.nombre}". Orientá la conversación a reservar para ese evento específico.`
    : '';

  const derechoInfo = derecho.activo
    ? `\n\nDERECHO DE RESERVA: Para grupos de ${derecho.desde}+ personas se solicita una garantía de ${derecho.tipo === 'por_persona' ? '$' + derecho.monto + ' por persona' : '$' + derecho.monto + ' fijo'}. Alias: ${derecho.alias || '—'}, CBU: ${derecho.cbu || '—'}, Titular: ${derecho.titular || '—'}${derecho.mp ? ', MP: ' + derecho.mp : ''}. Usá el mensaje configurado en el sistema.`
    : '';

  // Mensajes configurables
  const msgConf = mensajes.confirmacion || '¡Hola, {nombre}! 🎉\n\n¡Tu reserva en *{bar}* está confirmada!\n\n📅 *{fecha}*\n🕐 *{hora} hs*\n🪑 Mesa *{mesa}* para *{pax}* personas{evento}\n\nLlegá tranquilo, que acá te esperamos. 🍺✨\n\n¡Nos vemos en *{bar}*! 🔥';

  const system = `Sos el asistente virtual de *${bar.nombre || 'La Blonda'}*, un bar con mucha onda en Argentina.

TU MISIÓN PRINCIPAL: ayudar a los clientes a reservar para los EVENTOS del bar. Si no hay eventos, podés tomar reservas generales.

DATOS DEL BAR:
- Nombre: ${bar.nombre || 'La Blonda'}
- Dirección: ${bar.dir || 'Consultá por WhatsApp'}
- Horario: ${bar.horario || 'Jue a Dom de 20hs a 3hs'}
- Instagram: @${bar.ig || 'lablonda'}
- WhatsApp: ${bar.tel || '—'}

EVENTOS ACTIVOS (ofrecelos siempre al inicio):
${eventosStr}

ESTADO DE MESAS:
${mesasSummary || 'Sin información'}
${eventoInfo}
${derechoInfo}

REGLAS:
1. Al inicio de la conversación, mostrá los eventos disponibles y preguntá para cuál quiere reservar
2. Si el cliente elige un evento, orientá toda la reserva a ese evento
3. Recolectá: nombre completo, teléfono, fecha, hora, cantidad de personas
4. Sugerí la mesa más adecuada según capacidad
5. Si hay derecho de reserva y el grupo supera ${derecho.activo ? derecho.desde : 5} personas, informalo amablemente
6. Cuando tengas TODOS los datos, incluí al final de tu mensaje este JSON exacto (sin markdown ni backticks):
   {"ACCION":"RESERVAR","nombre":"...","telefono":"...","fecha":"YYYY-MM-DD","hora":"HH:MM","mesa":N,"personas":N,"evento":"...","eventoId":"..."}
7. Tono: alegre, argentino, emojis moderados
8. Nunca confirmes mesa ocupada según el estado real

MENSAJE DE CONFIRMACIÓN A USAR:
${msgConf}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system,
        messages: messages || []
      })
    });

    const data = await response.json();
    const texto = data.content?.[0]?.text || 'Disculpá, hubo un problema. Intentá de nuevo.';

    let accion = null;
    const jsonMatch = texto.match(/\{"ACCION"\s*:\s*"RESERVAR"[^}]+\}/s);
    if (jsonMatch) {
      try { accion = JSON.parse(jsonMatch[0]); } catch(e) {}
    }

    const textoLimpio = texto.replace(/\{"ACCION"\s*:\s*"RESERVAR"[^}]+\}/gs, '').trim();

    // Guardar reserva en Supabase
    if (accion?.ACCION === 'RESERVAR' && SUPABASE_URL && SUPABASE_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/reservas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            nombre: accion.nombre,
            telefono: accion.telefono,
            fecha: accion.fecha,
            hora: accion.hora,
            mesa: accion.mesa,
            personas: accion.personas,
            estado: 'reservada',
            operador: 'Chat web',
            notas: accion.evento || '',
            evento: accion.evento || ''
          })
        });
      } catch(e) { console.error('Error Supabase:', e); }
    }

    res.status(200).json({ texto: textoLimpio, accion, mensajes });
  } catch(e) {
    console.error(e);
    res.status(500).json({ texto: 'Error de conexión. Intentá de nuevo.' });
  }
}
