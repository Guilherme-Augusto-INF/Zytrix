# 08 — Auth migration

## Current flows

- Email/password registration and login.
- Google popup login.
- Email verification.
- Password reset email.
- Session observer and logout.
- Profile/channel provisioning in browser code.
- Account deletion after recent-login reauthentication.

## Verified production identity baseline

- 19 Firebase Auth users.
- 16 email/password-only identities.
- 2 Google-only identities.
- 1 identity with linked Google and email/password providers.
- Email/password and Google are the only enabled sign-in methods.
- Firestore contains 20 `users` and 20 `profiles` documents, so identity-map preflight must classify at least one orphan/legacy document before import.

## Supported migration strategy

Supabase's current official Firebase Auth guide provides tools to export Firebase users and import them into Supabase Auth. It requires the Firebase service account and Firebase SCRYPT parameters: signer key, salt separator, rounds and memory cost. This is the preferred path because it can preserve password sign-in without collecting plaintext passwords.

If production conditions prevent a supported transparent import, use a rolling login transition or forced password reset. Never collect, log or store plaintext passwords.

## UID strategy

Firebase UIDs are arbitrary strings; Supabase Auth user IDs are UUIDs. Therefore:

- create a Supabase UUID for each imported identity;
- store the immutable relation in `private.firebase_user_map`;
- preserve Firebase UID only as migration metadata;
- migrate every domain FK through the map;
- preserve `zytrix_id` as the public product identifier.

## Google OAuth

Before staging tests:

1. Configure the Supabase callback URL in the Google OAuth client.
2. Add localhost, preview and production redirect allowlists.
3. Verify automatic/explicit account linking behavior for an existing verified email.
4. Test Google-only user, password-only user, same verified email, changed email, revoked consent and cancelled popup.
5. Verify no duplicate `user_accounts`, profiles, channels or wallets are provisioned.

## Provisioning

An `auth.users` insert trigger creates a minimal account, unique fallback username, wallet and preferences. Import tooling then replaces fallback data with migrated values. Authorization never trusts user-editable metadata.

## Required Auth tests

- sign up, email verification and duplicate email;
- password login and bad password;
- Google new/existing/conflicting provider;
- refresh token/session restoration;
- password reset callback;
- logout and token expiry;
- deleted user and stale token behavior;
- account deletion with reauthentication;
- imported SCRYPT user login sample;
- Firebase/Supabase identity-map completeness.

## Cutover caveat

Existing Firebase browser sessions are not Supabase sessions. Users should be expected to authenticate again unless a separately reviewed, time-limited token exchange is implemented. No silent token conversion is assumed.
