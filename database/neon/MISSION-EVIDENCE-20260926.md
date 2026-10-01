# Mission evidence — 2026-10-01 follow-up

## Scope and revision

Repository Guilherme-Augusto-INF/Zytrix, Draft PR #11, feat/neon-postgresql-migration. Started at f55a8d99495f26e7cd1b1d2e765d05ac0df0ea98. Main 18370b2661d0ba2020992b94a38a5f877f4d24c1 integrated INTO migration branch; conflict-resolution commit 5b7724a290fbbffa615a8b01f7fc221809cb5b69. Resolved perfil.js and aeo-geo-check.yml, preserving Neon recovery and main's newer profile/channel/player/chat behavior. No main merge, production deployment/cutover, Firebase changes, Stripe live or PR #16 changes.

## Implemented and applied only to staging

Pinned project soft-water-98807259, branch br-wispy-scene-b6325si6, database neondb, host ep-ancient-recipe-b65mlsad.c-2.sa-east-1.aws.neon.tech. Runtime role zytrix_staging_app. No production branch operations.

- 012: retention-safe self-service account deletion, deleted_at, private deletion/evidence records, narrow live-session/revoke/disable Auth helpers. App cannot enumerate session tokens/passwords.
- 013: idempotent authoritative staging-only governance seed and four versioned, SHA-256 recorded draft policy snapshots. Explicit staging consent, enabled signup, versions and verified identity enforced server-side. Production POLICY_RELEASE remains ineffective.
- 014: sandbox PaymentIntent references and refund records. Atomic/idempotent full refund debits only if coins remain; partial/insufficient-balance refunds require manual review.
- 015: follows(channel_id,followed_at DESC,follower_id), justified by follower roster/count/notifications access; existing PK starts with follower_id.

No applied historical migration was rewritten. Identity/profile/wallet import rows were not reconciled or overwritten. Category catalog remains 16 canonical categories, 142 subcategories and one historical alias (159 rows).

Account deletion retains internal UUID/Firebase UID, external identity tombstones, wallet balance/totals, orders/ledger/support/redemption/claim history, policy acceptances, reports/moderation/bans/audit. Profile/managed user are anonymized; channels/lives/clips are hidden/scrubbed; active polls close, rewards/promotions deactivate, future schedules cancel, personal preferences/follows/presence are removed. Original chat text is copied to restricted security evidence before visible anonymization. The operation requires a verified own Neon session created within five minutes, locks account/lives/wallet and is transactional/idempotent. Retention duration/legal requests remain an operator/cutover policy gate.

Auth now binds a signature/issuer/audience/expiry verified Neon JWT to a matching live managed session token; disabled/deleted/logged-out sessions cannot retain API/SSE access. Browser uses bounded single-flight JWT caching, clears private subscriptions/cache on account replacement, waits initial session before document reads and restarts public listeners safely. Dual-proof linking rechecks ban after independent proof verification and preserves imported internal IDs; matching emails never authorize linking.

Original-screen fixes: channel creation sets current_live_id, native neon:UUID report references are accepted, unauthorized admin promotion UI stays hidden, profile promotion mounting waits for the profile section without observer recursion. Native chat works even before live-extras finishes mounting. Deletion logout cannot interrupt its final navigation.

SSE is authenticated PostgreSQL polling every two seconds, delivered as SSE (NOT CDC), up to 20 seconds/token expiry. Per-process slots: 32 total/3 per subject; released on close/finally. Each poll rechecks managed session and account; DB clients release between polls. Browser abort cancels pending reader; auth 401/403 stops retries. Multi-instance distributed limiting and load testing are not claimed.

## Executed validation

| Check | Result and limits |
|---|---|
| Conflict-resolution battery | 57/57 application, site check, 5/5 migration, 29 restricted-role groups and two concurrency groups PASS |
| Final local application battery | 68/69 initially; only failure was live-event error precedence; corrected and payment suite 3/3 PASS. No unresolved application failure |
| Focused final regressions | 23/23 PASS: original adapter/session races, report references, profile/streaming and reconciliation |
| npm run check | PASS: syntax, routes/links/anchors/headings, rules copies; final source additions checked again |
| npm run test:migration | 9/9 PASS (including four reconciliation fixture tests) |
| Restricted platform staging | 29/29 groups PASS; SET LOCAL ROLE zytrix_staging_app asserted; transaction ROLLED_BACK |
| Account lifecycle staging | 10/10 groups PASS under restricted role; normal/wallet/transactions/channel/live/content, stale/unlinked/anonymous/deleted/reexecution; ROLLED_BACK |
| Wallet/Stripe database concurrency | 12/12 groups PASS with independent actual restricted-role connections; insufficient balance, totals/conservation, idempotency/replay, injected intermediate rollback, tampered amount/user/session/currency, concurrent credits/full refund, cross-order refund event replay denied, partial/spent-coin refunds enter review without debit; fixtures REMOVED |
| npm run test:rules | 43/43 PASS in demo-zytrix-governance emulator; portable Windows runner fixed. Initial stripped Java runtime lacked jdk.httpserver; complete isolated Temurin 21 runtime used. No Firebase rules publication |
| Original browser public/authenticated navigation | Nine smoke checks PASS; public home/categories/explore/clips, original login/profile/notifications/creator/store/admin-denial |
| Original browser actions | 13 checks PASS, zero app page errors: real signup/login/enrollment, edit profile/preferences, create channel, Educação/Matemática configuration, start/end, schedule/reward/poll/VOD/chat/SSE/clip |
| Original two-user browser community | 17 checks PASS, zero app page errors: follows, chat/poll/reward/support, API/UI admin denial, report/moderation, promotion create/claim, notifications/profile/history, real logout and old-JWT rejection |
| Actual managed-session API/SSE | Eight checks PASS: missing/mismatched sessions, wallet/UID/admin spoofing, private wallet/viewer roster, banned account, per-user SSE cap/disconnect/reconnect, private-live isolation, logout API/SSE revocation |
| Original deletion browser | Five checks PASS: own fresh real session, original confirmation, managed revocation/disable, wallet/totals/ledger preserved, owned live/channel hidden, old JWT denied |
| Reconciliation CLI | Actual restricted-role PostgreSQL dry-run with checksummed catalog fixture PASS; applied=0; 111 validated FKs; zero checked negative-wallet/orphan/identity invariants. FK name-array parsing corrected. This is not fresh Firebase reconciliation |
| Performance preflight | 11 representative EXPLAIN ANALYZE/BUFFERS queries on restricted staging role recorded privately. No production-scale performance claim |

