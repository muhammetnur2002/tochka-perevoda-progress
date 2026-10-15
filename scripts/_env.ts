/**
 * Загрузка переменных из .env.local и .env для скриптов (tsx не делает этого сам,
 * в отличие от Next.js). Уже заданные в окружении значения не перезаписываются.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

for (const name of [".env.local", ".env"]) {
  const file = path.join(process.cwd(), name);
  if (!existsSync(file)) continue;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
