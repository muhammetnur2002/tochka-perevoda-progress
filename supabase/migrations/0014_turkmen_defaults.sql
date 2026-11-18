-- Новые заказы и платежи — в манатах; существующие суммы НЕ конвертируются.
alter table public.orders add column if not exists currency text not null default 'RUB';
alter table public.orders alter column currency set default 'TMT';
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.orders'::regclass and conname = 'orders_currency_check') then
    alter table public.orders add constraint orders_currency_check check (currency in ('RUB', 'TMT'));
  end if;
end; $$;
alter table public.payments alter column currency set default 'TMT';

create or replace function public.normalize_phone(p_phone text)
returns text language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if left(trim(coalesce(p_phone, '')), 1) = '+' then
    return nullif(d, '');
  elsif left(d, 5) = '00993' then
    d := substr(d, 3);
  elsif length(d) = 8 then
    d := '993' || d;
  end if;
  return nullif(d, '');
end;
$$;

-- Защита от сложения платежей в разных валютах, включая ручные платежи.
create or replace function public.check_payment_currency()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.currency is distinct from (select currency from public.orders where id = new.order_id) then
    raise exception 'Payment currency must match order currency';
  end if;
  return new;
end;
$$;
drop trigger if exists payments_check_currency on public.payments;
create trigger payments_check_currency before insert or update of currency, order_id on public.payments
for each row execute function public.check_payment_currency();

-- Валюту существующего заказа нельзя менять без конвертации всех финансовых данных.
create or replace function public.keep_order_currency()
returns trigger language plpgsql as $$
begin
  if old.currency is distinct from new.currency then
    raise exception 'Order currency cannot be changed';
  end if;
  return new;
end;
$$;
drop trigger if exists orders_keep_currency on public.orders;
create trigger orders_keep_currency before update of currency on public.orders
for each row execute function public.keep_order_currency();
