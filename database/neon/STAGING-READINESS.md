# Staging readiness — 2026-10-01

| Gate | Status |
|---|---|
| CODE READY (repository technical implementation) | YES within implemented/tested scope; no unresolved critical test failure; Draft review/CI required |
| STAGING READY (all external flows/data certified) | NO |
| CUTOVER READY | NO |
| PRODUCTION READY / migrated | NO — production work prohibited |

## Completed technical scope

Main conflicts resolved on PR #11; retention-safe deletion and session revocation; authoritative staging signup/report/policy drafts; original authenticated screens; Auth proof/link/token/session protections; SSE cleanup/limits/isolation; wallet concurrency/atomic sandbox fulfillment/refund; checksummed dry-run reconciliation and guarded explicit staging apply; follower index and roster/query/token N+1 fixes. See MISSION-EVIDENCE-20260926.md and MODULE-AUDIT.md for exact tests/counts.

## USER ACTION REQUIRED — Google OAuth

1. Enter Neon Console -> project soft-water-98807259 -> branch br-wispy-scene-b6325si6 -> Auth -> OAuth providers -> Google. Current provider is Neon's shared client. Ask Neon support to authorize its regional callback or use a dedicated staging OAuth client that you control. No production provider edit.
2. For a controlled client: enter Google Cloud Console -> Google Auth Platform -> Clients -> staging Web application client -> Authorized redirect URIs -> Add URI -> Save.
3. **Adicionar esta URI autorizada:** https://neonauth.c-2.sa-east-1.aws.neon.tech/auth/oauth/callback/google . This is the exact redirect_uri observed from the current real staging service. If switching provider changes its generated URI, read the new provider response before editing Google; do not guess.
4. In the staging Neon Google provider, enter that staging client ID and client secret privately. Never paste the secret into the PR or frontend.
5. Neon trusted return origin: **http://127.0.0.1:5502**. **Configurar este callback de retorno na aplicação:** http://127.0.0.1:5502/login.html . Google provider redirect and application return are distinct.
6. Validate original login Google -> callback -> session -> explicit dual-proof enrollment for an imported account -> original profile -> logout -> former JWT denied.

## USER ACTION REQUIRED — real email/enrollment/recovery

1. Open local original staging registration at http://127.0.0.1:5502/registro.html using an email inbox you control. Complete managed verification OTP through the original page, and explicit staging draft acceptance for a NEW test profile. Fixtures used in this execution simulated only emailVerified, not delivery.
2. For an imported Firebase identity, original staging login -> Concluir sua conta no staging -> Vincular sua conta Zytrix existente -> prove BOTH active managed session and previous Firebase password/Google identity. Existing UUID/profile/wallet must remain identical. No email-only link.
3. Open http://127.0.0.1:5502/recuperar-senha.html -> request reset -> use actual email callback -> set new password -> sign in. Verify old password fails and prior sessions have the provider's required revocation behavior; configure staging provider recovery/session policy if necessary. No bulk email or production account edits.

## USER ACTION REQUIRED — hosted staging and Stripe SANDBOX

