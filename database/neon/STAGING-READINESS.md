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

## Hosted staging (configured) and remaining Stripe SANDBOX actions

1. Vercel Console -> Zytrix project -> Deployments -> PR #11 branch Preview deployment -> Visit. Use its ACTUAL preview origin. Verified branch Preview origin: https://zytrix-web-git-feat-neon-postg-f6f98a-guilhermeaugusto2525-1431.vercel.app . Its hosted config initially returned postgresStaging=false/authentication=firebase; this was corrected to fail closed with 503 staging_not_configured until Preview-only Neon/Auth variables are configured. Neon staging trusted origin has now been authorized and its /login.html return accepted (200); The five Preview environment variables are now configured only for feat/neon-postgresql-migration; see the final verification below. Do not promote to production.
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

## Hosted Preview configuration verification — 2026-10-01

- Current Git/deployed HEAD: ebc19fb79507547f27a4311b7fcbdbbf94f0255f, feat/neon-postgresql-migration. Verified Vercel project zytrix-web (prj_RIZKlfqoO8LEgRqg258hC0jgtkS2), scope guilhermeaugusto2525-1431, Preview deployment dpl_8pPmD7zgNPZwsjFwp8YRrHZrSgzL, READY. This is not a production deployment.
- Actual PostgreSQL connection succeeded using the ignored private migration-data/runtime.connection file. current_user=zytrix_staging_app, database=neondb; rolsuper, rolcreatedb and rolcreaterole are all false. The owner connection is not a runtime option.
- Six focused checks PASS: missing Preview configuration fails closed; supplied private staging configuration selects PostgreSQL/Neon Auth; live.feed queries the real database using the restricted runtime; production rejects staging configuration; managed get-session accepts the exact hosted Preview Origin with credentialed CORS; real Ed25519 JWKS is available. Configuration-handler checks ran locally, not on the hosted deployment; no authenticated hosted-screen certification is claimed.
- Neon staging Auth already lists the exact branch Preview origin as trusted. No Neon configuration was changed during this verification.
- Vercel runtime logs for this deployment show GET /api/v1/config returning 503. Current connector fetches encounter deployment protection (302); they do not prove that the hosted configuration has changed. The settings browser redirects to Vercel login; no authenticated CLI credentials are available and this connector exposes no environment-variable mutation tool. No variables were written, no redeployment was triggered, and inheritance into other Previews/Production remains NOT VERIFIED.

USER ACTION REQUIRED: sign in at https://vercel.com/guilhermeaugusto2525-1431/zytrix-web/settings/environment-variables with access to zytrix-web, then notify the agent. To configure manually, add each of the five variables in the hosted staging instructions above, select ONLY Preview and restrict Git Branch to feat/neon-postgresql-migration for EVERY variable. Obtain ZYTRIX_STAGING_DATABASE_URL privately from the local ignored migration-data/runtime.connection file; mark it Sensitive. Never use owner.connection. Before saving, ensure Production and Development are unselected and the branch restriction is present. After saving, verify all five rows show Preview + that exact branch, then Deployments -> the branch Preview -> Redeploy once with the updated environment. Validate /api/v1/config returns 200 with postgresStaging=true/authentication=neon, followed by the original login/profile flows and the public live feed. Do not promote the deployment.

The five variables configure the original screens through /api/v1/platform. NEON_READ_API_ENABLED and NEON_DATABASE_URL belong to the older optional GET /api/v1/health and /api/v1/lives pilot and are not required by that path; a disabled pilot health endpoint alone must not be treated as proof that the platform connection failed.

## Preview provisioned after Vercel login — 2026-10-01

The five ZYTRIX staging variables are now saved as Secret in zytrix-web, Preview only, each restricted to feat/neon-postgresql-migration. Row read-back confirmed the branch scope; no Production/Development/shared variables were modified. The restricted runtime credential was rotated after it appeared in an initial tool diagnostic, then privately replaced in the same scoped Vercel variable and local ignored file. No database ownership or production credentials changed.

Preview E8m7B9SncB6uSrQjpYXBScgfTbc8 built successfully; hosted /api/v1/config returned 200 with postgresStaging=true/authentication=neon. Hosted login exposed an actual startup failure: firebase-admin eagerly imported jwks-rsa, whose require(jose) failed with ERR_REQUIRE_ESM under the Vercel runtime. Commit 8850017 defers the temporary Firebase bridge until proof verification and catches bridge dependency failures; Neon functions no longer eagerly load it. npm test: 71/71 PASS; npm run check: PASS; focused proof/revocation tests: 4/4 PASS. A fresh Git Preview with the rotated credential and startup correction is required; browser certification is pending that deployment. Direct managed email login from the hosted origin returned 200 with a real session and credentialed CORS.

### Final hosted validation

Deployment dpl_J9rVma43bzGzQC86mmLHe23ep4rm, Git HEAD 02fde26f26d6f37cfffcf401f8971836fb0e4e76, reached READY with the corrected API startup and rotated restricted credential. Real managed fixture login and original staging enrollment succeeded. Original profile loaded; bio persistence was independently read back using zytrix_staging_app. Original channel creation, live configuration (Educação/Matemática), start and end succeeded; Explorar displayed the PostgreSQL feed and all 16 category filters; authenticated notifications loaded. Only fixture email verification was simulated; real mail delivery, Google OAuth and imported dual-proof enrollment remain external gates. The disposable fixture was removed transactionally; baseline restored to 22 identities, 8 wallets, zero managed Auth users/Neon links.

