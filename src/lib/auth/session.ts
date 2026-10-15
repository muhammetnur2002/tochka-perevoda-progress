import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { forbidden, unauthorized } from "@/lib/errors";
import type { Database, UserRole } from "@/types/database.types";
import { can, type Permission } from "./roles";

/** Текущий пользователь в API-маршруте: id, роль и клиент Supabase с его сессией. */
export interface Actor {
  id: string;
  role: UserRole;
  name: string | null;
  supabase: SupabaseClient<Database>;
}

/** Возвращает актёра или null (гость). Роль читается из БД, а не из JWT. */
export async function getActor(): Promise<Actor | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("users")
    .select("role, name, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (profile && !profile.is_active) return null;
  return { id: user.id, role: profile?.role ?? "client", name: profile?.name ?? null, supabase };
}

/** Требует вход. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw unauthorized();
  return actor;
}

/** Требует право из матрицы ролей. */
export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireActor();
  if (!can(actor.role, permission)) throw forbidden();
  return actor;
}

/** Проверка секрета cron-задач (заголовок Authorization: Bearer <CRON_SECRET>). */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** IP и User-Agent запроса (для аудита и согласий 152-ФЗ). */
export function requestMeta(req: NextRequest): { ip: string | null; userAgent: string | null } {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  return { ip, userAgent: req.headers.get("user-agent") };
}
