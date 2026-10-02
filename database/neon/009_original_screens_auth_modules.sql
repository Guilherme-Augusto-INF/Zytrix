-- Additive migration for the existing, verified staging branch only.
begin;
alter table public.user_accounts add column if not exists disabled_at timestamptz;
grant usage on schema neon_auth to zytrix_staging_app;
grant select(id,banned) on neon_auth."user" to zytrix_staging_app;
grant select("userId","providerId") on neon_auth.account to zytrix_staging_app;
grant select,insert on private.external_auth_identities to zytrix_staging_app;
grant select,insert,update on public.user_progress,public.creator_attributions,public.live_schedules,
  public.rewards,public.polls,public.poll_options,public.channel_profiles,public.creator_codes to zytrix_staging_app;
grant delete on public.creator_attributions,public.creator_codes,public.channel_members,public.live_moderators to zytrix_staging_app;
grant select,insert on public.poll_votes,public.promotion_claims,public.reward_redemptions,public.clips,public.coin_promotions to zytrix_staging_app;
grant update(status,fulfilled_by,fulfilled_at) on public.reward_redemptions to zytrix_staging_app;
grant update(deleted_at) on public.clips to zytrix_staging_app;
grant update on public.coin_promotions to zytrix_staging_app;
grant insert on public.channel_members,public.live_moderators,public.reports,public.moderation_audit to zytrix_staging_app;
grant update(status,resolution,reviewed_at,reviewed_by) on public.reports to zytrix_staging_app;
grant select,insert,update on private.report_rate_limits to zytrix_staging_app;
grant update(title,description,thumbnail_url,playback_url,category_id,mature_content,support_alert_sound,
 support_goal_label,support_goal_coins,support_alert_theme,support_alert_min_coins,support_alert_duration_ms,vod_url,
 raid_target_live_id,host_target_live_id) on public.lives to zytrix_staging_app;
grant update(avatar_url,banner_url,category_id) on public.channels to zytrix_staging_app;
grant update(photo_url) on public.profiles to zytrix_staging_app;
grant select on public.support_alerts,public.featured_streamers to zytrix_staging_app;
commit;
