# 02 — Firebase Rules analysis

## Method

The 4,293-line Rules file was treated as an authorization specification, not as SQL source. Its behaviors were decomposed into identity, roles, ownership, relationships, visibility, permissions, validation and invariants. Existing emulator tests remain the behavioral baseline and must be ported to database authorization tests.

## Identity and authentication

- `loggedIn`: an authenticated principal exists.
- `verifiedUser`: authenticated and email verified.
- Password and Google provider values in `users/{uid}` must agree with the trusted token.
- Client-chosen `uid`, sender, owner and reporter fields are always compared with the authenticated UID.
- Supabase target: `auth.uid()`, `auth.jwt()` only for trusted Auth claims, FK ownership and controlled RPCs.
- User-controlled `raw_user_meta_data` is never an authorization source.

## Roles

- Admin is sourced from `admins/{uid}.active`, not from a writable profile field.
- Live moderator is an explicit relationship under a live.
- Channel/live ownership is derived from immutable foreign keys.
- Supabase target: `admins`, `live_moderators`, `channels.owner_id`, `lives.owner_id`; private `SECURITY DEFINER` lookup helpers with fixed `search_path` and restricted execution.

## Ownership and relationships

- Profile/user/wallet ownership follows Auth UID.
- Firebase duplicates follow relationships in two subcollections and requires an atomic batch.
- PostgreSQL target uses one `follows(follower_id, channel_id)` row with a composite PK.
- Poll vote uniqueness, promotion claims and report deduplication become database unique constraints/partial indexes.

## Visibility

- Public: profiles, channels, lives, chat, clips, schedules, rewards, categories and featured streamers.
- Participant/private: accounts, wallets, transactions, notification state, preferences, progress, memberships and bans.
- Administrative: reports queue, moderation actions/audit and global audit log.
- Ephemeral: viewer presence, reactions, support alerts and rate-limit state.

## Validation moved to the correct layer

| Current Rules behavior | Supabase enforcement |
|---|---|
| Required shape and primitive type | typed columns, `NOT NULL`, `CHECK` |
| Parent/target existence | FK |
| One follow/vote/claim | PK/`UNIQUE` |
| Username uniqueness/cooldown | unique generated key + locked RPC |
| Sender/owner/reporter identity | `auth.uid()` inside RLS/RPC |
| Immutable admin source | no client write grant; backend/admin operation only |
| Live state transitions | transactional RPC |
| Slow mode and reaction limits | private rate rows updated atomically by RPC |
| Wallet debit/credit/ledger | one PostgreSQL transaction inside RPC |
| Report rate/deduplication | private rate row + partial unique indexes |
| Policy version acceptance | composite PK + active version validation |
| File ownership | Storage path policy plus bucket restrictions |

## High-risk knowledge retained from Rules

1. A user cannot mint or directly update Zy Coins.
2. Support/reward transfers must update sender, recipient and immutable ledger atomically.
3. Admins cannot be enumerated by normal users.
4. Stream owners/moderators cannot punish a global admin; non-admin moderators cannot punish the stream owner.
5. Chat rate state must participate in the same atomic operation as message creation.
6. Poll count and unique vote must update atomically.
7. A report requires rate-limit and duplicate protection and remains private.
8. Report closure requires an immutable audit record in the same transaction.
9. Policy acceptance is immutable and versioned.
10. Public URLs are constrained to approved protocols/providers.
11. Viewer presence is private, expiring state; it is not a client-controlled durable counter.
12. Client updates must not change owner IDs, role/admin flags, timestamps or balances.

## Known weaknesses in the current implementation

- Some financially privileged Firestore batches are assembled in untrusted browser code. Rules validate the batch, but complexity is high and difficult to evolve safely.
- The payment page contains an `admin_demo` path and is explicitly not a production payment pipeline.
- Username is not globally unique in current Rules.
- `profiles` are publicly readable without an explicit deleted/visibility model.
- `viewerCount` is stored on the stream but client updates are blocked; actual displayed presence is separately counted from viewer documents.
- Public chat reads have no server-side pagination contract beyond client query limits.
- Duplicate follow documents can diverge if a partial client batch fails outside the expected path.
- There is no server-side media pipeline for clips or uploads.

## Regression requirement

Every existing Firebase Rules test is classified as one of:

- direct RLS parity;
- constraint/FK parity;
- controlled RPC parity;
- Realtime/Storage policy parity;
- intentionally changed behavior with documented rationale.

Critical deny cases may not be removed merely because PostgreSQL uses a different implementation.

