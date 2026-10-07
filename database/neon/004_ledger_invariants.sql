begin;
alter table private.channel_private_data drop column imported_at;
create view public.wallet_balances as
select w.user_id,coalesce(sum(case when t.to_user_id=w.user_id then t.amount else 0 end-case when t.from_user_id=w.user_id then t.amount else 0 end) filter(where t.status='completed'),0)::bigint as balance
from public.wallets w left join public.zy_coin_transactions t on t.to_user_id=w.user_id or t.from_user_id=w.user_id
group by w.user_id;
grant select on public.wallet_balances to zytrix_runtime;
create or replace function private.check_wallet_ledger() returns trigger language plpgsql security definer set search_path='' as $$
declare subject uuid;
begin
 for subject in select user_id from public.wallets where
  (tg_table_name='wallets' and user_id=(to_jsonb(new)->>'user_id')::uuid)
  or (tg_table_name='zy_coin_transactions' and user_id in((to_jsonb(new)->>'from_user_id')::uuid,(to_jsonb(new)->>'to_user_id')::uuid))
 loop
  if exists(select 1 from public.wallets w join public.wallet_balances b using(user_id) where w.user_id=subject and w.balance<>b.balance) then raise exception 'wallet_ledger_mismatch' using errcode='23514'; end if;
 end loop;
 return null;
end; $$;
revoke all on function private.check_wallet_ledger() from public;
create constraint trigger wallet_matches_ledger after insert or update on public.wallets deferrable initially deferred for each row execute function private.check_wallet_ledger();
create constraint trigger transaction_matches_wallet after insert on public.zy_coin_transactions deferrable initially deferred for each row execute function private.check_wallet_ledger();
commit;
