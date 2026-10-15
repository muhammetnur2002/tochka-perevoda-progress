"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/components/cart/cart-provider";
import { useCatalog, toPricingSettings } from "@/hooks/use-catalog";
import { calculatePrice } from "@/lib/services/pricing";
import { formatMoney } from "@/lib/format/money";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Выдвижная панель корзины (сверху — шапка сайта). */
export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const { items, options, setQuantity, removeItem } = useCart();
  const { data: catalog } = useCatalog();

  const pricing = calculatePrice(items, {
    urgency: options.urgency,
    notaryRequested: options.notaryRequested,
    deliveryType: options.deliveryType,
    settings: toPricingSettings(catalog?.settings),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Корзина</SheetTitle>
          <SheetDescription>Выбранные услуги и предварительный расчёт</SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Корзина пуста</p>
            <Button asChild variant="outline" onClick={() => onOpenChange(false)}>
              <Link href="/services">Перейти в каталог</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto">
              {items.map((item) => (
                <div key={item.key} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setQuantity(item.key, item.quantity - 1)}
                      aria-label="Уменьшить"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setQuantity(item.key, item.quantity + 1)}
                      aria-label="Увеличить"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeItem(item.key)}
                      aria-label="Удалить"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Separator />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сумма</span>
                <span>{formatMoney(pricing.subtotal)}</span>
              </div>
              {pricing.urgencySurcharge > 0 && (
                <div className="flex justify-between text-gold-700">
                  <span>Срочность (×{pricing.urgencyCoefficient})</span>
                  <span>+{formatMoney(pricing.urgencySurcharge)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 text-base font-semibold">
                <span>Итого</span>
                <span>{formatMoney(pricing.total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Button asChild className="w-full" size="lg" onClick={() => onOpenChange(false)}>
                <Link href="/calculator">Рассчитать точно</Link>
              </Button>
              <Button asChild variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                <Link href="/checkout">Оформить заказ</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
