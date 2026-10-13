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

## Preview evidence (2026-10-13)
- Feature commit: 125de8779deb7b491bb3dacf2fb0720518330e0c; preview deployment dpl_DCFJixk1hTYZCZozNqccQ1vYanYc, READY. Browser URL: https://zytrix-24jv9n49k-guilhermeaugusto2525-1431.vercel.app/usuario.html?uid=5f2da840-1097-469d-b442-10d089153186 . Vercel authentication protects previews; temporary access used for QA, protection retained.
- Initial preview lacked Neon variables and returned 503 neon_not_configured. Resolved using branch-scoped Preview DATABASE_URL (restricted zytrix_runtime role) and pinned public auth issuer. No production variables changed.
- Isolated DB: preview-public-profiles-pr31-20261013 (br-lingering-hall-b6hxomon), parent clean-neon-20261007; expires 2026-10-20 16:30 UTC. No mutations to account, followers, chat, reports or financial records for QA.
- PASS in browser: existing profile with real avatar/name/live/stats; anonymous API through deployed restricted runtime; direct URL/reload; /usuario alias; missing UUID; malformed UUID; home-card avatar link; live streamer link; profile-to-live navigation and Twitch embed; empty followers/following lists; copy link; login requirement plus safe return URL for follow; report target prefilled and submission disabled without login; browser back; dynamic title/canonical/noindex.
- Twitch embed loaded but upstream alanzoka was offline, while Zytrix persisted status remained live. Existing status-source behavior, not verified playback of an active broadcast.
- NOT TESTED live: mobile/tablet viewport, keyboard full flow, chat authors (no messages), populated social lists, disabled/deleted/banned fixtures, absent avatar/long bio/special-character visual fixtures, login/signup/profile editing, follow/unfollow with two accounts and concurrency, expired real session, actual report submission, financial regressions. Unit tests cover input/projection/no-channel/auth/self-follow/pagination/lock structure; they do not substitute for these real flow checks.
- Three preexisting PostgreSQL integration suites skipped. An extra restricted-runtime PostgreSQL attempt from the Work filesystem failed EAI_AGAIN (network/DNS restriction); runtime public queries were instead validated on the deployed preview.
- Auth emitter is pinned in current server code to the existing service. This isolated DB does not synchronize newly created parent auth sessions: use a properly isolated QA auth setup before testing authenticated preview flows. No auth architecture rewritten in this feature.
- PR #31 remains Draft. No merge, production deployment or production smoke test performed.
