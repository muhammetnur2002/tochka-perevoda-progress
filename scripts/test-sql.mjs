/**
 * Запуск SQL-теста матрицы доступа (supabase/tests/rls_check.sql) через psql.
 *
 *   pnpm test:sql                 — против DATABASE_URL из .env.local
 *   pnpm test:sql -- --fresh      — поднять пустую БД на «голом» PostgreSQL
 *                                   (DATABASE_URL должен указывать на сервер с правами
 *                                   CREATE DATABASE): заглушки Supabase + все миграции
 *
 * Тест выполняется в транзакции с ROLLBACK — данные не остаются.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

for (const name of [".env.local", ".env"]) {
  if (!existsSync(name)) continue;
  for (const line of readFileSync(name, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Не задана DATABASE_URL");
  process.exit(1);
}

const env = { ...process.env, PGCLIENTENCODING: "UTF8" };
const psql = (target, args) => {
  const r = spawnSync("psql", ["-v", "ON_ERROR_STOP=1", "-q", ...args, target], { stdio: "inherit", env });
  if (r.error) {
    console.error("psql не найден. Установите клиент PostgreSQL или запустите тест в Supabase SQL Editor.");
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
};

let target = url;
if (process.argv.includes("--fresh")) {
  const db = `tp_rls_${Date.now()}`;
  psql(url, ["-c", `create database ${db}`]);
  const u = new URL(url);
  u.pathname = `/${db}`;
  target = u.toString();
  psql(target, ["-f", "supabase/tests/supabase_stubs.sql"]);
  for (const f of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort()) {
    psql(target, ["-f", path.join("supabase/migrations", f)]);
  }
  console.log(`Временная БД: ${db} (удалите после проверки: drop database ${db})`);
}

psql(target, ["-f", "supabase/tests/rls_check.sql"]);
psql(target, ["-f", "supabase/tests/pricing_check.sql"]);
