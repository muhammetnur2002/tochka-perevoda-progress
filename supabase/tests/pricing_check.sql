-- =============================================================================
-- supabase/tests/pricing_check.sql
-- Сверка триггера recalc_order_totals с формулой движка цен (src/lib/services/pricing.ts):
--   total = (Σ price − discount) × urgency_coefficient + notary_fee + delivery_fee
-- Транзакция с ROLLBACK. Запуск: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pricing_check.sql
-- =============================================================================
\set ON_ERROR_STOP 1
begin;

insert into public.clients (id, name, phone) values ('99999999-0000-0000-0000-000000000001', 'Тест цены', '79990000000');

-- 12 стр. юридического перевода (550 ₽) с −5% за объём, срочно ×1.5, заверение 500, доставка 300
insert into public.orders (id, client_id, discount, urgency_coefficient, notary_fee, delivery_fee)
values ('99999999-0000-0000-0000-0000000000a1', '99999999-0000-0000-0000-000000000001', 330, 1.5, 500, 300);

insert into public.order_items (order_id, name_snapshot, quantity, unit_price, price)
values ('99999999-0000-0000-0000-0000000000a1', 'Перевод юридических документов', 12, 550, 6600);

do $$
declare o public.orders;
begin
  select * into o from public.orders where id = '99999999-0000-0000-0000-0000000000a1';
  -- (6600 − 330) × 1.5 + 500 + 300 = 10205
  assert o.subtotal = 6600, format('subtotal %s ≠ 6600', o.subtotal);
  assert o.total_price = 10205, format('total %s ≠ 10205', o.total_price);
  assert o.public_number ~ '^ТП-\d{4}-\d{6}$', 'номер заказа';
end $$;

-- 24 позиции прайса засеяны и активны, цены совпадают с ТЗ
do $$ begin
  assert (select count(*) from public.services where is_active) = 24, 'не 24 активные услуги';
  assert (select price from public.services where slug = 'passport-all') = 2390, 'цена паспорта';
  assert (select price from public.services where slug = 'dms-student') = 5700, 'цена ДМС';
  assert (select count(*) from public.services where category = 'translation') = 11, 'переводов не 11';
  assert (select count(*) from public.services where category = 'printing') = 12, 'полиграфии не 12';
  assert (select count(*) from public.price_rules where rule_type = 'urgent') = 22, 'правила срочности';
end $$;

\echo 'Проверка цен пройдена.'
rollback;
