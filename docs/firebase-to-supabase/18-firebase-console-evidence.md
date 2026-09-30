# 18 — Firebase production Console evidence

Inspection date: 2026-09-21. Mode: read-only. No Firebase data, rules, provider, billing or project setting was changed.

## Confirmed

- Project: `zytrix-ca4f2` / Zytrix.
- Plan: Spark.
- Firestore database: `(default)` in `southamerica-east1`.
- Auth: 19 users; email/password and Google enabled.
- Provider mix: 16 email-only, 2 Google-only, 1 linked Google + email/password.
- Root Firestore collections: `admins`, `channels`, `featuredStreamers`, `profiles`, `streams`, `users`, `wallets`, `zyCoinOrders`, `zyCoinTransactions`.
- Root document counts: 1, 5, 4, 20, 5, 20, 8, 10 and 0 respectively; total 73.
- Manual composite index list is empty.
- Latest Rules revision displayed by Console: 2026-09-09 17:13 local console time.
- Firebase Storage is not activated and the Console requires Blaze before setup.

## Anomalies requiring export-level resolution

1. Auth has 19 identities while `users` and `profiles` each have 20 documents.
2. Ten coin order documents exist but the root `zyCoinTransactions` collection has zero documents.
3. Only eight wallets exist for 19 Auth identities; wallet provisioning is not complete across legacy accounts.
4. Subcollection counts cannot be proven from the root Console inventory.
5. The deployed Rules editor showed the expected `SECURITY-HARDENING-V2-FIXES` header, but full byte equality with the 4,293-line repository file could not be extracted and remains unverified.

## Required next evidence

- Firebase Auth export with SCRYPT parameters.
- Recursive Firestore export including subcollections and typed values.
- Deployed Rules export/hash.
- Preflight report classifying the extra account/profile document and wallet/order gaps.

These inputs must be captured without disabling Firebase. They remain the rollback source until cutover acceptance.