1. Vercel Console -> Zytrix project -> Deployments -> PR #11 branch Preview deployment -> Visit. Use its ACTUAL preview origin. Verified branch Preview origin: https://zytrix-web-git-feat-neon-postg-f6f98a-guilhermeaugusto2525-1431.vercel.app . Its hosted config initially returned postgresStaging=false/authentication=firebase; this was corrected to fail closed with 503 staging_not_configured until Preview-only Neon/Auth variables are configured. Neon staging trusted origin has now been authorized and its /login.html return accepted (200); Preview environment variables remain unconfigured. Do not promote to production.
2. Vercel Settings -> Environment Variables -> Preview ONLY, restricted to feat/neon-postgresql-migration. Set ZYTRIX_POSTGRES_STAGING=true, ZYTRIX_AUTH_PROVIDER=neon, ZYTRIX_NEON_AUTH_URL=https://ep-ancient-recipe-b65mlsad.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth, ZYTRIX_STAGING_DATABASE_URL=the existing private connection for role zytrix_staging_app on br-wispy-scene-b6325si6. Set ZYTRIX_STAGING_ORIGIN=https://zytrix-web-git-feat-neon-postg-f6f98a-guilhermeaugusto2525-1431.vercel.app . That exact origin is already authorized only in STAGING Neon Auth. Hosted return callback: https://zytrix-web-git-feat-neon-postg-f6f98a-guilhermeaugusto2525-1431.vercel.app/login.html . Hosted Stripe webhook endpoint: https://zytrix-web-git-feat-neon-postg-f6f98a-guilhermeaugusto2525-1431.vercel.app/api/v1/stripe-webhook . Database owner credential must never be runtime.
3. Stripe Dashboard -> select Sandbox/Test mode -> Developers/API keys -> obtain the existing/new sandbox secret privately. Set STRIPE_SECRET_KEY to the actual sk_test_ value and ZYTRIX_STRIPE_SANDBOX=true in Preview only. No live key. Package/price/coins are controlled server-side; no frontend price authority or success-URL credit.
4. Stripe test Developers -> Webhooks -> Add endpoint -> actual preview origin + **/api/v1/stripe-webhook**. Select checkout.session.completed, checkout.session.async_payment_succeeded and charge.refunded. Reveal signing secret -> set actual STRIPE_WEBHOOK_SECRET (whsec_) privately, Preview only. Alternatively local forwarding: **stripe listen --forward-to http://127.0.0.1:5502/api/v1/stripe-webhook**; use only its actual sandbox signing secret in the local private environment.
5. Redeploy Preview once after real configuration, when build quota permits; never loop repeated deployments. Original store/payment page -> hosted Checkout -> test payment -> signed webhook. Verify one order/one credit, duplicate resend unchanged, tampered/stale signatures rejected, refund behavior recorded. Missing sandbox secrets/hosted external delivery remain NOT VERIFIED.

## USER ACTION REQUIRED — current source exports

1. On an authorized Firebase account: run **firebase login**; verify project **zytrix-ca4f2**. Only read/export production; never deploy or alter its rules/Auth.
2. Use existing scripts/firebase-to-neon/export-auth.mjs and export-firestore.mjs documented arguments to write ignored private exports; use an authorized read-only service identity where supported. Treat all exports/password hashes as private. No mail, reset or production write.
3. Normalize using existing transform.mjs; provide private runtime connection via NEON_DATABASE_URL_FILE. Run **node scripts/firebase-to-neon/reconcile.mjs <normalized-directory> <private-report.json> --dry-run**. Default omitting the final flag is also dry-run. Review new/changed/removed/conflicts, wallet/profile/identity divergences and FK/invariants.
4. **--apply-staging** is explicit and transactional, restricted to reviewed nonfinancial tables with proven newer source timestamps. It never deletes, lowers wallet balance or replaces identity/profile/ledger data; sensitive/conflicting changes block the entire transaction. Preserve newer Neon rows. A full source comparison needing write-freeze is a future cutover gate, not authorized now.

## Reproducing available tests

Official: npm test; npm run check; npm run test:migration; npm run test:rules (complete Java runtime required; demo emulator only). PostgreSQL scripts assert zytrix_staging_app for application operations: test-platform-staging.mjs, test-account-lifecycle.mjs, test-wallet-concurrency.mjs. Owners provision/remove isolated fixtures only.

Real managed fixture harnesses in scripts/firebase-to-neon: seed-managed-fixture.mjs, test-original-actions.mjs, test-original-community.mjs, test-managed-security.mjs, test-original-deletion.mjs, cleanup-managed-fixtures.mjs. Each script reports its exact private file arguments when omitted. Use ignored migration-data paths; no credentials in command arguments. PLAYWRIGHT_MODULE selects existing Playwright installation, PLAYWRIGHT_CHANNEL defaults to installed msedge. Run local scripts/staging-preview.mjs with ZYTRIX_STAGING_DATABASE_URL_FILE pointing to the private restricted staging connection. Fixture verification and role/wallet provisioning are explicitly simulated; application sessions/API/browser actions are real. Test deletion LAST, then guarded cleanup. No production bypass or framework dependency added.

## What remains for cutover

All external staging gates above, legal/operator review of actual effective policy versions/retention/support channels (current documents are draft placeholders), current reconciled data/invariants, complete external financial/OAuth/email/link certification, rollback/write-freeze plan and explicit user approval. No production migration is claimed. Partial refunds/spent-coin refunds require manual review, SSE limiting is per process, staging EXPLAIN is not production load evidence.

Firebase proof verification now explicitly checks revoked/disabled status (Admin SDK checkRevoked=true). Real imported linking requires authorized read-only Firebase Auth Admin credentials in staging; public JWT signature keys alone cannot certify revocation. No production Auth writes.
