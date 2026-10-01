# Module audit — 2026-10-01

Branch: `feat/neon-postgresql-migration`, PR #11. Starting HEAD: `7b2b1cf93bcefedea571c0a9b861a38bb8ea77fb`.

## Classification and counting scope

Global search covered repository source, imports, SQL identifiers, rules, scripts, tests, CI and documentation, excluding dependencies, lockfiles and ignored private exports. Call counts below were obtained from the JavaScript AST: imported SDK/facade bindings, aliases, transaction/batch methods and Timestamp factories. A callback named onSnapshot in realtime-client.js is not a Firestore listener and is excluded.

- A — functional Firestore dependency in the Neon web/API path: **0 modules, 0 call sites**. The only browser Firestore SDK import and getFirestore initialization are in firebase-legacy.js. firebase.js selects neon-browser.js when postgresStaging is true, before loading the legacy module. Config/API failure does not select Firebase. Server/API code has no Firestore SDK dependency.
- B — isolated compatibility/legacy: **36 browser modules** retain **725 SDK-shaped call sites**: 104 reads, 72 writes/transaction/batch factories, 46 subscriptions, 434 reference/query/transform builders, 43 tx methods, 17 batch methods, eight Timestamp factories and one getFirestore initialization. The 222 primary API calls are shown separately in the table. Under Neon, shared read/write/snapshot calls resolve to explicit relational actions; legacy transactions use guarded alternate branches. The SDK implementation is loaded only outside Neon.
- B — offline tooling: export-firestore.mjs has **eight** Firestore initialization/query/collection-enumeration call sites, including FieldPath.documentId. It runs only as an explicit export command and is not imported by the application. Total browser plus export tooling: **733** scoped call sites, **0 functional in Neon**.
- C — nonfunctional runtime references: documentation, migration metadata/mappings with firebase_uid/firebase_id, rules copies, emulator tests, CI commands, development dependencies and fixtures. They do not establish a runtime Firestore dependency.
- Firebase Auth remains an explicit enrollment proof bridge in neon-auth-page.js/server auth.mjs. It verifies the previous identity for linking; it does not query Firestore, import passwords or replace the Neon application session.

## Original V1 module inventory

N = business contracts implemented on Neon, with shared facade names retained for legacy compatibility. This denotes code coverage, not authenticated browser certification.
P = partially delivered. L = legacy-only implementation, not executed by the Neon path.
Columns: reads; mutation/factory calls; listeners; reference/query/transform builders; transaction methods; batch methods. Timestamp factories and getFirestore are counted above separately.

