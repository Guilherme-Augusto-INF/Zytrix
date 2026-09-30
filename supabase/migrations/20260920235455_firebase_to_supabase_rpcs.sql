-- Controlled operations that replace client-coordinated Firestore batches.

create or replace function private.assert_authenticated()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return caller;
end;
$$;

create or replace function private.valid_streaming_url(value text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select value ~ '^https://(www\.|m\.|player\.)?twitch\.tv/'
      or value ~ '^https://(www\.|player\.)?kick\.com/'
      or value ~ '^https://(www\.|m\.)?youtube\.com/(watch\?v=[A-Za-z0-9_-]{11}|live/[A-Za-z0-9_-]{11}|embed/[A-Za-z0-9_-]{11})'
      or value ~ '^https://(www\.)?youtu\.be/[A-Za-z0-9_-]{11}';
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_name text := coalesce(new.raw_app_meta_data ->> 'provider', 'password');
  generated_username text := 'user_' || substring(replace(new.id::text, '-', '') from 1 for 12);
begin
  insert into public.user_accounts (user_id, zytrix_id, email, provider, created_at, last_login_at)
  values (
    new.id,
    'ZY-' || upper(substring(replace(new.id::text, '-', '') from 1 for 12)),
    coalesce(new.email, new.id::text || '@invalid.local'),
    case when provider_name = 'google' then 'google' else 'password' end,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (user_id) do nothing;

  insert into public.profiles (user_id, username, created_at, username_updated_at)
  values (new.id, generated_username, coalesce(new.created_at, now()), now())
  on conflict (user_id) do nothing;

  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function public.update_my_profile(
  new_username text default null,
  new_photo_url text default null,
  new_bio text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  current_profile public.profiles;
  result_profile public.profiles;
  desired_username text;
begin
  select * into current_profile from public.profiles where user_id = caller for update;
  if not found then raise exception 'profile_not_found'; end if;

  desired_username := coalesce(new_username, current_profile.username);
  if desired_username !~ '^[A-Za-z0-9_.-]{2,30}$' then
    raise exception 'invalid_username';
  end if;
  if exists (select 1 from private.reserved_usernames r where r.username_key = lower(desired_username)) then
    raise exception 'reserved_username';
  end if;
  if desired_username <> current_profile.username
     and now() < current_profile.username_updated_at + interval '7 days' then
    raise exception 'username_cooldown';
  end if;
  if new_photo_url is not null and (char_length(new_photo_url) > 2048 or (new_photo_url <> '' and new_photo_url !~ '^https://')) then
    raise exception 'invalid_photo_url';
  end if;
  if new_bio is not null and char_length(new_bio) > 500 then
    raise exception 'invalid_bio';
  end if;

  update public.profiles
  set username = desired_username,
      username_updated_at = case when desired_username <> current_profile.username then now() else username_updated_at end,
      photo_url = coalesce(new_photo_url, photo_url),
      bio = coalesce(new_bio, bio)
  where user_id = caller
  returning * into result_profile;
  return result_profile;
end;
$$;

create or replace function public.create_live(
  channel_uuid uuid,
  live_title text,
  live_description text,
  live_category_id text,
  live_thumbnail_url text,
  live_playback_url text,
  is_mature boolean default false
)
returns public.lives
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  created_live public.lives;
begin
  if not private.is_verified_user() then raise exception 'verified_email_required'; end if;
  if private.is_globally_banned(caller) then raise exception 'user_banned'; end if;
  if not private.owns_channel(channel_uuid, caller) then raise exception 'channel_not_owned' using errcode = '42501'; end if;
  if char_length(live_title) not between 1 and 120 then raise exception 'invalid_title'; end if;
  if char_length(coalesce(live_description, '')) > 2000 then raise exception 'invalid_description'; end if;
  if not private.valid_streaming_url(live_playback_url) then raise exception 'invalid_playback_url'; end if;

  insert into public.lives (
    channel_id, owner_id, title, description, category_id, thumbnail_url, playback_url, mature_content
  ) values (
    channel_uuid, caller, live_title, coalesce(live_description, ''), live_category_id,
    coalesce(live_thumbnail_url, ''), live_playback_url, is_mature
  ) returning * into created_live;
  return created_live;
end;
$$;

create or replace function public.set_live_status(live_uuid uuid, new_status text)
returns public.lives
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  current_live public.lives;
  result_live public.lives;
begin
  select * into current_live from public.lives where id = live_uuid and deleted_at is null for update;
  if not found then raise exception 'live_not_found'; end if;
  if current_live.owner_id <> caller and not private.is_admin(caller) then raise exception 'forbidden' using errcode = '42501'; end if;
  if caller = current_live.owner_id and private.is_globally_banned(caller) then raise exception 'user_banned'; end if;
  if not (
    (current_live.status = 'created' and new_status in ('live', 'cancelled')) or
    (current_live.status = 'live' and new_status = 'ended') or
    (private.is_admin(caller) and new_status in ('created', 'live', 'ended', 'cancelled'))
  ) then raise exception 'invalid_live_transition'; end if;

  update public.lives
  set status = new_status,
      started_at = case when new_status = 'live' then coalesce(started_at, now()) else started_at end,
      ended_at = case when new_status in ('ended', 'cancelled') then now() else null end
  where id = live_uuid returning * into result_live;

  update public.channels
  set is_live = (new_status = 'live'),
      current_live_id = case when new_status = 'live' then live_uuid else null end
  where id = current_live.channel_id;
  return result_live;
end;
$$;

create or replace function public.send_chat_message(live_uuid uuid, message_text text, reply_to uuid default null)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  live_row public.lives;
  settings_row public.chat_settings;
  ban_row public.live_bans;
  slow_seconds integer := 1;
  rate_ok uuid;
  created_message public.chat_messages;
  moderator boolean;
begin
  if not private.is_verified_user() then raise exception 'verified_email_required'; end if;
  if private.is_globally_banned(caller) then raise exception 'user_banned'; end if;
  if message_text is null or char_length(message_text) not between 1 and 300 then raise exception 'invalid_message'; end if;

  select * into live_row from public.lives where id = live_uuid and deleted_at is null;
  if not found or live_row.status <> 'live' then raise exception 'live_not_active'; end if;
  if not private.can_access_live(live_uuid, caller) then raise exception 'live_access_denied' using errcode = '42501'; end if;
  moderator := private.can_moderate_live(live_uuid, caller);

  select * into ban_row from public.live_bans where live_id = live_uuid and user_id = caller;
  if found and ban_row.revoked_at is null and (ban_row.expires_at is null or ban_row.expires_at > now()) then
    raise exception 'chat_restricted';
  end if;

  select * into settings_row from public.chat_settings where live_id = live_uuid;
  if found and not moderator then
    if settings_row.emergency_mode then raise exception 'chat_emergency_mode'; end if;
    if settings_row.mode = 'followers' and not exists (
      select 1 from public.follows f where f.channel_id = live_row.channel_id and f.follower_id = caller
    ) then raise exception 'followers_only'; end if;
    if settings_row.mode = 'members' and not exists (
      select 1 from public.channel_members m where m.channel_id = live_row.channel_id and m.user_id = caller
    ) then raise exception 'members_only'; end if;
    if not settings_row.allow_links and message_text ~* '(https?://|www\.)' then raise exception 'links_not_allowed'; end if;
    slow_seconds := greatest(settings_row.slow_mode_seconds, 1);
  end if;

  if not moderator then
    insert into private.chat_rate_limits (live_id, user_id, last_at, expires_at)
    values (live_uuid, caller, now(), now() + interval '3 hours')
    on conflict (live_id, user_id) do update
      set last_at = excluded.last_at, expires_at = excluded.expires_at
      where private.chat_rate_limits.last_at + make_interval(secs => slow_seconds) <= excluded.last_at
    returning user_id into rate_ok;
    if rate_ok is null then raise exception 'slow_mode_rate_limit'; end if;
  end if;

  if reply_to is not null and not exists (
    select 1 from public.chat_messages m where m.id = reply_to and m.live_id = live_uuid
  ) then raise exception 'invalid_reply_target'; end if;

  insert into public.chat_messages (live_id, sender_id, reply_to_id, text)
  values (live_uuid, caller, reply_to, message_text)
  returning * into created_message;
  return created_message;
end;
$$;

create or replace function public.remove_chat_message(message_uuid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  message_row public.chat_messages;
begin
  select * into message_row from public.chat_messages where id = message_uuid for update;
  if not found then raise exception 'message_not_found'; end if;
  if message_row.sender_id <> caller and not private.can_moderate_live(message_row.live_id, caller) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not private.is_admin(caller) and private.is_admin(message_row.sender_id) then
    raise exception 'cannot_moderate_admin' using errcode = '42501';
  end if;
  update public.chat_messages
  set status = case when sender_id = caller then 'deleted_by_author' else 'removed_by_moderator' end,
      deleted_at = now(), deleted_by = caller
  where id = message_uuid;
end;
$$;

create or replace function public.set_live_ban(
  live_uuid uuid,
  target_user uuid,
  ban_kind text,
  ban_reason text default '',
  ban_expires_at timestamptz default null
)
returns public.live_bans
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  result_ban public.live_bans;
begin
  if not private.can_moderate_live(live_uuid, caller) then raise exception 'forbidden' using errcode = '42501'; end if;
  if ban_kind not in ('mute', 'ban') then raise exception 'invalid_ban_kind'; end if;
  if private.owns_live(live_uuid, target_user) or (private.is_admin(target_user) and not private.is_admin(caller)) then
    raise exception 'protected_target' using errcode = '42501';
  end if;
  if char_length(coalesce(ban_reason, '')) > 500 then raise exception 'invalid_reason'; end if;
  insert into public.live_bans (live_id, user_id, kind, reason, banned_by, created_at, expires_at)
  values (live_uuid, target_user, ban_kind, coalesce(ban_reason, ''), caller, now(), ban_expires_at)
  on conflict (live_id, user_id) do update set
    kind = excluded.kind, reason = excluded.reason, banned_by = excluded.banned_by,
    created_at = excluded.created_at, expires_at = excluded.expires_at,
    revoked_at = null, revoked_by = null
  returning * into result_ban;
  return result_ban;
end;
$$;

create or replace function public.send_live_reaction(live_uuid uuid, reaction_emoji text)
returns public.live_reactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  rate_ok uuid;
  result_reaction public.live_reactions;
begin
  if not private.is_verified_user() or private.is_globally_banned(caller) then raise exception 'not_allowed'; end if;
  if reaction_emoji not in ('❤️', '😂', '🔥', '👏', '😮') then raise exception 'invalid_reaction'; end if;
  if not exists (select 1 from public.lives where id = live_uuid and status = 'live' and deleted_at is null) then
    raise exception 'live_not_active';
  end if;
  if not private.can_access_live(live_uuid, caller) then raise exception 'live_access_denied' using errcode = '42501'; end if;
  insert into private.reaction_rate_limits (live_id, user_id, last_at, expires_at)
  values (live_uuid, caller, now(), now() + interval '3 hours')
  on conflict (live_id, user_id) do update
    set last_at = excluded.last_at, expires_at = excluded.expires_at
    where private.reaction_rate_limits.last_at + interval '1 second' <= excluded.last_at
  returning user_id into rate_ok;
  if rate_ok is null then raise exception 'reaction_rate_limit'; end if;
  insert into public.live_reactions (live_id, user_id, emoji, expires_at)
  values (live_uuid, caller, reaction_emoji, now() + interval '10 minutes')
  returning * into result_reaction;
  return result_reaction;
end;
$$;

create or replace function public.cast_poll_vote(poll_uuid uuid, option_uuid uuid)
returns public.poll_votes
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  poll_row public.polls;
  created_vote public.poll_votes;
begin
  if not private.is_verified_user() or private.is_globally_banned(caller) then raise exception 'not_allowed'; end if;
  select * into poll_row from public.polls where id = poll_uuid for update;
  if not found or poll_row.status <> 'active' then raise exception 'poll_not_active'; end if;
  if not private.can_access_live(poll_row.live_id, caller) then raise exception 'live_access_denied' using errcode = '42501'; end if;
  if not exists (select 1 from public.poll_options o where o.id = option_uuid and o.poll_id = poll_uuid) then
    raise exception 'invalid_poll_option';
  end if;
  insert into public.poll_votes (poll_id, option_id, user_id)
  values (poll_uuid, option_uuid, caller)
  returning * into created_vote;
  update public.poll_options set vote_count = vote_count + 1 where id = option_uuid;
  return created_vote;
exception when unique_violation then
  raise exception 'duplicate_vote';
end;
$$;

create or replace function public.heartbeat_viewer(live_uuid uuid)
returns table (current_viewers bigint, total_views bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  inserted_unique integer;
begin
  if not exists (select 1 from public.lives where id = live_uuid and status = 'live' and deleted_at is null) then
    raise exception 'live_not_active';
  end if;
  if not private.can_access_live(live_uuid, caller) then raise exception 'live_access_denied' using errcode = '42501'; end if;
  insert into private.live_viewer_sessions (live_id, user_id, joined_at, last_seen_at, expires_at)
  values (live_uuid, caller, now(), now(), now() + interval '2 minutes')
  on conflict (live_id, user_id) do update
    set last_seen_at = excluded.last_seen_at, expires_at = excluded.expires_at;

  insert into private.live_unique_views (live_id, user_id)
  values (live_uuid, caller) on conflict do nothing;
  get diagnostics inserted_unique = row_count;
  if inserted_unique = 1 then
    update public.lives set total_views = total_views + 1 where id = live_uuid;
  end if;

  return query
  select count(*)::bigint, l.total_views
  from private.live_viewer_sessions s
  join public.lives l on l.id = s.live_id
  where s.live_id = live_uuid and s.expires_at > now()
  group by l.total_views;
end;
$$;

create or replace function public.current_viewer_count(live_uuid uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  result_count bigint;
begin
  if not private.can_access_live(live_uuid, caller) then
    raise exception 'live_access_denied' using errcode = '42501';
  end if;
  select count(*)::bigint into result_count
  from private.live_viewer_sessions
  where live_id = live_uuid and expires_at > now();
  return result_count;
end;
$$;

create or replace function public.send_zy_coin_support(
  live_uuid uuid,
  coin_amount integer,
  request_key text,
  support_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  recipient uuid;
  transaction_uuid uuid;
  existing_uuid uuid;
begin
  if not private.is_verified_user() or private.is_globally_banned(caller) then raise exception 'not_allowed'; end if;
  if coin_amount not between 1 and 100000 then raise exception 'invalid_amount'; end if;
  if request_key is null or char_length(request_key) not between 8 and 128 then raise exception 'invalid_idempotency_key'; end if;
  if support_message is not null and char_length(support_message) > 120 then raise exception 'message_too_long'; end if;
  select owner_id into recipient from public.lives where id = live_uuid and status = 'live' and deleted_at is null;
  if recipient is null then raise exception 'live_not_active'; end if;
  if not private.can_access_live(live_uuid, caller) then raise exception 'live_access_denied' using errcode = '42501'; end if;
  if recipient = caller then raise exception 'self_support_forbidden'; end if;

  select id into existing_uuid from public.zy_coin_transactions where idempotency_key = request_key;
  if existing_uuid is not null then return existing_uuid; end if;

  insert into public.wallets (user_id) values (caller), (recipient) on conflict do nothing;
  perform 1 from public.wallets where user_id in (caller, recipient) order by user_id for update;
  if (select balance from public.wallets where user_id = caller) < coin_amount then raise exception 'insufficient_balance'; end if;

  insert into public.zy_coin_transactions (
    from_user_id, to_user_id, amount, type, live_id, idempotency_key, message
  ) values (caller, recipient, coin_amount, 'stream_support', live_uuid, request_key, support_message)
  returning id into transaction_uuid;

  update public.wallets set balance = balance - coin_amount, total_sent = total_sent + coin_amount where user_id = caller;
  update public.wallets set balance = balance + coin_amount, total_received = total_received + coin_amount where user_id = recipient;
  insert into public.support_alerts (transaction_id, live_id, from_user_id, amount, message, expires_at)
  values (transaction_uuid, live_uuid, caller, coin_amount, support_message, now() + interval '24 hours');
  return transaction_uuid;
end;
$$;

create or replace function public.redeem_reward(
  live_uuid uuid,
  reward_uuid uuid,
  request_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  reward_row public.rewards;
  recipient uuid;
  transaction_uuid uuid;
  existing_uuid uuid;
begin
  if not private.is_verified_user() or private.is_globally_banned(caller) then raise exception 'not_allowed'; end if;
  select r.* into reward_row from public.rewards r
  join public.lives l on l.channel_id = r.channel_id
  where r.id = reward_uuid and l.id = live_uuid and l.status = 'live' and r.active for update;
  if not found then raise exception 'reward_unavailable'; end if;
  if not private.can_access_live(live_uuid, caller) then raise exception 'live_access_denied' using errcode = '42501'; end if;
  select owner_id into recipient from public.channels where id = reward_row.channel_id;
  if recipient = caller then raise exception 'self_redemption_forbidden'; end if;
  select id into existing_uuid from public.zy_coin_transactions where idempotency_key = request_key;
  if existing_uuid is not null then return existing_uuid; end if;
  insert into public.wallets (user_id) values (caller), (recipient) on conflict do nothing;
  perform 1 from public.wallets where user_id in (caller, recipient) order by user_id for update;
  if (select balance from public.wallets where user_id = caller) < reward_row.cost then raise exception 'insufficient_balance'; end if;
  if reward_row.stock is not null and reward_row.stock <= 0 then raise exception 'out_of_stock'; end if;

  insert into public.zy_coin_transactions (
    from_user_id, to_user_id, amount, type, live_id, reward_id, idempotency_key
  ) values (caller, recipient, reward_row.cost, 'reward_redeem', live_uuid, reward_uuid, request_key)
  returning id into transaction_uuid;
  update public.wallets set balance = balance - reward_row.cost, total_sent = total_sent + reward_row.cost where user_id = caller;
  update public.wallets set balance = balance + reward_row.cost, total_received = total_received + reward_row.cost where user_id = recipient;
  if reward_row.stock is not null then update public.rewards set stock = stock - 1 where id = reward_uuid; end if;
  insert into public.reward_redemptions (reward_id, channel_id, user_id, transaction_id, cost)
  values (reward_uuid, reward_row.channel_id, caller, transaction_uuid, reward_row.cost);
  return transaction_uuid;
end;
$$;

create or replace function public.claim_coin_promotion(promotion_uuid uuid, request_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  promotion_row public.coin_promotions;
  transaction_uuid uuid;
  existing_uuid uuid;
begin
  if private.is_globally_banned(caller) then raise exception 'user_banned'; end if;
  select id into existing_uuid from public.zy_coin_transactions where idempotency_key = request_key;
  if existing_uuid is not null then return existing_uuid; end if;
  select * into promotion_row from public.coin_promotions where id = promotion_uuid for update;
  if not found or not promotion_row.active or now() not between promotion_row.starts_at and promotion_row.ends_at
     or promotion_row.claim_count >= promotion_row.max_claims then raise exception 'promotion_unavailable'; end if;
  if exists (select 1 from public.promotion_claims where promotion_id = promotion_uuid and user_id = caller) then
    raise exception 'promotion_already_claimed';
  end if;
  insert into public.wallets (user_id) values (caller) on conflict do nothing;
  perform 1 from public.wallets where user_id = caller for update;
  insert into public.zy_coin_transactions (
    from_user_id, to_user_id, amount, type, promotion_id, idempotency_key
  ) values (null, caller, promotion_row.amount, 'promotion_claim', promotion_uuid, request_key)
  returning id into transaction_uuid;
  insert into public.promotion_claims (promotion_id, user_id, transaction_id, amount)
  values (promotion_uuid, caller, transaction_uuid, promotion_row.amount);
  update public.coin_promotions set claim_count = claim_count + 1 where id = promotion_uuid;
  update public.wallets set balance = balance + promotion_row.amount where user_id = caller;
  return transaction_uuid;
end;
$$;

create or replace function public.create_report(
  report_target_type text,
  target_uuid uuid,
  report_reason text,
  report_description text default ''
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  config_row public.governance_config;
  created_report public.reports;
  previous_at timestamptz;
begin
  if not private.is_verified_user() then raise exception 'verified_email_required'; end if;
  select * into config_row from public.governance_config where singleton;
  if not found or not config_row.reports_enabled then raise exception 'reports_disabled'; end if;
  if report_target_type not in ('profile', 'live', 'chat') then raise exception 'invalid_target_type'; end if;
  if report_reason not in ('child_safety','sexual','violence','hate','harassment','privacy','self_harm','fraud','malware','spam','copyright','impersonation','other') then raise exception 'invalid_reason'; end if;
  if char_length(coalesce(report_description, '')) > 1000 then raise exception 'description_too_long'; end if;
  select last_at into previous_at from private.report_rate_limits where user_id = caller for update;
  if previous_at is not null and previous_at + interval '60 seconds' > now() then raise exception 'report_rate_limit'; end if;

  if report_target_type = 'profile' then
    if target_uuid = caller or not exists (select 1 from public.profiles where user_id = target_uuid) then raise exception 'invalid_target'; end if;
    insert into public.reports (reporter_id, target_type, target_profile_id, reason, description)
    values (caller, 'profile', target_uuid, report_reason, coalesce(report_description, '')) returning * into created_report;
  elsif report_target_type = 'live' then
    if not exists (select 1 from public.lives where id = target_uuid and owner_id <> caller) then raise exception 'invalid_target'; end if;
    insert into public.reports (reporter_id, target_type, target_live_id, reason, description)
    values (caller, 'live', target_uuid, report_reason, coalesce(report_description, '')) returning * into created_report;
  else
    if not exists (select 1 from public.chat_messages where id = target_uuid and sender_id <> caller) then raise exception 'invalid_target'; end if;
    insert into public.reports (reporter_id, target_type, target_chat_message_id, reason, description)
    values (caller, 'chat', target_uuid, report_reason, coalesce(report_description, '')) returning * into created_report;
  end if;

  insert into private.report_rate_limits (user_id, last_at, last_report_id)
  values (caller, now(), created_report.id)
  on conflict (user_id) do update set last_at = excluded.last_at, last_report_id = excluded.last_report_id;
  return created_report;
exception when unique_violation then
  raise exception 'duplicate_open_report';
end;
$$;

create or replace function public.close_report(report_uuid uuid, report_resolution text)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.assert_authenticated();
  result_report public.reports;
begin
  if not private.is_admin(caller) then raise exception 'admin_required' using errcode = '42501'; end if;
  if report_resolution not in ('no_violation','insufficient','target_unavailable','reviewed') then raise exception 'invalid_resolution'; end if;
  update public.reports
  set status = 'closed', resolution = report_resolution, reviewed_at = now(), reviewed_by = caller
  where id = report_uuid and status = 'open'
  returning * into result_report;
  if not found then raise exception 'open_report_not_found'; end if;
  insert into public.moderation_audit (report_id, action, resolution, moderator_id)
  values (report_uuid, 'close_report', report_resolution, caller);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (caller, 'close_report', 'report', report_uuid::text, jsonb_build_object('resolution', report_resolution));
  return result_report;
end;
$$;

-- Revoke the implicit PUBLIC execute grant on every exposed function, then grant only intended roles.
revoke execute on function public.update_my_profile(text,text,text) from public, anon;
revoke execute on function public.create_live(uuid,text,text,text,text,text,boolean) from public, anon;
revoke execute on function public.set_live_status(uuid,text) from public, anon;
revoke execute on function public.send_chat_message(uuid,text,uuid) from public, anon;
revoke execute on function public.remove_chat_message(uuid) from public, anon;
revoke execute on function public.set_live_ban(uuid,uuid,text,text,timestamptz) from public, anon;
revoke execute on function public.send_live_reaction(uuid,text) from public, anon;
revoke execute on function public.cast_poll_vote(uuid,uuid) from public, anon;
revoke execute on function public.heartbeat_viewer(uuid) from public, anon;
revoke execute on function public.current_viewer_count(uuid) from public;
revoke execute on function public.send_zy_coin_support(uuid,integer,text,text) from public, anon;
revoke execute on function public.redeem_reward(uuid,uuid,text) from public, anon;
revoke execute on function public.claim_coin_promotion(uuid,text) from public, anon;
revoke execute on function public.create_report(text,uuid,text,text) from public, anon;
revoke execute on function public.close_report(uuid,text) from public, anon;

grant execute on function public.update_my_profile(text,text,text) to authenticated;
grant execute on function public.create_live(uuid,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.set_live_status(uuid,text) to authenticated;
grant execute on function public.send_chat_message(uuid,text,uuid) to authenticated;
grant execute on function public.remove_chat_message(uuid) to authenticated;
grant execute on function public.set_live_ban(uuid,uuid,text,text,timestamptz) to authenticated;
grant execute on function public.send_live_reaction(uuid,text) to authenticated;
grant execute on function public.cast_poll_vote(uuid,uuid) to authenticated;
grant execute on function public.heartbeat_viewer(uuid) to authenticated;
grant execute on function public.current_viewer_count(uuid) to authenticated;
grant execute on function public.send_zy_coin_support(uuid,integer,text,text) to authenticated;
grant execute on function public.redeem_reward(uuid,uuid,text) to authenticated;
grant execute on function public.claim_coin_promotion(uuid,text) to authenticated;
grant execute on function public.create_report(text,uuid,text,text) to authenticated;
grant execute on function public.close_report(uuid,text) to authenticated;
