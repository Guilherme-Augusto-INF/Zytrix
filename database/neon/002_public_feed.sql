-- Read-only public projection for Neon API. Apply AFTER 001_foundation.sql.
-- The view intentionally excludes wallet/admin/private fields.
begin;
create or replace view public.live_feed
with (security_barrier=true)
as
select
  l.id as postgres_id,
  l.firebase_id,
  i.firebase_uid as streamer_uid,
  c.firebase_id as channel_id,
  l.title,
  l.description,
  l.category_id,
  l.thumbnail_url,
  l.playback_url,
  l.mature_content,
  l.created_at,
  coalesce(vc.viewer_count, 0)::integer as viewer_count,
  p.username,
  p.photo_url
from public.lives l
join public.identities i on i.id = l.owner_id
join public.channels c on c.id = l.channel_id
join public.profiles p on p.user_id = l.owner_id
left join lateral (
  select count(*)::integer as viewer_count
  from private.live_viewer_sessions vs
  where vs.live_id = l.id and vs.expires_at > now()
) vc on true
where l.status = 'live' and l.deleted_at is null
  and c.deleted_at is null;
revoke all on public.live_feed from public;
-- A dedicated limited runtime role must be provisioned by the operator.
-- Grant it SELECT on this view only; do not expose the migration-owner connection to Vercel.
commit;
