-- Rehearsal only. Apply to br-sparkling-math-b6fz3kyb (teste), never the active
-- branch. No route or foreign key in the application is switched by this file.
-- Intentionally fails if the candidate schema already exists.
create schema zytrix_auth_candidate_20261018;
comment on schema zytrix_auth_candidate_20261018 is 'Isolated Better Auth migration rehearsal; not an active identity provider';

create table zytrix_auth_candidate_20261018."user" (like neon_auth."user" including all);
create table zytrix_auth_candidate_20261018.account (like neon_auth.account including all);
create table zytrix_auth_candidate_20261018.organization (like neon_auth.organization including all);
create table zytrix_auth_candidate_20261018.member (like neon_auth.member including all);
create table zytrix_auth_candidate_20261018.invitation (like neon_auth.invitation including all);
create table zytrix_auth_candidate_20261018.session (like neon_auth.session including all);
create table zytrix_auth_candidate_20261018.verification (like neon_auth.verification including all);
create table zytrix_auth_candidate_20261018.jwks (like neon_auth.jwks including all);

insert into zytrix_auth_candidate_20261018."user" select * from neon_auth."user";
insert into zytrix_auth_candidate_20261018.account select * from neon_auth.account;
insert into zytrix_auth_candidate_20261018.organization select * from neon_auth.organization;
insert into zytrix_auth_candidate_20261018.member select * from neon_auth.member;
insert into zytrix_auth_candidate_20261018.invitation select * from neon_auth.invitation;

-- Do not import session cookies, reset/verification tokens, or encrypted signing
-- keys. They belong to the old provider and must not be assumed portable.
alter table zytrix_auth_candidate_20261018.account add foreign key ("userId") references zytrix_auth_candidate_20261018."user"(id) on delete cascade;
alter table zytrix_auth_candidate_20261018.member add foreign key ("userId") references zytrix_auth_candidate_20261018."user"(id) on delete cascade;
alter table zytrix_auth_candidate_20261018.member add foreign key ("organizationId") references zytrix_auth_candidate_20261018.organization(id) on delete cascade;
alter table zytrix_auth_candidate_20261018.invitation add foreign key ("inviterId") references zytrix_auth_candidate_20261018."user"(id) on delete cascade;
alter table zytrix_auth_candidate_20261018.invitation add foreign key ("organizationId") references zytrix_auth_candidate_20261018.organization(id) on delete cascade;
alter table zytrix_auth_candidate_20261018.session add foreign key ("userId") references zytrix_auth_candidate_20261018."user"(id) on delete cascade;

do $$
begin
 if exists((select * from neon_auth."user" except all select * from zytrix_auth_candidate_20261018."user") union all (select * from zytrix_auth_candidate_20261018."user" except all select * from neon_auth."user")) then raise exception 'user_copy_mismatch'; end if;
 if exists((select * from neon_auth.account except all select * from zytrix_auth_candidate_20261018.account) union all (select * from zytrix_auth_candidate_20261018.account except all select * from neon_auth.account)) then raise exception 'account_copy_mismatch'; end if;
 if exists(select 1 from public.identities i left join zytrix_auth_candidate_20261018."user" u on u.id=i.id where u.id is null) then raise exception 'identity_copy_mismatch'; end if;
end $$;
