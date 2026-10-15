-- =============================================================================
-- 0007_seed_services.sql
-- Стартовые данные: услуги (полный прайс из ТЗ), правила цен, языки, настройки.
-- Идемпотентно: повторный запуск не дублирует и не перезаписывает правки админа.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Услуги: 11 переводов, 12 полиграфии, 1 страхование
-- ---------------------------------------------------------------------------
insert into public.services
  (slug, category, name, description, price, unit, duration_days, is_notarial, sort_order)
values
  -- Переводы
  ('legal', 'translation', 'Перевод юридических документов',
   'Договоры, учредительные документы, доверенности, решения судов. Цена за страницу.', 550, 'page', 2, false, 1),
  ('medical', 'translation', 'Перевод медицинских документов',
   'Справки, выписки, заключения, эпикризы. Цена за страницу.', 550, 'page', 2, false, 2),
  ('technical', 'translation', 'Перевод технической документации',
   'Инструкции, паспорта оборудования, чертежи, ТУ. Цена за страницу.', 650, 'page', 2, false, 3),
  ('military-id', 'translation', 'Перевод военного билета (нотариальный)',
   'Перевод с нотариальным заверением. Фиксированная цена за документ.', 1650, 'document', 1, true, 4),
  ('work-book', 'translation', 'Перевод трудовой книжки (нотариальный)',
   'Перевод с нотариальным заверением. Фиксированная цена за документ.', 1650, 'document', 1, true, 5),
  ('diploma', 'translation', 'Перевод диплома (нотариальный)',
   'Перевод документа об образовании с нотариальным заверением.', 1870, 'document', 1, true, 6),
  ('certificate', 'translation', 'Перевод справки (нотариальный)',
   'Перевод справки с нотариальным заверением.', 1780, 'document', 1, true, 7),
  ('passport-all', 'translation', 'Перевод паспорта (все страницы)',
   'Перевод всех страниц паспорта.', 2390, 'document', 1, false, 8),
  ('driver-license', 'translation', 'Перевод водительского удостоверения',
   'Перевод водительского удостоверения.', 1770, 'document', 1, false, 9),
  ('passport-notary', 'translation', 'Перевод паспорта (нотариально заверенный)',
   'Перевод паспорта с нотариальным заверением.', 1770, 'document', 1, true, 10),
  ('power-of-attorney', 'translation', 'Перевод доверенности (нотариальный)',
   'Перевод доверенности с нотариальным заверением.', 2370, 'document', 1, true, 11),
  -- Полиграфия
  ('photocopy-a4', 'printing', 'Ксерокопия А4', 'Чёрно-белая ксерокопия формата А4.', 15, 'item', 1, false, 12),
  ('scanning', 'printing', 'Сканирование', 'Сканирование одного листа.', 20, 'item', 1, false, 13),
  ('color-print', 'printing', 'Цветная распечатка', 'Цветная распечатка одного листа.', 25, 'item', 1, false, 14),
  ('color-photocopy', 'printing', 'Цветная ксерокопия', 'Цветная ксерокопия одного листа.', 30, 'item', 1, false, 15),
  ('bw-print', 'printing', 'Распечатка ч/б', 'Чёрно-белая распечатка одного листа.', 10, 'item', 1, false, 16),
  ('print-a3', 'printing', 'Распечатка А3', 'Распечатка формата А3.', 40, 'item', 1, false, 17),
  ('print-a2', 'printing', 'Распечатка А2', 'Распечатка формата А2.', 100, 'item', 1, false, 18),
  ('print-a1', 'printing', 'Распечатка А1', 'Распечатка формата А1.', 150, 'item', 1, false, 19),
  ('laminating', 'printing', 'Ламинирование', 'Ламинирование одного листа.', 50, 'item', 1, false, 20),
  ('binding', 'printing', 'Брошюрование', 'Брошюрование одного документа.', 200, 'item', 1, false, 21),
  ('diploma-stitching', 'printing', 'Прошивка дипломов', 'Прошивка диплома.', 250, 'item', 1, false, 22),
  ('photo', 'printing', 'Фото на документы', 'Фотографии на документы (комплект).', 300, 'item', 1, false, 23),
  -- Страхование
  ('dms-student', 'insurance', 'Полис ДМС студентам (для иностранных граждан)',
   'Полис добровольного медицинского страхования для иностранных студентов.', 5700, 'item', 2, false, 24)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Правила цен:
