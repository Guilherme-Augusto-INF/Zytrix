# Public user profiles

## Scope and architecture
Base: main c912393. Use `/usuario.html?uid=<Neon Auth UUID>` (alias `/usuario?uid=...`); immutable IDs survive username changes. `/perfil.html` remains private account management. No schema migration or new dependency. Existing social model follows public channels: users without a public channel cannot be followed. Hidden/private/unlisted/deleted channels and inactive accounts are excluded from public social statistics and lists.

## Server contract
POST `/api/v1/platform`: `profile.public {uid}` returns only public profile fields, public channel/current public live and real follower/following counts. `profile.network {uid,kind,offset}` pages public profiles (20, maximum offset 1000). Both execute in READ ONLY transactions. Invalid UUID/offset/kind: 400; unavailable account: `profile:null`, with no channel/network details. Explicit public projection rejects unknown/private fields and unsafe image URLs. Existing `profile.get` and `profile.search` also exclude deleted, disabled and banned accounts.

Reuses profiles, identities, user_accounts, neon_auth.user, moderation_penalties, channels, lives and follows. Existing grants and API authorization protect the database; current deployment does not use browser database access or RLS. Do not grant browser roles database access.

`follow.set` still requires server-verified Neon identity and verified email, disallows self-follow, validates public active channel, holds channel SHARE lock and per-user/channel transaction advisory lock, and uses existing unique follow constraint. No financial endpoints changed. Reports reuse existing governance availability and `/denunciar` flow, which requires authenticated verified accounts.

## UI and navigation
Anonymous profile reads bypass stale sessions. Auth changes refresh follow state; buttons prevent overlapping requests. Chat names/avatars, live streamer identity, home/category/explore live cards and private followed-channel list link to immutable profiles. Live-card handlers ignore links/buttons to preserve navigation. Public network lists are paginated and escaped. Public profile bio/name render as text, image URLs are allowlisted. Supports retry, empty state, unavailable state, clipboard failure, reduced motion, focus and mobile CSS.

## Indexing and sharing
Public profile pages deliberately remain `noindex,follow`: no profile-indexing privacy preference exists. Title/description/Open Graph/canonical update in browser from authorized public data. Social crawlers without JavaScript receive generic metadata; no server-rendered per-profile social card. Static unavailable page has HTTP 200 and noindex; API distinguishes absence. Private profile HTML metadata corrected to noindex.

## Validation
- Baseline: 71 PASS, 0 FAIL, 3 skipped integration tests.
- Implementation: 79 PASS, 0 FAIL, 3 skipped; 8 new unit tests cover UUIDs, public projection, private image rejection, anonymous reads, unavailable accounts, no-channel accounts, pagination, auth and serialized follow writes.
- `npm run lint`, `npm run typecheck`, `npm run build`: PASS locally.
- SQL schema/grants inspected read-only on clean-neon-20261007. Live SQL and preview validation recorded in PR.
- No real account modifications, report submissions or financial transactions for tests.

## Release gate
Keep PR unmerged until preview and authenticated regression checks are complete. Production requires user authorization. Rollback: revert feature commit; no data rollback needed. Follow state is a channel relation, not a new user-follow model.
