import "server-only";
import type { CartItem } from "@/types/domain";
import type { PromoCodeRow } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculatePrice,
  promoDiscountAmount,
  type PriceOptions,
  type PromoRejection,
  type PromoRule,
} from "@/lib/services/pricing";

export const PROMO_REJECTION_MESSAGES: Record<PromoRejection, string> = {
  not_found: "Промокод не найден",
  inactive: "Промокод не действует",
  not_started: "Промокод ещё не начал действовать",
  expired: "Срок действия промокода истёк",
  limit: "Лимит использований промокода исчерпан",
  client_limit: "Вы уже использовали этот промокод",
  first_order_only: "Промокод действует только на первый заказ",
  min_amount: "Сумма заказа меньше минимальной для этого промокода",
};

/** Единый вид кода: без пробелов, верхний регистр (так он хранится в БД). */
export function normalizePromoCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function promoRuleFromRow(row: PromoCodeRow): PromoRule {
  return {
    code: row.code,
    name: row.name,
    type: row.discount_type,
    value: Number(row.value),
    maxDiscount: row.max_discount == null ? null : Number(row.max_discount),
    minOrderAmount: Number(row.min_order_amount),
  };
}

export interface ResolvedPromo {
  row: PromoCodeRow;
  rule: PromoRule;
  discount: number;
}

export interface ResolvePromoArgs {
  /** Введённый клиентом код (необязательно: автоскидки применяются и без него). */
  code?: string | null;
  items: CartItem[];
  options: Omit<PriceOptions, "promo">;
  /** Известен при оформлении заказа — тогда проверяются лимиты на клиента и «первый заказ». */
  clientId?: string | null;
  now?: Date;
}

export interface ResolvePromoResult {
  /** Лучшая применимая скидка (введённый код или автоскидка). */
  promo: ResolvedPromo | null;
  /** Почему введённый код не подошёл (если код вводили). */
  codeError: PromoRejection | null;
}

/**
 * Подбирает скидку для заказа. Вводить код необязательно; из введённого кода и
 * автоскидок выбирается наибольшая (скидки не суммируются).
 */
export async function resolvePromo(args: ResolvePromoArgs): Promise<ResolvePromoResult> {
  const admin = createAdminClient();
  const now = args.now ?? new Date();
  const base = calculatePrice(args.items, { ...args.options, now });
  const servicesAmount = Math.round((base.total - base.notaryFee - base.deliveryFee) * 100) / 100;

  const usage = async (promoId: string): Promise<number> => {
    const { data } = await admin.from("v_promo_usage").select("uses").eq("promo_code_id", promoId).maybeSingle();
    return Number(data?.uses ?? 0);
  };
  const clientOrders = async (promoId: string | null): Promise<number> => {
    if (!args.clientId) return 0;
    let q = admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("client_id", args.clientId)
      .neq("status", "cancelled");
    if (promoId) q = q.eq("promo_code_id", promoId);
    const { count } = await q;
    return count ?? 0;
  };

  const check = async (row: PromoCodeRow): Promise<PromoRejection | null> => {
    if (!row.is_active) return "inactive";
    if (row.valid_from && new Date(row.valid_from) > now) return "not_started";
    if (row.valid_to && new Date(row.valid_to) <= now) return "expired";
    if (promoDiscountAmount(promoRuleFromRow(row), servicesAmount) <= 0) return "min_amount";
    if (row.max_uses != null && (await usage(row.id)) >= row.max_uses) return "limit";
    if (row.max_uses_per_client != null && args.clientId && (await clientOrders(row.id)) >= row.max_uses_per_client) {
      return "client_limit";
    }
    if (row.first_order_only && args.clientId && (await clientOrders(null)) > 0) return "first_order_only";
    return null;
  };

  const candidates: ResolvedPromo[] = [];
  let codeError: PromoRejection | null = null;

  const code = args.code ? normalizePromoCode(args.code) : "";
  if (code) {
    const { data: row } = await admin.from("promo_codes").select("*").eq("code", code).maybeSingle();
    if (!row) {
      codeError = "not_found";
    } else {
      codeError = await check(row);
      if (!codeError) {
        const rule = promoRuleFromRow(row);
        candidates.push({ row, rule, discount: promoDiscountAmount(rule, servicesAmount) });
      }
    }
  }

  const { data: autos } = await admin
    .from("promo_codes")
    .select("*")
    .eq("is_active", true)
    .eq("auto_apply", true);
  for (const row of autos ?? []) {
    if (candidates.some((c) => c.row.id === row.id)) continue;
    if (await check(row)) continue;
    const rule = promoRuleFromRow(row);
    candidates.push({ row, rule, discount: promoDiscountAmount(rule, servicesAmount) });
  }

  candidates.sort((a, b) => b.discount - a.discount);
  return { promo: candidates[0] ?? null, codeError };
}
