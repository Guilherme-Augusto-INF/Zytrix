# 14 — Production validation

## Smoke checklist

- [ ] Sign up, verify email, login, logout, reset password.
- [ ] Google new user and existing-user link.
- [ ] View/edit profile; username cooldown and collision.
- [ ] Create/edit channel; another user cannot edit it.
- [ ] Create/start/end live; invalid transition denied.
- [ ] Enter live; current and total viewer semantics.
- [ ] Chat send/realtime/reply/delete/pin.
- [ ] Slow mode, followers-only, members-only, emergency mode.
- [ ] Mute/ban/moderator permissions.
- [ ] Poll creation/vote/duplicate vote/result.
- [ ] Follow/unfollow and notification state.
- [ ] Schedule and rewards.
- [ ] Zy Coin support, insufficient balance, duplicate click.
- [ ] Reward redemption and fulfillment.
- [ ] Clip metadata creation/list/delete.
- [ ] Report creation/privacy/dedup/rate limit/admin close.
- [ ] Policy acceptance version.
- [ ] Avatar/channel/thumbnail upload and cross-owner denial.
- [ ] Mobile browser and desktop smoke tests.

## Operational checks

- [ ] Supabase Security Advisor reviewed.
- [ ] Supabase Performance Advisor reviewed.
- [ ] No service-role/secret key in browser bundle, repository or Vercel public env.
- [ ] Auth/Realtime/Storage/Edge/Data API error rates acceptable.
- [ ] No RLS zero-row surprises on expected updates.
- [ ] Keyset pagination used for chat, transactions, reports and clips.
- [ ] EXPLAIN/ANALYZE evidence for feed/chat/report/ledger queries.
- [ ] Backup/export and rollback artifacts accessible to authorized operator.

Current status: **NOT RUN**. Production remains on Firebase.

