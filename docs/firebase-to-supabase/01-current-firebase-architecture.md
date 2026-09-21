# 01 — Current Firebase architecture

## Audit baseline

- Repository: `Guilherme-Augusto-INF/Zytrix`
- Audited commit: `bb3a3f600f50e0a7ced5a29e4a6f83f1dc9ca7eb`
- Production Vercel project: `zytrix-web`
- Production deployment was built from the same commit at audit time.
- Firebase project ID referenced by the client: `zytrix-ca4f2`
- Rules source: `firestore.rules`
- Duplicate Rules copies: `firebase/firestore.rules` and `REGRAS-PARA-COLAR-NO-FIREBASE.txt`
- All three Rules files are byte-identical: SHA-256 `9119d5f86ffcbbe8d739e43d7f65fc1d29451a42c0fd5913369331ee5128d64a`.
- Actual Rules size: 4,293 lines.

Read-only Firebase Console inspection was completed on 2026-09-21. It verified Auth totals, top-level Firestore collections/counts, representative field shapes, region, enabled login providers, Storage activation state and the latest Rules deployment timestamp. A machine-readable export was not obtained, so full subcollection counts, checksums, orphan identity and cross-record invariants remain pending.

## Verified remote snapshot

| Resource | Verified state |
|---|---|
| Firebase plan | Spark |
| Firestore database/region | `(default)` / `southamerica-east1` |
| Auth users | 19 |
| Auth providers | 16 email-only, 2 Google-only, 1 linked Google + email |
| Enabled sign-in methods | Email/password and Google |
| Latest deployed Rules revision visible | 2026-09-09 17:13 local console time |
| Manual composite indexes | 0 |
| Firebase Storage | Not activated; console requires Blaze before setup |

The console revealed 20 `users` documents and 20 `profiles` documents for 19 Auth users. This is a concrete reconciliation warning: at least one legacy/orphan identity candidate exists and must be resolved from the export rather than silently imported.

## Runtime architecture

The production application is a static HTML/CSS/JavaScript site. Browser modules import Firebase 12.18.0 directly from Google's CDN. There is no application server in this repository.

| Capability | Current implementation | Evidence |
|---|---|---|
| Email/password Auth | Firebase Auth in browser | `assets/js/auth-pages.js`, `assets/js/firebase.js` |
| Google Login | Firebase popup provider | `assets/js/auth-pages.js` |
| Email verification | Firebase Auth email verification | `assets/js/auth-pages.js` |
| Password reset | Firebase Auth reset email | `assets/js/auth-pages.js` |
| Account deletion | Firebase user deletion plus Firestore batch cleanup | `assets/js/perfil.js` |
| Database | Cloud Firestore client SDK | 34 browser modules import `firebase.js` |
| Realtime | Firestore `onSnapshot` listeners | lives, chat, alerts, polls, notifications, followers |
| Transactions | Firestore client transactions/batches | wallets, reports, follows, polls, reactions, deletion |
| Storage SDK | Not found | No Storage SDK import or upload call in repository |
| Realtime Database | Not found | No RTDB dependency or API usage |
| Cloud Functions | Not found | No `functions/`, `firebase-functions` or callable usage |
| Custom claims | Read only through Auth token (`email_verified`, provider) | Rules |
| Admin authority | `admins/{uid}.active == true` | Rules and admin UI |
| Hosting | Vercel production; Firebase Hosting config retained | `vercel.json`, `firebase.json` |

## Firestore inventory

