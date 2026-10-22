# Password policy

New passwords require 8–128 JavaScript string code units, at least one Latin letter (including accented letters), and one ASCII digit. Spaces and symbols are permitted. No trimming or truncation occurs. Login and reauthentication preserve existing passwords.

Frontend validation covers registration, recovery and adapter calls for signup/reset/change/set password. The opt-in self-hosted Better Auth server applies the same rule before writes, including OTP/admin paths. Managed Neon remains the default provider until the coordinated cutover.

## Verified behavior (2026-10-18)

On the isolated Neon test branch, the managed server rejected lengths 7 and 129, accepted 8/9/10/128, and also accepted letters-only and digits-only. Client validation cannot enforce composition against that public endpoint. The authorized self-hosted integration closes this gap only after managed writes are retired. See [migration criteria](BETTER-AUTH-MIGRATION.md).

Tests cover 7/8/9/10/128/129, missing letters/digits, accented letters, frontend input limits/messages, legacy login and UUID/hash preservation. Real HTTP and isolated PostgreSQL tests verify signup, OTP with simulated delivery, reset, change, private API access and session revocation. Real Google OAuth and SMTP delivery remain pending. No production account or password was changed.
