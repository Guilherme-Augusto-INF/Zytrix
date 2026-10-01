# Migration evidence — updated 2026-10-01

PR #11, branch `feat/neon-postgresql-migration`, starting HEAD `7b2b1cf93bcefedea571c0a9b861a38bb8ea77fb`. The four mission documents were read before edits. Main was initially `bb3a3f600f50e0a7ced5a29e4a6f83f1dc9ca7eb`; a later remote check found `18370b2661d0ba2020992b94a38a5f877f4d24c1`. The PR branch had not advanced. Main was not merged into this work.

**Code concluded: NO. Staging concluded: NO. Ready for cutover: NO. Production migrated: NO.** PR remains Draft. No production deployment/cutover, Firebase production write, Stripe live operation, official-domain change or PR #16 modification was performed.

## Delivered in this execution

Original V1 screens now select Neon before loading the legacy Firebase SDK. Explicit relational reads/writes and server actions cover live configuration/lifecycle, creator dashboards, profiles/follows/social, notifications, clips/VOD, schedules, chat/membership/moderation, viewer presence, reports/admin, progress/rewards/polls/promotions, preferences/discovery and wallet/support/payment initiation. Generic financial writes and arbitrary document paths are denied. Financial operations and retries retain server-authoritative identity, prices/costs, row locks, ledger entries and idempotency.

Neon Auth verifier pins the actual staging service, Ed25519 signature/JWKS, issuer, audience, expiration and bounded token lifetime. Identity mapping preserves imported internal UUIDs and Firebase IDs. Enrollment requires independently verified Neon and fresh Firebase proofs; email equality never links accounts. Session change/expiry clears private subscriptions, and snapshots compare field values even when document IDs do not change. Account deletion still requires implementation; its legacy path is blocked.

SSE remains authenticated PostgreSQL polling every two seconds, delivered over SSE, with at most 20 seconds per stream, token expiry checks and released database clients between snapshots. Original live/chat subscriptions share transport per account/live. Other document subscriptions poll every 15 seconds without overlapping requests and clean up on identity change. This is not CDC. Joined clip/chat/support metadata and batched schedules/admin summaries remove several original N+1 reads.

Applied **only to verified Neon staging** (`soft-water-98807259`, `br-wispy-scene-b6325si6`, `neondb`):
- 009: additive original-screen grants, disabled-account field and narrowly selected Auth columns; runtime remains zytrix_staging_app.
- 010: additive shared catalog: 16 canonical categories / 142 subcategories, preserving the original eight and existing IDs.
- 011: restore only three missing canonical parent links. Physical catalog: 159 rows, including the retained gaming alias.
- Auth trusted return origin: http://127.0.0.1:5502 only. No production OAuth settings were modified.

No newer profile, identity, wallet or ledger data was overwritten. Integration fixtures rolled back; separately committed disposable concurrency fixtures were removed.

## Executed validation

| Check | Result | Scope |
|---|---|---|
| npm test | PASS, 52/52 in the initial final battery | Existing suites plus Neon-token/original-module security tests |
| npm run check | PASS | JS syntax, policy routes/links/headings, rules copies; Windows used a local python3 shim |
| npm run test:migration | PASS, 5/5 | Existing transform/remediation/staging guards |
| Focused post-correction tests | PASS, 15/15 | Auth/API/SSE and snapshot stable-ID regression; three tests added after the initial battery |
| Session-replacement/snapshot regression | PASS, 6/6 | Specific adapter tests; no real credentials/session |
| test-platform-staging.mjs --runtime-role | PASS, 29 groups | Real staging PostgreSQL; SET LOCAL ROLE zytrix_staging_app asserted; fixtures ROLLED_BACK |
| test-wallet-concurrency.mjs | PASS, 2 groups | Two independent restricted-role connections; overspend rejection, simultaneous duplicate retry, conservation/nonnegative balances; fixtures REMOVED |
| Webhook/fulfillment | PASS locally | Existing signature tests plus simulated sandbox PostgreSQL credit; wrong amount denied, retry credits once |
| Original-screen browser smoke | PASS, public scope | Home/Explore load actual Neon live; 16 category cards; Clips loads an empty feed; original login form and error handling work |
| Google OAuth | BLOCKED | Local INVALID_CALLBACKURL fixed; Google then returned redirect_uri_mismatch for Neon's shared regional callback |
| Firebase CLI | BLOCKED | No authorized accounts; no source export/reconciliation performed |

The initial broad battery was run once. Specific failures were corrected and retested: PostgreSQL bigint expectations, members.created_at, creator_attributions.creator_code, fixture VOD expectation, the login message function scope, and snapshot comparison of data. No current test failure is left in the executed scope.

Private credentials/results stay in ignored migration-data/. No secret or raw user export is committed. No live/production payment was initiated. Actual application Checkout completion and externally signed webhook delivery remain unverified: C:\\Stripe and the previous private export directory are absent here, and no Stripe secrets were invented.

## Current data/Auth evidence and remaining gates

Read-only staging query: **22 internal identities, eight wallets, zero Neon Auth users, zero Neon mappings, zero governance rows**. Missing wallets/profiles were not recreated merely by login. The governance/config source REST read returned 404. The shared Google provider is configured but its callback is rejected by Google; no real Neon account session or account link was completed.

The Sept 26 evidence (328 imported rows / 17 populated tables from 295 Firestore documents, 22 Auth accounts, and an unapplied delta of two new/two changed documents) is historical, not fresh certification. Old PaymentIntent/audit/timing results were not rerun or claimed as current evidence.

Remaining: account deletion lifecycle; configured authoritative policies/reports/signup; real managed Auth verification, reset, logout/account switch and dual-proof links; working staging Google OAuth credentials/callback; current source reconciliation; actual Stripe sandbox Checkout and signed webhook delivery; authenticated original-screen smoke. See MODULE-AUDIT.md, AUTH-TRANSITION.md and CUTOVER-ROLLBACK.md.
