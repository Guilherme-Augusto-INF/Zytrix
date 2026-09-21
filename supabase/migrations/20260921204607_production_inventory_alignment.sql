-- Align the relational model with fields verified in the production Firebase Console.
-- Legacy featured-streamer rows contain position/active but no creator identity.

alter table public.featured_streamers
  add column if not exists active boolean not null default true;

alter table public.featured_streamers
  alter column created_by drop not null;

comment on column public.featured_streamers.created_by is
  'Actor that curated the row. NULL is reserved for migrated Firebase rows whose legacy document has no createdBy field.';
