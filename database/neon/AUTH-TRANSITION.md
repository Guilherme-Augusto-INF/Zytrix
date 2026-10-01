# Neon Auth transition — 2026-10-01

Neon Auth is implemented for the isolated staging path; real enrollment is not certified. Read-only database counts: **0 managed users, 0 Neon links**, with 22 preserved internal identities. No production account, password, OAuth setting or authentication domain was changed.

## Actual staging configuration

Project soft-water-98807259, branch br-wispy-scene-b6325si6, database neondb.

- Provider: Better Auth.
- Base: https://ep-ancient-recipe-b65mlsad.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth
- JWKS: base plus /.well-known/jwks.json.
- Expected JWT issuer/audience: https://ep-ancient-recipe-b65mlsad.neonauth.c-2.sa-east-1.aws.neon.tech (the origin, not the full base path).
- Actual configuration uses EdDSA/Ed25519 and a default 900-second token lifetime. The server pins this service and checks signature, algorithm/key, issuer, audience, exp/iat/nbf; unavailable JWKS fails closed.
- Email/password and shared OTP email delivery are configured; application writes/enrollment require verified contact independently of the provider's optional verification flags.
- localhost is allowed. Added trusted origin http://127.0.0.1:5502 only on this staging branch after an observed INVALID_CALLBACKURL.

Enable the original-screen staging path with ZYTRIX_POSTGRES_STAGING=true, the pinned restricted-role database connection, ZYTRIX_AUTH_PROVIDER=neon and the exact ZYTRIX_NEON_AUTH_URL above. Config errors do not fall back to production Firebase. The local staging-preview script configures these non-secret flags and requires a private runtime connection file.

## Preserved identities and linking

public.identities.id, Firebase UIDs, profiles and wallet/ledger references remain unchanged. private.external_auth_identities maps the verified Neon subject to the internal UUID; unique constraints protect subject and account ownership. Migration 009 grants runtime SELECT/INSERT on this map and SELECT only on the necessary Auth user/account columns. Runtime cannot read managed passwords or provider tokens.

auth.link requires a verified Neon JWT plus an independently signature-verified Firebase token with verified email and recent auth_time (at most five minutes, no future time beyond clock tolerance). The server derives both identities. Subject/account advisory locks and unique constraints prevent conflicting links. Matching emails never authorize linking; an email collision during signup instead requires dual-proof enrollment. Disabled/banned application or Neon accounts are refused. No bulk linking occurred.

The original login/registration/reset pages use managed sign-in, signup, email OTP, reset and logout. Enrollment supplies a legacy password proof directly to Firebase's existing Identity Toolkit endpoint or a Google proof using only Firebase App/Auth with in-memory persistence. It never loads Firestore or stores the previous password; the form clears it after submission. New profiles require explicit registration with authoritative current policy versions. The governance row is absent, and source governance/config returned 404, so new-profile registration/reports remain gated. No policy release or consent was fabricated.

Session replacement waits out an older refresh, tokens are checked against the visible account to prevent mixed-account UI, account changes broadcast across tabs, and private subscriptions cancel on identity change. API/SSE responses use no-store. The server repeats ownership/admin/disabled checks; browser claims never authorize roles or money. These controls have unit/restricted-role coverage, but real managed login/reset/logout/account switch and dual-proof linking still need authenticated browser verification.

## Passwords and Google

The reviewed Neon Auth API documentation does not establish a supported Firebase modified-SCRYPT hash import operation. No password hashes were exported, reconstructed or imported. Use user-controlled managed enrollment/verification/reset, proving the previous identity when linking is required. Do not send mass enrollment mail or modify production accounts.

Google smoke reached the provider after the local callback origin was authorized. Google's configured shared client rejected the regional callback with **redirect_uri_mismatch**:
https://neonauth.c-2.sa-east-1.aws.neon.tech/auth/oauth/callback/google

The shared client credentials are owned by the provider and no usable custom staging OAuth secret is available here. A working staging-only provider configuration or correction of the shared provider is required. Callback → session → linking → return → logout remains BLOCKED, with zero completed accounts/links.

Account deletion also remains unavailable in the Neon implementation; it must preserve financial integrity and use a complete self-service managed Auth/session lifecycle. Its legacy destructive path is blocked in staging.

## Reversal

Disable staging flags/stop the preview if validation fails. Preserve additive migrations, identity links and ledger evidence. Revert the application revision on the migration branch after review; no production switch or account deletion is authorized. A future production cutover requires all preservation/recovery gates in CUTOVER-ROLLBACK.md.

References: [Neon authentication flow](https://neon.com/docs/auth/authentication-flow), [Neon Auth overview](https://neon.com/docs/auth/overview), [Firebase password export format](https://firebase.google.com/docs/cli/auth).