| Module | Reads | Mutations | Listeners | Builders | tx | batch | State |
|---|---:|---:|---:|---:|---:|---:|:---:|
| firebase-legacy.js | 2 | 2 | 0 | 4 | 0 | 2 | L |
| admin-promotions.js | 2 | 2 | 0 | 8 | 0 | 0 | N |
| admin.js | 3 | 5 | 0 | 13 | 0 | 0 | N |
| ao-vivo.js | 0 | 0 | 1 | 3 | 0 | 0 | N |
| auth-pages.js | 4 | 2 | 0 | 8 | 0 | 0 | P |
| categoria.js | 0 | 0 | 1 | 3 | 0 | 0 | N |
| clips.js | 1 | 0 | 1 | 5 | 0 | 0 | N |
| config-live.js | 3 | 3 | 0 | 12 | 0 | 3 | N |
| creator-center.js | 20 | 17 | 2 | 77 | 0 | 0 | N |
| explorar.js | 5 | 0 | 1 | 17 | 0 | 0 | N |
| global-features.js | 1 | 0 | 4 | 7 | 0 | 0 | N |
| home.js | 0 | 0 | 1 | 3 | 0 | 0 | N |
| live-extras.js | 9 | 7 | 6 | 71 | 22 | 0 | N |
| live-moderator.js | 4 | 3 | 2 | 13 | 0 | 0 | N |
| live-player-access.js | 0 | 0 | 1 | 1 | 0 | 0 | N |
| live-social.js | 2 | 0 | 1 | 3 | 0 | 0 | N |
| live-support-alerts.js | 1 | 0 | 2 | 6 | 0 | 0 | N |
| live-vod.js | 0 | 0 | 1 | 1 | 0 | 0 | N |
| live.js | 4 | 8 | 5 | 31 | 5 | 0 | N |
| loja.js | 0 | 0 | 1 | 1 | 0 | 0 | N |
| moderation-page.js | 2 | 0 | 0 | 5 | 0 | 0 | N |
| notificacoes.js | 1 | 1 | 4 | 10 | 0 | 0 | N |
| notifications-plus.js | 7 | 1 | 0 | 16 | 0 | 0 | N |
| pagamento.js | 1 | 2 | 0 | 8 | 3 | 0 | N |
| perfil.js | 11 | 3 | 1 | 32 | 0 | 6 | P |
| platform-core.js | 4 | 6 | 3 | 19 | 2 | 0 | N |
| platform-global.js | 1 | 0 | 0 | 1 | 0 | 0 | N |
| policy-acceptance.js | 2 | 1 | 0 | 3 | 0 | 0 | L |
| profile-plus.js | 1 | 0 | 0 | 1 | 0 | 0 | N |
| profile-promotions.js | 2 | 0 | 0 | 2 | 0 | 0 | N |
| profile-social.js | 1 | 0 | 3 | 4 | 0 | 0 | N |
| report-page.js | 1 | 0 | 0 | 4 | 0 | 0 | N |
| report-service.js | 1 | 2 | 0 | 15 | 11 | 0 | N |
| social.js | 4 | 7 | 3 | 17 | 0 | 6 | N |
| status.js | 1 | 0 | 0 | 3 | 0 | 0 | N |
| streamer-dashboard.js | 3 | 0 | 2 | 7 | 0 | 0 | N |
| **Total** | **104** | **72** | **46** | **434** | **43** | **17** | |

Implemented original-screen contracts include live configuration/lifecycle, creator dashboards, profiles/social/follows, notifications/read markers, clips/VOD, schedules, chat/moderators/members, viewer presence/counts, reports/moderation/admin, progress/rewards/polls/promotions, wallet/support/history, payment initiation and preferences/discovery. Explicit server actions handle money, voting, moderation and progress; the relational document adapter rejects arbitrary paths and generic financial writes. Unknown operations fail closed.

The original public home, Categories, Explore and Clips and original login form were exercised in the local Neon preview. Restricted-role PostgreSQL tests cover 29 scenario groups. Authenticated original-screen end-to-end flows still need a real Neon session.

The shared catalog contains 16 canonical categories and 142 subcategories, preserving the original eight categories. Additive 010 inserts the catalog without replacing existing rows. 011 restores three missing canonical parent relationships only. Staging has 159 category rows: 16 canonical roots, 142 children and one preserved legacy root alias, gaming.

## Partial modules and actual gaps

- perfil.js: profile editing, explicit recovery, channel creation and wallet reads are implemented; account deletion remains deliberately unavailable on Neon. A complete, retention-safe deletion/enrollment-session lifecycle remains implementation work. Legacy collectionGroup/batch deletion cannot run in staging.
- auth-pages.js/neon-auth-page.js/neon-browser.js: managed Auth login/signup/verification/reset/logout and dual-proof enrollment are implemented; real session/linking/reset/account-switch regression is not certified. Google provider is blocked externally (see AUTH-TRANSITION.md).
- Signup and reports are gated by authoritative governance configuration. Staging has zero governance rows, and the read-only Firebase REST request for governance/config returned NOT_FOUND. Current policy-release.js marks draft policies ineffective. No effective policies or consents were fabricated.
- Payment code is sandbox-only and validated locally; external hosted Checkout/webhook delivery is unverified without sandbox secrets/configuration.
- The existing source delta and a fresh reconciliation remain unapplied/unverified.

Firestore isolation therefore does not establish code, staging or cutover completion. PR remains Draft.
