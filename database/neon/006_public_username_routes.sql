-- Apply to an isolated branch first; production requires a separately approved release.
begin;
-- Serialize deployment with all profile/reservation writers while installing the guard.
lock table public.profiles,private.reserved_usernames in share row exclusive mode;
create or replace function private.guard_public_username() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare old_key text;new_key text;locked_key text;
begin
 if tg_op<>'INSERT' then old_key:=lower(btrim(old.username));end if;
 if tg_op<>'DELETE' then new_key:=lower(btrim(new.username));end if;
 if old_key is not distinct from new_key then return new;end if;
 -- All inserts/renames/deletes lock the same namespace, in a stable order.
 -- This closes the reservation-check vs uniqueness-wait race on a retired name.
 for locked_key in select distinct k from unnest(array[old_key,new_key]) as names(k) where k is not null order by k loop
  perform pg_advisory_xact_lock(hashtextextended('public-username:'||locked_key,0));
 end loop;
 if new_key is not null and exists(select 1 from private.reserved_usernames where username_key=new_key) then
  raise exception 'username unavailable' using errcode='23505';
 end if;
 if old_key is not null then
  insert into private.reserved_usernames(username_key,reason) values(old_key,'retired public profile username') on conflict do nothing;
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end;
$$;
revoke all on function private.guard_public_username() from public;
create or replace trigger profiles_guard_public_username
 before insert or update of username or delete on public.profiles
 for each row execute function private.guard_public_username();
comment on function private.guard_public_username() is 'Reserves retired public usernames without aliases; internal account IDs stay unchanged.';
commit;
