-- Explicitly apply only to the verified staging endpoint.
begin;
grant select on public.categories to zytrix_staging_app;
grant insert on public.channels,public.lives to zytrix_staging_app;
grant update(name,slug,description,visibility) on public.channels to zytrix_staging_app;
commit;
