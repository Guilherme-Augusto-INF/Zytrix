import { enabled, getPool } from '../../server/neon/pool.mjs';
export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({ error:'method_not_allowed' }); }
  if (!enabled()) return res.status(503).json({ status:'disabled' });
  try {
    await getPool().query('select 1');
    return res.status(200).json({ status:'ready' });
  } catch {
    return res.status(503).json({ status:'unavailable' });
  }
}
