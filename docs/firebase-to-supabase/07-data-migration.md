# 07 — Data migration and reconciliation

## Required inputs

1. Firebase Auth export plus password hash parameters.
2. Firestore recursive export from project `zytrix-ca4f2`.
3. No Firebase Storage manifest is currently required: the production console shows Storage was never activated. Recheck immediately before cutover in case this changes.
4. Deployed Rules and index configuration export.
5. Supabase staging connection with secrets available only to the migration process.

No machine-readable production export has been supplied yet. The Firebase Console verified 19 Auth users and 73 top-level Firestore documents, but importable payloads, subcollections and deterministic checksums remain **NOT VERIFIED** until the export pipeline runs.

## Console baseline before export

| Source | Count |
|---|---:|
| Firebase Auth | 19 |
| `admins` | 1 |
| `channels` | 5 |
| `featuredStreamers` | 4 |
| `profiles` | 20 |
| `streams` | 5 |
| `users` | 20 |
| `wallets` | 8 |
| `zyCoinOrders` | 10 |
| `zyCoinTransactions` | 0 |

Preflight must explicitly resolve the 20 profile/account documents versus 19 Auth identities. It must also preserve the 10 historical orders while marking that no corresponding top-level transaction ledger rows currently exist. Existing wallet balances therefore require opening-balance provenance; they cannot be claimed as ledger-reconciled history.

## Reproducible pipeline

```text
Firebase snapshot
  -> raw immutable export
  -> type/path inventory
  -> preflight validation
  -> Auth UUID mapping
  -> relational transform
  -> staging import transaction
  -> row/invariant reconciliation
  -> deterministic hashes
  -> signed migration report
```

## Pre-import validation

- Count Auth users and every collection/subcollection path.
- Record all observed field names and Firestore value types.
- Detect duplicate normalized usernames, channel slugs, creator codes and public Zytrix IDs.
- Detect orphan users, profiles, channels, streams, messages, follows, clips, wallets, transactions and reports.
- Detect non-UUID assumptions before resolving IDs.
- Verify wallet balance against ledger where enough ledger history exists; otherwise mark legacy opening balances explicitly.
- Flag invalid URLs, timestamps, negative counters, expired ephemeral rows and unsupported enum values.
- Produce a fatal/non-fatal decision for every anomaly.

## Transform rules

| Firestore value | PostgreSQL |
|---|---|
| Timestamp | UTC `TIMESTAMPTZ` |
| DocumentReference | resolved UUID/text FK |
| duplicated following/follower docs | one `follows` row |
| poll `option0..3` + `count0..3` | `poll_options` rows |
| report key/rate documents | partial unique indexes + private rate row |
| chat/reaction rate documents | private rate rows; expired rows omitted |
| viewer heartbeats | only non-expired staging state; not durable history |
| map with stable schema | typed columns |
| unknown channel-private map | bounded private JSONB legacy payload |

## ID mapping

1. Import/create Supabase Auth user and obtain UUID.
2. Insert `private.firebase_user_map(firebase_uid, supabase_user_id, batch)`.
3. Resolve all user FKs through that map.
4. Preserve Firestore document IDs in `firebase_id` when they may appear in URLs, local storage, reports or audit records.
5. Fail the dependent row when a required mapping is missing; never generate an unrelated owner silently.

## Import ordering

1. Auth users and mapping.
2. Accounts, profiles, admins and wallets/opening balances.
3. Categories, channels and channel profiles.
4. Lives and schedules.
5. Follows, members and moderators.
6. Chat/settings/bans, polls/options/votes, viewer/watch data.
7. Rewards, promotions, orders, ledger, redemptions and support alerts.
8. Clips, reports, moderation and policy acceptances.
9. Deferred FK validation and sequence/state checks.

## Reconciliation

Counts alone are insufficient. The report must include:

- source count, transformed count, imported count, skipped count and reason per resource;
- referential invariant queries;
- wallet/ledger reconciliation;
- random and risk-weighted record samples;
- deterministic canonical JSON SHA-256 summaries for source and normalized output;
- documented expected differences (deduplicated follows, omitted expired ephemeral rows, normalized poll options);
- a zero-tolerance list for missing users, ownership, active money rows, open reports and policy acceptances.

## Storage migration

If Firebase Storage objects exist, export an object manifest containing path, owner inference, content type, byte size, generation and MD5/CRC where available. Upload to the mapped Supabase bucket/path, compare byte size and checksum, update relational references, and retain the Firebase object. Objects with unknown owners are quarantined, not published.
