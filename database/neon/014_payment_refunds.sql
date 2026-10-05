begin;
alter table public.zy_coin_orders add column if not exists provider_payment_intent text;
create unique index if not exists sandbox_order_payment_intent on public.zy_coin_orders(provider_payment_intent) where provider_payment_intent is not null;
create table if not exists private.payment_refunds (
 charge_id text primary key, order_id uuid not null references public.zy_coin_orders(id),
 amount_cents integer not null check(amount_cents>0), status text not null check(status in ('applied','review_required')),
 reason text not null, created_at timestamptz not null default now()
);
grant select,insert on private.payment_refunds to zytrix_staging_app;
grant update(provider_payment_intent) on public.zy_coin_orders to zytrix_staging_app;
commit;
