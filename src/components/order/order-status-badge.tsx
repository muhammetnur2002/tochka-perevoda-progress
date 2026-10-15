"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/config/constants";

const VARIANTS: Record<OrderStatus, "secondary" | "default" | "info" | "gold" | "success" | "destructive"> = {
  new: "default",
  confirmed: "info",
  in_progress: "gold",
  ready: "success",
  issued: "secondary",
  completed: "secondary",
  cancelled: "destructive",
};

/** Бейдж статуса заказа на языке интерфейса. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("orderStatus");
  return <Badge variant={VARIANTS[status]}>{t(status)}</Badge>;
}
