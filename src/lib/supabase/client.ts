import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { assertSupabaseConfigured } from "@/lib/config/env";

let browserClient: SupabaseClient<Database> | null = null;

/**
 * Браузерный клиент Supabase (singleton). Используется в клиентских компонентах
 * для запросов и Realtime. RLS ограничивает доступ на уровне базы.
 */
export function createClient(): SupabaseClient<Database> {
  if (browserClient) return browserClient;
  assertSupabaseConfigured();
  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return browserClient;
}
