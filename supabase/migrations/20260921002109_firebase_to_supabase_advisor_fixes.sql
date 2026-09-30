-- Follow-up for findings from the Supabase Security and Performance Advisors.
-- Existing environments need these changes; the baseline migrations above already
-- contain the corrected policies and grants for clean installations.

revoke execute on function public.current_viewer_count(uuid) from anon;

drop policy if exists channel_profiles_owner_write on public.channel_profiles;
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

drop policy if exists schedules_owner_write on public.live_schedules;
create policy schedules_owner_insert on public.live_schedules for insert to authenticated
with check ((select private.owns_channel(channel_id)) or (select private.is_admin()));
create policy schedules_owner_update on public.live_schedules for update to authenticated
using ((select private.owns_channel(channel_id)) or (select private.is_admin()))
with check ((select private.owns_channel(channel_id)) or (select private.is_admin()));
create policy schedules_owner_delete on public.live_schedules for delete to authenticated
using ((select private.owns_channel(channel_id)) or (select private.is_admin()));

drop policy if exists rewards_owner_write on public.rewards;
create policy rewards_owner_insert on public.rewards for insert to authenticated
with check ((select private.owns_channel(channel_id)) or (select private.is_admin()));
create policy rewards_owner_update on public.rewards for update to authenticated
using ((select private.owns_channel(channel_id)) or (select private.is_admin()))
with check ((select private.owns_channel(channel_id)) or (select private.is_admin()));
create policy rewards_owner_delete on public.rewards for delete to authenticated
using ((select private.owns_channel(channel_id)) or (select private.is_admin()));

drop policy if exists chat_settings_moderator_write on public.chat_settings;
create policy chat_settings_moderator_insert on public.chat_settings for insert to authenticated
with check ((select private.can_moderate_live(live_id)) and updated_by = (select auth.uid()));
create policy chat_settings_moderator_update on public.chat_settings for update to authenticated
using ((select private.can_moderate_live(live_id)))
with check ((select private.can_moderate_live(live_id)) and updated_by = (select auth.uid()));
create policy chat_settings_moderator_delete on public.chat_settings for delete to authenticated
using ((select private.can_moderate_live(live_id)));

-- Cover foreign keys that participate in deletion checks and actual product queries.
create index if not exists follows_channel_fk_idx on public.follows(channel_id);
create index if not exists channel_members_user_fk_idx on public.channel_members(user_id);
create index if not exists channel_members_added_by_fk_idx on public.channel_members(added_by);
create index if not exists live_moderators_user_fk_idx on public.live_moderators(user_id);
create index if not exists live_moderators_added_by_fk_idx on public.live_moderators(added_by);
create index if not exists chat_messages_sender_fk_idx on public.chat_messages(sender_id);
create index if not exists chat_messages_reply_fk_idx on public.chat_messages(reply_to_id) where reply_to_id is not null;
create index if not exists live_bans_user_fk_idx on public.live_bans(user_id);
create index if not exists poll_options_poll_fk_idx on public.poll_options(poll_id);
create index if not exists poll_votes_user_fk_idx on public.poll_votes(user_id);
create index if not exists poll_votes_option_fk_idx on public.poll_votes(option_id);
create index if not exists watch_history_live_fk_idx on public.watch_history(live_id);
create index if not exists reward_redemptions_user_fk_idx on public.reward_redemptions(user_id, created_at desc);
create index if not exists reward_redemptions_reward_fk_idx on public.reward_redemptions(reward_id);
create index if not exists clips_live_fk_idx on public.clips(live_id) where live_id is not null;
create index if not exists reports_reporter_fk_idx on public.reports(reporter_id, created_at desc);
create index if not exists moderation_actions_moderator_fk_idx on public.moderation_actions(moderator_id, created_at desc);
create index if not exists viewer_sessions_user_fk_idx on private.live_viewer_sessions(user_id);
