# Password policy

New passwords must contain 8 through 128 JavaScript string code units, at least one Latin letter (including accented Latin letters), and at least one ASCII digit. Spaces and symbols are allowed but do not replace a letter or digit. Passwords are not trimmed or truncated.

`strongPassword()` is used by registration and recovery pages and the `authRequest()` adapter for `sign-up/email`, `reset-password`, `change-password`, and `set-password`. The registration and recovery inputs have matching length limits. There is no separate change-password form in this repository; callers using the adapter receive the same validation.

Sign-in and reauthentication do not apply the new-password policy. No users, hashes, sessions, or database records are migrated by this change.

## Backend review (2026-10-18)

The application's API authenticates Neon sessions and does not receive or store new passwords. Password writes go directly to managed Neon Auth. The active Auth URL in the repository CSP matches project `soft-water-98807259`, branch `br-dawn-flower-b62xw0gm` (`clean-neon-20261007`); the project's default branch has no Neon Auth enabled.

Read-only inspection of the active branch configuration and `/open-api/generate-schema` confirmed email/password authentication and the signup/reset/change routes. Neither response exposes minimum/maximum length or composition settings. No remote settings or account data were changed.

[Better Auth documents default limits of 8 and 128](https://better-auth.com/docs/authentication/email-password). These defaults are consistent with the application, but do not prove the deployed managed service's policy. The initial read-only inspection did not establish the effective provider policy. See the live signup check below. The browser adapter is not a server-side security boundary: direct requests to the public Auth URL can bypass it. Full enforcement requires a supported Neon password-policy setting or provider-side hook; the connected management tool does not expose either. Do not claim server-side composition enforcement based on these client tests or introduce a replacement auth server as part of this small change.

## Validation

Automated tests cover 7, 8, 9, 10, 128, and 129 characters; letter/digit combinations; letters only; digits only; symbols only; accented letters; unchanged forwarding of current passwords; invalid writes rejected before network access; registration/reset input limits; and policy error messages. Adapter tests mock the provider and do not establish live signup/reset/change success. No live password was changed for testing.

## Live signup check (2026-10-18)

The user's browser showed an existing `teste` branch (`br-sparkling-math-b6fz3kyb`), derived from `clean-neon-20261007`, with Auth URL `https://ep-delicate-heart-b6qk9y0q.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth`. Both branches' Console settings expose no password length or composition control.

Direct HTTPS POST requests to the test branch's `/sign-up/email` endpoint, using generated `example.invalid` addresses and Origin `http://localhost:5502`, produced:

| Input | HTTP | Result |
| --- | --- | --- |
| `Abc1234` (7) | 400 | `PASSWORD_TOO_SHORT` |
| `Abcd1234` (8) | 200 | User created |
| `Abcde1234` (9) | 200 | User created |
| `Abcdef1234` (10) | 200 | User created |
| `abcdefgh` | 200 | User created: missing digit accepted |
| `12345678` | 200 | User created: missing letter accepted |
| 127 letters + 1 digit (128) | 200 | User created |
| 128 letters + 1 digit (129) | 400 | `PASSWORD_TOO_LONG` |

This confirms signup length enforcement on the test branch and demonstrates that server-side composition enforcement is absent there. It does not establish active-branch behavior or successful reset/change flows. The PR remains draft because the requested provider-side composition rule is not satisfied. No auth settings or existing credentials were changed.

All six newly created test users were removed after explicit user approval. Neon management API deletion failed because of application foreign keys; a transaction removed only the six exact UUIDs matched to this run's email prefix, their zero-balance wallets and associated identities, then Auth users and cascading account records. Cleanup was verified with zero matching test users and the original single user remaining.
