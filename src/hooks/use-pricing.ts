"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCart } from "@/components/cart/cart-provider";
import { toPricingSettings, useCatalog } from "@/hooks/use-catalog";
import { apiFetch } from "@/lib/client/api";
import { calculatePrice, type PromoRejection, type PromoRule } from "@/lib/services/pricing";
import { dueNow, policyFromSettings, type DueNow, type PaymentPolicy } from "@/lib/payments/policy";
import type { DeliveryType } from "@/types/database.types";
import type { PriceBreakdown } from "@/types/domain";

interface QuoteResponse {
  promo: PromoRule | null;
  /** true — скидка применилась сама (автоскидка), а не по введённому коду. */
  auto: boolean;
  error: PromoRejection | null;
}

export interface PromoQuote {
  rule: PromoRule | null;
  auto: boolean;
  /** Почему введённый код не подошёл. */
  error: PromoRejection | null;
  loading: boolean;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/**
 * Какая скидка полагается на корзину (код и/или автоскидка). Решает сервер, на
 * клиенте — только показ: итоговая цена заказа в любом случае считается заново.
 */
export function usePromoQuote(opts: { deliveryType?: DeliveryType } = {}): PromoQuote {
  const { items, options, hydrated } = useCart();
  const body = JSON.stringify({
    code: options.promoCode,
    items: items.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity })),
    urgency: options.urgency,
    notaryRequested: options.notaryRequested,
    deliveryType: opts.deliveryType ?? options.deliveryType,
  });
  const debounced = useDebounced(body, 350);

  const { data, isFetching } = useQuery<QuoteResponse>({
    queryKey: ["promo-quote", debounced],
    queryFn: () => apiFetch<QuoteResponse>("/api/promo/quote", { method: "POST", body: debounced }),
    enabled: hydrated && items.length > 0,
    staleTime: 30_000,
    retry: false,
    placeholderData: keepPreviousData,
  });

  return {
    rule: items.length > 0 ? (data?.promo ?? null) : null,
    auto: data?.auto ?? false,
    error: options.promoCode ? (data?.error ?? null) : null,
    loading: isFetching || debounced !== body,
  };
}

/** Расчёт корзины с учётом промокода (для показа; итог заказа считает сервер). */
export function usePricing(opts: { deliveryType?: DeliveryType } = {}): PriceBreakdown {
  const { items, options } = useCart();
  const { data } = useCatalog();
  const { rule } = usePromoQuote(opts);
  return calculatePrice(items, {
    urgency: options.urgency,
    notaryRequested: options.notaryRequested,
    deliveryType: opts.deliveryType ?? options.deliveryType,
    settings: toPricingSettings(data?.settings),
    promo: rule,
  });
}

/** Политика оплаты из публичных настроек и сколько клиент платит сейчас (для показа в корзине и оформлении). */
export function usePaymentInfo(opts: { deliveryType?: DeliveryType } = {}): {
  policy: PaymentPolicy;
  due: DueNow;
  total: number;
} {
  const { items } = useCart();
  const { data } = useCatalog();
  const pricing = usePricing(opts);
  const policy = policyFromSettings(data?.settings);
  const hasNotarial = pricing.notaryFee > 0 || items.some((i) => i.isNotarial);
  return { policy, due: dueNow(policy, { total: pricing.total, paid: 0, hasNotarial }), total: pricing.total };
}
