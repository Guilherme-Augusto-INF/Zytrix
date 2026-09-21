# 11 — Security and regression tests

## Executed baseline

- 19 JavaScript/security/static migration tests pass.
- 41 Firebase Rules tests pass.
- ETL transform and Auth-preflight tests pass (2/2).
- Remote staging authorization suite passes 10/10 inside a rolled-back transaction.
- Parallel username collision test passes: one winner and one database unique-key denial.
- Parallel Zy Coin overspend test passes: one transfer succeeds, one receives `insufficient_balance`, balances remain 20/80, and one ledger row exists.
- Idempotent Zy Coin retry returns the same transaction ID without another debit.
- These staging results do not replace Auth, Storage, Realtime, real-data or browser end-to-end validation.

## Mandatory allow tests

- public reads for visible profiles/channels/lives/chat/clips;
- own private account/preferences/wallet/transactions;
- channel owner edits safe channel fields;
- live owner state transition through RPC;
- moderator chat settings and moderation;
- verified user sends chat under slow mode;
- one poll vote and one promotion claim;
- atomic support and reward redemption;
- own report creation/read and admin closure with audit;
- versioned policy acceptance;
- owner-path Storage uploads.

## Mandatory deny tests

| Attack | Expected |
|---|---|
| update own/admin role | denied |
| insert into `admins` from browser | denied |
| edit another profile/channel/live | denied |
| change immutable owner/user/sender ID | denied |
| direct wallet balance update | denied |
| insert fake ledger transaction | denied |
| duplicate request/idempotency key | same result, no double charge |
| two concurrent redemptions exceeding balance | at most one succeeds |
| duplicate follow/poll vote/promotion claim | constraint/RPC denial |
| bypass chat slow mode from two tabs | denial |
| chat while globally/live banned | denial |
| non-admin punish admin/owner | denial |
| list/read another user's report | denied |
| close report without admin/audit | denied |
| upload/update/delete another owner's object | denied |
| call privileged RPC as anon/wrong owner | denied |
| use user metadata to become admin | denied |
| known UUID BOLA against every private resource | denied |

## Concurrency tests

- same username in parallel;
- follow/unfollow races;
- same poll vote in parallel;
- slow-mode messages in parallel;
- reaction rate in parallel;
- support/reward requests with same and different idempotency keys;
- final wallet unit under concurrent spend;
- last promotion stock/claim slot;
- live state transitions;
- report duplicate and rate-limit races;
- viewer heartbeat/multiple-tab behavior.

## Test implementation

Use a staging Supabase project with dedicated test users for visitor, users A/B, owner, moderator and admin. Tests must exercise the Data API/RPC with real JWTs. Service-role setup is allowed only for fixture creation and must not be used for the assertion request itself. Run Security and Performance Advisors after migrations and after every policy/function correction.

## Advisor disposition

- Security Advisor: anonymous execution of `current_viewer_count` was removed. The remaining 15 warnings are the intentionally exposed, reviewed transaction boundary RPCs; each pins `search_path`, revokes implicit `PUBLIC` execution and performs identity/ownership/role validation. See the [SECURITY DEFINER lint guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Performance Advisor: overlapping permissive policies were eliminated. The remaining findings are informational unindexed FKs selected for measurement and unused indexes expected on an empty staging database. See the [unindexed FK](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) and [unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) guidance.

Current status: **PARTIAL PASS**. SQL authorization and two critical concurrency paths passed; real JWT/Data API, Storage, Realtime and full attack-matrix execution remain pending.
