import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { assertSupabaseConfigured } from "@/lib/config/env";

/**
 * Серверный клиент Supabase для Server Components и Route Handlers.
 * Управляет cookie-сессией (стандартный паттерн @supabase/ssr).
 */
export function createClient(): SupabaseClient<Database> {
  assertSupabaseConfigured();
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component не может записывать cookie — игнорируем;
            // запись выполняется в middleware при refresh.
          }
        },
      },
    },
  );
}
