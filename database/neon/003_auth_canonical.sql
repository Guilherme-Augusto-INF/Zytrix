begin;
create or replace function private.provision_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.identities(id) values(new.id);
 insert into public.user_accounts(user_id,zytrix_id) values(new.id,'ZY-'||new.id);
 insert into public.profiles(user_id,username,name,photo_url) values(new.id,'user_'||left(replace(new.id::text,'-',''),25),left(coalesce(new.name,''),80),coalesce(new.image,''));
 insert into public.wallets(user_id) values(new.id);
 return new;
end; $$;
alter table public.user_accounts drop column email,drop column provider,drop column imported_at;
alter table public.lives drop column if exists imported_at;
grant select(email) on neon_auth."user" to zytrix_runtime;
update public.governance_config set terms_effective=false;
revoke insert on public.user_accounts from zytrix_runtime;
commit;
