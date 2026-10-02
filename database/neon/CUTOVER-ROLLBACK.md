# Cutover and rollback — 2026-10-01

**No merge into main, production cutover/deploy, production Firebase/Auth/Stripe changes or official-domain changes were executed or authorized. PR #11 remains Draft.**

## Current boundary

Repository code and available restricted-stage checks completed; STAGING READY/CUTOVER READY/PRODUCTION READY = NO. Applied additive 012–015 only to soft-water-98807259 / br-wispy-scene-b6325si6 / neondb. Runtime remains zytrix_staging_app. Imported 22 internal identities/eight wallets preserved; disposable managed fixtures removed, no actual imported Auth links. Zero functional Firestore dependencies in Neon path; legacy SDK/facade remains isolated for existing production and rollback.

## Required before any future cutover

- All USER ACTION REQUIRED gates in STAGING-READINESS.md: real Google callback/session/link/logout; real email verification/reset/session recovery; real dual-proof imported identity linking; hosted sandbox Checkout/verified external webhook; fresh source delta and reconciliation.
- Effective operator-approved terms/privacy/community/content/report configuration, legal placeholders/support contacts resolved and retention/access rules established. Current server policy snapshots are explicitly staging test drafts and do not release production signup/policies.
- Verify identity/profile/wallet/ledger equality and referential integrity with current exports; resolve conflicts without replacing newer Neon records or reducing balances. Preserve financial/moderation/security history. No password reconstruction or unsupported hash import.
- Production-specific restricted role/security/grants/pinned Auth issuer/audience, OAuth origins, configuration/secrets, financial provider verification, load/SSE limits, monitoring and backups approved independently. Current code intentionally pins staging and refuses VERCEL_ENV=production.
- Planned source write-freeze, final reconciliation, explicit traffic/domain/account transition and rollback decision require USER APPROVAL. Do not perform them under this task.

## Future rollback controls

Keep Firebase production intact throughout staging certification; do not disable Firebase Auth. Stop local/preview staging or revert only migration-branch app revision when a staging regression appears. Versioned SQL is additive; do not drop tables, identity mappings, ledger or deletion/security evidence as a rollback shortcut. Restore reviewed backups to an isolated branch if needed, then reconcile and validate before approval.

Account deletion is transactional self-service; it anonymizes/disables and preserves wallet/ledger/audit identity references. User-visible account recreation must never silently resurrect a deleted internal identity or attach retained balances by email. Staging fixture cleanup is a separate explicit test-only operation guarded by exact example.invalid identities; it is not a real-account deletion policy.

Payments remain SANDBOX ONLY. A verified success URL cannot mint coins. Credit/refund use order/row locks, unique ledger/event/refund records and transaction rollback. Partial/insufficient-coin refunds enter review_required; do not automatically write negative balances or delete ledger.

SSE is polling/SSE, 2-second polling, 20-second connection/token lifetime, cleanup/reconnect and per-process caps. Production multi-instance limits/load strategy require future measured review; no CDC or unlimited scale claim.

Historical Sept 26 source delta and earlier owner-level test results are historical context, not certification of current production state. See MISSION-EVIDENCE-20260926.md for this execution's actual role/test/browser evidence.
