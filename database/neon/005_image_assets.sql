begin;
create table private.image_assets (
 id uuid primary key,
 owner_id uuid not null references public.identities(id) on delete restrict,
 kind text not null check(kind in('profile','thumbnail')),
 live_id uuid references public.lives(id) on delete restrict,
 object_key text not null unique,
 url text not null unique,
 state text not null default 'pending' check(state in('pending','active','delete_pending','deleted')),
 width integer, height integer, bytes integer, sha256 text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check ((kind='profile' and live_id is null) or (kind='thumbnail' and live_id is not null)),
 check(object_key='zytrix/'||owner_id::text||'/'||id::text||'.webp'),
 check(state<>'active' or (width is not null and height is not null and bytes is not null and sha256 is not null and width>0 and height>0 and bytes between 1 and 614400 and sha256 ~ '^[a-f0-9]{64}$'))
);
create unique index image_assets_active_slot on private.image_assets(owner_id,kind,live_id) nulls not distinct where state='active';
create index image_assets_owner_created on private.image_assets(owner_id,created_at desc);
create index image_assets_cleanup on private.image_assets(state,updated_at) where state in('pending','delete_pending');
revoke all on private.image_assets from public;
grant select,insert on private.image_assets to zytrix_runtime;
grant update(state,width,height,bytes,sha256,updated_at) on private.image_assets to zytrix_runtime;
comment on table private.image_assets is 'Server-owned image metadata and durable deletion outbox. Files live in Zytrix Blob storage.';
commit;
