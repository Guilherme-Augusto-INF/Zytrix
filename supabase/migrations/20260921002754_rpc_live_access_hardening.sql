-- Harden SECURITY DEFINER live RPCs against UUID-based access to private lives.

create or replace function private.can_access_live(check_live_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select check_user_id is not null and exists (
    select 1
    from public.lives l
    where l.id = check_live_id
      and l.deleted_at is null
      and (
        l.visibility in ('public', 'unlisted')
        or l.owner_id = check_user_id
        or private.is_admin(check_user_id)
        or exists (
          select 1 from public.channel_members m
          where m.channel_id = l.channel_id and m.user_id = check_user_id
        )
        or exists (
          select 1 from public.live_moderators m
          where m.live_id = l.id and m.user_id = check_user_id
        )
      )
  );
$$;

revoke all on function private.can_access_live(uuid, uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.can_access_live(uuid, uuid) to authenticated;

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
