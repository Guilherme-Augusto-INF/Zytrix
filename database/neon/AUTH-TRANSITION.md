# Firebase Authentication → Neon Auth: staging preparation

Status on 2026-09-26: Neon Auth is provisioned on staging only. Its JWKS endpoint responds successfully. Existing accounts still authenticate through Firebase. No password, provider, email verification state, or Firebase account has been changed. There are no completed account links yet.

## Account preservation

Keep `public.identities.id` and all dependent PostgreSQL rows unchanged. Existing Firebase UIDs remain legacy identifiers. The new `private.external_auth_identities` table maps a verified Neon subject to the existing internal UUID. Its unique constraints prevent one Neon subject linking to multiple accounts, or multiple Neon subjects linking to one account. The application role can read the map but cannot modify it.

The private fresh export contains 22 Auth identities, all enabled. It deliberately excludes password hashes. A matching email address is insufficient proof of account ownership. Do not bulk-create identities from email matches or reconstruct the intentionally deleted profile.

## Required implementation before enabling Neon login

1. Implement and test Neon session verification against the staging provider, with explicit issuer, audience, expiration and signature validation. Reject tokens from production, unrelated branches and untrusted issuers. Determine the actual supported claims from the SDK and provider configuration; do not infer them from a decoded, unverified token.
2. Implement explicit account linking requiring fresh authenticated sessions at both providers. Resolve the internal UUID from the verified Firebase UID; resolve the Neon subject from the verified Neon session. Link in one transaction under a dedicated narrowly privileged server operation. Deny conflicting links, disabled accounts and stale sessions. Do not accept a target UID or email as authorization.
3. Keep Firebase login available during staged adoption. Map both providers to the same internal UUID. Exercise profile, wallet, moderation and ownership regression tests for both sessions. Verify that logging out or switching accounts clears subscriptions and cached private data.
4. Create a separate signup path for new Neon users. Require explicit current policy acceptance and verified contact information. Never create a Firebase production account from the staging signup page.
5. Validate password migration compatibility using supported provider APIs before considering hash import. Firebase uses a modified SCRYPT format; this export is not a password migration package. If passwords cannot transfer, a user-controlled enrollment/reset flow and communication approval are required. No emails have been sent.
6. Validate Google OAuth configuration and redirects on staging before enabling it. Only switch the default provider after all 22 existing accounts have a tested preservation/recovery path and final reconciliation passes.

## Reversal

Disable Neon login/linking flags and retain Firebase verification. Preserve the link table and audit records; do not delete accounts or rewrite internal UUIDs. Restore application code from the approved previous commit if needed. Account linking does not authorize Firebase account deletion.

References: [Neon Auth overview](https://neon.com/docs/auth/overview), [Neon authentication flow](https://neon.com/docs/auth/authentication-flow), [Firebase password export format](https://firebase.google.com/docs/cli/auth).
