-- Deny-by-default authorization for the Zytrix relational schema.

create or replace function private.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select check_user_id is not null and exists (
    select 1 from public.admins a
    where a.user_id = check_user_id and a.active
  );
$$;

create or replace function private.is_verified_user()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((select auth.jwt() ->> 'email_verified')::boolean, false);
$$;

create or replace function private.is_globally_banned(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select check_user_id is not null and exists (
    select 1 from public.moderation_penalties p
    where p.user_id = check_user_id
      and p.active
      and p.type = 'ban'
      and (p.expires_at is null or p.expires_at > now())
  );
$$;

create or replace function private.owns_channel(check_channel_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select check_user_id is not null and exists (
    select 1 from public.channels c
    where c.id = check_channel_id and c.owner_id = check_user_id and c.deleted_at is null
  );
$$;

create or replace function private.owns_live(check_live_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select check_user_id is not null and exists (
    select 1 from public.lives l
    where l.id = check_live_id and l.owner_id = check_user_id and l.deleted_at is null
  );
$$;

create or replace function private.can_moderate_live(check_live_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select check_user_id is not null and (
    private.is_admin(check_user_id)
    or private.owns_live(check_live_id, check_user_id)
    or exists (
      select 1 from public.live_moderators m
      where m.live_id = check_live_id and m.user_id = check_user_id
    )
  );
$$;

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

revoke all on function private.is_admin(uuid) from public;
revoke all on function private.is_verified_user() from public;
revoke all on function private.is_globally_banned(uuid) from public;
revoke all on function private.owns_channel(uuid, uuid) from public;
revoke all on function private.owns_live(uuid, uuid) from public;
revoke all on function private.can_moderate_live(uuid, uuid) from public;
revoke all on function private.can_access_live(uuid, uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;
grant execute on function private.is_verified_user() to authenticated;
grant execute on function private.is_globally_banned(uuid) to authenticated;
grant execute on function private.owns_channel(uuid, uuid) to authenticated;
grant execute on function private.owns_live(uuid, uuid) to authenticated;
grant execute on function private.can_moderate_live(uuid, uuid) to authenticated;
grant execute on function private.can_access_live(uuid, uuid) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_accounts','admins','profiles','channels','channel_profiles','categories','lives',
    'follows','channel_members','live_moderators','live_schedules','rewards','creator_codes',
    'user_preferences','notification_states','watch_history','user_progress','followed_categories',
    'creator_attributions','chat_settings','chat_messages','live_bans','live_reactions','polls',
    'poll_options','poll_votes','wallets','zy_coin_transactions','zy_coin_orders','support_alerts',
    'coin_promotions','promotion_claims','reward_redemptions','clips','moderation_penalties',
    'moderation_actions','governance_config','reports','moderation_audit','policy_acceptances',
    'featured_streamers','audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

-- Account/auth metadata.
grant select on public.user_accounts to authenticated;
create policy user_accounts_select_own_or_admin on public.user_accounts
for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

grant select on public.admins to authenticated;
create policy admins_get_self_or_admin on public.admins
for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Public profiles; mutations are RPC-only to enforce field allowlists and cooldowns.
grant select on public.profiles to anon, authenticated;
create policy profiles_public_select on public.profiles
for select to anon, authenticated using (true);

-- Channels and lives are public-readable. Sensitive state transitions are RPC-only.
grant select on public.channels to anon, authenticated;
create policy channels_public_select on public.channels
for select to anon, authenticated
using (visibility = 'public' and deleted_at is null or (select private.owns_channel(id)) or (select private.is_admin()));

grant insert on public.channels to authenticated;
grant update (name, slug, description, avatar_url, banner_url, category_id, visibility) on public.channels to authenticated;
create policy channels_owner_insert on public.channels
for insert to authenticated
with check (owner_id = (select auth.uid()) and not (select private.is_globally_banned()));
create policy channels_owner_update on public.channels
for update to authenticated
using (owner_id = (select auth.uid()) or (select private.is_admin()))
with check (owner_id = (select auth.uid()) or (select private.is_admin()));

grant select on public.channel_profiles to anon, authenticated;
grant insert, update, delete on public.channel_profiles to authenticated;
create policy channel_profiles_public_select on public.channel_profiles
for select to anon, authenticated using (true);
create policy channel_profiles_owner_insert on public.channel_profiles
for insert to authenticated
with check ((select private.owns_channel(channel_id)) or (select private.is_admin()));
create policy channel_profiles_owner_update on public.channel_profiles
for update to authenticated
using ((select private.owns_channel(channel_id)) or (select private.is_admin()))
with check ((select private.owns_channel(channel_id)) or (select private.is_admin()));
create policy channel_profiles_owner_delete on public.channel_profiles
for delete to authenticated
using ((select private.owns_channel(channel_id)) or (select private.is_admin()));

grant select on public.categories to anon, authenticated;
create policy categories_public_select on public.categories
for select to anon, authenticated using (active or (select private.is_admin()));

grant select on public.lives to anon, authenticated;
create policy lives_public_select on public.lives
for select to anon, authenticated
using (visibility = 'public' and deleted_at is null or owner_id = (select auth.uid()) or (select private.is_admin()));

-- Social graph.
grant select, insert, delete on public.follows to authenticated;
create policy follows_select_participant_or_admin on public.follows
for select to authenticated
using (
  follower_id = (select auth.uid())
  or (select private.owns_channel(channel_id))
  or (select private.is_admin())
);
create policy follows_insert_self on public.follows
for insert to authenticated
with check (follower_id = (select auth.uid()) and not (select private.is_globally_banned()));
create policy follows_delete_self_or_channel_owner on public.follows
for delete to authenticated
using (
  follower_id = (select auth.uid())
  or (select private.owns_channel(channel_id))
  or (select private.is_admin())
);

grant select, insert, delete on public.channel_members to authenticated;
create policy channel_members_select_participant on public.channel_members
for select to authenticated
using (user_id = (select auth.uid()) or (select private.owns_channel(channel_id)) or (select private.is_admin()));
create policy channel_members_owner_insert on public.channel_members
for insert to authenticated
with check (((select private.owns_channel(channel_id)) or (select private.is_admin())) and added_by = (select auth.uid()));
create policy channel_members_owner_delete on public.channel_members
for delete to authenticated
using ((select private.owns_channel(channel_id)) or (select private.is_admin()));

grant select, insert, delete on public.live_moderators to authenticated;
create policy live_moderators_select_authorized on public.live_moderators
for select to authenticated
using (user_id = (select auth.uid()) or (select private.owns_live(live_id)) or (select private.is_admin()));
create policy live_moderators_owner_insert on public.live_moderators
for insert to authenticated
with check (((select private.owns_live(live_id)) or (select private.is_admin())) and added_by = (select auth.uid()));
create policy live_moderators_owner_delete on public.live_moderators
for delete to authenticated
using ((select private.owns_live(live_id)) or (select private.is_admin()));

-- Channel content.
grant select on public.live_schedules, public.rewards, public.creator_codes to anon, authenticated;
grant insert, update, delete on public.live_schedules, public.rewards, public.creator_codes to authenticated;
create policy schedules_public_select on public.live_schedules for select to anon, authenticated using (true);
create policy schedules_owner_insert on public.live_schedules for insert to authenticated
with check ((select private.owns_channel(channel_id)) or (select private.is_admin()));
create policy schedules_owner_update on public.live_schedules for update to authenticated
using ((select private.owns_channel(channel_id)) or (select private.is_admin()))
with check ((select private.owns_channel(channel_id)) or (select private.is_admin()));
create policy schedules_owner_delete on public.live_schedules for delete to authenticated
using ((select private.owns_channel(channel_id)) or (select private.is_admin()));
create policy rewards_public_select on public.rewards for select to anon, authenticated using (true);
create policy rewards_owner_insert on public.rewards for insert to authenticated
with check ((select private.owns_channel(channel_id)) or (select private.is_admin()));
create policy rewards_owner_update on public.rewards for update to authenticated
using ((select private.owns_channel(channel_id)) or (select private.is_admin()))
with check ((select private.owns_channel(channel_id)) or (select private.is_admin()));
create policy rewards_owner_delete on public.rewards for delete to authenticated
using ((select private.owns_channel(channel_id)) or (select private.is_admin()));
create policy creator_codes_public_select on public.creator_codes for select to anon, authenticated using (true);
create policy creator_codes_owner_insert on public.creator_codes for insert to authenticated
with check (creator_id = (select auth.uid()) and not (select private.is_globally_banned()));
create policy creator_codes_owner_update on public.creator_codes for update to authenticated
using (creator_id = (select auth.uid()) or (select private.is_admin()))
with check (creator_id = (select auth.uid()) or (select private.is_admin()));
create policy creator_codes_owner_delete on public.creator_codes for delete to authenticated
using (creator_id = (select auth.uid()) or (select private.is_admin()));

-- Private user-owned product state.
grant select, insert, update, delete on public.user_preferences, public.notification_states,
  public.watch_history, public.followed_categories, public.creator_attributions to authenticated;
grant select on public.user_progress to authenticated;

create policy preferences_own_all on public.user_preferences for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy notification_states_own_all on public.notification_states for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy watch_history_own_all on public.watch_history for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy progress_own_select on public.user_progress for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy followed_categories_own_all on public.followed_categories for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy creator_attributions_own_all on public.creator_attributions for all to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));

-- Chat and live interactions. Message/reaction/vote creation is RPC-only.
grant select on public.chat_settings, public.chat_messages, public.live_reactions, public.polls, public.poll_options to anon, authenticated;
create policy chat_settings_public_select on public.chat_settings for select to anon, authenticated using (true);
create policy chat_messages_public_visible on public.chat_messages for select to anon, authenticated
using (status = 'visible' or sender_id = (select auth.uid()) or (select private.can_moderate_live(live_id)));
create policy reactions_public_unexpired on public.live_reactions for select to anon, authenticated
using (expires_at > now());
create policy polls_public_select on public.polls for select to anon, authenticated using (true);
create policy poll_options_public_select on public.poll_options for select to anon, authenticated using (true);

grant select, insert, update, delete on public.chat_settings to authenticated;
create policy chat_settings_moderator_insert on public.chat_settings for insert to authenticated
with check ((select private.can_moderate_live(live_id)) and updated_by = (select auth.uid()));
create policy chat_settings_moderator_update on public.chat_settings for update to authenticated
using ((select private.can_moderate_live(live_id)))
with check ((select private.can_moderate_live(live_id)) and updated_by = (select auth.uid()));
create policy chat_settings_moderator_delete on public.chat_settings for delete to authenticated
using ((select private.can_moderate_live(live_id)));

grant select on public.live_bans to authenticated;
create policy live_bans_select_subject_or_moderator on public.live_bans for select to authenticated
using (user_id = (select auth.uid()) or (select private.can_moderate_live(live_id)));

grant select on public.poll_votes to authenticated;
create policy poll_votes_select_own_or_moderator on public.poll_votes for select to authenticated
using (user_id = (select auth.uid()) or (select private.can_moderate_live((select p.live_id from public.polls p where p.id = poll_id))));

-- Financial data is readable by participants; every write is RPC/backend-only.
grant select on public.wallets, public.zy_coin_transactions, public.zy_coin_orders,
  public.promotion_claims, public.reward_redemptions to authenticated;
create policy wallets_select_own_or_admin on public.wallets for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy transactions_select_participant on public.zy_coin_transactions for select to authenticated
using (from_user_id = (select auth.uid()) or to_user_id = (select auth.uid()) or (select private.is_admin()));
create policy orders_select_own_or_admin on public.zy_coin_orders for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy promotion_claims_select_own_or_admin on public.promotion_claims for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy redemptions_select_participant on public.reward_redemptions for select to authenticated
using (user_id = (select auth.uid()) or (select private.owns_channel(channel_id)) or (select private.is_admin()));

grant select on public.support_alerts, public.coin_promotions to anon, authenticated;
create policy support_alerts_public_unexpired on public.support_alerts for select to anon, authenticated
using (expires_at > now());
create policy promotions_public_active on public.coin_promotions for select to anon, authenticated
using (active and starts_at <= now() and ends_at >= now() or (select private.is_admin()));

-- Clips.
grant select on public.clips to anon, authenticated;
create policy clips_public_select on public.clips for select to anon, authenticated
using (visibility = 'public' and deleted_at is null or creator_id = (select auth.uid()) or streamer_id = (select auth.uid()) or (select private.is_admin()));

-- Moderation and reports.
grant select on public.moderation_penalties to authenticated;
create policy penalties_subject_or_admin on public.moderation_penalties for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

grant select on public.moderation_actions, public.moderation_audit, public.audit_logs to authenticated;
create policy moderation_actions_admin_select on public.moderation_actions for select to authenticated
using ((select private.is_admin()));
create policy moderation_audit_admin_select on public.moderation_audit for select to authenticated
using ((select private.is_admin()));
create policy audit_logs_admin_select on public.audit_logs for select to authenticated
using ((select private.is_admin()));

grant select on public.governance_config to anon, authenticated;
create policy governance_public_select on public.governance_config for select to anon, authenticated using (true);

grant select on public.reports to authenticated;
create policy reports_owner_or_admin_select on public.reports for select to authenticated
using (reporter_id = (select auth.uid()) or (select private.is_admin()));

grant select, insert on public.policy_acceptances to authenticated;
create policy policy_acceptances_owner_select on public.policy_acceptances for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy policy_acceptances_owner_insert on public.policy_acceptances for insert to authenticated
with check (
  user_id = (select auth.uid())
  and accepted_at >= now() - interval '10 seconds'
  and exists (
    select 1 from public.governance_config g
    where g.singleton and g.terms_effective
      and ((policy = 'terms' and version = g.terms_version) or (policy = 'privacy' and version = g.privacy_version))
  )
);

grant select on public.featured_streamers to anon, authenticated;
create policy featured_streamers_public_select on public.featured_streamers for select to anon, authenticated using (true);

-- Sequence access remains denied; audit writes happen only inside privileged functions.
revoke all on all sequences in schema public from anon, authenticated;
