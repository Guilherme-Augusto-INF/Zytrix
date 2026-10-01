# Auth transition — 2026-10-01

## Staging implementation

Pinned managed Better Auth base: https://ep-ancient-recipe-b65mlsad.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth . Ed25519 JWT verification pins actual origin as issuer/audience, algorithm/JWKS, valid UUID subject, issued/expiry window and bounded lifetime. Every authenticated request also supplies X-Neon-Session; private.active_auth_session checks the matching subject/token, expiry and managed ban. Runtime cannot enumerate sessions, passwords or provider credentials.

Imported public.identities.id/Firebase UIDs/wallet refs are preserved. private.external_auth_identities uniquely maps managed subject/internal UUID. auth.link requires verified managed session and independent recent, verified Firebase Admin SDK proof; server derives the identity. Advisory locks, uniqueness and managed-ban recheck after proof prevent conflicting links. Never link by email. Signup email collisions require dual-proof enrollment instead of merging.

Native enrollment requires authoritative enabled staging governance, correct version values and explicit staging draft consent. Original login/register/recovery screens use managed signup/signin, email OTP and password reset requests. All private actions enforce authorization server-side; frontend UID/admin/balance values are not authority.

Logout revokes the matching managed session server-side before provider sign-out; a still-unexpired JWT then fails API/SSE. Deletion revokes all managed sessions/provider credentials, bans and anonymizes managed user, disables app account and preserves financial/security identity tombstones. Requires real session created within five minutes, not JWT refresh time. API reexecution after deletion is 401, while the transaction/service lifecycle is idempotent.

Single-flight browser JWT cache is scoped to subject/session/verification and expires before JWT; public listeners wait initial session and restart, private listeners/transport/cache are discarded on account switch. Cross-tab messages trigger refresh; expired/unauthorized transport stops. No private response caching.

## Evidence and limits

Three disposable managed staging signup/login sessions were exercised in real original-screen Edge E2E. Email verification was SIMULATED by setup on those test-only identities; no email inbox was faked. Admin role/wallet fixtures were DB-provisioned, while application operations ran as zytrix_staging_app. Actual HTTP tests deny mismatched sessions, banned users, other wallets/viewer rosters/private lives, and old JWT after real logout/deletion. Unit tests cover signature, issuer, audience, expiry, malformed/unlinked/conflicting/banned identities and adapter account switch/cache races.

Previous mission cleanup restored managed users/links = 0 at that time; this is historical, not the current count. No imported production account was linked or changed. Real Firebase dual-proof login, cross-tab switching with human identities, Google full flow and actual email OTP/reset delivery remain NOT VERIFIED. Provider reset/recovery session-revocation semantics must be confirmed with a controlled real email before certification; no bulk mail or production account changes.

## Passwords

