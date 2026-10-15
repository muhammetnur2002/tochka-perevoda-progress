# Деплой в Yandex Cloud

Приложение — один Docker-образ (Next.js standalone, порт 3000) + Supabase +
плановые вызовы cron-эндпоинтов. Ниже три варианта; для старта рекомендуем **Б**.

## База данных и файлы (152-ФЗ)

| Вариант | Когда |
|---|---|
| **Supabase self-hosted на ВМ в Yandex Cloud** (docker compose из репозитория supabase/supabase) | данные клиентов остаются в РФ; полный функционал (Auth, Storage, Realtime) |
| Supabase Cloud | быстро для пилота; регион вне РФ — оформите правовое основание трансграничной передачи или используйте только для теста |
| Yandex Managed PostgreSQL + Supabase Auth/Realtime/Storage self-hosted | максимально «облачный» вариант в РФ |

Файлы заказов можно хранить в Yandex Object Storage: `STORAGE_DRIVER=yandex`,
`S3_*` (сервисный аккаунт с ролью `storage.editor`, бакет **приватный**,
шифрование SSE включается заголовком при загрузке).

Применение схемы: `DATABASE_URL=… pnpm db:push` с машины разработчика или из CI.

## Вариант А — Serverless Containers

1. Container Registry: `yc container registry create --name tochka`.
2. Сборка и публикация:
   ```bash
   docker build -t cr.yandex/<registry-id>/tochka:1 \
     --build-arg NEXT_PUBLIC_SUPABASE_URL=… --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=… \
     --build-arg NEXT_PUBLIC_SITE_URL=https://perevod-progress.ru .
   docker push cr.yandex/<registry-id>/tochka:1
   ```
3. `yc serverless container create --name tochka` и ревизия: образ, 1 ГБ RAM,
   concurrency 8, переменные окружения из `.env.example` (секреты — через Lockbox).
4. API Gateway с доменом и сертификатом Certificate Manager → контейнер.
5. Cron: **Cloud Functions → Триггеры → Таймер**, функция `curl` с заголовком
   `Authorization: Bearer <CRON_SECRET>`: `0 * * * *` → `/api/cron/deadlines`,
   `*/15 * * * *` → `POST /api/notifications`, `30 3 * * *` → `/api/cron/retention`.

Учтите: холодный старт контейнера 1–3 с; для мгновенного отклика держите
«подготовленные экземпляры» = 1.

## Вариант Б — ВМ + Docker Compose + Caddy (рекомендуется)

1. Compute Cloud: Ubuntu 24.04, 2 vCPU / 4 ГБ, публичный IP, группа безопасности: 22, 80, 443.
2. Установить Docker, склонировать репозиторий, создать `.env` по `.env.example`.
3. `docker compose up -d --build` — поднимет приложение (127.0.0.1:3000) и cron-контейнер.
4. Reverse proxy с автоматическим HTTPS (Caddy):
   ```
   perevod-progress.ru {
     encode zstd gzip
     reverse_proxy 127.0.0.1:3000
   }
   ```
   Caddy передаёт `X-Forwarded-For` — это нужно для рейт-лимитов и IP-проверки вебхука ЮKassa.
5. Обновление: `git pull && docker compose up -d --build`.
6. Бэкапы: `scripts/backup.sh` по cron на ВМ (или снапшоты дисков + PITR в БД).

## Вариант В — ВМ + Node.js + PM2 (без Docker)

```bash
pnpm install --frozen-lockfile && pnpm build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
pm2 start .next/standalone/server.js --name tochka -i 2 --env production
```
nginx: `proxy_pass http://127.0.0.1:3000; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`

## После деплоя

- `curl https://<домен>/api/health` → `{"status":"ok","database":"ok", …}`.
- `pnpm tg:set-webhook` с `NEXT_PUBLIC_SITE_URL=https://<домен>`.
- ЮKassa → Интеграция → HTTP-уведомления: `https://<домен>/api/webhooks/payment`.
- Supabase Auth → Site URL и Redirect URLs (`/auth/callback`).
- Мониторинг: Yandex Monitoring (метрики ВМ/контейнера) + алерт на `/api/health`;
  логи приложения — JSON в stdout (`LOG_LEVEL`), собираются Cloud Logging.
