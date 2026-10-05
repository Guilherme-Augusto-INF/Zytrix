-- Safe read-only validation after applying 001_foundation.sql to Neon STAGING.
-- Expected tables: 52; no data is modified by this script.
WITH expected(schema_name, table_name) AS (
  VALUES
    ('public','identities'),
    ('public','user_accounts'),
    ('private','firebase_user_map'),
    ('public','admins'),
    ('public','profiles'),
    ('private','reserved_usernames'),
    ('public','channels'),
    ('public','channel_profiles'),
    ('private','channel_private_data'),
    ('public','categories'),
    ('public','lives'),
    ('public','follows'),
    ('public','channel_members'),
    ('public','live_moderators'),
    ('public','live_schedules'),
    ('public','rewards'),
    ('public','creator_codes'),
    ('public','user_preferences'),
    ('public','notification_states'),
    ('public','watch_history'),
    ('public','user_progress'),
    ('public','followed_categories'),
    ('public','creator_attributions'),
    ('public','chat_settings'),
    ('public','chat_messages'),
    ('public','live_bans'),
    ('private','chat_rate_limits'),
    ('private','reaction_rate_limits'),
    ('public','live_reactions'),
    ('public','polls'),
    ('public','poll_options'),
    ('public','poll_votes'),
    ('private','live_viewer_sessions'),
    ('private','live_unique_views'),
    ('public','wallets'),
    ('public','zy_coin_transactions'),
    ('public','zy_coin_orders'),
    ('public','support_alerts'),
    ('public','coin_promotions'),
    ('public','promotion_claims'),
    ('public','reward_redemptions'),
    ('public','clips'),
    ('public','moderation_penalties'),
    ('public','moderation_actions'),
    ('public','governance_config'),
    ('public','reports'),
    ('private','report_rate_limits'),
    ('public','moderation_audit'),
    ('public','policy_acceptances'),
    ('public','featured_streamers'),
    ('public','audit_logs'),
    ('private','migration_runs')
), found AS (
  SELECT e.schema_name, e.table_name,
         CASE WHEN c.oid IS NOT NULL THEN 1 ELSE 0 END AS present
  FROM expected e
  LEFT JOIN pg_namespace n ON n.nspname=e.schema_name
  LEFT JOIN pg_class c ON c.relnamespace=n.oid
                       AND c.relname=e.table_name AND c.relkind IN ('r','p')
)
SELECT COUNT(*)::integer AS expected_tables,
       SUM(present)::integer AS installed_tables,
       COUNT(*)::integer-SUM(present)::integer AS missing_tables,
       COALESCE(STRING_AGG(schema_name||'.'||table_name, ', ' ORDER BY schema_name,table_name)
                FILTER (WHERE present=0),'') AS missing_names,
       CASE WHEN SUM(present)=COUNT(*) THEN 'PASS' ELSE 'FAIL' END AS schema_status
FROM found;
