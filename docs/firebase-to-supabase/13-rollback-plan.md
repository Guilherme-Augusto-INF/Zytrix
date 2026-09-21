# 13 — Rollback plan

## Preconditions

- Firebase project, Auth users, Firestore data, Rules and Storage objects remain intact.
- A timestamped export exists before T0.
- The old frontend build and environment values remain deployable.
- All Supabase writes after T0 have an export/reconciliation path back to Firebase or a documented freeze policy.

## Rollback trigger

Rollback is considered for Auth lockout, unexplained data loss, financial inconsistency, Critical/High authorization bypass, widespread frontend failure or unrecoverable Realtime/Storage failure.

## Procedure

1. Stop new Supabase writes or enable maintenance mode.
2. Capture Supabase delta since T0, including Auth/account mapping, ledger, reports, policy acceptances and moderation.
3. Validate the delta and determine whether it can be replayed safely into Firebase.
4. Redeploy the last known Firebase frontend build/environment.
5. Smoke-test Firebase Auth, live/chat, wallet and reports.
6. Reconcile writes from the cutover window; never discard unmatched financial/moderation data.
7. Preserve Supabase for forensics; do not destroy it during rollback.

## Rollback limits

Firebase sessions may still be valid, but users who changed passwords or created accounts only in Supabase need an explicit recovery/synchronization path. The maximum automatic rollback window must be chosen after measuring migration delta complexity. Until then, rollback readiness is **PARTIAL**.