No supported Neon managed API operation for securely importing Firebase modified-SCRYPT hashes was established in the reviewed documentation. Do not reconstruct passwords or write arbitrary managed password hashes. Use user-controlled verification/enrollment/reset and independent old-identity proof to preserve imported UUIDs. [Neon Auth API management](https://github.com/neondatabase/website/blob/main/content/docs/auth/guides/manage-auth-api.md); [Firebase hash export/import](https://firebase.google.com/docs/cli/auth).

## Current staging authentication diagnosis — 2026-10-01

Scope: project soft-water-98807259, branch staging / br-wispy-scene-b6325si6, neondb. Read current config through the Neon connector; no Auth/SMTP/OAuth configuration was changed. Production and the shared Google provider were not modified or deleted.

### Google OAuth

Actual POST sign-in/social -> sign-in/social/init returned a Google authorization request with:

- Client ID: 516759701042-1j43chkqtgl8hf49j0cql8gf34sun3e9.apps.googleusercontent.com (Neon shared client; public identifier).
- redirect_uri: https://neonauth.c-2.sa-east-1.aws.neon.tech/auth/oauth/callback/google
- Configured Google provider: shared; custom client_id/client_secret absent. The user's separate Zytrix Staging client is not active here.
- Application return / error callback: https://zytrix-web-git-feat-neon-postg-f6f98a-guilhermeaugusto2525-1431.vercel.app/login.html
- That Preview origin and http://127.0.0.1:5502 are already trusted by staging Auth. The provider redirect URI is separate from the application return URL.

The observed redirect_uri_mismatch belongs to Neon's shared Google client. Registering a URI in the user's separate Google client cannot fix a request that still uses the shared Client ID. No frontend change can authorize a redirect for Neon's Google Cloud client. Custom credentials are officially supported by updating the existing Google provider; its deletion is unnecessary.

USER ACTION REQUIRED: sign in to https://console.neon.tech/app/projects/soft-water-98807259 and select staging (br-wispy-scene-b6325si6). Open Settings -> Auth / OAuth providers -> Google -> Configure. Use Custom credentials for the existing provider, entering the Zytrix Staging Client ID and Client Secret privately. The console session and custom credentials were unavailable during this mission; never paste the secret into chat, frontend, Git or this document.

For the custom provider, the current official guide specifies the branch callback below. In Google Cloud -> APIs & Services -> Credentials -> Zytrix Staging, add this Authorized redirect URI:

https://ep-ancient-recipe-b65mlsad.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth/callback/google

Use the exact callback shown by Neon Configure if it differs; the custom provider's actual emitted redirect has NOT yet been observed. Do not treat the shared regional callback as proof of the future custom callback. Authorized JavaScript origin for the app, if requested:

https://zytrix-web-git-feat-neon-postg-f6f98a-guilhermeaugusto2525-1431.vercel.app

Do not change the production OAuth client or Vercel variables. After saving, capture only the public client_id and redirect_uri from the new Google request and confirm both match this custom client's authorized configuration; then complete Google -> managed session -> original screen -> logout. Imported account linking additionally requires independent Firebase proof, not email equality.

If Google Configure cannot switch credentials, the following support request is prepared (NOT sent): "Neon Auth staging Google Shared keys produces redirect_uri_mismatch. Project soft-water-98807259; branch br-wispy-scene-b6325si6; DB neondb; auth base https://ep-ancient-recipe-b65mlsad.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth. On 2026-10-01, sign-in/social/init emitted client_id 516759701042-1j43chkqtgl8hf49j0cql8gf34sun3e9.apps.googleusercontent.com and redirect_uri https://neonauth.c-2.sa-east-1.aws.neon.tech/auth/oauth/callback/google. Please fix the shared regional client's authorized redirect or enable updating the existing staging Google provider with custom credentials and confirm the callback. No provider deletion/production change requested." No cookies, state, OTPs, tokens or secrets belong in that request.

[Official Google OAuth setup](https://neon.com/docs/auth/guides/setup-oauth).

### Signup / verification / delivery

Live config: email/password and signup enabled; require_email_verification=true, verify_email_on_sign_up=false, verify_email_on_sign_in=false, method=otp, auto_sign_in_after_verification=true. SMTP is shared, sender auth@mail.myneon.app / Neon Auth. Signup of one disposable unverified fixture returned HTTP 200 with a user but no token/session; password sign-in returned 403 EMAIL_NOT_VERIFIED. This is successful account creation, not failed signup.

Root cause in the app: the signup adapter discarded this pending user after refreshing a nonexistent session. sendEmailVerification then dereferenced null, failing BEFORE an explicit OTP request. The generic catch obscured that cause. The automatic signup-email flag was also off; showing the OTP field did not prove an email had been requested.

Commit 2c260f5 preserves a pending verification object separately from auth.currentUser (no token or session), explicitly requests an OTP, and permits enrollment only after verified authentication. Errors distinguish signup, send, verify, login and recovery; reset no longer swallows provider failures and reports false success. Verification without auto-sign-in requests password login instead of redirecting null. Account-change guards prevent finishing the wrong account, while explicit login to another account clears the prior verification UI. Public messages omit provider diagnostic payloads. OTP resend waits at least 60 seconds, prevents concurrent clicks and respects a bounded provider Retry-After up to one hour. This client cooldown is UX protection, not a server-side rate-limit guarantee; refreshing the page cannot replace the provider's enforcement.

One explicit OTP request from the original screen to the real provider was accepted for an example.invalid disposable fixture; the resend button disabled. This proves request acceptance ONLY. It does not prove delivery, inbox ownership or successful verification. No real recipient was supplied, no inbox was available, and no delivery/quota telemetry was exposed by the connector. Shared SMTP has sending limits, but no numeric quota or quota exhaustion was verified. Neither a service delivery failure nor delivery success is claimed. Verification remains required; no security bypass was installed.

USER ACTION REQUIRED: provide one authorized staging test mailbox with inbox access (address only, no password), or use the original Preview login page yourself. Enter existing credentials -> EMAIL_NOT_VERIFIED -> Solicitar código once -> check inbox/spam -> enter the received code -> verified session -> explicit enrollment/dual-proof linking as appropriate. Wait for the resend countdown before another request. For a new account, signup now requests the code explicitly. In Neon staging Settings -> Auth, retain verification required and OTP. If enabling automatic Verify at Sign-up later, align the app's explicit send to avoid two requests. If accepted requests do not arrive, record the time and safe error/status, then ask Neon support to check shared SMTP delivery/quota for this branch; configure existing authorized custom SMTP privately only if available. Never disable verification or send bulk messages as a workaround.

Password recovery uses request-password-reset with the exact original return URL https://zytrix-web-git-feat-neon-postg-f6f98a-guilhermeaugusto2525-1431.vercel.app/recuperar-senha.html and reset-password with the delivered token. Actual inbox delivery, token completion and recovery session-revocation behavior remain NOT VERIFIED. The official checklist permits shared SMTP for OTP and password reset, while verification links require custom SMTP. [Email verification](https://neon.com/docs/auth/guides/email-verification), [SMTP requirements](https://neon.com/docs/auth/production-checklist#email-provider), [password reset](https://neon.com/docs/auth/guides/password-reset).

### Initialization security and tests

The hosted smoke additionally reproduced native form submission before async backend imports finished: the default GET form put a disposable fixture password in the URL. Commit 06a0176 sets original auth forms to POST and disables submit/Google controls in HTML until handlers are installed; startup failures remain disabled. Logout similarly waits for its handler. No human password was used in the test. Only disposable fixtures are removed by guarded staging cleanup; real user accounts remain untouched.

Final application suite after both corrections: 78/78 PASS; check PASS; migration 9/9 PASS. Auth/token/link tests: 21/21 PASS. Restricted integration: 29 groups PASS with SET LOCAL ROLE zytrix_staging_app after owner-only fixture setup, all rolled back. An initial attempt to seed using runtime credentials correctly failed permission denied on categories; no privileges were widened. Real HTTP checks: 4 PASS (restricted runtime, signed JWT/matching session accepted, wrong session rejected, logout rejects old JWT/session). Additional initialization correction: 18 focused tests PASS and check PASS.

Original local and hosted Preview screens tested real password login, unverified-account message, invalid OTP rejection, switching from pending to verified fixture, and logout. Fixture email verification was explicitly SIMULATED during setup; real managed sessions/API calls were not simulated. Custom Google login, real OTP inbox delivery/successful verification, real reset completion and authorized Firebase dual-proof linking remain external gates. ID preservation, Ed25519 signature/issuer/audience/expiry checks and server-side revocation were retained.


Final guarded Preview: 06a0176be7b7c786819969dd957ce74cd855a802, deployment dpl_CnsFx7qQMBpHAtQqxFdaaQos6sKF, READY. Immediate original-screen submission waits for installed handlers and keeps passwords out of the URL; pending verification, explicit account switch and original logout passed there. Sampled 5xx runtime-log aggregate for this deployment was empty; this is not a universal error-free claim. Removed both disposable fixtures transactionally; retained 22 internal identities, 8 wallets, 1 real managed user and 0 Neon links. No real user's account/data was deleted or verified by the agent.