| Firebase path | Current purpose | Principal access | Supabase target |
|---|---|---|---|
| `admins/{uid}` | Trusted admin allowlist | self/admin read; no client writes | `admins` |
| `users/{uid}` | Private identity/account record | self/admin | `user_accounts` |
| `users/{uid}/following/{channelId}` | User-side follows | self/admin | canonical `follows` |
| `channels/{channelId}/followers/{uid}` | Channel-side duplicate follows | follower/channel owner/admin | canonical `follows` |
| `users/{uid}/notificationState/*` | Per-user read state | self/admin | `notification_states` |
| `users/{uid}/watchHistory/{streamId}` | Watch history | self/admin | `watch_history` |
| `users/{uid}/preferences/platform` | Product preferences | self/admin | `user_preferences` |
| `users/{uid}/progress/main` | XP/watch streak | self/admin | `user_progress` via RPC |
| `users/{uid}/followedCategories/*` | Category follows | self/admin | `followed_categories` |
| `users/{uid}/creatorAttribution/current` | Creator code attribution | self/admin | `creator_attributions` |
| `profiles/{uid}` | Public profile | public read; owner/admin write | `profiles` |
| `channels/{uid}` | Public channel | public read; owner/admin write | `channels` |
| `channels/{uid}/private/*` | Arbitrary channel-private documents | owner/admin | `private.channel_private_data` |
| `channels/{uid}/members/*` | Channel memberships | member/owner/admin | `channel_members` |
| `channels/{uid}/schedule/*` | Scheduled lives | public read; owner/admin write | `live_schedules` |
| `channels/{uid}/rewards/*` | Reward catalog | public read; owner/admin write | `rewards` |
| `channelProfiles/{uid}` | Extended public channel profile | public read; owner/admin write | `channel_profiles` |
| `creatorCodes/{code}` | Unique creator code | public read; creator/admin write | `creator_codes` |
| `streams/{streamId}` | Live configuration/state | public read; owner/admin write | `lives` |
| `streams/*/viewers/{uid}` | Authenticated viewer heartbeat | viewer/streamer/admin | `private.live_viewer_sessions` + Presence |
| `streams/*/chat/{id}` | Chat messages | public read; controlled write/moderation | `chat_messages` + RPC |
| `streams/*/chatRate/{uid}` | Slow-mode/rate state | self/admin | `private.chat_rate_limits` |
| `streams/*/chatSettings/main` | Chat policy | public read; moderator write | `chat_settings` |
| `streams/*/chatConfig/main` | Pinned message | public read; moderator write | merged into `chat_settings` |
| `streams/*/chatBans/{uid}` | Live-scoped mute/ban | subject/moderator/admin | `live_bans` |
| `streams/*/moderators/{uid}` | Live moderators | moderator/owner/admin | `live_moderators` |
| `streams/*/reactions/*` | Ephemeral reactions | public read; verified user write | `live_reactions` / Broadcast |
| `streams/*/reactionRate/{uid}` | Reaction rate state | self/admin | `private.reaction_rate_limits` |
| `streams/*/polls/*` | Poll/prediction | public read; moderator write | `polls`, `poll_options` |
| `streams/*/polls/*/votes/{uid}` | One vote per user | self/moderator | `poll_votes` unique key |
| `streams/*/supportAlerts/*` | Public support notification | public read; immutable | `support_alerts` |
| `wallets/{uid}` | Cached Zy Coin balance/totals | self/admin | `wallets` |
| `zyCoinTransactions/{id}` | Immutable coin ledger | participants/admin | `zy_coin_transactions` |
| `zyCoinOrders/{id}` | Coin purchase prototype/admin demo | owner/admin | `zy_coin_orders` |
| `rewardRedemptions/{id}` | Reward fulfillment | user/channel/admin | `reward_redemptions` |
| `coinPromotions/{id}` | Admin-created promotions | public read | `coin_promotions` |
| `coinPromotions/*/claims/{uid}` | One claim per user | self/admin | `promotion_claims` unique key |
| `clips/{id}` | Clip metadata only | public read | `clips` |
| `reports/{id}` | Private abuse report | reporter/admin | `reports` |
| `reportLimits/{uid}` | Report rate limiter | self | `private.report_rate_limits` |
| `reportKeys/{uid}/targets/{key}` | Open-report deduplication | self | partial unique indexes on `reports` |
| `moderationAudit/{id}` | Immutable report closure audit | admin | `moderation_audit` |
| `moderationPenalties/{uid}` | Current global penalty | subject/admin | `moderation_penalties` |
| `moderationActions/{id}` | Immutable admin action history | admin | `moderation_actions` |
| `governance/config` | Rules/policy release configuration | public read, no client write | `governance_config` |
| `policyAcceptances/{uid}/versions/{version}` | Versioned policy acceptance | self/admin | `policy_acceptances` |
| `categories/{id}` | Category catalog | public/admin | `categories` |
| `featuredStreamers/{uid}` | Curated list | public/admin | `featured_streamers` |

### Top-level production counts verified in Console

| Collection | Documents | Representative fields observed |
|---|---:|---|
| `admins` | 1 | `active` |
| `channels` | 5 | `ownerUid`, `channelName`, `categoryId`, `currentStreamId`, `isLive`, asset URLs, timestamps |
| `featuredStreamers` | 4 | `active`, `position` |
| `profiles` | 20 | `uid`, `username`, `bio`, `photoURL`, `createdAt`, `usernameUpdatedAt` |
| `streams` | 5 | owner/channel IDs, title/description/category, playback/thumbnail URLs, status/timestamps, `viewerCount` |
| `users` | 20 | `uid`, `zytrixId`, email, provider, created/login timestamps |
| `wallets` | 8 | balance/totals, `lastTransactionId`, timestamps |
| `zyCoinOrders` | 10 | package/coins/price/payment/status/mode/timestamps |
| `zyCoinTransactions` | 0 | no production documents |

Verified top-level total: **73 documents**. Counts for subcollections mentioned in Rules remain export-dependent; absence from the root list is not proof that a subcollection has no documents.

## Query and listener inventory

- Public live feed: `streams WHERE status == live`, then client-side ordering/filtering.
- Stream lookup: `streams WHERE streamerUid == uid LIMIT 1`.
- Chat: latest 100 messages ordered by `createdAt DESC`.
- Clips: latest 80 ordered by `createdAt DESC`.
- Schedule: channel schedule ordered by `startsAt ASC`, usually limited to 3–5.
- Polls: latest 5–10 ordered by `createdAt DESC`.
- Transactions: recipient query by `toUid`.
- Reports: reporter or open status, limited to 30.
- Collection-group queries are used during account deletion for followers and chat messages.
- `firestore.indexes.json` contains no composite index; five TTL field overrides cover viewers, support alerts, reactions, reaction rate and chat rate.

## Baseline verification

| Check | Result |
|---|---|
| JavaScript unit/security tests | PASS — 16/16 |
| Firebase Rules regression tests | PASS — 41/41 |
| Site structural check | PASS |
| Policy build | PASS |
| Production Firebase top-level record counts | PASS — 73 documents across 9 root collections |
| Firebase Auth user count/providers | PASS — 19 users; email and Google enabled |
| Firebase Storage object count/bytes | PASS — Storage is not activated; no source bucket inventory exists |
| Deployed Rules equal repository Rules | NOT VERIFIED |
