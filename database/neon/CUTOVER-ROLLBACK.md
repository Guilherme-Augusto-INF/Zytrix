# Reconciliation and reversal procedure

Production cutover is blocked. This procedure is preparation, not authorization to execute it.

## Current staging boundary

Project `soft-water-98807259`, branch `br-wispy-scene-b6325si6`, database `neondb`. Scripts validate the exact staging endpoint and verified TLS. The application uses `zytrix_staging_app`, never the database owner. API writes require the staging flag and are refused under `VERCEL_ENV=production`. Legacy Firebase mutations are blocked when staging is enabled or its configuration cannot be loaded.

The original import contains 328 rows across 17 populated tables, from 295 Firestore documents and 22 Auth accounts. Quarantined orphan records, withheld invalid alerts and username decisions remain in the private export/review directory. Eight historical wallet balances retain the user-confirmed manual adjustments; the migration does not fabricate transactions to explain them. Fourteen missing wallets were not automatically initialized.

## Final reconciliation gate

1. Preserve the original private export and verified local backup. Obtain an agreed write-freeze window before a production cutover. Current exports are sequential snapshots and do not establish a consistent final cutover point.
2. Export fresh Auth metadata and Firestore documents into a new private directory. Never commit these files. Compare document paths and canonical field values with the previous approved snapshot, including deleted records and changed account status.
3. The 2026-09-26 read-only export found 297 documents: two added followed-category documents and two changed documents (channel live state and stream status/end time). No documents were removed; Auth identity count remained 22. This delta has NOT been applied. The original snapshot reconciliation still passes, which does not imply reconciliation with the current source.
4. Transform and validate the new snapshot with the same approved remediations. Review the delta against staging edits before applying anything: never overwrite newer PostgreSQL wallet/profile changes blindly. Use an explicit transaction and a private pre-change snapshot for each affected row.
5. Reconcile exact row values, identity mapping, FKs, visibility, per-wallet balances, purchase/support totals and quarantine counts. Record expected manual adjustments separately. Counts alone are insufficient. Require zero unexplained financial differences and no unreviewed delta.
6. Repeat restricted-role integration, authentication, browser, webhook delivery, concurrent transfer and load tests. Complete the module inventory and Neon Auth preservation gates. Obtain explicit production approval only after the evidence is reviewable.

## Reversal without data loss

If staging validation fails, stop the preview and disable `ZYTRIX_POSTGRES_STAGING`/`ZYTRIX_STRIPE_SANDBOX`. Stop new writers before investigating. Preserve logs privately with secrets and personal data excluded from shared reports.

The pre-change application reference is commit `e8ac4d6f490acd3b20b2c42c13af850798f11834`. Revert reviewed application commits on the migration branch when needed; do not reset unrelated working changes. Migrations 008 and the staging Auth schema are additive. Leave them in place during an application rollback; dropping them is unnecessary and can destroy evidence.

Do not rerun the full importer over a populated database. Restore a private staging backup into a separately verified staging recovery branch, reconcile it, and switch only a staging connection after review. Do not delete the active branch or restore production automatically.

After a future production cutover, a code rollback alone cannot safely return to Firebase: new PostgreSQL writes and external payments would be missing there. Freeze writes, reconcile the post-cutover delta, and decide how to retain those writes before any backend switch. Never replay payment fulfillment or alter ledger history to force balances to match.

## External setup still needed

- Stripe sandbox webhook signing secret and a verified delivery route to the staging handler. `C:\Stripe` contains a usable test API key but no signing secret. No live payments are enabled.
- A real authenticated browser session available for controlled end-to-end validation. External-browser login does not by itself establish a session in the inspectable preview.
- The account enrollment/communication decisions described in `AUTH-TRANSITION.md`, if supported password import cannot be established.

Remaining module implementation is development work, not a user permission blocker. See `MODULE-AUDIT.md` and `MISSION-EVIDENCE-20260926.md`.
