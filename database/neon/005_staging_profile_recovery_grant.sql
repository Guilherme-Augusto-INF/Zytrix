-- Run on the verified Neon STAGING branch ONLY after 004_staging_runtime_grants.sql.
-- This additive grant enables user-confirmed profile recovery, never automatic login writes.
begin;
grant insert(user_id, firebase_uid, username, bio) on public.profiles to zytrix_staging_app;
commit;
