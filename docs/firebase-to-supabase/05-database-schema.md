# 05 — Database schema

The authoritative implementation is the ordered SQL in `supabase/migrations/`. This document explains modeling decisions rather than duplicating every column.

## Identity and public account

- `auth.users`: Supabase-owned identity.
- `user_accounts`: private-to-user account record, Zytrix ID, email/provider snapshot and legacy Firebase UID.
- `private.firebase_user_map`: authoritative Firebase UID → Supabase UUID map.
- `profiles`: public username, photo and bio; case-insensitive generated key is unique.
- `admins`: trusted, non-user-writable administrator source.
- `user_preferences`, `notification_states`, `user_progress`, `watch_history`, `followed_categories`.

## Channels and discovery

- `channels` 1:1 owner, with stable slug and optional current live.
- `channel_profiles` 1:1 extended social/about data.
- `follows` N:N users ↔ channels; replaces two Firestore copies.
- `channel_members` N:N explicit membership.
- `live_schedules`, `rewards`, `creator_codes`, `creator_attributions`.
- `categories` self-referencing hierarchy.
- `featured_streamers` curated channel ordering.

## Lives and interaction

- `lives` belongs to a channel and owner; one active live per channel partial unique index.
- `live_moderators` N:N.
- `chat_messages` with reply FK and moderation status.
- `chat_settings` 1:1, including pinned message.
- `live_bans` 1 row per live/user with expiry/revocation.
- `polls`, `poll_options`, `poll_votes`; vote uniqueness is `(poll_id, user_id)`.
- `live_reactions` short retention.
- `private.chat_rate_limits`, `private.reaction_rate_limits`.
- `private.live_viewer_sessions` for current authenticated presence.
- `private.live_unique_views` prevents refresh/multi-tab inflation of total views.

## Zy Coins

- `wallets`: transactional balance cache and totals; clients have no write grant.
- `zy_coin_transactions`: append-only ledger with idempotency key.
- `zy_coin_orders`: purchase intent/provider state.
- `support_alerts`: expiring public projection tied to a completed ledger row.
- `rewards` + `reward_redemptions`: atomic reward purchase and fulfillment.
- `coin_promotions` + `promotion_claims`: bounded promotion with one claim per user.

The ledger is the audit source; wallet balances are updated only in the same database transaction as ledger insertion. Direct client balance writes are impossible.

## Safety and governance

- `moderation_penalties`: current global penalty.
- `moderation_actions`: immutable admin action history.
- `reports`: polymorphic profile/live/chat target with exactly-one-target constraints.
- Three partial unique indexes prevent duplicate open reports per reporter/target.
- `private.report_rate_limits`: server-only rate state.
- `moderation_audit`: immutable report decision audit.
- `policy_acceptances`: `(user_id, policy, version)` immutable acceptance.
- `governance_config`: singleton active versions/features.
- `audit_logs`: sensitive administrative/financial/destructive actions only.

## JSONB policy

JSONB is intentionally limited to:

- legacy unknown documents in `private.channel_private_data`;
- bounded ledger/audit metadata;
- category metadata;
- migration run counts/checksums/differences.

Core domain entities are not stored as generic JSON documents.

## Index rationale

- Feed: live status + creation time.
- Chat: live + descending creation time, visible rows only.
- Schedule: channel + start time.
- Clips: descending creation time and streamer.
- Ledger: sender/recipient + descending creation time.
- Reports: status + descending creation time.
- Viewer sessions: live + expiry.

Additional indexes require measured query plans; indexes are not added to every column by default.

