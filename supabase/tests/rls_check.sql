-- =============================================================================
-- supabase/tests/rls_check.sql
-- Автотест матрицы доступа (RLS + триггеры защиты). Самодостаточный: создаёт
-- тестовых пользователей и заказы внутри транзакции и в конце делает ROLLBACK —
-- безопасно запускать на любой базе с применёнными миграциями.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_check.sql
--   (или pnpm test:sql)
--
-- Любое нарушение — ошибка ASSERT/EXCEPTION, psql завершится с кодом ≠ 0.
-- Запускать от роли postgres (владелец схемы).
-- =============================================================================
\set ON_ERROR_STOP 1
begin;

-- Тестовые идентификаторы
\set c1 '''11111111-1111-1111-1111-111111111111'''
\set c2 '''22222222-2222-2222-2222-222222222222'''
\set mg '''33333333-3333-3333-3333-333333333333'''
\set tr '''44444444-4444-4444-4444-444444444444'''
\set ad '''55555555-5555-5555-5555-555555555555'''
\set gu '''66666666-6666-6666-6666-666666666666'''

-- -----------------------------------------------------------------------------
-- Подготовка данных (от postgres, RLS не действует)
-- -----------------------------------------------------------------------------
-- c1 пытается назначить себе роль admin через метаданные регистрации
insert into auth.users (id, email, raw_user_meta_data) values
  (:c1, 'rls-c1@test.local', '{"name":"Клиент 1","phone":"+7 900 000-00-01","role":"admin"}'),
  (:c2, 'rls-c2@test.local', '{"name":"Клиент 2","phone":"+7 900 000-00-02"}'),
  (:mg, 'rls-mg@test.local', '{"name":"Менеджер"}'),
  (:tr, 'rls-tr@test.local', '{"name":"Переводчик"}'),
  (:ad, 'rls-ad@test.local', '{"name":"Админ"}');

\echo '1. Роль из user_metadata игнорируется при регистрации'
do $$ begin
  assert (select role from public.users where id = '11111111-1111-1111-1111-111111111111') = 'client',
    'Повышение роли через raw_user_meta_data не заблокировано';
  assert (select count(*) from public.clients where user_id = '11111111-1111-1111-1111-111111111111') = 1,
    'Карточка клиента не создана при регистрации';
end $$;

update public.users set role = 'manager' where id = :mg;
update public.users set role = 'translator' where id = :tr;
update public.users set role = 'admin' where id = :ad;
insert into public.translators (user_id, capacity_per_day) values (:tr, 5);

-- Гостевой заказ (без аккаунта) с телефоном, который позже зарегистрируется
insert into public.clients (id, name, phone) values (:gu, 'Гость', '79000000099');

insert into public.orders (id, client_id, user_id, total_price)
select '00000000-0000-0000-0000-0000000000a1', c.id, c.user_id, 1000
from public.clients c where c.user_id = :c1;
insert into public.orders (id, client_id, user_id, total_price)
select '00000000-0000-0000-0000-0000000000a2', c.id, c.user_id, 2000
from public.clients c where c.user_id = :c2;
insert into public.orders (id, client_id, user_id, total_price)
values ('00000000-0000-0000-0000-0000000000a3', :gu, null, 3000);

insert into public.order_items (order_id, name_snapshot, quantity, unit_price, price) values
  ('00000000-0000-0000-0000-0000000000a1', 'Перевод паспорта', 1, 2390, 2390),
  ('00000000-0000-0000-0000-0000000000a2', 'Перевод диплома', 1, 1870, 1870);
insert into public.payments (order_id, amount, status) values
  ('00000000-0000-0000-0000-0000000000a1', 2390, 'pending'),
  ('00000000-0000-0000-0000-0000000000a2', 1870, 'pending');
insert into public.files (order_id, storage_path, original_name, mime_type) values
  ('00000000-0000-0000-0000-0000000000a1', 'orders/00000000-0000-0000-0000-0000000000a1/x-a.jpg', 'a.jpg', 'image/jpeg'),
  ('00000000-0000-0000-0000-0000000000a2', 'orders/00000000-0000-0000-0000-0000000000a2/x-b.jpg', 'b.jpg', 'image/jpeg');
insert into storage.objects (bucket_id, name) values
  ('order-files', 'orders/00000000-0000-0000-0000-0000000000a1/x-a.jpg'),
  ('order-files', 'orders/00000000-0000-0000-0000-0000000000a2/x-b.jpg');
insert into public.order_assignments (order_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a2', :tr, 'translator');

\echo '2. Нагрузка переводчика пересчитана триггером'
do $$ begin
  assert (select current_load from public.translators where user_id = '44444444-4444-4444-4444-444444444444') = 1,
    'current_load не синхронизирован';
end $$;

\echo '3. Платёж succeeded → заказ confirmed, paid_amount обновлён'
update public.payments set status = 'succeeded' where order_id = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  assert (select status from public.orders where id = '00000000-0000-0000-0000-0000000000a1') = 'confirmed',
    'Оплата не перевела заказ в confirmed';
  assert (select paid_amount from public.orders where id = '00000000-0000-0000-0000-0000000000a1') = 2390,
    'paid_amount не обновлён';
  assert (select public_number from public.orders where id = '00000000-0000-0000-0000-0000000000a1') ~ '^ТП-\d{4}-\d{6}$',
    'Неверный формат номера заказа';
end $$;

-- -----------------------------------------------------------------------------
\echo '4. Клиент видит только своё'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from public.orders) = 1, 'Клиент видит чужие заказы';
  assert (select count(*) from public.order_items) = 1, 'Клиент видит чужие позиции';
  assert (select count(*) from public.payments) = 1, 'Клиент видит чужие платежи';
  assert (select count(*) from public.files) = 1, 'Клиент видит чужие файлы';
  assert (select count(*) from storage.objects) = 1, 'Клиент видит чужие объекты Storage';
  assert (select count(*) from public.clients) = 1, 'Клиент видит чужие карточки клиентов';
  assert (select count(*) from public.users) = 1, 'Клиент видит чужие профили';
  assert (select count(*) from public.audit_log) = 0, 'Клиенту доступен аудит';
  assert (select count(*) from public.status_history) >= 1, 'Клиент не видит историю своего заказа';
  assert (select count(*) from public.v_revenue_daily) <= 1, 'Отчёт обходит RLS';
