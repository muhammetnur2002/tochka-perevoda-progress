"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useCart, serviceToCartItem } from "@/components/cart/cart-provider";
import { useCatalog } from "@/hooks/use-catalog";

interface RepeatOrderButtonProps extends Omit<ButtonProps, "onClick"> {
  items: { service_id: string | null; quantity: number }[];
}

/**
 * «Повторить заказ» в 1 клик: кладёт те же услуги в корзину по ТЕКУЩИМ ценам
 * и открывает калькулятор (согласие и оплата — заново, как требует 152-ФЗ).
 */
export function RepeatOrderButton({ items, children, ...props }: RepeatOrderButtonProps) {
  const router = useRouter();
  const { replaceItems } = useCart();
  const { data } = useCatalog();

  const repeat = () => {
    const services = data?.services ?? [];
    const cart = items.flatMap((i) => {
      const s = services.find((x) => x.id === i.service_id);
      return s ? [serviceToCartItem(s, i.quantity)] : [];
    });
    if (cart.length === 0) {
      toast.error("Эти услуги больше не доступны в каталоге");
      return;
    }
    if (cart.length < items.length) toast.warning("Часть услуг снята с продажи — они не добавлены");
    replaceItems(cart);
    router.push("/calculator");
  };

  return (
    <Button variant="gold" onClick={repeat} disabled={!data} {...props}>
      {children ?? (
        <>
          <RefreshCw /> Повторить
        </>
      )}
    </Button>
  );
}
