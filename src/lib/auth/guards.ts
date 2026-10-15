import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole, UserRow } from "@/types/database.types";
import { homePathForRole } from "./roles";

/**
 * Серверные гарды для layout'ов (Server Components). Роль читается из БД,
 * а не из JWT — изменения роли админом применяются сразу.
 */

/** Профиль текущего пользователя или null. */
export async function getCurrentProfile(): Promise<UserRow | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
  if (!data || !data.is_active) return null;
  return data;
}

/** Требует вход, иначе — на /login с возвратом. */
export async function requireUser(next = "/account"): Promise<UserRow> {
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(next)}`);
  return profile;
}

/** Требует одну из ролей, иначе — на «домашнюю» страницу своей роли. */
export async function requireRole(roles: readonly UserRole[], next: string): Promise<UserRow> {
  const profile = await requireUser(next);
  if (!roles.includes(profile.role)) redirect(homePathForRole(profile.role));
  return profile;
}

/** Проверяет роль без редиректа. */
export function hasRole(profile: UserRow | null, roles: readonly UserRole[]): boolean {
  return Boolean(profile && roles.includes(profile.role));
}
