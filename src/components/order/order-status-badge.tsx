import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/config/constants";

const VARIANTS: Record<OrderStatus, "secondary" | "default" | "info" | "gold" | "success" | "destructive"> = {
  new: "default",
  confirmed: "info",
  in_progress: "gold",
  ready: "gold",
  issued: "success",
  completed: "secondary",
  cancelled: "destructive",
};

/** Бейдж статуса заказа. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={VARIANTS[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}
