# Migration evidence — 2026-09-26

Status: partial implementation, production cutover blocked. PR #11 remains a draft. No production database changes or live payments were performed.

## Delivered in this revision

- Verified-account registration service with current policy acceptance and stable Firebase-to-UUID mapping. Existing accounts and deliberately missing profiles are not recreated. Signup UI and Neon enrollment remain pending.
- PostgreSQL notification listing, read markers, admin overview and audited/idempotent penalties, with staging UI.
- Authenticated SSE for live/chat snapshots and notifications; PostgreSQL polling every two seconds, connection release between snapshots, bounded stream lifetime, expiration checks and reconnect/cancellation handling. This is polling delivered over SSE, not database change-data capture.
- Stripe sandbox Checkout and signed raw-body webhook handlers; server-controlled pricing, transactionally idempotent wallet crediting and a separate event table. Production and live keys/events are denied. The local preview leaves these handlers disabled until configured.
- Guarded legacy Firebase mutations in staging, including signup, account deletion, email sends and Google popup signup paths. This prevents unsafe fallback but does not replace the remaining modules.
- Additive migration 008 applied only to staging. Neon Auth provisioned only on staging; JWKS reachable. No accounts linked, passwords imported or enrollment emails sent.
- Firebase Admin/UUID runtime dependencies updated. The scoped gaxios 6 override selects UUID 11, preserving its CommonJS v4 API while removing the audited older UUID advisory.

## Executed evidence

| Check | Result | Scope/limitation |
|---|---|---|
| `npm test` | 47 passed | Unit/static/security/client stream tests |
| `npm run test:migration` | 5 passed | Remediation, transform and endpoint guard |
| `test-platform-staging.mjs ... --runtime-role` | 19 scenario groups passed | Real staging PostgreSQL, restricted role; all fixtures rolled back |
| `scripts/check-site.py` | PASS | JavaScript syntax, policy links/routes/headings and rules copies |
| `npm audit --omit=dev --json` | 0 vulnerabilities | Root and ETL runtime dependencies; not a full dev dependency audit |
| `test-stripe-sandbox.mjs` | PASS | Actual Stripe test PaymentIntent for BRL 490 cents; succeeded, livemode false; repeated request returned same payment |
| Stripe webhook signature tests | PASS | Locally signed SDK fixture; tampering and stale signature rejected |
| Payment fulfillment integration | PASS | Simulated webhook against PostgreSQL; amount mismatch denied, duplicate credit prevented; not external webhook delivery |
| HTTP preview smoke | 7 passed | Page 200; unauthenticated API/SSE 401; unconfigured payment handlers 503; private paths 404 |
| Read-only feed timing | p50 8 ms, p95 10 ms, max 10 ms | 25 sequential warmed queries, one returned row; not concurrent load/capacity validation |
| Original import reconciliation | PASS | Approved snapshot counts/wallet invariants; not the new source delta |

Private reports are under the local export directory in `mission-20260926/` and `staging-final-approved/`. Raw exports, connection strings, user identifiers and API keys are excluded from Git and this report. The Stripe sandbox test used the key from `C:\Stripe` in memory; no key was copied into source files.

## Open work

The static inventory has 37 modules with direct Firestore call sites, including guarded legacy fallbacks. Clips, VOD, schedules, rewards, polls, promotions, full governance/report flows and original-screen integration still require implementation/review. See `MODULE-AUDIT.md`. This is development work, not a permission blocker.

Remaining validation includes authenticated browser end-to-end flows, concurrent financial operations, sustained realtime/load testing and the full module regression suite. A complete migration cannot be certified from the current 19 database scenario groups.

`C:\Stripe` has a valid sandbox API key but no webhook signing secret. Hosted Checkout completion and external signed webhook delivery are not verified. The independent test PaymentIntent does not prove that the application's Checkout-to-wallet flow is complete.

Neon Auth remains preparation only; Firebase is still the active verifier. See `AUTH-TRANSITION.md` for proof-based linking and password compatibility gates. See `CUTOVER-ROLLBACK.md` for the unapplied source delta, final reconciliation and reversal procedure.
