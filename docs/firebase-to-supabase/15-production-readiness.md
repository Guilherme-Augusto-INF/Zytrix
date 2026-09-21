# 15 — Production readiness

Status is evidence-based. `NOT VERIFIED` is never treated as pass.

| Area | Status | Evidence | Pending |
|---|---|---|---|
| Schema | PASS | Seven versioned migrations applied to isolated staging; generated TypeScript types | Real-data sizing may require additive tuning |
| Data Migration | NOT VERIFIED | Console baseline: 73 top-level documents; ETL pipeline implemented | Machine-readable export, subcollections, transform/import/reconcile |
| Auth | PARTIAL | 19 users and provider mix verified; official SCRYPT strategy documented; auth trigger modeled | Secure Auth export/hash parameters, import rehearsal, flow tests |
| Profiles | PARTIAL | schema, unique key, cooldown RPC; parallel collision passed | legacy username collision scan and frontend adapter |
| Channels | PARTIAL | relational owner/slug/RLS; cross-owner update denied remotely | frontend adapter and browser test |
| Lives | PARTIAL | lifecycle schema/RPC/one-active constraint | staging tests and frontend adapter |
| Chat | PARTIAL | tables, rate RPC, moderation RPC, Realtime publication | staging/Reatime/concurrency tests |
| Moderation | PARTIAL | trusted admin/moderator relations and audit model | complete admin RPCs and attack tests |
| Poll | PARTIAL | normalized options/votes and atomic RPC | staging/concurrency tests |
| Follow | PARTIAL | canonical unique relation | migration dedup and frontend test |
| Rewards | PARTIAL | catalog/redemption transaction | fulfillment/admin tests |
| Zy Coins | PARTIAL | private writes, append-only ledger; parallel overspend and idempotent retry passed | real-data reconciliation and broader red-team |
| Clips | PARTIAL | metadata schema | create/delete RPC and real-media decision |
| Reports | PARTIAL | private RLS, partial unique indexes, close audit RPC | staging/race tests |
| Storage | PARTIAL | Firebase source verified inactive/zero baseline; three Supabase buckets and owner-path policies | Supabase upload/policy tests and pre-cutover recheck |
| Realtime | PARTIAL | publication and private topic policies | live client test and load behavior |
| RLS | PARTIAL | 42/42 public tables RLS-enabled; 66 policies; 10/10 remote SQL authorization checks pass | real JWT/Data API and complete matrix |
| RPC | PARTIAL | 15 controlled RPCs applied; fixed `search_path`; grants and live UUID access reviewed | complete functional and attack matrix |
| Edge Functions | N/A | no current external secret/webhook backend found | required only for real payments/external integrations |
| IDOR/BOLA | PARTIAL | cross-owner channel, wallet, report and private-live viewer-count attacks denied | exhaustive resource matrix with real JWTs |
| Concurrency | PARTIAL | parallel username and Zy Coin overspend tests pass | follow, poll, chat, reward, viewer and moderation races |
| Performance | PARTIAL | Advisor reviewed; targeted FK/query indexes applied | production-like data + EXPLAIN ANALYZE |
| Frontend | FAIL | still imports Firebase directly; repository/history secret scan passed | migrate by domain through services; verify Vercel env scopes |
| Preview | NOT VERIFIED | Vercel Preview for commit `bceb87f` built READY; protected login page returned HTTP 200 | configure Supabase preview env and complete authenticated functional smoke tests |
| Production | FAIL | production still Firebase; intentional | all gates + explicit cutover approval |
| Backup | PARTIAL | baseline Git commit and Console counts recorded; Firebase preserved | Firestore/Auth machine-readable export |
| Rollback | PARTIAL | documented plan; Firebase preserved | delta replay rehearsal and window decision |
| Observability | PARTIAL | audit/log requirements defined | dashboards/alerts/log tests |

## Cutover verdict

**NOT READY**

Blocking reasons: no authorized Firebase production export/credentials, no real data reconciliation, no Auth import rehearsal, incomplete real-JWT/Storage/Realtime/browser coverage, no preview deployment, and frontend still uses Firebase.
