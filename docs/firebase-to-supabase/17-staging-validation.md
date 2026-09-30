# 17 — Isolated staging validation

## Environment

- Supabase project: `Zytrix Staging`
- Project reference: `hfgrsmyotubzsdkzwmol`
- Region: `sa-east-1`
- Purpose: isolated migration rehearsal only; it is not the production cutover target.
- Firebase `zytrix-ca4f2` remains untouched and is still the production source of truth.

## Applied state

| Check | Result |
|---|---:|
| Versioned migrations applied | 7 |
| Public application tables | 42 |
| Public tables with RLS | 42 |
| RLS policies | 66 |
| Controlled public `SECURITY DEFINER` RPCs | 15 |
| Zytrix Storage buckets | 3 |
| Realtime publication tables | 9 |
| Generated database types | `supabase/database.types.ts` |

All seven migration files parse successfully with a PostgreSQL grammar parser. The remote database accepted each migration. The generated TypeScript types reflect PostgREST 14.5. The seventh migration aligns `featured_streamers` with production's verified `position`/`active` shape while allowing a null curator only for legacy rows whose Firebase documents contain no `createdBy`.

## Authorization evidence

`supabase/tests/authorization.sql` runs in a transaction and rolls all fixtures back. It passed 10/10 checks:

1. public profile read;
2. wallet BOLA read denied;
3. cross-owner channel update denied;
4. immutable `owner_id` mass assignment denied;
5. direct wallet balance mutation denied;
6. self-insertion into `admins` denied;
7. private-live viewer-count UUID access denied;
8. controlled own-profile RPC allowed;
9. another user's report hidden;
10. anonymous privileged RPC execution denied.

No test fixture accounts remain in staging.

## Concurrency evidence

Two independent database connections attempted to send 80 Zy Coins from the same 100-coin wallet:

- one request succeeded;
- one failed with `insufficient_balance`;
- sender balance became 20;
- recipient balance became 80;
- exactly one immutable ledger transaction existed;
- retrying the winning idempotency key returned the same transaction ID and did not debit again.

Two independent connections also attempted to claim the same normalized username. Exactly one succeeded; the other was rejected by `profiles_username_key_key`.

These tests cover the two highest-risk database races, but do not yet cover every concurrency row in `11-security-tests.md`.

## Advisor review

The Security Advisor's anonymous `SECURITY DEFINER` finding was corrected by revoking anonymous viewer-count execution. Fifteen authenticated warnings remain intentionally: these functions are the designed RPC transaction boundary. Each has a fixed empty `search_path`, explicit grants, trusted `auth.uid()` derivation and operation-specific authorization.

The Performance Advisor's multiple-permissive-policy warnings were corrected by splitting four `FOR ALL` policies into command-specific INSERT/UPDATE/DELETE policies. Targeted query/FK indexes were added. Remaining unindexed-FK and unused-index findings are informational until representative data and `EXPLAIN ANALYZE` are available.

## Verdict

Staging database foundation: **PASS**.

The migration branch produced a Vercel Preview in READY state and the protected login page returned HTTP 200. This validates packaging/deployment only; it is not functional parity because the branch intentionally still uses Firebase and authenticated end-to-end smoke tests have not run.

Overall migration/cutover: **NOT READY**. Real Firebase/Auth exports, data reconciliation, full Auth/OAuth, Storage, Realtime, frontend adapters, authenticated Preview validation and production smoke testing remain required.
