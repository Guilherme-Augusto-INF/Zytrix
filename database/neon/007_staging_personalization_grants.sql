-- Apply only using the fixed, validated staging connection.
begin;
grant select,insert,delete on public.followed_categories to zytrix_staging_app;
commit;
