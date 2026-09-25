# Application migration to staging

Database snapshot import is complete. Application cutover is NOT complete.
The original 38 frontend modules still use the Firestore abstraction; the new
API is deliberately not substituted globally until all operations are covered.

## Implemented, isolated behind ZYTRIX_POSTGRES_STAGING

- Firebase ID token signature, expiry, issuer and audience verification using Admin SDK.
- Fixed staging endpoint and dedicated runtime role; production deployment disabled.
- Own account, public profile, profile editing and own wallet reads/zero-wallet creation.
- Live read/start/end, channel ownership checks and unique viewer heartbeat/leave.
- Follow/unfollow, preferences, notification read marker, own transaction history.
- Chat listing/sending/deletion, idempotency, rate limits, follower/member modes,
  moderator permissions, bans, pinned message, restricted reactions.
- Support transfer with deterministic wallet lock order, insufficient-funds protection,
  parameterized SQL, atomic ledger/alert writes and idempotent retries.
- Private staging role with table/column grants, never migration-owner credentials.
- Anonymous read-only `live.feed` action uses `public.live_feed` view; rejects arbitrary filters and excludes hidden/non-public lives at the SQL view.
- Home, Ao Vivo, Categoria and Explorar public feed readers are conditionally migrated via the shared `watchPublicLiveFeed` adapter. They query `/api/v1/config` first: staging=true reads only PostgreSQL (polling every 15s); staging=false keeps existing Firestore subscriptions. On staging API errors they fail closed without silently mixing databases. Personalization/followed categories in those screens still use Firebase.
- The local isolated staging validation page now tests the PostgreSQL public feed anonymously.
- Integration fixtures always rolled back. Eight scenario groups passed with the
  restricted runtime role. Real browser sign-in verification remains pending.

## Not yet migrated

- Remaining frontend document/query/subscription and transaction contracts across all 38 modules; 4 public live listing screens now have a staging-only read adapter (NOT a full cutover).
- Account bootstrap/deletion and profile recovery flow; never automatically recreate
  the manually deleted profile or write Firebase production accounts from staging tests.
- Channel/live creation and settings, schedules, channel bios/social links, creator codes,
  channel membership and moderator management.
- Watch progress/achievements, followed categories, attribution, full notifications.
- Enquetes/predictions, clips/VOD, reward redemption and fulfillment.
- Promotions/claims, order/payment workflows and administrative credit adjustments.
- Reporting/governance/policy acceptance/global moderation/admin screens and audit trail.
- Complete API permission coverage, pagination and subscription replacement/load tests.
- Storage audit, updated source export and final reconciliation before any cutover.

No production merge/deploy/cutover is authorized by this staging work. Firebase Auth
is retained; credentials remain in local private files outside the checkout.

## Local isolated validation

Set ZYTRIX_STAGING_DATABASE_URL_FILE to the private runtime connection file, then
run `node scripts/staging-preview.mjs`. It binds only to 127.0.0.1:5502 and serves
the dedicated validation page and assets, not the original application or private files.
The page does not load the Firestore SDK. It now checks the public PostgreSQL live feed too, plus existing-account sign-in and
read-only account/wallet checks. It does not register or delete Firebase accounts.

Run `node --test tests/platform-service.test.mjs` for local permission boundary tests.
Run the explicit `scripts/firebase-to-neon/test-platform-staging.mjs` command with
private connection/report paths and `--runtime-role` for rolled-back database tests.
The owner needs membership in the restricted role solely to exercise SET LOCAL ROLE
inside the fixture transaction; the runtime role never inherits the owner.

Firebase token verification reference: https://firebase.google.com/docs/auth/admin/verify-id-tokens

Explorar stage mode uses Neon only for its **public live feed**. User personalization, clips and schedules are still Firestore until their respective backend endpoints are migrated. This separation is intentional and must be addressed before production cutover.
