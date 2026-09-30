-- Transactional authorization regression tests for the isolated staging project.
-- Run as a database owner. All fixtures are rolled back.

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'rls-a@example.invalid', '{"provider":"email"}', '{}', now(), now()),
  ('20000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'rls-b@example.invalid', '{"provider":"email"}', '{}', now(), now());

insert into public.channels (id, owner_id, name, slug)
values
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Channel A', 'channel-a'),
  ('b0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Channel B', 'channel-b');

insert into public.lives (
  id, channel_id, owner_id, title, playback_url, status, visibility, started_at
) values (
  'b1000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  'Private B',
  'https://youtube.com/watch?v=abcdefghijk',
  'live',
  'private',
  now()
);

insert into public.reports (
  id, reporter_id, target_type, target_profile_id, reason, description
) values (
  'c0000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'profile',
  '20000000-0000-4000-8000-000000000002',
  'other',
  'transactional authorization fixture'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $$
declare
  affected integer;
  denied boolean := false;
begin
  if (select count(*) from public.profiles) <> 2 then
    raise exception 'FAIL: public profile read parity';
  end if;

  if exists (
    select 1 from public.wallets
    where user_id = '20000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'FAIL: BOLA wallet read';
  end if;

  update public.channels
  set name = 'Hacked B'
  where id = 'b0000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: BOLA channel update';
  end if;

  begin
    update public.channels
    set owner_id = '20000000-0000-4000-8000-000000000002'
    where id = 'a0000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'FAIL: owner_id mass assignment';
  end if;

  denied := false;
  begin
    update public.wallets
    set balance = 999999
    where user_id = '10000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'FAIL: direct wallet mutation';
  end if;

  denied := false;
  begin
    insert into public.admins (user_id, active)
    values ('10000000-0000-4000-8000-000000000001', true);
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'FAIL: self-escalation to admin';
  end if;

  denied := false;
  begin
    perform public.current_viewer_count('b1000000-0000-4000-8000-000000000002');
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'FAIL: private live viewer-count IDOR';
  end if;
end;
$$;

select public.update_my_profile(null, null, 'RLS test bio');

do $$
begin
  if (select bio from public.profiles where user_id = auth.uid()) <> 'RLS test bio' then
    raise exception 'FAIL: controlled own-profile RPC';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

do $$
begin
  if exists (
    select 1 from public.reports
    where id = 'c0000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'FAIL: private report disclosure';
  end if;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  denied boolean := false;
begin
  begin
    perform public.current_viewer_count('a0000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'FAIL: anonymous SECURITY DEFINER execution';
  end if;
end;
$$;

reset role;
select jsonb_build_object(
  'suite', 'authorization',
  'status', 'PASS',
  'checks', 10,
  'rolled_back', true
) as result;

rollback;
