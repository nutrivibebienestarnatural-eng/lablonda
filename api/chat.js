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

  // EVENTOS HARDCODEADOS — siempre disponibles
  const EVENTOS_FIJOS = [
    {
      nombre: 'Karaoke con Fernando Bosco',
      tipo: 'karaoke',
      fecha: '2026-06-10',
      hora: '23:00',
      precio: 0,
      activo: true,
      claudeMsg: 'Noche de karaoke con Fernando Bosco. Entrada libre. Recomendá mesas centrales para que todos vean la pantalla.'
    },
    {
      nombre: 'Marcos Capitán y su Banda + Maicho Maraquista',
      tipo: 'show',
      fecha: '2026-06-11',
      hora: '23:00',
      precio: 8000,
      activo: true,
      claudeMsg: 'Show en vivo de Marcos Capitán y su banda con la actuación especial de Maicho Maraquista. Entrada $8.000. Recomendá mesas cercanas al escenario.'
    }
  ];

  // Combinar: eventos del frontend + eventos fijos
  let eventosActivos = EVENTOS_FIJOS;
  if (Array.isArray(eventos) && eventos.length > 0) {
    const extras = eventos.filter(e => (e.activo === true || e.activo === 'true') && 
      !EVENTOS_FIJOS.find(f => f.nombre === e.nombre));
    eventosActivos = [...EVENTOS_FIJOS, ...extras];
  }

  // Reservas activas de Supabase
  let reservasActivas = [];
  try {
    const SB = process.env.SUPABASE_URL;
    const KEY = process.env.SUPABASE_ANON_KEY;
    if (SB && KEY) {
      const r = await fetch(`${SB}/rest/v1/reservas?estado=eq.reservada&select=mesa,nombre`, {
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
      });
      const data = await r.json();
      if (Array.isArray(data)) reservasActivas = data;
    }
  } catch(e) {}

  const mesasSummary = mesas.length > 0
    ? mesas.map(m => {
        const ocupada = reservasActivas.find(r => r.mesa === m.num);
        return `Mesa ${m.num} (${m.cap} pers.): ${ocupada ? 'RESERVADA — ' + ocupada.nombre : 'LIBRE'}`;
      }).join('\n')
    : 'Mesas disponibles';

  const eventosStr = eventosActivos.map(e => {
    const [y, m, d] = (e.fecha || '').split('-');
    return `• *${e.nombre}* — ${d}/${m}/${y} ${e.hora}hs${e.precio > 0 ? ' — Entrada: $' + Number(e.precio).toLocaleString('es-AR') : ' — Entrada libre'}${e.claudeMsg ? '\n  ' + e.claudeMsg : ''}`;
  }).join('\n');

  const system = `Sos el asistente virtual de *${bar.nombre || 'La Blonda'}*, un bar con mucha onda en Argentina.

DATOS DEL BAR:
- Nombre: ${bar.nombre || 'La Blonda'}
- Dirección: ${bar.dir || 'Consultá por WhatsApp'}
- Horario: ${bar.horario || 'Jue a Dom de 20hs a 3hs'}
- Instagram: @${bar.ig || 'lablonda'}
- WhatsApp: ${bar.tel || '—'}

EVENTOS ESTA SEMANA:
${eventosStr}

ESTADO DE MESAS:
${mesasSummary}
${derecho.activo ? `\nDERECHO DE RESERVA: Grupos de ${derecho.desde}+ personas requieren garantía de ${derecho.tipo === 'por_persona' ? '$'+derecho.monto+' por persona' : '$'+derecho.monto}. Alias: ${derecho.alias||'—'}, CBU: ${derecho.cbu||'—'}.` : ''}

INSTRUCCIONES:
1. SIEMPRE al arrancar mencioná los dos eventos de esta semana
2. Preguntá para cuál evento quiere reservar o si prefiere reserva general
3. Recolectá: nombre completo, teléfono, fecha, hora, personas
4. Sugerí la mesa más adecuada
5. Cuando tengas TODOS los datos, incluí al final este JSON sin markdown:
{"ACCION":"RESERVAR","nombre":"...","telefono":"...","fecha":"YYYY-MM-DD","hora":"HH:MM","mesa":N,"personas":N,"evento":"..."}
6. Tono: alegre, argentino, cálido, con onda`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system,
        messages: messages || []
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Claude API error:', JSON.stringify(data.error));
      return res.status(200).json({ texto: 'Disculpá, hubo un problema técnico. Intentá de nuevo en un momento.' });
    }

    const texto = data.content?.[0]?.text || 'Disculpá, hubo un problema. Intentá de nuevo.';
    let accion = null;
    const jsonMatch = texto.match(/\{"ACCION"\s*:\s*"RESERVAR"[^}]+\}/s);
    if (jsonMatch) { try { accion = JSON.parse(jsonMatch[0]); } catch(e) {} }
    const textoLimpio = texto.replace(/\{"ACCION"\s*:\s*"RESERVAR"[^}]+\}/gs, '').trim();

    // Guardar reserva en Supabase
    if (accion?.ACCION === 'RESERVAR') {
      try {
        const SB = process.env.SUPABASE_URL;
        const KEY = process.env.SUPABASE_ANON_KEY;
        if (SB && KEY) {
          await fetch(`${SB}/rest/v1/reservas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Prefer': 'return=minimal' },
            body: JSON.stringify({
              nombre: accion.nombre, telefono: accion.telefono,
              fecha: accion.fecha, hora: accion.hora,
              mesa: accion.mesa, personas: accion.personas,
              estado: 'reservada', operador: 'Chat web',
              evento: accion.evento || ''
            })
          });
        }
      } catch(e) {}
    }

    res.status(200).json({ texto: textoLimpio, accion });
  } catch(e) {
    console.error('Error general:', e);
    res.status(500).json({ texto: 'Error de conexión. Intentá de nuevo.' });
  }
}
