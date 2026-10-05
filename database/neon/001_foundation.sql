-- Zytrix Firestore -> Neon native PostgreSQL relational foundation.
-- This migration is additive. It does not modify or delete Firebase data.

BEGIN;

create extension if not exists pgcrypto;
create schema if not exists private;

revoke all on schema private from public;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Preserve existing Firebase UID semantics during the database-only migration.
-- Authentication remains Firebase until a separately tested identity cutover.
create table public.identities (
  id uuid primary key,
  firebase_uid text not null unique,
  created_at timestamptz not null default now()
);
create table public.user_accounts (
  user_id uuid primary key references public.identities(id) on delete cascade,
  firebase_uid text unique,
  zytrix_id text not null unique,
  email text not null,
  provider text not null check (provider in ('password', 'google')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  migrated_at timestamptz,
  check (char_length(zytrix_id) between 5 and 64),
  check (char_length(email) <= 320)
);

create table private.firebase_user_map (
  firebase_uid text primary key,
  postgres_user_id uuid not null unique references public.identities(id) on delete cascade,
  source_email text,
  source_provider text,
  migrated_at timestamptz not null default now(),
  migration_batch_id uuid not null
);

create table public.admins (
  user_id uuid primary key references public.identities(id) on delete restrict,
  active boolean not null default true,
  granted_by uuid references public.identities(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.profiles (
  user_id uuid primary key references public.identities(id) on delete cascade,
  firebase_uid text unique,
  username text not null,
  username_key text generated always as (lower(btrim(username))) stored,
  photo_url text not null default '',
  bio text not null default '',
  created_at timestamptz not null default now(),
  username_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(username) between 2 and 30),
  check (username = btrim(username)),
  check (username ~ '^[A-Za-z0-9_.-]{2,30}$'),
  check (char_length(bio) <= 500),
  check (char_length(photo_url) <= 2048),
  unique (username_key)
);

create table private.reserved_usernames (
  username_key text primary key,
  reason text not null,
  created_at timestamptz not null default now()
);

insert into private.reserved_usernames (username_key, reason) values
  ('admin', 'system role'), ('administrator', 'system role'),
  ('moderator', 'system role'), ('zytrix', 'brand'),
  ('support', 'support impersonation'), ('security', 'security impersonation')
on conflict do nothing;

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  owner_id uuid not null unique references public.identities(id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  avatar_url text not null default '',
  banner_url text not null default '',
  category_id text,
  is_live boolean not null default false,
  current_live_id uuid,
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (char_length(name) between 1 and 80),
  check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  check (char_length(description) <= 800),
  unique (slug)
);

create table public.channel_profiles (
  channel_id uuid primary key references public.channels(id) on delete cascade,
  firebase_uid text unique,
  about text not null default '',
  games text not null default '',
  website text not null default '',
  youtube text not null default '',
  instagram text not null default '',
  tiktok text not null default '',
  updated_at timestamptz not null default now(),
  check (char_length(about) <= 800),
  check (char_length(games) <= 160)
);

create table private.channel_private_data (
  channel_id uuid not null references public.channels(id) on delete cascade,
  firebase_document_id text not null,
  payload jsonb not null default '{}'::jsonb,
  migrated_at timestamptz,
  primary key (channel_id, firebase_document_id)
);

create table public.categories (
  id text primary key,
  name text not null,
  parent_id text references public.categories(id) on delete restrict,
  active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lives (
  id uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  channel_id uuid not null references public.channels(id) on delete cascade,
  owner_id uuid not null references public.identities(id) on delete cascade,
  title text not null,
  description text not null default '',
  category_id text references public.categories(id) on delete set null,
  thumbnail_url text not null default '',
  playback_url text not null,
  status text not null default 'created' check (status in ('created', 'live', 'ended', 'cancelled')),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  mature_content boolean not null default false,
  support_alert_sound text not null default 'coin' check (support_alert_sound in ('coin', 'bell', 'pop', 'soft', 'none')),
  support_goal_label text,
  support_goal_coins bigint check (support_goal_coins between 0 and 10000000),
  support_alert_theme text check (support_alert_theme in ('classic', 'minimal', 'celebrate', 'neon')),
  support_alert_min_coins integer check (support_alert_min_coins between 1 and 100000),
  support_alert_duration_ms integer check (support_alert_duration_ms between 2500 and 10000),
  vod_url text,
  raid_target_live_id uuid references public.lives(id) on delete set null deferrable initially deferred,
  host_target_live_id uuid references public.lives(id) on delete set null deferrable initially deferred,
  total_views bigint not null default 0 check (total_views >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (char_length(title) between 1 and 120),
  check (char_length(description) <= 2000),
  check (char_length(playback_url) <= 2048),
  check (char_length(thumbnail_url) <= 2048),
  check (support_goal_label is null or char_length(support_goal_label) <= 60),
  check ((status <> 'live') or started_at is not null),
  check ((status <> 'ended') or ended_at is not null)
);

alter table public.channels
  add constraint channels_current_live_id_fkey
  foreign key (current_live_id) references public.lives(id) on delete set null deferrable initially deferred;

create unique index one_active_live_per_channel
  on public.lives(channel_id)
  where status = 'live' and deleted_at is null;

create table public.follows (
  follower_id uuid not null references public.identities(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  followed_at timestamptz not null default now(),
  primary key (follower_id, channel_id)
);

create table public.channel_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.identities(id) on delete cascade,
  added_by uuid not null references public.identities(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table public.live_moderators (
  live_id uuid not null references public.lives(id) on delete cascade,
  user_id uuid not null references public.identities(id) on delete cascade,
  added_by uuid not null references public.identities(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (live_id, user_id)
);

create table public.live_schedules (
  id uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  channel_id uuid not null references public.channels(id) on delete cascade,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(title) between 1 and 80),
  check (char_length(description) <= 500)
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  channel_id uuid not null references public.channels(id) on delete cascade,
  title text not null,
  description text not null default '',
  cost integer not null check (cost between 1 and 100000),
  active boolean not null default true,
  stock integer check (stock is null or stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(title) between 1 and 60),
  check (char_length(description) <= 160)
);

create table public.creator_codes (
  code text primary key check (code ~ '^[a-z0-9_-]{3,24}$'),
  creator_id uuid not null unique references public.identities(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references public.identities(id) on delete cascade,
  hide_mature_content boolean not null default false,
  safe_mode boolean not null default true,
  allow_reactions boolean not null default true,
  compact_alerts boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.notification_states (
  user_id uuid not null references public.identities(id) on delete cascade,
  state_type text not null check (state_type in ('zycoins', 'platform')),
  last_seen_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, state_type)
);

create table public.watch_history (
  user_id uuid not null references public.identities(id) on delete cascade,
  live_id uuid not null references public.lives(id) on delete cascade,
  first_watched_at timestamptz not null default now(),
  last_watched_at timestamptz not null default now(),
  watch_seconds bigint not null default 0 check (watch_seconds >= 0),
  primary key (user_id, live_id)
);

create table public.user_progress (
  user_id uuid primary key references public.identities(id) on delete cascade,
  xp bigint not null default 0 check (xp >= 0),
  watch_minutes bigint not null default 0 check (watch_minutes >= 0),
  streak_days integer not null default 0 check (streak_days >= 0),
  last_active_day date,
  last_live_id uuid references public.lives(id) on delete set null,
  last_watch_reward_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.followed_categories (
  user_id uuid not null references public.identities(id) on delete cascade,
  category_id text not null references public.categories(id) on delete cascade,
  followed_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

create table public.creator_attributions (
  user_id uuid primary key references public.identities(id) on delete cascade,
  creator_id uuid not null references public.identities(id) on delete cascade,
  creator_code text not null references public.creator_codes(code) on delete cascade,
  updated_at timestamptz not null default now(),
  check (user_id <> creator_id)
);

create table public.chat_settings (
  live_id uuid primary key references public.lives(id) on delete cascade,
  mode text not null default 'everyone' check (mode in ('everyone', 'followers', 'members')),
  slow_mode_seconds integer not null default 0 check (slow_mode_seconds between 0 and 120),
  allow_links boolean not null default false,
  block_excess_caps boolean not null default true,
  blocked_words text[] not null default '{}',
  emergency_mode boolean not null default false,
  pinned_message_id uuid,
  updated_by uuid not null references public.identities(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check (cardinality(blocked_words) <= 40)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  firebase_id text,
  live_id uuid not null references public.lives(id) on delete cascade,
  sender_id uuid not null references public.identities(id) on delete cascade,
  reply_to_id uuid references public.chat_messages(id) on delete set null deferrable initially deferred,
  text text not null,
  status text not null default 'visible' check (status in ('visible', 'deleted_by_author', 'removed_by_moderator')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.identities(id) on delete set null,
  check (char_length(text) between 1 and 300),
  unique (live_id, firebase_id)
);

alter table public.chat_settings
  add constraint chat_settings_pinned_message_id_fkey
  foreign key (pinned_message_id) references public.chat_messages(id) on delete set null;

create table public.live_bans (
  live_id uuid not null references public.lives(id) on delete cascade,
  user_id uuid not null references public.identities(id) on delete cascade,
  kind text not null check (kind in ('mute', 'ban')),
  reason text not null default '',
  banned_by uuid not null references public.identities(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.identities(id) on delete restrict,
  primary key (live_id, user_id),
  check (char_length(reason) <= 500)
);

create table private.chat_rate_limits (
  live_id uuid not null references public.lives(id) on delete cascade,
  user_id uuid not null references public.identities(id) on delete cascade,
  last_at timestamptz not null,
  expires_at timestamptz not null,
  primary key (live_id, user_id)
);

create table private.reaction_rate_limits (
  live_id uuid not null references public.lives(id) on delete cascade,
  user_id uuid not null references public.identities(id) on delete cascade,
  last_at timestamptz not null,
  expires_at timestamptz not null,
  primary key (live_id, user_id)
);

create table public.live_reactions (
  id uuid primary key default gen_random_uuid(),
  firebase_id text,
  live_id uuid not null references public.lives(id) on delete cascade,
  user_id uuid not null references public.identities(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😂', '🔥', '👏', '😮')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (live_id, firebase_id)
);

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  firebase_id text,
  live_id uuid not null references public.lives(id) on delete cascade,
  kind text not null check (kind in ('poll', 'prediction')),
  question text not null,
  status text not null default 'active' check (status in ('active', 'closed', 'resolved')),
  result_option_id uuid,
  created_by uuid not null references public.identities(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(question) between 1 and 100),
  unique (live_id, firebase_id)
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  position smallint not null check (position between 0 and 3),
  label text not null check (char_length(label) between 1 and 50),
  vote_count bigint not null default 0 check (vote_count >= 0),
  unique (poll_id, position)
);

alter table public.polls
  add constraint polls_result_option_id_fkey
  foreign key (result_option_id) references public.poll_options(id) on delete set null deferrable initially deferred;

create table public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.identities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create table private.live_viewer_sessions (
  live_id uuid not null references public.lives(id) on delete cascade,
  user_id uuid not null references public.identities(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (live_id, user_id)
);

create table private.live_unique_views (
  live_id uuid not null references public.lives(id) on delete cascade,
  user_id uuid not null references public.identities(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  primary key (live_id, user_id)
);

create table public.wallets (
  user_id uuid primary key references public.identities(id) on delete restrict,
  balance bigint not null default 0 check (balance >= 0),
  total_sent bigint not null default 0 check (total_sent >= 0),
  total_received bigint not null default 0 check (total_received >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.zy_coin_transactions (
  id uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  from_user_id uuid references public.identities(id) on delete restrict,
  to_user_id uuid references public.identities(id) on delete restrict,
  amount bigint not null check (amount between 1 and 100000),
  type text not null check (type in ('stream_support', 'reward_redeem', 'promotion_claim', 'purchase', 'admin_adjustment', 'refund')),
  status text not null default 'completed' check (status in ('pending', 'completed', 'reversed', 'failed')),
  live_id uuid references public.lives(id) on delete restrict,
  reward_id uuid references public.rewards(id) on delete restrict,
  promotion_id uuid,
  order_id uuid,
  idempotency_key text not null unique,
  reference text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reversed_transaction_id uuid references public.zy_coin_transactions(id) on delete restrict deferrable initially deferred,
  check (from_user_id is not null or type in ('promotion_claim', 'purchase', 'admin_adjustment')),
  check (to_user_id is not null or type in ('admin_adjustment', 'refund')),
  check (from_user_id is null or to_user_id is null or from_user_id <> to_user_id),
  check (message is null or char_length(message) <= 120)
);

create table public.zy_coin_orders (
  id uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  user_id uuid not null references public.identities(id) on delete restrict,
  package_id text not null check (package_id in ('zy100', 'zy500', 'zy1200', 'zy2500')),
  coins integer not null,
  price_cents integer not null,
  payment_method text not null check (payment_method in ('pix', 'card')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refunded')),
  mode text not null check (mode in ('prototype', 'admin_demo', 'payment_provider')),
  provider_reference text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check (
    (package_id = 'zy100' and coins = 100 and price_cents = 490) or
    (package_id = 'zy500' and coins = 500 and price_cents = 1490) or
    (package_id = 'zy1200' and coins = 1200 and price_cents = 2990) or
    (package_id = 'zy2500' and coins = 2500 and price_cents = 4990)
  )
);

alter table public.zy_coin_transactions
  add constraint zy_coin_transactions_order_id_fkey
  foreign key (order_id) references public.zy_coin_orders(id) on delete restrict;

create table public.support_alerts (
  transaction_id uuid primary key references public.zy_coin_transactions(id) on delete cascade,
  live_id uuid not null references public.lives(id) on delete cascade,
  from_user_id uuid not null references public.identities(id) on delete cascade,
  amount bigint not null check (amount > 0),
  message text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (message is null or char_length(message) <= 120)
);

create table public.coin_promotions (
  id uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  title text not null,
  description text not null default '',
  amount integer not null check (amount between 1 and 10000),
  max_claims integer not null check (max_claims between 1 and 100000),
  claim_count integer not null default 0 check (claim_count between 0 and max_claims),
  active boolean not null default true,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null references public.identities(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (char_length(title) between 1 and 60),
  check (char_length(description) <= 160)
);

alter table public.zy_coin_transactions
  add constraint zy_coin_transactions_promotion_id_fkey
  foreign key (promotion_id) references public.coin_promotions(id) on delete restrict;

create table public.promotion_claims (
  promotion_id uuid not null references public.coin_promotions(id) on delete restrict,
  user_id uuid not null references public.identities(id) on delete restrict,
  transaction_id uuid not null unique references public.zy_coin_transactions(id) on delete restrict,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  primary key (promotion_id, user_id)
);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  reward_id uuid not null references public.rewards(id) on delete restrict,
  channel_id uuid not null references public.channels(id) on delete restrict,
  user_id uuid not null references public.identities(id) on delete restrict,
  transaction_id uuid not null unique references public.zy_coin_transactions(id) on delete restrict,
  cost integer not null check (cost > 0),
  status text not null default 'pending_fulfillment' check (status in ('pending_fulfillment', 'fulfilled', 'cancelled', 'refunded')),
  created_at timestamptz not null default now(),
  fulfilled_by uuid references public.identities(id) on delete restrict,
  fulfilled_at timestamptz
);

create table public.clips (
  id uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  live_id uuid not null references public.lives(id) on delete cascade,
  streamer_id uuid not null references public.identities(id) on delete cascade,
  creator_id uuid not null references public.identities(id) on delete cascade,
  title text not null,
  moment_seconds integer not null check (moment_seconds >= 0),
  source_url text not null default '',
  thumbnail_url text not null default '',
  media_path text,
  mature_content boolean not null default false,
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (char_length(title) between 1 and 80)
);

create table public.moderation_penalties (
  user_id uuid primary key references public.identities(id) on delete restrict,
  type text not null check (type in ('warning', 'mute', 'ban')),
  reason text not null,
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid not null references public.identities(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(reason) between 1 and 500)
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  target_user_id uuid not null references public.identities(id) on delete restrict,
  action text not null check (action in ('apply', 'revoke', 'warn', 'mute', 'ban', 'content_remove', 'no_action')),
  penalty_type text not null check (penalty_type in ('none', 'warning', 'mute', 'ban')),
  reason text not null,
  moderator_id uuid not null references public.identities(id) on delete restrict,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (char_length(reason) between 1 and 500)
);

create table public.governance_config (
  singleton boolean primary key default true check (singleton),
  reports_enabled boolean not null default false,
  rules_version text not null,
  terms_version text not null,
  privacy_version text not null,
  terms_effective boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  reporter_id uuid not null references public.identities(id) on delete restrict,
  target_type text not null check (target_type in ('profile', 'live', 'chat')),
  target_profile_id uuid references public.profiles(user_id) on delete restrict,
  target_live_id uuid references public.lives(id) on delete restrict,
  target_chat_message_id uuid references public.chat_messages(id) on delete restrict,
  reason text not null check (reason in ('child_safety', 'sexual', 'violence', 'hate', 'harassment', 'privacy', 'self_harm', 'fraud', 'malware', 'spam', 'copyright', 'impersonation', 'other')),
  description text not null default '',
  status text not null default 'open' check (status in ('open', 'closed')),
  resolution text check (resolution in ('no_violation', 'insufficient', 'target_unavailable', 'reviewed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.identities(id) on delete restrict,
  check (char_length(description) <= 1000),
  check (num_nonnulls(target_profile_id, target_live_id, target_chat_message_id) = 1),
  check ((target_type = 'profile') = (target_profile_id is not null)),
  check ((target_type = 'live') = (target_live_id is not null)),
  check ((target_type = 'chat') = (target_chat_message_id is not null))
);

create unique index reports_open_profile_once
  on public.reports(reporter_id, target_profile_id)
  where status = 'open' and target_profile_id is not null;
create unique index reports_open_live_once
  on public.reports(reporter_id, target_live_id)
  where status = 'open' and target_live_id is not null;
create unique index reports_open_chat_once
  on public.reports(reporter_id, target_chat_message_id)
  where status = 'open' and target_chat_message_id is not null;

create table private.report_rate_limits (
  user_id uuid primary key references public.identities(id) on delete cascade,
  last_at timestamptz not null,
  last_report_id uuid references public.reports(id) on delete set null
);

create table public.moderation_audit (
  id uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  report_id uuid not null references public.reports(id) on delete restrict,
  action text not null check (action in ('close_report', 'reopen_report', 'escalate_report')),
  resolution text,
  moderator_id uuid not null references public.identities(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.policy_acceptances (
  user_id uuid not null references public.identities(id) on delete restrict,
  policy text not null check (policy in ('terms', 'privacy', 'community_guidelines', 'content_policy')),
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy, version)
);

create table public.featured_streamers (
  channel_id uuid primary key references public.channels(id) on delete cascade,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references public.identities(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.identities(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  request_id uuid,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table private.migration_runs (
  id uuid primary key default gen_random_uuid(),
  source_project text not null,
  source_commit text not null,
  status text not null check (status in ('started', 'validated', 'imported', 'reconciled', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  counts jsonb not null default '{}'::jsonb,
  checksums jsonb not null default '{}'::jsonb,
  differences jsonb not null default '{}'::jsonb
);

create index lives_feed_idx on public.lives(status, created_at desc) where deleted_at is null;
create index lives_channel_idx on public.lives(channel_id, created_at desc);
create index chat_messages_live_created_idx on public.chat_messages(live_id, created_at desc) where status = 'visible';
create index live_reactions_live_created_idx on public.live_reactions(live_id, created_at desc);
create index live_schedules_channel_starts_idx on public.live_schedules(channel_id, starts_at);
create index rewards_channel_active_idx on public.rewards(channel_id, active);
create index clips_created_idx on public.clips(created_at desc) where deleted_at is null;
create index clips_streamer_idx on public.clips(streamer_id, created_at desc) where deleted_at is null;
create index transactions_from_created_idx on public.zy_coin_transactions(from_user_id, created_at desc);
create index transactions_to_created_idx on public.zy_coin_transactions(to_user_id, created_at desc);
create index reports_status_created_idx on public.reports(status, created_at desc);
create index moderation_actions_target_idx on public.moderation_actions(target_user_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index viewer_sessions_active_idx on private.live_viewer_sessions(live_id, expires_at);

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger channels_set_updated_at before update on public.channels
for each row execute function private.set_updated_at();
create trigger lives_set_updated_at before update on public.lives
for each row execute function private.set_updated_at();
create trigger wallets_set_updated_at before update on public.wallets
for each row execute function private.set_updated_at();

comment on schema private is 'Server-only Zytrix data; never expose through the Data API.';
comment on table private.firebase_user_map is 'Stable Firebase UID to internal PostgreSQL identity UUID mapping.';
comment on table public.zy_coin_transactions is 'Append-only Zy Coins ledger; writes only through controlled RPC/backend.';
comment on table public.audit_logs is 'Append-only audit trail for sensitive operations; contains no secrets or raw tokens.';

COMMIT;
