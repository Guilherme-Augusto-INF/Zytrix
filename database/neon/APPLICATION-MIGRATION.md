# Application migration to staging

Database snapshot import is complete. Application cutover is NOT complete.
The original 38 frontend modules still use the Firestore abstraction; the new
API is deliberately not substituted globally until all operations are covered.

## Implemented, isolated behind ZYTRIX_POSTGRES_STAGING

- Firebase ID token signature, expiry, issuer and audience verification using Admin SDK.
- Fixed staging endpoint and dedicated runtime role; production deployment disabled.
- Own account, public profile, profile editing with server-side seven-day username cooldown and own wallet reads/zero-wallet creation.
- Explicit, verified owner-only `profile.recover` creates a new chosen profile **only** when none exists; no synthetic history and no automatic account login writes. It requires the additional staging-only column grant in `005_staging_profile_recovery_grant.sql` before executing its integration fixture.
- Live read/start/end, channel ownership checks and unique viewer heartbeat/leave.
- Own channel creation/editing and idempotent live creation with approved streaming
  providers. Private streams are excluded from the public feed and other accounts.
- Isolated `staging.html` application for profile/preferences, wallet/history, channel,
  live creation/start/end, embedded player, chat/delete, follows and support transfers.
  This entry point does not import Firestore; original pages remain separate.
- Profile renames preserve the existing seven-day cooldown, including a locked row check.
- Follow/unfollow, preferences, notification read marker, own transaction history.
- Chat listing/sending/deletion, idempotency, rate limits, follower/member modes,
  moderator permissions, bans, pinned message, restricted reactions.
- Support transfer with deterministic wallet lock order, insufficient-funds protection,
  parameterized SQL, atomic ledger/alert writes and idempotent retries.
- Private staging role with table/column grants, never migration-owner credentials.
- Anonymous read-only `live.feed` action uses `public.live_feed` view; rejects arbitrary filters and excludes hidden/non-public lives at the SQL view.
- Home, Ao Vivo, Categoria and Explorar public feed readers are conditionally migrated via the shared `watchPublicLiveFeed` adapter. They query `/api/v1/config` first: staging=true reads only PostgreSQL (polling every 15s); staging=false keeps existing Firestore subscriptions. On staging API errors they fail closed without silently mixing databases. Home and Explorar following/history now use discovery.context in staging. Shared preferences and followed-category helpers also select PostgreSQL in staging and never fall back to Firebase on API errors.
- The local isolated staging validation page now tests the PostgreSQL public feed anonymously.
- Integration fixtures always rolled back. Fifteen scenario groups passed with the
  restricted runtime role, including creator, recovery, public-feed and permission scenarios.
  Real browser sign-in verification remains pending.
  The user reported successful sign-in in an external Chrome/Edge browser on
  2026-09-25; that browser is not attached to the agent, so this is not recorded
  as an independently verified end-to-end test.

## Not yet migrated

- Remaining frontend document/query/subscription and transaction contracts across the original 38 modules; four public listing screens now have staging-only feed adapters.
- Account bootstrap/deletion. Missing profile recovery is explicit and opt-in through the isolated validation page; never automatically recreate profiles on login.
- Advanced channel/live settings, schedules, channel bios/social links, creator codes,
  channel membership and moderator management.
- Watch progress/achievements, attribution, full notifications.
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
Open `/staging.html` for the interactive staging application; its mutations affect
staging. Both pages retain Firebase Auth for existing accounts. Original application
routes are deliberately not served by this local preview.

Apply `006_staging_creator_grants.sql` only through a connection validated against
the fixed staging endpoint. It adds the minimal category read and channel/live
creation permissions used by the interactive preview. Applied on 2026-09-25.

Run `node --test tests/platform-service.test.mjs` for local permission boundary tests.
Run the explicit `scripts/firebase-to-neon/test-platform-staging.mjs` command with
private connection/report paths and `--runtime-role` for rolled-back database tests.
The owner needs membership in the restricted role solely to exercise SET LOCAL ROLE
inside the fixture transaction; the runtime role never inherits the owner.

Firebase token verification reference: https://firebase.google.com/docs/auth/admin/verify-id-tokens

Explorar stage mode uses Neon only for its **public live feed**. Clips and schedules still use Firestore until their backend endpoints are migrated. Personalization now has an authenticated staging API. This separation is intentional and must be addressed before production cutover.

The isolated `staging-validation.html` offers optional profile recovery **only** after a real authenticated read detects an account without a profile and Firebase reports a verified email. Submission requires an explicit checkbox; ordinary login and verification remain read-only. The `005_staging_profile_recovery_grant.sql` permissions were independently exercised successfully by the combined staging integration test on 2026-09-25. Recovery uses an advisory lock and does not require UPDATE permission on identities. This staging-only form must not be used for production recovery until full cutover.

## Personalization checkpoint (2026-09-25)

Preferences read/write/listeners, category following and Home/Explorar discovery context now use PostgreSQL when staging is enabled. The isolated application also has categories and history screens. History excludes deleted and newly private streams, and never accepts a client-selected account. A shared backend selector caches configuration, fails closed and suppresses callbacks after unsubscribe. Production keeps the existing Firebase path.

007_staging_personalization_grants.sql was applied only to staging. Fifteen rolled-back database scenarios and 40 application tests passed. Post-test reconciliation of the imported snapshot passed. Category following accepts only existing active catalog entries. No progress rewards or monetary history were fabricated. Remaining original pages still need full migration; this is not authorization for production cutover.
