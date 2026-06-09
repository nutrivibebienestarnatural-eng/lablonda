export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SB = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_ANON_KEY;
  if (!SB || !KEY) return res.status(500).json({ error: 'Supabase no configurado' });

  const H = {
    'Content-Type': 'application/json',
    'apikey': KEY,
    'Authorization': `Bearer ${KEY}`,
    'Prefer': 'return=representation'
  };

  // GET — leer tabla
  if (req.method === 'GET') {
    const tabla = req.query.tabla || 'reservas';
    try {
      let url = `${SB}/rest/v1/${tabla}?select=*`;
      if (tabla === 'reservas') url += '&order=created_at.desc';
      if (tabla === 'eventos') url += '&order=created_at.desc';
      if (tabla === 'sponsors') url += '&order=orden.asc';
      const r = await fetch(url, { headers: H });
      const data = await r.json();
      return res.status(200).json(Array.isArray(data) ? data : []);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST — insertar, actualizar, eliminar, upsert
  if (req.method === 'POST') {
    const { tabla, accion, datos, filtro } = req.body || {};
    if (!tabla) return res.status(400).json({ error: 'Falta tabla' });

    try {

      // ELIMINAR
      if (accion === 'delete') {
        const r = await fetch(`${SB}/rest/v1/${tabla}?id=eq.${filtro}`, {
          method: 'DELETE', headers: H
        });
        return res.status(200).json({ ok: true });
      }

      // ACTUALIZAR
      if (accion === 'update') {
        const r = await fetch(`${SB}/rest/v1/${tabla}?id=eq.${filtro}`, {
          method: 'PATCH', headers: H,
          body: JSON.stringify(datos)
        });
        const data = await r.json();
        return res.status(200).json(data);
      }

      // UPSERT config (merge por clave primaria)
      if (tabla === 'config') {
        const r = await fetch(`${SB}/rest/v1/config`, {
          method: 'POST',
          headers: { ...H, 'Prefer': 'return=representation,resolution=merge-duplicates' },
          body: JSON.stringify(datos)
        });
        const data = await r.json();
        return res.status(200).json(data);
      }

      // UPSERT eventos (merge por id)
      if (tabla === 'eventos') {
        const r = await fetch(`${SB}/rest/v1/eventos`, {
          method: 'POST',
          headers: { ...H, 'Prefer': 'return=representation,resolution=merge-duplicates' },
          body: JSON.stringify(datos)
        });
        const data = await r.json();
        return res.status(200).json(data);
      }

      // UPSERT sponsors
      if (tabla === 'sponsors') {
        const r = await fetch(`${SB}/rest/v1/sponsors`, {
          method: 'POST',
          headers: { ...H, 'Prefer': 'return=representation,resolution=merge-duplicates' },
          body: JSON.stringify(datos)
        });
        const data = await r.json();
        return res.status(200).json(data);
      }

      // INSERT reservas
      if (tabla === 'reservas') {
        const r = await fetch(`${SB}/rest/v1/reservas`, {
          method: 'POST', headers: H,
          body: JSON.stringify(datos)
        });
        const data = await r.json();
        return res.status(200).json(data);
      }

      // INSERT mensajes (upsert por clave)
      if (tabla === 'mensajes') {
        const r = await fetch(`${SB}/rest/v1/mensajes`, {
          method: 'POST',
          headers: { ...H, 'Prefer': 'return=representation,resolution=merge-duplicates' },
          body: JSON.stringify(datos)
        });
        const data = await r.json();
        return res.status(200).json(data);
      }

      return res.status(400).json({ error: 'Tabla no reconocida: ' + tabla });
    } catch(e) {
      console.error('Supabase error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).end();
}
