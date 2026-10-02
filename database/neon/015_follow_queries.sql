begin;
-- Channel follower counts/rosters and recipient notifications filter channel_id;
-- the existing PK begins with follower_id and cannot serve this access pattern.
create index if not exists follows_channel_recent_idx on public.follows(channel_id,followed_at desc,follower_id);
commit;
