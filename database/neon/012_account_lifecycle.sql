begin;
alter table public.user_accounts add column if not exists deleted_at timestamptz;
create table if not exists private.account_deletions (
 user_id uuid primary key references public.identities(id) on delete restrict,
 deleted_at timestamptz not null default now(),
 request_key text not null
);
create table if not exists private.account_deletion_evidence (
 user_id uuid not null references public.identities(id),
 entity_type text not null, entity_id text not null, evidence jsonb not null,
 retained_at timestamptz not null default now(), primary key(user_id,entity_type,entity_id)
);
-- No session tokens/passwords can be enumerated by the application role.
create or replace function private.active_auth_session(subject uuid, session_token text)
returns timestamptz language sql stable security definer set search_path='' as $$
 select s."createdAt" from neon_auth.session s join neon_auth."user" u on u.id=s."userId"
 where s."userId"=subject and s.token=session_token and s."expiresAt">now() and not coalesce(u.banned,false)
$$;
create or replace function private.revoke_auth_session(subject uuid, session_token text)
returns void language sql security definer set search_path='' as $$
 delete from neon_auth.session where "userId"=subject and token=session_token
$$;
create or replace function private.disable_auth_identity(subject uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 delete from neon_auth.session where "userId"=subject;
 delete from neon_auth.account where "userId"=subject;
 update neon_auth."user" set banned=true,name='Deleted account',email='deleted-'||subject||'@example.invalid',
  image=null,"emailVerified"=false,"updatedAt"=now() where id=subject;
end;
$$;
revoke all on function private.active_auth_session(uuid,text),private.revoke_auth_session(uuid,text),private.disable_auth_identity(uuid) from public;
grant execute on function private.active_auth_session(uuid,text),private.revoke_auth_session(uuid,text),private.disable_auth_identity(uuid) to zytrix_staging_app;
grant select,insert on private.account_deletions,private.account_deletion_evidence to zytrix_staging_app;
grant update(email,disabled_at,deleted_at) on public.user_accounts to zytrix_staging_app;
grant update(name,description,avatar_url,banner_url,visibility,deleted_at) on public.channels to zytrix_staging_app;
grant update(visibility,deleted_at) on public.lives to zytrix_staging_app;
grant update(title,source_url,thumbnail_url,media_path,visibility) on public.clips to zytrix_staging_app;
grant update(text) on public.chat_messages to zytrix_staging_app;
grant update(active,revoked_at) on public.admins to zytrix_staging_app;
grant delete on public.user_preferences,public.notification_states,public.watch_history,public.user_progress,
 public.followed_categories,public.live_reactions,public.featured_streamers,private.live_unique_views,
 private.channel_private_data,private.chat_rate_limits,private.reaction_rate_limits,private.report_rate_limits to zytrix_staging_app;
grant select on private.channel_private_data,private.chat_rate_limits,private.reaction_rate_limits to zytrix_staging_app;
commit;
