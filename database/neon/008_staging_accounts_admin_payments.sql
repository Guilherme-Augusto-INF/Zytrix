-- Staging only. Existing data is preserved; no historical payments are recreated.
begin;
grant insert(id,firebase_uid) on public.identities to zytrix_staging_app;
grant insert(user_id,firebase_uid,zytrix_id,email,provider) on public.user_accounts to zytrix_staging_app;
grant select on public.governance_config,public.policy_acceptances,public.live_schedules,public.reports,public.zy_coin_orders,public.moderation_actions to zytrix_staging_app;
grant insert on public.policy_acceptances,public.moderation_actions,public.zy_coin_orders to zytrix_staging_app;
grant insert,update on public.moderation_penalties to zytrix_staging_app;
grant update(status,provider_reference,paid_at) on public.zy_coin_orders to zytrix_staging_app;
create table if not exists private.payment_events (
  event_id text primary key,
  order_id uuid not null references public.zy_coin_orders(id),
  event_type text not null,
  received_at timestamptz not null default now()
);
grant select,insert on private.payment_events to zytrix_staging_app;
create table if not exists private.external_auth_identities (
  provider text not null check(provider='neon'),
  subject text not null,
  user_id uuid not null references public.identities(id) on delete restrict,
  linked_at timestamptz not null default now(),
  primary key(provider,subject),unique(provider,user_id)
);
-- Link writes remain unavailable to the web role until dual-session proof is implemented.
grant select on private.external_auth_identities to zytrix_staging_app;
commit;