--   per_page — для услуг «за страницу» (юридические/медицинские/технические);
--   fixed    — для остальных (цена за документ/штуку);
--   urgent   — коэффициенты срочности для переводов: priority 1 = «за 1 день» (×1.5),
--              priority 2 = «в день обращения» (×2.0). Глобальные значения — settings.urgency;
--   volume   — пример объёмной скидки: −5% от 10 страниц юридического перевода.
-- ---------------------------------------------------------------------------
insert into public.price_rules (service_id, rule_type, value, min_qty, max_qty, priority)
select s.id,
       (case when s.unit = 'page' then 'per_page' else 'fixed' end)::public.price_rule_type,
       s.price, null, null, 0
from public.services s
where not exists (
  select 1 from public.price_rules r
  where r.service_id = s.id and r.rule_type in ('per_page', 'fixed')
);

insert into public.price_rules (service_id, rule_type, value, min_qty, max_qty, priority)
select s.id, 'urgent', u.coef, null, null, u.prio
from public.services s
cross join (values (1.5::numeric, 1), (2.0::numeric, 2)) as u(coef, prio)
where s.category = 'translation'
  and not exists (
    select 1 from public.price_rules r
    where r.service_id = s.id and r.rule_type = 'urgent' and r.priority = u.prio
  );

insert into public.price_rules (service_id, rule_type, value, min_qty, max_qty, priority)
select s.id, 'volume', 0.95, 10, null, 10
from public.services s
where s.slug = 'legal'
  and not exists (
    select 1 from public.price_rules r where r.service_id = s.id and r.rule_type = 'volume'
  );

-- ---------------------------------------------------------------------------
-- Языки
-- ---------------------------------------------------------------------------
insert into public.languages (code, name) values
  ('ru', 'Русский'),
  ('en', 'Английский'),
  ('tt', 'Татарский'),
  ('de', 'Немецкий'),
  ('fr', 'Французский'),
  ('es', 'Испанский'),
  ('it', 'Итальянский'),
  ('zh', 'Китайский'),
  ('ar', 'Арабский'),
  ('tr', 'Турецкий'),
  ('uz', 'Узбекский'),
  ('ky', 'Киргизский'),
  ('kk', 'Казахский'),
  ('tg', 'Таджикский')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Настройки (публичные читает каталог; правки — через админку)
-- ---------------------------------------------------------------------------
insert into public.settings (key, value, is_public) values
  ('urgency', '{"1d": 1.5, "same_day": 2.0}', true),
  ('notary_fee', '0', true),
  ('delivery_price', '0', true),
  ('prepayment_percent', '100', false),
  ('holidays', '["2025-01-01","2025-01-02","2025-01-03","2025-01-06","2025-01-07","2025-01-08","2025-02-23","2025-03-08","2025-05-01","2025-05-09","2025-06-12","2025-11-04","2026-01-01","2026-01-02","2026-01-05","2026-01-06","2026-01-07","2026-01-08","2026-02-23","2026-03-09","2026-05-01","2026-05-09","2026-06-12","2026-11-04","2026-12-31","2027-01-01","2027-01-04","2027-01-05","2027-01-06","2027-01-07","2027-01-08","2027-02-23","2027-03-08","2027-05-03","2027-05-10","2027-06-14","2027-11-04"]', true),
  ('company', '{"name":"Точка Перевода Прогресс","city":"Казань","address":"г. Казань, ул. Сибирский Тракт, 7/6","phone":"8 (843) 000-00-00","email":"info@tochka-perevoda.ru","workHours":"Пн–Пт 9:00–19:00, Сб 10:00–16:00"}', true),
  ('notifications', '{"client_status_change": true, "client_ready": true, "reminder_pickup_days": 3, "deadline_warning_hours": 24}', false),
  ('volume_discounts', '[{"slug": "legal", "minQty": 10, "coefficient": 0.95}]', true),
  ('file_retention_days', '90', false)
on conflict (key) do nothing;