end $$;

\echo '5. Клиент не может создать заказ напрямую (цены — только сервер) и поднять себе роль'
do $$ begin
  begin
    insert into public.orders (client_id, user_id, total_price)
    select id, auth.uid(), 1 from public.clients limit 1;
    raise exception 'FAIL: клиент вставил заказ в обход сервера';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.users set role = 'admin' where id = auth.uid();
    raise exception 'FAIL: клиент поднял себе роль';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    update public.orders set total_price = 1 where id = '00000000-0000-0000-0000-0000000000a1';
    assert not found, 'Клиент изменил цену своего заказа';
  end;
end $$;
reset role;

-- -----------------------------------------------------------------------------
\echo '6. Переводчик видит только назначенный заказ, без платежей'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from public.orders) = 1, 'Переводчик видит не только назначенные заказы';
  assert (select id from public.orders) = '00000000-0000-0000-0000-0000000000a2', 'Переводчик видит не тот заказ';
  assert (select count(*) from public.files) = 1, 'Переводчик не видит исходник назначенного заказа';
  assert (select count(*) from storage.objects) = 1, 'Переводчик не видит объект назначенного заказа';
  assert (select count(*) from public.payments) = 0, 'Переводчик видит платежи';
  assert (select count(*) from public.clients where user_id is distinct from auth.uid()) = 0,
    'Переводчик видит базу клиентов';

  update public.order_assignments set status = 'in_progress' where user_id = auth.uid();
  assert found, 'Переводчик не может сменить статус своей задачи';

  begin
    update public.order_assignments set user_id = '33333333-3333-3333-3333-333333333333' where user_id = auth.uid();
    raise exception 'FAIL: переводчик переназначил задачу';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  update public.orders set status = 'ready' where id = '00000000-0000-0000-0000-0000000000a2';
  assert not found, 'Переводчик меняет статус заказа напрямую';
end $$;
reset role;

-- -----------------------------------------------------------------------------
\echo '7. Менеджер видит всё и меняет статус с комментарием'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from public.orders) >= 3, 'Менеджер видит не все заказы';
  assert (select count(*) from public.payments) >= 2, 'Менеджер видит не все платежи';
  assert (select count(*) from public.audit_log) = 0, 'Аудит доступен менеджеру (только админ)';
  perform public.change_order_status('00000000-0000-0000-0000-0000000000a2', 'in_progress', 'Передан переводчику');
  assert (select comment from public.status_history
          where order_id = '00000000-0000-0000-0000-0000000000a2' and to_status = 'in_progress') = 'Передан переводчику',
    'Комментарий к смене статуса не записан в историю';
  assert exists (select 1 from public.notifications where order_id = '00000000-0000-0000-0000-0000000000a2'),
    'Не создано уведомление о смене статуса';
end $$;
reset role;

\echo '8. Администратор видит аудит'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from public.audit_log) > 0, 'Администратор не видит аудит';
end $$;
reset role;

-- -----------------------------------------------------------------------------
\echo '9. Гость (anon): каталог виден, заказы — нет'
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  assert (select count(*) from public.services where is_active) = 24, 'В каталоге не 24 активные услуги';
  assert (select count(*) from public.settings) = (select count(*) from public.settings where is_public),
    'Гостю видны непубличные настройки';
  begin
    perform count(*) from public.orders;
    raise exception 'FAIL: anon читает orders';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.v_deadline_approaching;
    raise exception 'FAIL: anon читает отчёт с телефонами';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- -----------------------------------------------------------------------------
\echo '10. Гостевой заказ НЕ привязывается по неподтверждённому телефону, привязывается сервером'
insert into auth.users (id, email, raw_user_meta_data)
values ('77777777-7777-7777-7777-777777777777', 'rls-guest@test.local', '{"name":"Гость","phone":"8 (900) 000-00-99"}');
do $$ begin
  assert (select user_id from public.orders where id = '00000000-0000-0000-0000-0000000000a3') is null,
    'Гостевой заказ привязан по неподтверждённому телефону';
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.claim_guest_orders('77777777-7777-7777-7777-777777777777');
    raise exception 'FAIL: клиент сам привязал заказы по телефону';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- сервер (после SMS-кода) привязывает заказы — от имени service_role
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.claim_guest_orders('77777777-7777-7777-7777-777777777777');
do $$ begin
  assert (select user_id from public.orders where id = '00000000-0000-0000-0000-0000000000a3')
         = '77777777-7777-7777-7777-777777777777', 'Сервер не смог привязать гостевой заказ';
end $$;

\echo 'RLS-проверка пройдена: все утверждения выполнены.'
rollback;
