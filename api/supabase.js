// api/supabase.js — CRUD para eventos, config y reservas
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase no configurado' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer': 'return=representation'
  };

  const { tabla, accion, datos, filtro } = req.body || {};
  const tablaParam = req.query.tabla;
  const accionParam = req.query.accion;

  // GET — leer datos
  if (req.method === 'GET') {
    const t = tablaParam || 'reservas';
    try {
      let url = `${SUPABASE_URL}/rest/v1/${t}?select=*`;
      if (t === 'reservas') url += '&order=created_at.desc';
      if (t === 'eventos') url += '&order=created_at.desc';
      const r = await fetch(url, { headers });
      const data = await r.json();
      return res.status(200).json(data);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST — escribir datos
  if (req.method === 'POST') {
    try {
      // Guardar evento
      if (tabla === 'eventos') {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/eventos`, {
          method: 'POST',
          headers,
          body: JSON.stringify(datos)
        });
        const data = await r.json();
        return res.status(200).json(data);
      }

      // Guardar reserva
      if (tabla === 'reservas') {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/reservas`, {
          method: 'POST',
          headers,
          body: JSON.stringify(datos)
        });
        const data = await r.json();
        return res.status(200).json(data);
      }

      // Guardar config
      if (tabla === 'config') {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/config`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation,resolution=merge-duplicates' },
          body: JSON.stringify(datos)
        });
        const data = await r.json();
        return res.status(200).json(data);
      }

      // Actualizar estado reserva
      if (tabla === 'reservas' && accion === 'update') {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/reservas?id=eq.${filtro}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(datos)
        });
        const data = await r.json();
        return res.status(200).json(data);
      }

      return res.status(400).json({ error: 'Tabla no reconocida' });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // PUT — actualizar
  if (req.method === 'PUT') {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?id=eq.${filtro}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(datos)
      });
      const data = await r.json();
      return res.status(200).json(data);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // DELETE
  if (req.method === 'DELETE') {
    try {
      const { tabla: t, id } = req.query;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}?id=eq.${id}`, {
        method: 'DELETE',
        headers
      });
      return res.status(200).json({ ok: true });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).end();
}
