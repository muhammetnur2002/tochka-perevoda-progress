"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/components/cart/cart-provider";
import { usePricing } from "@/hooks/use-pricing";
import { useServiceName } from "@/i18n/names";
import { formatMoney } from "@/lib/format/money";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Выдвижная панель корзины из шапки сайта. */
export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const t = useTranslations("cartDrawer");
  const tc = useTranslations("calculator");
  const serviceName = useServiceName();
  const { items, setQuantity, removeItem } = useCart();
  const pricing = usePricing();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">{t("empty")}</p>
            <Button asChild variant="outline" onClick={() => onOpenChange(false)}>
              <Link href="/calculator">{t("toCatalog")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto">
              {items.map((item) => {
                const name = serviceName(item.slug, item.name);
                return (
                  <div key={item.key} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(item.unitPrice)} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setQuantity(item.key, item.quantity - 1)}
                        aria-label={tc("decrease", { name })}
                      >
                        <Minus />
                      </Button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setQuantity(item.key, item.quantity + 1)}
                        aria-label={tc("increase", { name })}
                      >
                        <Plus />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive"
                        onClick={() => removeItem(item.key)}
                        aria-label={name}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("sum")}</span>
                <span>{formatMoney(pricing.subtotal)}</span>
              </div>
              {pricing.urgencySurcharge > 0 && (
                <div className="flex justify-between text-gold-800">
                  <span>{t("urgency", { coef: pricing.urgencyCoefficient })}</span>
                  <span>+{formatMoney(pricing.urgencySurcharge)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 text-base font-semibold">
                <span>{t("total")}</span>
                <span>{formatMoney(pricing.total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Button asChild className="w-full" size="lg" onClick={() => onOpenChange(false)}>
                <Link href="/calculator">{t("calculate")}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                <Link href="/checkout">{t("checkout")}</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
