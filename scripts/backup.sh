#!/usr/bin/env bash
# =============================================================================
# Резервное копирование PostgreSQL (Supabase).
# Запуск: bash scripts/backup.sh
# Требует DATABASE_URL и каталог backups/ (создаётся автоматически).
# Для расписания добавьте в cron (пример ниже).
#
#   # Ежедневно в 03:00
#   0 3 * * * cd /path/to/app && bash scripts/backup.sh >> backups/backup.log 2>&1
# =============================================================================
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Ошибка: не задана DATABASE_URL"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
OUTDIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
mkdir -p "$OUTDIR"

echo "[$(date '+%F %T')] Начинаю резервное копирование..."

pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --file="$OUTDIR/db_${STAMP}.dump"

# Оставляем последние 14 копий
ls -1t "$OUTDIR"/db_*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "[$(date '+%F %T')] Готово: $OUTDIR/db_${STAMP}.dump"

# ---------------------------------------------------------------------------
# Восстановление:
#   pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" backups/db_XXXX.dump
#
# Также включите PITR в Supabase Dashboard (Project Settings → Database).
# ---------------------------------------------------------------------------
