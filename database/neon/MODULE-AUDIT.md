# Module audit — 2026-10-01

PR #11, feat/neon-postgresql-migration. Execution started at f55a8d99495f26e7cd1b1d2e765d05ac0df0ea98. Main 18370b2661d0ba2020992b94a38a5f877f4d24c1 was integrated into this branch in conflict-resolution commit 5b7724a.

## Exact counting scope

Global source search includes imports, aliases, SDK calls, transactions/batches, Timestamp factories, docs, tests, SQL, CI and offline tooling; dependencies, lockfiles and ignored private exports excluded. Browser counts use JavaScript AST CallExpressions bound to Firebase/facade imports. A realtime callback named onSnapshot is not a Firestore SDK subscription.

- A: **0 functional Firestore modules / 0 functional call sites in the Neon application/API path**. firebase.js selects neon-browser.js before loading legacy SDK; errors fail closed. api/server contain no Firestore imports.
- B: **36 modules with scoped legacy/facade call sites, 739 browser call sites**: 110 reads, 74 writes/factories, 46 subscriptions, 439 builders/transforms, 43 transaction methods, 18 batch methods, eight Timestamp factories, one getFirestore initialization. Primary reads+writes+listeners: 230.
- B offline: export-firestore.mjs contains eight initialization/query/enumeration calls. **Browser + offline total: 747**; none are a functional application dependency in Neon.
- C: docs, tests/emulator, migration metadata/firebase_uid/firebase_id, CI/rules copies and dependencies are nonfunctional references. Their textual matches are not counted as runtime calls.
- **41 modules import ./firebase.js** (shared facade, not necessarily Firestore calls). One module, firebase-legacy.js, directly imports the Firestore browser SDK. The SDK implementation and getFirestore execute only outside staging.
- Explicit Firebase Auth enrollment proof remains in neon-auth-page.js/auth.mjs. It never invokes Firestore or links by matching email.

N = original business contracts implemented on Neon, despite compatible facade spellings. P = external certification still incomplete. L = isolated legacy path. These labels are not production readiness.

| Module | Reads | Writes/factories | Listeners | Builders | tx | batch | State |
|---|---:|---:|---:|---:|---:|---:|:---:|
| admin-promotions.js | 2 | 2 | 0 | 8 | 0 | 0 | N |
| admin.js | 3 | 5 | 0 | 13 | 0 | 0 | N |
| ao-vivo.js | 0 | 0 | 1 | 3 | 0 | 0 | N |
| auth-pages.js | 4 | 2 | 0 | 8 | 0 | 0 | P |
| categoria.js | 0 | 0 | 1 | 3 | 0 | 0 | N |
| clips.js | 1 | 0 | 1 | 5 | 0 | 0 | N |
| config-live.js | 3 | 3 | 0 | 12 | 0 | 3 | N |
| creator-center.js | 20 | 17 | 2 | 77 | 0 | 0 | N |
| explorar.js | 5 | 0 | 1 | 17 | 0 | 0 | N |
| firebase-legacy.js | 2 | 2 | 0 | 4 | 0 | 2 | L |
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
| pagamento.js | 1 | 2 | 0 | 8 | 3 | 0 | P |
| perfil.js | 17 | 5 | 1 | 37 | 0 | 7 | N |
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
| Total | 110 | 74 | 46 | 439 | 43 | 18 | |

Facade import inventory: admin-promotions.js, admin.js, ao-vivo.js, auth-pages.js, categoria.js, category-follow.js, clips.js, config-live.js, creator-center.js, explorar.js, global-features.js, home.js, live-extras.js, live-moderator.js, live-player-access.js, live-social.js, live-support-alerts.js, live-vod.js, live.js, loja.js, moderation-page.js, notificacoes.js, notifications-plus.js, pagamento.js, perfil.js, platform-backend.js, platform-core.js, platform-global.js, policy-acceptance.js, profile-plus.js, profile-promotions.js, profile-social.js, report-page.js, report-service.js, sair.js, social.js, staging-app.js, staging-validation.js, status.js, streamer-dashboard.js, ui.js.

## Original screen coverage and isolation

Live configuration/start/end, creator center/dashboard, profile/edit/recovery/deletion, follows, notifications, clips/VOD, schedules, chat/moderation, viewer presence, reports/admin, preferences/progress, rewards/polls/promotions and wallet/support/history are relational. Money/voting/moderation use explicit authorized server actions; arbitrary SQL, document paths and financial writes are rejected.

Authenticated original-screen browser evidence uses real managed signup/login/sessions and disposable staging fixtures. Email verification and administrator/wallet provisioning are explicitly simulated test setup; public/home/categories/explore/clips/store and authenticated creator/profile/live/community/report/moderation flows were exercised. See MISSION-EVIDENCE-20260926.md for executed counts and limits.

Profile deletion is now implemented server-side with retained identities, wallets, ledger, moderation and audit evidence. Legacy collectionGroup/batch account deletion cannot run in staging. Governance/policy-acceptance legacy code does not execute on the Neon signup path; current policy versions and explicit staging-only consent are enforced by PostgreSQL.

Catalog remains 16 canonical categories / 142 subcategories plus the retained gaming alias (159 physical rows). Main's playback/chat/channel/profile fixes are preserved. No PR #16 changes.

## Remaining partial delivery

Auth provider Google callback is blocked externally; real email OTP/reset and real imported Firebase dual-proof linking remain unverified. Hosted Stripe sandbox Checkout and external signed webhook require sandbox secrets. Fresh Firebase reconciliation requires current source exports. These are staging certification gates; no functional Firestore dependency is left behind as a workaround.

Future removal candidates: firebase-legacy.js and the legacy branches in the table, auth-pages.js fallback, policy-acceptance.js, offline export tooling after rollback/source-retention requirements end. Do not remove them during this prohibited-cutover mission.
