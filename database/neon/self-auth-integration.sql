-- Rehearsal only. Apply to br-sparkling-math-b6fz3kyb (teste), never the active
-- branch. This file DOES switch the identities FK and provisioning on TEST.
-- Run inside a transaction on the isolated test branch. Fails if schema exists.
create schema zytrix_auth;
comment on schema zytrix_auth is 'Isolated Better Auth migration rehearsal; not an active identity provider';

create table zytrix_auth."user" (like neon_auth."user" including all);
create table zytrix_auth.account (like neon_auth.account including all);
create table zytrix_auth.organization (like neon_auth.organization including all);
create table zytrix_auth.member (like neon_auth.member including all);
create table zytrix_auth.invitation (like neon_auth.invitation including all);
create table zytrix_auth.session (like neon_auth.session including all);
create table zytrix_auth.verification (like neon_auth.verification including all);
create table zytrix_auth.jwks (like neon_auth.jwks including all);

insert into zytrix_auth."user" select * from neon_auth."user";
insert into zytrix_auth.account select * from neon_auth.account;
insert into zytrix_auth.organization select * from neon_auth.organization;
insert into zytrix_auth.member select * from neon_auth.member;
insert into zytrix_auth.invitation select * from neon_auth.invitation;

-- Do not import session cookies, reset/verification tokens, or encrypted signing
-- keys. They belong to the old provider and must not be assumed portable.
alter table zytrix_auth.account add foreign key ("userId") references zytrix_auth."user"(id) on delete cascade;
alter table zytrix_auth.member add foreign key ("userId") references zytrix_auth."user"(id) on delete cascade;
alter table zytrix_auth.member add foreign key ("organizationId") references zytrix_auth.organization(id) on delete cascade;
alter table zytrix_auth.invitation add foreign key ("inviterId") references zytrix_auth."user"(id) on delete cascade;
alter table zytrix_auth.invitation add foreign key ("organizationId") references zytrix_auth.organization(id) on delete cascade;
alter table zytrix_auth.session add foreign key ("userId") references zytrix_auth."user"(id) on delete cascade;

do $$
begin
 if exists((select * from neon_auth."user" except all select * from zytrix_auth."user") union all (select * from zytrix_auth."user" except all select * from neon_auth."user")) then raise exception 'user_copy_mismatch'; end if;
 if exists((select * from neon_auth.account except all select * from zytrix_auth.account) union all (select * from zytrix_auth.account except all select * from neon_auth.account)) then raise exception 'account_copy_mismatch'; end if;
 if exists(select 1 from public.identities i left join zytrix_auth."user" u on u.id=i.id where u.id is null) then raise exception 'identity_copy_mismatch'; end if;
end $$;

create table zytrix_auth."rateLimit" (id uuid primary key default gen_random_uuid(),"key" text unique not null,"count" integer not null,"lastRequest" bigint not null);

grant usage on schema zytrix_auth to zytrix_auth_service;
grant select,insert,update,delete on all tables in schema zytrix_auth to zytrix_auth_service;
grant usage on schema zytrix_auth to zytrix_runtime;
grant select(id,email,banned) on zytrix_auth."user" to zytrix_runtime;
grant select("userId","providerId") on zytrix_auth.account to zytrix_runtime;
create function private.active_better_auth_session(subject uuid, session_token text)
returns timestamptz language sql stable security definer set search_path='' as $$
 select s."createdAt" from zytrix_auth.session s join zytrix_auth."user" u on u.id=s."userId"
 where s."userId"=subject and s.token=session_token and s."expiresAt">now() and not coalesce(u.banned,false)
$$;
create function private.revoke_better_auth_session(subject uuid, session_token text)
returns void language sql security definer set search_path='' as $$
 delete from zytrix_auth.session where "userId"=subject and token=session_token
$$;
create function private.disable_better_auth_identity(subject uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 delete from zytrix_auth.session where "userId"=subject;
 delete from zytrix_auth.account where "userId"=subject;
 update zytrix_auth."user" set banned=true,name='Deleted account',email='deleted-'||subject||'@example.invalid',image=null,"emailVerified"=false,"updatedAt"=now() where id=subject;
end $$;
revoke all on function private.active_better_auth_session(uuid,text),private.revoke_better_auth_session(uuid,text),private.disable_better_auth_identity(uuid) from public;
grant execute on function private.active_better_auth_session(uuid,text),private.revoke_better_auth_session(uuid,text),private.disable_better_auth_identity(uuid) to zytrix_runtime;
-- The following two statements change references only; no rows are removed.
-- In production, execute only in the approved cutover maintenance transaction.
alter table public.identities drop constraint identities_id_fkey;
alter table public.identities add constraint identities_id_fkey foreign key(id) references zytrix_auth."user"(id) on delete restrict;
create trigger provision_profile after insert on zytrix_auth."user" for each row execute function private.provision_profile();
