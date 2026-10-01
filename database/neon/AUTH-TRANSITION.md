# Auth transition — 2026-10-01

## Staging implementation

Pinned managed Better Auth base: https://ep-ancient-recipe-b65mlsad.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth . Ed25519 JWT verification pins actual origin as issuer/audience, algorithm/JWKS, valid UUID subject, issued/expiry window and bounded lifetime. Every authenticated request also supplies X-Neon-Session; private.active_auth_session checks the matching subject/token, expiry and managed ban. Runtime cannot enumerate sessions, passwords or provider credentials.

Imported public.identities.id/Firebase UIDs/wallet refs are preserved. private.external_auth_identities uniquely maps managed subject/internal UUID. auth.link requires verified managed session and independent recent, verified Firebase Admin SDK proof; server derives the identity. Advisory locks, uniqueness and managed-ban recheck after proof prevent conflicting links. Never link by email. Signup email collisions require dual-proof enrollment instead of merging.

Native enrollment requires authoritative enabled staging governance, correct version values and explicit staging draft consent. Original login/register/recovery screens use managed signup/signin, email OTP and password reset requests. All private actions enforce authorization server-side; frontend UID/admin/balance values are not authority.

Logout revokes the matching managed session server-side before provider sign-out; a still-unexpired JWT then fails API/SSE. Deletion revokes all managed sessions/provider credentials, bans and anonymizes managed user, disables app account and preserves financial/security identity tombstones. Requires real session created within five minutes, not JWT refresh time. API reexecution after deletion is 401, while the transaction/service lifecycle is idempotent.

Single-flight browser JWT cache is scoped to subject/session/verification and expires before JWT; public listeners wait initial session and restart, private listeners/transport/cache are discarded on account switch. Cross-tab messages trigger refresh; expired/unauthorized transport stops. No private response caching.

## Evidence and limits

Three disposable managed staging signup/login sessions were exercised in real original-screen Edge E2E. Email verification was SIMULATED by setup on those test-only identities; no email inbox was faked. Admin role/wallet fixtures were DB-provisioned, while application operations ran as zytrix_staging_app. Actual HTTP tests deny mismatched sessions, banned users, other wallets/viewer rosters/private lives, and old JWT after real logout/deletion. Unit tests cover signature, issuer, audience, expiry, malformed/unlinked/conflicting/banned identities and adapter account switch/cache races.

Fixtures removed; final managed users/links = 0. No imported production account was linked or changed. Real Firebase dual-proof login, cross-tab switching with human identities, Google full flow and actual email OTP/reset delivery remain NOT VERIFIED. Provider reset/recovery session-revocation semantics must be confirmed with a controlled real email before certification; no bulk mail or production account changes.

## Passwords

No supported Neon managed API operation for securely importing Firebase modified-SCRYPT hashes was established in the reviewed documentation. Do not reconstruct passwords or write arbitrary managed password hashes. Use user-controlled verification/enrollment/reset and independent old-identity proof to preserve imported UUIDs. [Neon Auth API management](https://github.com/neondatabase/website/blob/main/content/docs/auth/guides/manage-auth-api.md); [Firebase hash export/import](https://firebase.google.com/docs/cli/auth).

## Exact Google failure and configuration

Rechecked real staging sign-in/social -> sign-in/social/init (302). Provider emits this exact redirect_uri:

https://neonauth.c-2.sa-east-1.aws.neon.tech/auth/oauth/callback/google

Google previously returned redirect_uri_mismatch. Current configured Google client is shared/owned by Neon, with no custom staging client secret available. Local code already uses authorized return callback **http://127.0.0.1:5502/login.html** and Neon trusted origin **http://127.0.0.1:5502**. These return URLs are different from Google's provider redirect URI. No repository edit can authorize the shared client's Google Cloud credentials.

USER ACTION REQUIRED: have Neon correct its shared regional Google client, or configure a separate custom staging Google client in the staging branch. Google Cloud authorized redirect: exact URI above. Neon OAuth return callback: http://127.0.0.1:5502/login.html . Do not change production OAuth. Hosted Vercel preview is not yet a certified Auth origin; obtain the actual preview URL and register that exact origin and /login.html return only in staging, as described in STAGING-READINESS.md.

Validation after provider correction: original Google button -> callback -> real managed session -> explicit independent old identity linking -> original profile -> logout -> old session rejected. [Neon add OAuth provider API](https://api-docs.neon.tech/reference/addbranchneonauthoauthprovider).

Firebase proof verification now explicitly checks revoked/disabled status (Admin SDK checkRevoked=true). Real imported linking requires authorized read-only Firebase Auth Admin credentials in staging; public JWT signature keys alone cannot certify revocation. No production Auth writes.

Authorized only staging Preview origin https://zytrix-web-git-feat-neon-postg-f6f98a-guilhermeaugusto2525-1431.vercel.app via Neon trusted-domain API; list/read-back confirmed it, and real sign-in/social accepted https://zytrix-web-git-feat-neon-postg-f6f98a-guilhermeaugusto2525-1431.vercel.app/login.html . Vercel hosted runtime flags are still disabled, so hosted Neon Auth remains unverified pending Preview-only configuration.
