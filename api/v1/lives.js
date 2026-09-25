import { enabled, getPool } from '../../server/neon/pool.mjs';
const sql = `select firebase_id as "id", streamer_uid as "streamerUid",
  channel_id as "channelId", title, description,
  category_id as "categoryId", thumbnail_url as "thumbnailURL",
  playback_url as "playbackURL", mature_content as "matureContent",
  created_at as "createdAt", viewer_count as "viewerCount",
  username, photo_url as "photoURL"
from public.live_feed
order by viewer_count desc, created_at desc, postgres_id
limit 40`;
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({ error:'method_not_allowed' }); }
  if (!enabled()) { res.setHeader('Cache-Control','no-store');return res.status(503).json({ status:'migration_preview_disabled' }); }
  try {
    const result = await getPool().query(sql);
    // Public data only, short CDN cache; never cache authenticated endpoints.
    res.setHeader('Cache-Control','public, s-maxage=5, stale-while-revalidate=10');
    return res.status(200).json({ lives: result.rows });
  } catch {
    res.setHeader('Cache-Control','no-store');
    return res.status(503).json({ error:'feed_unavailable' });
  }
}