Logs identified and drove the ERR_REQUIRE_ESM startup fix. The final deployment returned successful API requests (132 HTTP 200 in the sampled aggregate); it also reported 401/403 and one 503. Follow-up filtered log retrieval timed out, so the remaining sampled non-200 entries are not individually certified or claimed resolved. This is not a claim of zero errors or complete staging readiness. No production/Firebase/Stripe settings, main merge or cutover occurred. PR #11 remains Draft.

### Final logout correction and validation

After removing the disposable fixture, the original logout page exposed a false failure for an already-deleted/expired session. Commit 7c5ace6 treats authentication_required/account_disabled and provider HTTP 401 as already signed out, clears the local JWT cache, and still propagates real revocation-service errors. Final npm test: 73/73 PASS; npm run check: PASS; original Neon/auth-focused tests: 11/11 PASS. Its Preview dpl_2bf1w77bziA6joXDNxyzzdEDE3yE reached READY. Google redirect_uri_mismatch, real inbox verification/reset, imported dual-proof enrollment and externally delivered Stripe sandbox webhook remain uncertified; Preview configuration itself no longer requires user action. Vercel deployment protection remains enabled.


## Authentication follow-up — 2026-10-01

Read starting HEAD 35b2863030d602049d5eae81b4bb0d5b114773a3 and recent commits before editing. Auth configuration now requires verified email, with automatic send on signup/signin off. Corrected the pending-user/no-session signup path, explicit OTP request and safe stage-specific errors (2c260f5). Resend cooldown/inflight prevention/Retry-After handling added; reset errors no longer falsely report successful requests. Found and fixed native GET credential submission before async initialization (06a0176); original auth controls stay disabled until handlers are ready, and forms use POST.

The actual Google request still uses Neon's shared Client ID and regional callback; the separately created Zytrix Staging Google client is not configured in Neon. No OAuth/SMTP/verification settings or production resources were changed. Exact current/requested callbacks, private configuration steps, and a prepared support request are in AUTH-TRANSITION.md. Neon Console remained at login and custom credentials/test mailbox were unavailable.

Code Preview 2c260f5 reached READY as dpl_5c6Ltw9ASXCQRRwumQdDpLWkYqNC. Real hosted tests passed password login with a disposable verified fixture, pending verification, invalid OTP, account switch and logout. Local original screen accepted one explicit OTP request to the real managed provider for an example.invalid fixture and disabled resend; there is no inbox/delivery certification. Its verification flag was simulated solely for password-session tests. Runtime logs sampled 200/401/403; no claim that every non-200 entry is resolved.

Final tests: npm test 78/78; npm run check PASS; npm run test:migration 9/9; focused auth/token/link 21/21; restricted integration 29 groups PASS (owner fixture setup, application assertions under zytrix_staging_app, rollback); real session/API security 4 checks PASS. Initialization fix then passed 18 focused tests and check. A direct attempt to seed the integration fixtures as the restricted role was denied as expected; use the existing --runtime-role mode, never widen runtime privileges.

AUTH CODE READY: corrected paths and automated tests PASS. AUTH STAGING READY: NO. USER ACTION REQUIRED: sign into Neon staging Console and configure the existing Google provider with the private Zytrix Staging client, or have Neon fix shared keys; provide one controlled test inbox / complete real OTP and reset yourself; authorize real old-identity proof if imported linking is to be certified. Follow the exact steps in AUTH-TRANSITION.md. Full Google, actual mail delivery/verification, recovery/revocation and imported dual-proof enrollment remain NOT VERIFIED. No production migration or cutover readiness is claimed.


Final code Preview 06a0176be7b7c786819969dd957ce74cd855a802 reached READY as dpl_CnsFx7qQMBpHAtQqxFdaaQos6sKF. Original login submitted safely immediately after navigation (no password query parameter), displayed pending verification, switched to the verified fixture and completed original logout. Its sampled 5xx log aggregate was empty. Both disposable fixtures were removed; 22 identities / 8 wallets / 1 real managed Auth user / 0 Neon links remain. Real user and financial records preserved. No configuration mutation, merge, promotion, production Firebase change or PR #16 edit occurred. Google and real email/recovery/link certification remain pending.


## Google staging credential update — 2026-10-04

The existing Google provider in soft-water-98807259 / br-wispy-scene-b6325si6 was updated via PATCH with the private Zytrix Staging client. Actual Google request verified the custom Client ID and branch-specific callback (see AUTH-TRANSITION.md). Original Preview login reached Google device confirmation and consent, then returned account_not_linked for the existing managed account. Shared-key redirect_uri_mismatch is resolved for this request; full Google login/logout certification remains pending authenticated provider linking. No linking by email, account deletion, production configuration, Firebase change or cutover occurred. Public error handling now distinguishes this callback error. Actual OTP delivery/reset, imported dual-proof linking and the other earlier staging gates remain uncertified. AUTH STAGING READY: NO.

Validation after this change: npm test 78/78 PASS; npm run check PASS; npm run test:migration 13/13 PASS. Provider PATCH/read-back and original-screen Google redirect/consent were real. Successful managed Google session, original enrollment, Google logout and account switching were not validated because the provider returned account_not_linked. No secret, complete OAuth URL/state, OTP or token was stored in Git.
