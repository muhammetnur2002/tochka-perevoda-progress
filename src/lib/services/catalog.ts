import "server-only";
import type { LanguageRow, ServiceRow, SettingRow } from "@/types/database.types";
import { SEED_LANGUAGES, SEED_SERVICES } from "@/lib/seed/services";
import { isDemoMode } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/server";

function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Активные услуги каталога (из БД или демо-данные). */
export async function getServices(): Promise<ServiceRow[]> {
  if (isDemoMode() || !hasSupabaseConfig()) {
    return SEED_SERVICES.map((s) => ({
      id: s.slug,
      slug: s.slug,
      category: s.category,
      name: s.name,
      description: s.description,
      price: s.price,
      unit: s.unit,
      duration_days: s.durationDays,
      is_active: true,
      is_notarial: s.isNotarial,
      sort_order: s.sortOrder,
      meta: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Не удалось загрузить услуги: ${error.message}`);
  return data ?? [];
}

/** Языки перевода. */
export async function getLanguages(): Promise<LanguageRow[]> {
  if (isDemoMode() || !hasSupabaseConfig()) {
    return SEED_LANGUAGES.map((l) => ({
      id: l.code,
      code: l.code,
      name: l.name,
      is_active: true,
    }));
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("languages")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`Не удалось загрузить языки: ${error.message}`);
  return data ?? [];
}

/** Публичные настройки (срочность, нотариальное заверение, доставка). */
export async function getPublicSettings(): Promise<Record<string, unknown>> {
  const defaults: Record<string, unknown> = {
    urgency: { "1d": 1.5, same_day: 2.0 },
    notary_fee: 0,
    delivery_price: 0,
    holidays: [],
    company: {
      name: "Точка Перевода Прогресс",
      city: "Казань",
      address: "г. Казань, ул. Сибирский Тракт, 7/6",
    },
  };

  if (isDemoMode() || !hasSupabaseConfig()) return defaults;

  const supabase = createClient();
  const { data, error } = await supabase.from("settings").select("*").eq("is_public", true);
  if (error) return defaults;

  const map: Record<string, unknown> = { ...defaults };
  for (const row of (data ?? []) as SettingRow[]) {
    map[row.key] = row.value;
  }
  return map;
}
