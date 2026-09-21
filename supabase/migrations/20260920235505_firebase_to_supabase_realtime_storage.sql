-- Realtime and Storage configuration. No Firebase source is removed.

-- Durable, moderate-frequency records use Postgres Changes.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'lives','chat_messages','chat_settings','live_bans','polls','poll_options',
    'support_alerts','notification_states','reward_redemptions'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = relation_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', relation_name);
    end if;
  end loop;
end;
$$;

-- Private Broadcast/Presence topics use `live:<uuid>`.
-- The realtime schema is platform-managed; policies are the supported extension point.
create policy "authenticated can read live broadcast and presence"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select realtime.topic()) ~ '^live:[0-9a-f-]{36}$'
  and exists (
    select 1 from public.lives l
    where l.id = split_part((select realtime.topic()), ':', 2)::uuid
      and l.deleted_at is null
      and (
        l.visibility = 'public'
        or l.owner_id = (select auth.uid())
        or (select private.can_moderate_live(l.id))
      )
  )
);

create policy "authenticated can send live broadcast and presence"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select realtime.topic()) ~ '^live:[0-9a-f-]{36}$'
  and exists (
    select 1 from public.lives l
    where l.id = split_part((select realtime.topic()), ':', 2)::uuid
      and l.status = 'live'
      and l.deleted_at is null
      and not (select private.is_globally_banned())
  )
);

-- Buckets are intentionally limited to assets that the current product already models.
-- No clips bucket is created: the current code has no real video production/upload pipeline.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('channel-assets', 'channel-assets', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('live-thumbnails', 'live-thumbnails', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.first_storage_folder(object_name text)
returns uuid
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when invalid_text_representation or array_subscript_error then
  return null;
end;
$$;

revoke all on function private.first_storage_folder(text) from public;
grant execute on function private.first_storage_folder(text) to authenticated;

create policy avatars_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'avatars');
create policy avatars_owner_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and private.first_storage_folder(name) = (select auth.uid()));
create policy avatars_owner_update on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and owner_id = (select auth.uid()::text))
with check (bucket_id = 'avatars' and private.first_storage_folder(name) = (select auth.uid()));
create policy avatars_owner_delete on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and owner_id = (select auth.uid()::text));

create policy channel_assets_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'channel-assets');
create policy channel_assets_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'channel-assets'
  and (select private.owns_channel(private.first_storage_folder(name)))
);
create policy channel_assets_owner_update on storage.objects
for update to authenticated
using (bucket_id = 'channel-assets' and (select private.owns_channel(private.first_storage_folder(name))))
with check (bucket_id = 'channel-assets' and (select private.owns_channel(private.first_storage_folder(name))));
create policy channel_assets_owner_delete on storage.objects
for delete to authenticated
using (bucket_id = 'channel-assets' and (select private.owns_channel(private.first_storage_folder(name))));

create policy live_thumbnails_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'live-thumbnails');
create policy live_thumbnails_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'live-thumbnails'
  and (select private.owns_live(private.first_storage_folder(name)))
);
create policy live_thumbnails_owner_update on storage.objects
for update to authenticated
using (bucket_id = 'live-thumbnails' and (select private.owns_live(private.first_storage_folder(name))))
with check (bucket_id = 'live-thumbnails' and (select private.owns_live(private.first_storage_folder(name))));
create policy live_thumbnails_owner_delete on storage.objects
for delete to authenticated
using (bucket_id = 'live-thumbnails' and (select private.owns_live(private.first_storage_folder(name))));
