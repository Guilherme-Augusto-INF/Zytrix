# Reconciliation and reversal — updated 2026-10-01

Production cutover is prohibited in this mission. **Code concluded: NO; staging concluded: NO; ready for cutover: NO; production migrated: NO.** PR #11 remains Draft.

## Verified staging boundary

Project soft-water-98807259, branch br-wispy-scene-b6325si6, database neondb; direct endpoint ep-ancient-recipe-b65mlsad.c-2.sa-east-1.aws.neon.tech. All database tests validate the pinned staging endpoint with verified TLS. The application uses zytrix_staging_app, not the database owner. Its pool rejects any other role, bounds connections/timeouts and releases clients.

Production refuses the platform and sandbox payment handlers even if staging flags are supplied. Original screens choose one backend at page load; unavailable staging configuration does not select Firebase. No production Firebase change, main merge, production deploy, domain alteration or Stripe live enabling occurred. PR #16 was not changed.

Migrations 009, 010 and 011 were applied only to staging; 001–008 were not rewritten. They add original-screen/Auth grants and disabled-account support, append the catalog and restore three missing canonical category parents. The local Auth callback origin was authorized only on staging. No identity/profile/wallet/ledger reconciliation write was performed.

## Data evidence and delta

Historical approved import: 328 rows across 17 populated tables, from 295 Firestore documents and 22 Auth accounts. Eight wallet balances retain user-approved historical manual adjustments; do not fabricate ledger entries to explain those adjustments. Fourteen originally missing wallets were not automatically initialized by login.

The Sept 26 read-only source delta was two new followed-category documents and two changed channel/live-state documents; zero removals, 22 Auth identities. That delta is still unapplied and is not a current source snapshot.

This execution's read-only staging checks found 22 internal identities, eight wallets, zero Neon Auth users/links and zero governance rows. Browser public feed reads the existing staging snapshot. Firebase CLI has no authorized account; previous private source exports and C:\\Stripe are unavailable in this workspace. A public REST read of governance/config returned NOT_FOUND. A fresh whole-source Auth/Firestore delta, identity/profile/wallet comparison and final reconciliation are **NOT VERIFIED**. No newer staging data was overwritten to force counts to match.

Disposable integration data was rolled back. The concurrent-money test used committed, uniquely identified staging fixtures and two direct runtime-role connections; all its fixtures were removed. The known historical eight wallets/22 identities remain.

## Remaining staging and cutover gates

1. Finish retention-safe original account deletion and managed Auth/session cleanup.
2. Supply authoritative policy/report/signup configuration. Current policy documents are ineffective drafts; do not invent released versions or acceptances.
3. Complete real managed email login/verification/reset/logout/account-switch and dual-proof linking, preserving all existing UUIDs. Resolve the staging Google shared-client redirect_uri_mismatch; do not edit production OAuth.
4. Configure a real Stripe sandbox API key/signing secret and staging origin/verified webhook route. Complete the application's hosted Checkout → signed raw-body webhook → PostgreSQL idempotent wallet-credit flow. Local signature/simulated fulfillment and concurrency tests have passed; external delivery has not.
5. Obtain an authorized fresh source snapshot and approved prior private remediations. First produce a per-path/per-field delta, including disabled/deleted identities and private balances/ledger. Review against newer PostgreSQL writes before any safe staging transaction.
6. Reconcile identity mappings, profiles, financial totals/ledger/manual adjustments, ownership/visibility, FKs and quarantine decisions. Zero unexplained financial differences are required.
7. Validate authenticated critical flows in the original V1 screens with a real Neon session. The public local smoke is not equivalent to this gate.
8. A final consistent source snapshot/write-freeze and production cutover require a separate explicit approval. Do not execute them here.

## Reversal without data loss

For failed staging validation, stop the preview/disable ZYTRIX_POSTGRES_STAGING and ZYTRIX_STRIPE_SANDBOX, stop writers and retain private evidence. Keep credentials/exports outside Git.

The starting application reference for this execution is 7b2b1cf93bcefedea571c0a9b861a38bb8ea77fb. Revert reviewed migration-branch commits if needed; do not reset unrelated work. Additive schemas/grants/catalog and Auth links can remain during a code rollback; dropping them would lose evidence. Do not run the full importer over a populated database.

Use a reviewed private staging backup in a separately verified recovery branch if recovery is necessary. Never delete the active branch or restore production automatically. After a future cutover, a code-only return to Firebase would omit new PostgreSQL writes and payments: freeze and reconcile the post-cutover delta before any backend switch.
