# Точка Перевода Прогресс — платформа бюро переводов

Сайт с каталогом и калькулятором, онлайн-заказ с загрузкой документов и оплатой
по СБП/QR/карте, проверка статуса, личный кабинет, Telegram-бот и Mini App,
CRM-админка (канбан, клиенты, прайс, финансы, отчёты, экспорт) и кабинет переводчика.

г. Казань, ул. Сибирский Тракт, 7/6.

| Стек | |
|---|---|
| Фронтенд и API | Next.js 14 (App Router, Server Actions), TypeScript strict, Tailwind + shadcn/ui |
| Данные | Supabase: PostgreSQL + RLS, Auth, Storage, Realtime |
| Платежи | ЮKassa (карта, СБП, QR) + mock-провайдер без ключей |
| Уведомления | Telegram Bot API → SMS.ru → SMTP (с фолбэком и очередью повторов) |
| Тесты | Vitest (54 unit-теста), SQL-тесты RLS и цен, Playwright smoke |

## Быстрый старт (локально)

Нужны **Node.js ≥ 20**, **pnpm 9** и проект **Supabase** (облачный бесплатный
или локальный через Supabase CLI). Ключи ЮKassa, SMS, SMTP и Telegram не нужны —
работают mock-драйверы.

```bash
pnpm install
cp .env.local.example .env.local   # вставьте ключи Supabase и DATABASE_URL
pnpm db:push                       # схема, RLS, триггеры, прайс (24 услуги), настройки
pnpm db:seed                       # демо-пользователи всех ролей и заказы
pnpm dev                           # http://localhost:3000
```

Где взять значения для `.env.local` (Supabase Dashboard → Project Settings):

| Переменная | Где |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | API → Project URL / anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | API → service_role (только сервер!) |
| `DATABASE_URL` | Database → Connection string → URI (Session pooler) |

Локальный Supabase (нужен Docker Desktop): `npx supabase start` — миграции применятся сами.
Порты перенесены на 5442x, т.к. Windows резервирует 54308–54407:
API `http://127.0.0.1:54421`, БД `postgresql://postgres:postgres@127.0.0.1:54422/postgres`,
Studio `http://127.0.0.1:54423`, почта (Mailpit) `http://127.0.0.1:54424`; ключи — `npx supabase status`.

### Демо-доступы (после `pnpm db:seed`, только для разработки)

| Роль | Email | Пароль | Куда попадает |
|---|---|---|---|
| Администратор | admin@tochka.local | Admin123! | /admin (+ аудит, роли) |
| Менеджер | manager@tochka.local | Manager123! | /admin |
| Переводчик | translator@tochka.local | Translator123! | /workspace |
| Нотариус / печать | notary@ / printer@tochka.local | Notary123! / Printer123! | /workspace |
| Клиент | client@tochka.local | Client123! | /account |

Без ключей ЮKassa оплата имитируется: на экране оплаты есть кнопка **«Я оплатил(а)»**.
SMS, письма и сообщения Telegram печатаются в консоль `pnpm dev`.

## Команды

| Команда | Что делает |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | разработка / продакшен-сборка (standalone) / запуск |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | проверка типов, ESLint, unit-тесты (`pnpm check` — всё сразу) |
| `pnpm test:sql` | SQL-тесты RLS и цен против `DATABASE_URL` (нужен `psql`) |
| `pnpm test:e2e` | Playwright smoke (`E2E_FULL=1` — полный сценарий с БД) |
| `pnpm db:push` | применить миграции `supabase/migrations` (идемпотентно) |
| `pnpm db:seed` | демо-данные (не на проде) |
| `pnpm db:types` | перегенерировать типы из облачного проекта (Supabase CLI) |
| `pnpm tg:set-webhook` | вебхук бота, команды и кнопка меню Mini App |
| `pnpm tg:poll` | бот в режиме polling для локальной разработки |
| `pnpm brand:assets` | пересобрать логотипы, иконки, OG-картинку из исходного JPG |

## Чек-лист запуска в продакшен

1. **Supabase** в регионе, допустимом по 152-ФЗ (self-hosted в Yandex Cloud или managed — см. `docs/152-FZ.md`); включить PITR/бэкапы.
2. `pnpm db:push` против продакшен-БД; **не** запускать `db:seed`.
3. Заполнить реальные телефон, email и часы работы в `src/lib/config/constants.ts` и настройку `company` (админка → Настройки).
4. Секреты окружения: `SUPABASE_SERVICE_ROLE_KEY`, `ORDER_ACCESS_SECRET` (`openssl rand -hex 32`), `CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET`.
5. ЮKassa: `PAYMENT_PROVIDER=yookassa`, `YOOKASSA_SHOP_ID/SECRET_KEY`; в кабинете ЮKassa — HTTP-уведомления на `https://<домен>/api/webhooks/payment` (события `payment.succeeded`, `payment.canceled`); при онлайн-кассе — `YOOKASSA_SEND_RECEIPT=true`.
6. Telegram: токен @BotFather → `pnpm tg:set-webhook`; в @BotFather → Bot Settings → Configure Mini App → URL `https://<домен>/tg`.
7. SMS.ru и SMTP — ключи; callback SMS.ru: `https://<домен>/api/webhooks/sms?secret=<SMSRU_CALLBACK_SECRET>`.
8. Supabase Auth → URL Configuration: Site URL = домен, Redirect URLs: `https://<домен>/auth/callback`.
9. Cron (раз в час `/api/cron/deadlines`, раз в 15 мин `POST /api/notifications`, раз в сутки `/api/cron/retention`) с заголовком `Authorization: Bearer <CRON_SECRET>`.
10. Выдать роли сотрудникам: администратор регистрируется на сайте, роль `admin` выставляется SQL-запросом один раз (см. `docs/OPERATIONS.md`), дальше роли — в админке «Исполнители».
11. Проверка: `GET /api/health` → `database: "ok"`; тестовый заказ на 1 ₽-услугу и возврат в ЮKassa.

## Структура

```
src/app/(marketing)   сайт: главная, услуги, калькулятор, оформление, оплата, статус, юр. страницы
src/app/(auth)        вход, регистрация, сброс пароля
src/app/account       личный кабинет (заказы, профиль с подтверждением телефона, 152-ФЗ)
src/app/tg            Telegram Mini App
src/app/admin         CRM: дашборд, канбан, карточка заказа, клиенты, прайс, исполнители, финансы, отчёты, настройки, аудит
src/app/workspace     кабинет переводчика/нотариуса/печати
src/app/api           REST для Mini App, бота, вебхуков, загрузки, cron
src/lib               бизнес-логика: цены и сроки, заказы, платежи, уведомления, Telegram, хранилище, права
supabase/migrations   схема, функции, RLS, Storage, представления, сид прайса, Realtime
supabase/tests        SQL-тесты RLS и цен + заглушки Supabase для «голого» PostgreSQL
docs/                 архитектура, модель данных, API, деплой, регламенты, 152-ФЗ
```

## Известные ограничения

- Исходный логотип — 240×240 px: аватар бота и OG-картинка апскейлены. При появлении
  вектора или PNG ≥ 1024 px положите его вместо JPG и выполните `pnpm brand:assets`.
- Стоимость нотариального заверения и доставки по умолчанию 0 ₽ («уточняет менеджер») —
  задайте реальные значения в админке → Настройки.
- Рейт-лимиты хранятся в БД (`rate_limit_hit`), при её недоступности — в памяти процесса.
- ИИ-функции (YandexGPT/GigaChat) — заглушки этапа 2 (`AI_PROVIDER=off`).

Подробности — в [`docs/`](docs/).
