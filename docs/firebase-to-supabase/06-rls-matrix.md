# 06 — RLS and API grant matrix

RLS is enabled on every application table in `public`. Table/column grants are separate from row policies. Tables in `private` are not exposed and have no `anon`/`authenticated` grants.

| Table | anon SELECT | auth SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| `user_accounts` | deny | self/admin | backend | backend | backend |
| `admins` | deny | self/admin | backend | backend | backend |
| `profiles` | public | public | Auth trigger/backend | RPC | backend |
| `channels` | public rows | public/owned/admin | owner | safe columns + owner RLS | backend/admin op |
| `channel_profiles` | public | public | channel owner/admin | channel owner/admin | channel owner/admin |
| `categories` | active | active/admin | backend/admin op | backend/admin op | backend/admin op |
| `lives` | public rows | public/owned/admin | RPC | RPC | backend/admin op |
| `follows` | deny | participant/admin | self | deny | self/channel owner/admin |
| `channel_members` | deny | participant/admin | channel owner/admin | deny | channel owner/admin |
| `live_moderators` | deny | participant/admin | live owner/admin | deny | live owner/admin |
| `live_schedules` | public | public | channel owner/admin | channel owner/admin | channel owner/admin |
| `rewards` | public | public | channel owner/admin | channel owner/admin | channel owner/admin |
| `creator_codes` | public | public | self | creator/admin | creator/admin |
| `user_preferences` | deny | self/admin | self | self | self/admin |
| `notification_states` | deny | self/admin | self | self | self/admin |
| `watch_history` | deny | self/admin | self/RPC | self/RPC | self/admin |
| `user_progress` | deny | self/admin | RPC | RPC | backend/admin |
| `followed_categories` | deny | self/admin | self | self | self/admin |
| `creator_attributions` | deny | self/admin | self | self | self/admin |
| `chat_settings` | public | public | live moderator | live moderator | live moderator |
| `chat_messages` | visible | visible/self/mod | RPC | backend/RPC | RPC soft-delete |
| `live_bans` | deny | subject/moderator | RPC | RPC | RPC revoke |
| `live_reactions` | unexpired | unexpired | RPC | deny | cleanup/backend |
| `polls` | public | public | moderator RPC | vote/moderator RPC | owner/admin op |
| `poll_options` | public | public | moderator RPC | vote RPC | backend |
| `poll_votes` | deny | self/moderator | RPC | deny | deny |
| `wallets` | deny | self/admin | Auth trigger/backend | RPC only | backend only |
| `zy_coin_transactions` | deny | participant/admin | RPC/backend | deny | deny |
| `zy_coin_orders` | deny | self/admin | backend/payment RPC | webhook/admin | admin/backend |
| `support_alerts` | unexpired | unexpired | support RPC | deny | cleanup/backend |
| `coin_promotions` | active | active/admin | admin op | claim RPC/admin op | deny |
| `promotion_claims` | deny | self/admin | claim RPC | deny | deny |
| `reward_redemptions` | deny | participant/admin | redeem RPC | channel/admin RPC | deny |
| `clips` | public | public/participant | RPC | deny | RPC soft-delete |
| `moderation_penalties` | deny | subject/admin | admin op | admin op | deny |
| `moderation_actions` | deny | admin | admin op | deny | deny |
| `governance_config` | public | public | backend | backend | backend |
| `reports` | deny | reporter/admin | RPC | close RPC | deny |
| `moderation_audit` | deny | admin | close RPC | deny | deny |
| `policy_acceptances` | deny | self/admin | self, effective version only | deny | deny |
| `featured_streamers` | public | public | admin op | admin op | admin op |
| `audit_logs` | deny | admin | privileged operations | deny | deny |

## Private schema

The following are server-only: `firebase_user_map`, reserved usernames, channel-private legacy payloads, chat/reaction/report rate limits, viewer sessions, unique views and migration runs. RLS is not relied on as their primary boundary because the schema is not exposed and API roles have no table grants.

## SECURITY DEFINER review

- Helpers are in `private`, use `search_path = ''`, are stable where appropriate and have explicit execute grants.
- Exposed RPCs are `SECURITY DEFINER` only where atomic privileged writes are required.
- Every exposed RPC derives the caller from `auth.uid()`, validates role/ownership and does not accept actor/sender/owner IDs from the browser.
- The implicit `PUBLIC EXECUTE` grant is revoked for each exposed RPC.
- Service-role access is never embedded in client code.

