# 12 — Cutover plan

Cutover is prohibited until all critical checklist items pass and the user explicitly approves production switching.

## T-7 days

- staging schema/RLS/RPC/Storage/Realtime deployed and advisor-clean;
- full Firebase export/import/reconciliation completed;
- Auth import rehearsal and Google OAuth verified;
- frontend service adapters work in preview;
- rollback rehearsal completed;
- Critical = 0, High = 0.

## T-3 days

- second migration rehearsal with measured duration;
- delta-export mechanism verified;
- production environment variables prepared but not enabled;
- dashboards/log queries and incident contacts prepared;
- user communication for possible reauthentication ready.

## T-1 day

- fresh backup/export and hash manifest;
- freeze window and responsible operator confirmed;
- final readiness review signed;
- Firebase remains writable and authoritative.

## T0

1. Enable the shortest practical write freeze for affected domains.
2. Export final delta.
3. Transform/import in a database transaction or idempotent batches.
4. Reconcile counts, hashes and critical invariants.
5. Abort on unexplained divergence.
6. Deploy frontend selector/environment change to Supabase.
7. Run production smoke tests with real non-admin/admin test users.
8. Monitor Auth, Data API, Realtime, Storage, RPC and browser errors.
9. End freeze only after explicit validation.

## T+1 to T+7

- Firebase remains intact as rollback source.
- Reconcile new Supabase activity and watch business/security metrics.
- Do not revoke Firebase credentials, delete data or remove code yet.
- After the agreed stability window, make Firebase legacy/read-only where technically safe.

## Cutover gate

Required: reproducible migrations, successful reconciliation, Auth/Google/Storage/Realtime, all critical Zytrix flows, RLS/BOLA/concurrency, preview, backup and rollback. Any critical area at `PARTIAL`, `FAIL` or `NOT VERIFIED` blocks cutover.