Browser used installed Edge/Playwright against original V1 HTML and local loopback preview connected to real staging Neon Auth/PostgreSQL. Three disposable example.invalid accounts used REAL managed password signup/login, JWT/session APIs and application authorization. Email verification flag, fixture wallet and fixture admin role were explicitly SIMULATED setup, not real email delivery or imported Firebase linking. Shared Twitch iframe getLayoutMap errors excluded from app errors. No bypass endpoint/config can ship to production.

Fixture cleanup was transactional, guarded by exact managed UUID/example.invalid email and pinned staging target. All three fixtures and their test-only related data removed. Final counts: **22 identities, eight wallets, zero managed Auth users, zero Neon external links**, one staging governance row/four policy snapshots. Financial integration/lifecycle test fixtures rolled back; concurrency fixtures removed. No real imported wallet/profile was altered.

## Security and performance findings

Fixed immediate session revocation, session-subject mixing, stale auth/document races, unauthorized promotion UI, private viewer enumeration and deleted-profile publication. Existing parameterized SQL, ownership/admin checks, payload caps, rate limits, financial row locks/constraints/idempotency remain. Real restricted-role and actual HTTP negative cases are recorded above; this is not a claim of formal penetration testing or absence of all possible vulnerabilities.

Removed two redundant raid/host reads from stream documents and joined member/moderator profiles to remove creator roster N+1. Cached managed JWT acquisition avoids /token request storms. No speculative index overhaul; small staging tables may legitimately use sequential scans. Pool maximum five, bounded query/connection timeouts, no DB client held while waiting for next SSE poll.

## External gates and truthful readiness

Repository changes and available staging technical checks are completed. Staging is NOT fully certified: shared Google OAuth still rejects its exact regional callback, real email verification/reset and imported dual-proof linking need controlled real identities, hosted Stripe Checkout/signed external webhook need sandbox secrets, and fresh source reconciliation needs authorized exports. No source data was manufactured to remove those gates.

Historical Sept 26 evidence (328 imported rows from 295 documents, 22 Auth accounts, unapplied two-new/two-changed delta) is retained as history, not a fresh comparison. No modified-SCRYPT password import support is established by reviewed Neon managed API documentation; no passwords/hashes imported or reconstructed, no mass email.

See STAGING-READINESS.md for exact user actions and CUTOVER-ROLLBACK.md for prohibited production gates. Credentials, raw exports, browser bodies, fixtures/results, SQL plans and temporary Java runtime stay ignored/private.

GitHub validation at initial published semantic revision 9c7fb48: Quality, AEO/GEO, Governance and Neon Migration Checks PASS; application 70/70, site check PASS, migration 9/9 ([run](https://github.com/Guilherme-Augusto-INF/Zytrix/actions/runs/36854391761)). Vercel Preview READY. Local commit histories were normalized to remove Windows-only line-ending differences; functionality is unchanged.

Hosted branch Preview: https://zytrix-web-git-feat-neon-postg-f6f98a-guilhermeaugusto2525-1431.vercel.app . Authorized only this preview origin on br-wispy-scene-b6325si6 Neon Auth, and verified hosted /login.html callback accepted. Authenticated connector read of /api/v1/config confirms postgresStaging=false/authentication=firebase; hosted Neon runtime variables remain USER ACTION REQUIRED because no Vercel env-write tool or authenticated CLI is available here. No hosted Auth/application smoke is claimed and no production settings changed.

Final financial review additionally binds refund event IDs to their order, preventing cross-order replay. Four focused restricted-role groups added (12 total) and payment unit suite 3/3 PASS. All new fixtures removed. Vercel settings browser opened login: Preview environment configuration needs the account owner login; no authenticated settings session was available.

Hosted Preview safety correction: the observed unconfigured Preview previously selected Firebase. api/v1/config now fails closed with 503 staging_not_configured whenever VERCEL_ENV=preview lacks restricted Neon runtime or managed Auth settings. Production legacy compatibility is unchanged. Regression test verifies both paths; authenticated hosted testing must wait for the Preview-only environment configuration.
