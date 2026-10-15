/**
 * Применение SQL-миграций из supabase/migrations к PostgreSQL по DATABASE_URL
 * (облачный Supabase, локальный `supabase start` или Yandex Managed PostgreSQL
 * с установленными заглушками Supabase — см. supabase/tests/supabase_stubs.sql).
 *
 * Запуск: pnpm db:push
 * Миграции идемпотентны; журнал применённых — в таблице public._migrations.
 * Флаг --force переприменяет все файлы (безопасно благодаря идемпотентности).
 */
import "./_env";
import { Client } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

function sslFor(url: string) {
  const host = new URL(url).hostname;
  const local = ["localhost", "127.0.0.1", "::1", "db", "supabase_db"].includes(host);
  return local || /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Не задана DATABASE_URL (.env.local). Облако: Supabase → Project Settings → Database → Connection string (URI). " +
        "Локально: postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    );
  }
  const force = process.argv.includes("--force");

  const client = new Client({ connectionString: url, ssl: sslFor(url) });
  await client.connect();

  await client.query(
    `create table if not exists public._migrations (
       name text primary key,
       applied_at timestamptz not null default now()
     );
     alter table public._migrations enable row level security;`,
  );

  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Найдено миграций: ${files.length}`);
  for (const file of files) {
    const applied = await client.query("select 1 from public._migrations where name = $1", [file]);
    if ((applied.rowCount ?? 0) > 0 && !force) {
      console.log(`  · ${file} — уже применена`);
      continue;
    }
    const sql = readFileSync(path.join(dir, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into public._migrations (name) values ($1) on conflict (name) do update set applied_at = now()",
        [file],
      );
      await client.query("commit");
      console.log(`  ✓ ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`Ошибка в миграции ${file}: ${(err as Error).message}`);
    }
  }

  await client.end();
  console.log("Готово: схема БД актуальна.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
