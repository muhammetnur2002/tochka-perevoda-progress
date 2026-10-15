/**
 * Генерация официальных типов Supabase через CLI.
 * Требует установленного Supabase CLI и привязанного/указанного проекта.
 *
 * Запуск: pnpm db:types
 *  или:   SUPABASE_PROJECT_ID=abcdefghijklmnop pnpm db:types
 */
import { execSync } from "node:child_process";

function projectIdFromUrl(url: string): string | null {
  const m = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  return m?.[1] ?? null;
}

async function main() {
  const projectId =
    process.env.SUPABASE_PROJECT_ID ?? projectIdFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");

  if (!projectId) {
    console.error(
      "Не удалось определить project_id. Задайте SUPABASE_PROJECT_ID " +
        "или NEXT_PUBLIC_SUPABASE_URL и запустите снова.",
    );
    process.exit(1);
  }

  const cmd = `supabase gen types typescript --project-id ${projectId} --schema public > src/types/database.types.ts`;
  try {
    execSync(cmd, { stdio: "inherit" });
    console.log("Типы обновлены в src/types/database.types.ts");
  } catch {
    console.error(
      "Не удалось запустить Supabase CLI. Установите его: " +
        "https://supabase.com/docs/guides/cli — или используйте рукописные типы.",
    );
    process.exit(1);
  }
}

main();
