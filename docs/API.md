# REST API

Все ответы — JSON. Ошибка: `{ "error": { "message": "…", "code": "BAD_REQUEST" } }`
(коды: `BAD_REQUEST` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404,
`CONFLICT` 409, `RATE_LIMIT` 429). Авторизация — cookie сессии Supabase; гость
подтверждает доступ к заказу заголовком `x-order-token` (выдаётся при создании).

| Маршрут | Метод | Доступ | Назначение |
|---|---|---|---|
| `/api/services` | GET | все | каталог, языки, публичные настройки (`Cache-Control: s-maxage=300`) |
| `/api/orders` | POST | все, 5 / 10 мин с IP | создать заказ → `{orderId, publicNumber, totalPrice, deadline, accessToken}` |
| `/api/orders` | GET | вход | список (клиент — свои, менеджер — все; `?status=`, `?limit=`, `?closed=1`) |
| `/api/orders/[id]` | GET | по RLS | карточка с позициями, файлами, платежами, историей |
| `/api/orders/[id]` | PATCH | менеджер | `{status, comment?, deadline?}` — смена статуса + уведомление клиента |
| `/api/orders/[id]/assign` | POST | менеджер | `{userId, role, force?}` — назначить исполнителя (проверка загрузки) |
| `/api/orders/lookup` | POST | все, 5 / 10 мин с IP | `{number, phone}` — публичный статус (оба поля обязательны) |
| `/api/upload` | POST multipart | владелец / токен / менеджер / исполнитель (`kind=translation`) | `orderId`, `file`, `kind?`; до 50 МБ, проверка сигнатуры |
| `/api/files/[id]/url` | GET | как к заказу | подписанная ссылка на 5 минут |
| `/api/payments` | POST | владелец / токен / менеджер | `{orderId, method: sbp\|qr\|card}` → `{paymentId, amount, qrSvg, confirmationUrl, mock}` |
| `/api/payments/[id]` | GET | как к заказу | статус платежа (поллинг) |
| `/api/payments/[id]/mock-confirm` | POST | как к заказу, только mock | имитация успешной оплаты |
| `/api/webhooks/payment` | POST | IP ЮKassa | уведомление ЮKassa (перезапрос платежа, идемпотентно) |
| `/api/webhooks/telegram` | POST | секрет-заголовок | апдейты бота |
| `/api/webhooks/sms` | POST | `?secret=` | статусы доставки SMS.ru |
| `/api/telegram/auth` | POST | все | `{initData}` → сессия Supabase в cookie |
| `/api/chat` | GET / POST | участники заказа | `?orderId=` / `{orderId, body}` |
| `/api/account/data` | GET / DELETE | вход | выгрузка ПД (JSON) / удаление ПД и аккаунта |
| `/api/account/phone` | POST / PUT | вход | отправить SMS-код / подтвердить телефон и привязать гостевые заказы |
| `/api/admin/stats` | GET | менеджер | агрегаты (`?days=`) |
| `/api/admin/export` | GET | менеджер | `?type=orders\|payments\|clients&format=xlsx\|csv&from&to` |
| `/api/cron/deadlines` | GET | `Bearer CRON_SECRET` | дедлайны < 24 ч, «не забрал > 3 дней», повтор уведомлений |
| `/api/cron/retention` | GET | `Bearer CRON_SECRET` | удаление файлов закрытых заказов старше N дней |
| `/api/notifications` | POST | `Bearer CRON_SECRET` | воркер очереди уведомлений |
| `/api/health` | GET | все | состояние БД и режимы драйверов (503 при недоступной БД) |

Мутации CRM и кабинета переводчика — Server Actions (`src/app/admin/actions.ts`,
`src/app/workspace/actions.ts`): статус, срок, назначение, ручная оплата, прайс,
настройки, клиенты, роли, профиль переводчика, статус задачи.
