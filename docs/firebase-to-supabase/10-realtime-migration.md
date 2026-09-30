# 10 — Realtime migration

## Listener mapping

| Firebase listener | Supabase mechanism |
|---|---|
| live status/details | Postgres Changes on `lives` |
| chat message stream | Postgres Changes on `chat_messages` |
| pinned/settings | Postgres Changes on `chat_settings` |
| live ban for current user | Postgres Changes on `live_bans` |
| polls/counts | Postgres Changes on `polls`/`poll_options` |
| support alerts | Postgres Changes on `support_alerts` |
| notification read state | Postgres Changes on `notification_states` |
| reward fulfillment | Postgres Changes on `reward_redemptions` |
| viewer presence | private Realtime Presence topic `live:<uuid>` plus heartbeat RPC |
| high-frequency reactions | private Broadcast topic when scaled; short-retention table initially |

## Authorization

Private Broadcast/Presence channels are authorized by RLS on `realtime.messages`. A subscriber must be authenticated, the topic must encode a valid live UUID and the live must be visible or related to the user. Send permission additionally requires an active live and a non-banned user.

The client must set Realtime authentication before subscribing and use `config: { private: true }`.

## Viewer semantics

- `total_views`: persistent unique authenticated users per live, incremented once.
- `current_viewers`: count of non-expired server-owned viewer sessions.
- Multiple tabs and refreshes do not create multiple unique views.
- Disconnect is handled by Presence for UI responsiveness; expiry handles missing disconnect events.
- The browser cannot write `total_views` or arbitrary viewer rows.

## Scale notes

Postgres Changes is intentionally limited to durable moderate-frequency data. If chat volume becomes large, chat fan-out should move to Broadcast from a trusted insert trigger/worker while PostgreSQL remains the durable store. Reactions should not accumulate indefinitely; expiration cleanup is required.

