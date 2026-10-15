# Модель данных

Миграции: `supabase/migrations/0001…0009` (идемпотентны, применяются `pnpm db:push`).

| Таблица | Назначение |
|---|---|
| `users` | профиль к `auth.users`: роль, имя, телефон (+ `phone_verified_at`), Telegram |
| `clients` | клиенты (физ./юр. лица, ИНН); `user_id` — если есть кабинет |
| `services` | 24 услуги прайса: категория, цена, единица (страница/документ/шт.), срок, `is_notarial` |
| `price_rules` | правила: `per_page`, `fixed`, `urgent` (×1.5/×2), `volume` (−5% от 10 стр.) |
| `languages` | языки перевода |
| `orders` | заказ: номер `ТП-ГГГГ-000123`, статус, суммы (subtotal, скидка, срочность, заверение, доставка, итог, оплачено), срок, источник |
| `order_items` | позиции с `name_snapshot` и ценой на момент заказа |
| `files` | метаданные файлов (`orders/{order_id}/…` в приватном бакете), sha256, `deleted_at` |
| `payments` | платежи ЮKassa/mock/ручные: `provider_payment_id` (уник.), `idempotence_key` |
| `status_history` | история статусов с автором и комментарием |
| `notifications` | журнал и очередь уведомлений (попытки, `next_attempt_at`) |
| `translators` | лимит задач в день, языки, специализация, текущая загрузка |
| `order_assignments` | назначения исполнителей (переводчик/нотариус/печать/менеджер) |
| `audit_log` | аудит INSERT/UPDATE/DELETE (before/after) |
| `consents` | согласия 152-ФЗ: версия документа, время, IP, UA |
| `chat_messages` | чат клиента с менеджером по заказу |
| `settings` | key/value: `urgency`, `notary_fee`, `delivery_price`, `prepayment_percent`, `holidays`, `notifications`, `file_retention_days`, `volume_discounts`, `company` |
| `rate_limits` | счётчики рейт-лимитов (`rate_limit_hit`) |
| `phone_verifications` | SMS-коды подтверждения телефона (хэш, попытки, срок) |

## Статусы заказа

`new → confirmed → in_progress → ready → issued → completed`, плюс `cancelled`.
Разрешено: вперёд на любой шаг, назад на один, отмена до завершения
(`src/lib/auth/roles.ts → canTransition`).

## Функции и триггеры

| Объект | Что делает |
|---|---|
| `get_user_role`, `is_staff`, `is_manager`, `is_admin`, `is_assigned_to_order`, `can_view_order`, `owns_order` | SECURITY DEFINER-хелперы для RLS (без рекурсии по `users`) |
| `handle_new_user` | профиль и карточка клиента при регистрации; роль только из `app_metadata` |
| `users_prevent_role_escalation` | роль, Telegram, активность, подтверждение телефона меняет только админ/сервер |
| `generate_order_number` | `ТП-2026-000123` |
| `recalc_order_totals` | итог = (Σ позиций − скидка) × срочность + заверение + доставка |
| `payments_after_change` | `paid_amount`, `new → confirmed` после успешной оплаты |
| `orders_status_history`, `orders_set_dates`, `enqueue_status_notification` | история, даты выдачи/завершения/отмены, внутреннее уведомление |
| `change_order_status(id, status, comment)` | смена статуса с комментарием (SECURITY INVOKER — под RLS) |
| `claim_guest_orders(user)` | привязка гостевых заказов по подтверждённому телефону (только service_role) |
| `assignments_guard`, `sync_translator_load` | исполнитель меняет только статус задачи; пересчёт загрузки |
| `audit_row_change` | аудит orders, order_items, payments, services, users |
| `rate_limit_hit` | атомарный счётчик рейт-лимита (только service_role) |
| `normalize_phone` | 8/10-значные номера → `7XXXXXXXXXX` (как в TS) |

## Представления (security_invoker)

`v_revenue_daily`, `v_service_popularity`, `v_language_popularity`,
`v_translator_load`, `v_deadline_approaching` (срок < 24 ч), `v_unclaimed_orders`
(«готов» > 3 дней). Работают под RLS читающего; гостю недоступны.

## Матрица доступа (RLS)

| | гость | клиент | переводчик/нотариус/печать | менеджер | админ |
|---|---|---|---|---|---|
| каталог, языки, публичные настройки | чтение | чтение | чтение | правка | правка |
| заказы, позиции, история | — | свои | назначенные (чтение) | все | все |
| файлы | через токен | свои | назначенные (+ загрузка перевода) | все | все |
| платежи | через токен | свои | — | все | все |
| чат | — | свои заказы | чтение назначенных | все | все |
| назначения | — | — | свои (только статус) | все | все |
| клиенты | — | своя карточка | своя карточка | все | все |
| аудит | — | — | — | — | чтение |

Проверяется автотестом `supabase/tests/rls_check.sql` (10 сценариев).
