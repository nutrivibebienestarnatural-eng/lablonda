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
  const eventos = cfg?.eventos || [];

  const mesasSummary = mesas.map(m => `Mesa ${m.num}: hasta ${m.cap} personas`).join(', ');
  const eventoInfo = eventoActual
    ? `\n\nEL CLIENTE ENTRÓ POR EL LINK DEL EVENTO: "${eventoActual.nombre}" (${eventoActual.tipo}) — ${eventoActual.fecha ? new Date(eventoActual.fecha).toLocaleDateString('es-AR') : ''} ${eventoActual.hora || ''}hs${eventoActual.precio > 0 ? ` — Entrada: $${eventoActual.precio}` : ' — Entrada libre'}${eventoActual.cupos > 0 ? ` — ${eventoActual.cupos} cupos` : ''}.\n${eventoActual.claudeMsg ? 'INSTRUCCIONES ESPECIALES PARA ESTE EVENTO: ' + eventoActual.claudeMsg : ''}`
    : '';

  const derechoInfo = derecho.activo
    ? `\n\nDERECHO DE RESERVA: Se aplica para grupos de ${derecho.desde}+ personas. Monto: ${derecho.tipo === 'por_persona' ? '$' + derecho.monto + ' por persona' : '$' + derecho.monto + ' fijo'}${derecho.maximo > 0 ? ' (máximo $' + derecho.maximo + ')' : ''}. CBU: ${derecho.cbu || '—'}, Alias: ${derecho.alias || '—'}, Titular: ${derecho.titular || '—'}${derecho.mp ? ', MP: ' + derecho.mp : ''}.`
    : '';

  const system = `Sos el asistente virtual de *${bar.nombre || 'La Blonda'}*, un bar con mucha onda en Argentina.
Tu misión: ayudar a los clientes a reservar mesas de forma amigable, cálida y con energía argentina.

DATOS DEL BAR:
- Nombre: ${bar.nombre || 'La Blonda'}
- Dirección: ${bar.dir || 'Consultá por WhatsApp'}
- Horario: ${bar.horario || 'Jue a Dom de 20hs a 3hs'}
- Instagram: @${bar.ig || 'lablonda'}
- WhatsApp: ${bar.tel || '—'}

MESAS DISPONIBLES: ${mesasSummary || 'Consultá disponibilidad'}
${eventoInfo}
${derechoInfo}

EVENTOS ACTIVOS HOY:
${eventos.filter(e=>e.activo).map(e=>`- ${e.nombre} (${e.tipo}) — ${e.fecha || 'Sin fecha'} ${e.hora || ''}hs${e.precio > 0 ? ' $'+e.precio : ' gratis'}`).join('\n') || '- Sin eventos especiales'}

REGLAS IMPORTANTES:
1. Recolectá siempre: nombre completo, teléfono, fecha, hora, cantidad de personas
2. Sugerí la mesa más adecuada según la capacidad: ${mesas.map(m=>`Mesa ${m.num} (${m.cap} pers)`).join(', ')}
3. Si el grupo supera ${derecho.activo ? derecho.desde : 5} personas${derecho.activo ? ', informá el derecho de reserva con el mensaje del sistema' : ''}
4. Cuando tengas TODOS los datos (nombre, tel, fecha, hora, mesa, personas), respondé el mensaje normal Y al final incluí este JSON exacto (sin markdown):
   {"ACCION":"RESERVAR","nombre":"...","telefono":"...","fecha":"YYYY-MM-DD","hora":"HH:MM","mesa":N,"personas":N,"evento":"${eventoActual?.nombre || ''}"}
5. Si el cliente pide cancelar, pedí sus datos y respondé con: {"ACCION":"CANCELAR","nombre":"...","telefono":"..."}
6. Tono: alegre, argentino, con emojis moderados, serio cuando hace falta
7. Nunca inventés disponibilidad — si no sabés, decí que confirmás y que se comuniquen al WhatsApp del bar
8. Si el evento tiene derecho de reserva, usá el mensaje configurado en el sistema reemplazando las variables`;

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
    const jsonMatch = texto.match(/\{[^{}]*"ACCION"\s*:\s*"[^"]+[^{}]*\}/s);
    if (jsonMatch) {
      try { accion = JSON.parse(jsonMatch[0]); } catch(e) {}
    }

    const textoLimpio = texto.replace(/\{[^{}]*"ACCION"\s*:\s*"[^"]+[^{}]*\}/gs, '').trim();
    res.status(200).json({ texto: textoLimpio, accion });
  } catch(e) {
    console.error(e);
    res.status(500).json({ texto: 'Error de conexión. Intentá de nuevo en un momento.' });
  }
}
