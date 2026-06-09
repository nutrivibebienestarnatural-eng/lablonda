export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, cfg, eventoActual, eventos } = req.body;
  const bar = cfg?.bar || {};
  const mesas = cfg?.mesas || [];
  const derecho = cfg?.derecho || {};

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  // Leer eventos directo de Supabase (sin pasar por supabase.js)
  let eventosActivos = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/eventos?select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const data = await r.json();
    if (Array.isArray(data)) {
      eventosActivos = data.filter(e => e.activo === true);
    }
  } catch(e) {
    console.error('Error leyendo eventos:', e);
  }

  // Si el frontend mandó eventos, usarlos también
  if (eventosActivos.length === 0 && Array.isArray(eventos) && eventos.length > 0) {
    eventosActivos = eventos.filter(e => e.activo);
  }

  // Leer reservas activas para estado de mesas
  let reservasActivas = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/reservas?estado=eq.reservada&select=mesa,nombre`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const data = await r.json();
    if (Array.isArray(data)) reservasActivas = data;
  } catch(e) {}

  const mesasSummary = mesas.map(m => {
    const ocupada = reservasActivas.find(r => r.mesa === m.num);
    return `Mesa ${m.num} (hasta ${m.cap} pers.): ${ocupada ? 'RESERVADA — ' + ocupada.nombre : 'LIBRE'}`;
  }).join('\n');

  const eventosStr = eventosActivos.length > 0
    ? eventosActivos.map(e => {
        const [y, m, d] = (e.fecha || '').split('-');
        const precio = e.precio > 0 ? ` — Entrada: $${Number(e.precio).toLocaleString('es-AR')}` : ' — Entrada libre';
        const instr = e.claude_msg ? `\n  Notas: ${e.claude_msg}` : '';
        return `• "${e.nombre}" (${e.tipo}) — ${d||'?'}/${m||'?'}/${y||'?'} ${e.hora||''}hs${precio}${instr}`;
      }).join('\n')
    : 'Sin eventos especiales esta semana';

  const system = `Sos el asistente virtual de *${bar.nombre || 'La Blonda'}*, un bar con mucha onda en Argentina.

DATOS DEL BAR:
- Nombre: ${bar.nombre || 'La Blonda'}
- Dirección: ${bar.dir || 'Consultá por WhatsApp'}
- Horario: ${bar.horario || 'Jue a Dom de 20hs a 3hs'}
- Instagram: @${bar.ig || 'lablonda'}
- WhatsApp: ${bar.tel || '—'}

EVENTOS ACTIVOS ESTA SEMANA:
${eventosStr}

ESTADO DE MESAS:
${mesasSummary || 'Mesas disponibles'}

${derecho.activo ? `DERECHO DE RESERVA: Para grupos de ${derecho.desde}+ personas, se requiere una garantía de ${derecho.tipo === 'por_persona' ? '$' + derecho.monto + ' por persona' : '$' + derecho.monto + ' fijo'}. Alias: ${derecho.alias || '—'}, CBU: ${derecho.cbu || '—'}.` : ''}

INSTRUCCIONES IMPORTANTES:
1. AL ARRANCAR siempre mencioná los eventos disponibles esta semana
2. Preguntá para cuál evento quiere reservar o si prefiere una reserva general
3. Recolectá: nombre completo, teléfono, fecha, hora, cantidad de personas
4. Sugerí la mesa más adecuada según capacidad
5. Cuando tengas TODOS los datos confirmados, incluí al FINAL este JSON exacto sin markdown:
{"ACCION":"RESERVAR","nombre":"...","telefono":"...","fecha":"YYYY-MM-DD","hora":"HH:MM","mesa":N,"personas":N,"evento":"..."}
6. Tono: alegre, argentino, cálido, emojis moderados`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
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
      } catch(e) { console.error('Error guardando reserva:', e); }
    }

    res.status(200).json({ texto: textoLimpio, accion });
  } catch(e) {
    console.error(e);
    res.status(500).json({ texto: 'Error de conexión. Intentá de nuevo en un momento.' });
  }
}
