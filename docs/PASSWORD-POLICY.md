# Password policy

New passwords must contain 8 through 128 JavaScript string code units, at least one Latin letter (including accented Latin letters), and at least one ASCII digit. Spaces and symbols are allowed but do not replace a letter or digit. Passwords are not trimmed or truncated.

`strongPassword()` is used by registration and recovery pages and the `authRequest()` adapter for `sign-up/email`, `reset-password`, `change-password`, and `set-password`. The registration and recovery inputs have matching length limits. There is no separate change-password form in this repository; callers using the adapter receive the same validation.

Sign-in and reauthentication do not apply the new-password policy. No users, hashes, sessions, or database records are migrated by this change.

## Backend review (2026-10-18)

The application's API authenticates Neon sessions and does not receive or store new passwords. Password writes go directly to managed Neon Auth. The active Auth URL in the repository CSP matches project `soft-water-98807259`, branch `br-dawn-flower-b62xw0gm` (`clean-neon-20261007`); the project's default branch has no Neon Auth enabled.

Read-only inspection of the active branch configuration and `/open-api/generate-schema` confirmed email/password authentication and the signup/reset/change routes. Neither response exposes minimum/maximum length or composition settings. No remote settings or account data were changed.

[Better Auth documents default limits of 8 and 128](https://better-auth.com/docs/authentication/email-password). These defaults are consistent with the application, but do not prove the deployed managed service's policy. Acceptance at Neon and server-side composition enforcement remain unverified. The browser adapter is not a server-side security boundary: direct requests to the public Auth URL can bypass it. Full enforcement requires a supported Neon password-policy setting or provider-side hook; the connected management tool does not expose either. Do not claim server-side composition enforcement based on these client tests or introduce a replacement auth server as part of this small change.

## Validation

Automated tests cover 7, 8, 9, 10, 128, and 129 characters; letter/digit combinations; letters only; digits only; symbols only; accented letters; unchanged forwarding of current passwords; invalid writes rejected before network access; registration/reset input limits; and policy error messages. Adapter tests mock the provider and do not establish live signup/reset/change success. No live password was changed for testing.
