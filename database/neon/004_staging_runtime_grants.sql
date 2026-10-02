-- Apply only to the verified staging branch, after creating zytrix_staging_app.
-- No owner credential belongs in the web application.
begin;
grant connect on database neondb to zytrix_staging_app;
grant usage on schema public, private to zytrix_staging_app;
grant select on public.identities,public.user_accounts,public.admins,
  public.profiles,public.channels,public.lives,public.wallets,public.chat_messages,
  public.chat_settings,public.live_bans,public.live_moderators,public.channel_members,
  public.follows,public.moderation_penalties,public.zy_coin_transactions,
  public.live_feed,private.reserved_usernames to zytrix_staging_app;
grant update(username,bio,username_updated_at) on public.profiles to zytrix_staging_app;
grant insert on public.wallets,public.chat_messages,public.zy_coin_transactions,
  public.support_alerts,public.follows to zytrix_staging_app;
grant update(balance,total_sent,total_received) on public.wallets to zytrix_staging_app;
grant update(status,deleted_at,deleted_by) on public.chat_messages to zytrix_staging_app;
grant delete on public.follows to zytrix_staging_app;
grant update(status,started_at,ended_at,total_views) on public.lives to zytrix_staging_app;
grant update(is_live,current_live_id) on public.channels to zytrix_staging_app;
grant select,insert,update on public.user_preferences,public.notification_states,
  public.watch_history,public.chat_settings,public.live_bans to zytrix_staging_app;
grant select,insert on public.live_reactions to zytrix_staging_app;
grant select,insert,update,delete on private.live_viewer_sessions to zytrix_staging_app;
grant select,insert on private.live_unique_views to zytrix_staging_app;
commit;
