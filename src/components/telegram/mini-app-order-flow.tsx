"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Camera, CheckCircle2, FileText, Minus, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/components/cart/cart-provider";
import { NotaryCheckbox, PriceLines, UrgencySwitch } from "@/components/cart/order-summary";
import { PaymentPanel } from "@/components/payments/payment-panel";
import { LanguagePairPicker, OfficePicker } from "@/components/order/placement-pickers";
import { TgBackButton, TgMainButton } from "@/components/telegram/tg-buttons";
import { useCatalog, toPricingSettings } from "@/hooks/use-catalog";
import { useTelegram } from "@/hooks/use-telegram";
import { usePricing } from "@/hooks/use-pricing";
import { PromoField } from "@/components/cart/promo-field";
import { apiFetch, saveOrderToken, uploadOrderFile } from "@/lib/client/api";
import { formatMoney } from "@/lib/format/money";
import { isValidRuPhone, phoneMask } from "@/lib/format/phone";
import { SERVICE_CATEGORY_LABELS } from "@/lib/config/constants";
import type { ServiceCategory } from "@/types/database.types";
import { cn } from "@/lib/utils";

type Step = "catalog" | "cart" | "docs" | "pay" | "done";
const UNIT: Record<string, string> = { page: "за стр.", document: "за док.", item: "за шт." };

interface CreatedOrder {
  orderId: string;
  publicNumber: string;
  accessToken: string;
}

/** Заказ в Mini App: каталог → корзина → документы → оплата → готово. */
export function MiniAppOrderFlow() {
  const { webApp, user, auth, haptic } = useTelegram();
  const { data, isLoading } = useCatalog();
  const cart = useCart();
  const [step, setStep] = React.useState<Step>("catalog");
  const [category, setCategory] = React.useState<ServiceCategory>("translation");
  const [files, setFiles] = React.useState<File[]>([]);
  const [phone, setPhone] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [order, setOrder] = React.useState<CreatedOrder | null>(null);
  const photoRef = React.useRef<HTMLInputElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const settings = toPricingSettings(data?.settings);
  const pricing = usePricing({ deliveryType: "pickup" });
  const count = cart.itemsCount;
  const hasTranslation = cart.items.some((i) => i.category === "translation");
  const placementReady = Boolean(cart.options.officeId) && (!hasTranslation || Boolean(cart.options.languageFrom));
  const services = (data?.services ?? []).filter((s) => s.category === category);
  const back: Partial<Record<Step, Step>> = { cart: "catalog", docs: "cart" };

  const sharePhone = () => {
    if (!webApp?.requestContact) return toast.info("Введите номер вручную");
    webApp.requestContact((shared, res) => {
      const p = res?.responseUnsafe?.contact?.phone_number;
      if (shared && p) setPhone(phoneMask(p));
    });
  };

  const createOrder = async () => {
    if (!isValidRuPhone(phone)) return toast.error("Укажите телефон для уведомлений");
    if (!consent) return toast.error("Нужно согласие на обработку персональных данных");
    setBusy(true);
    try {
      const created = await apiFetch<CreatedOrder>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          name: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Клиент Telegram",
          phone,
          telegram: user?.username ? `@${user.username}` : null,
          type: "individual",
          items: cart.items.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity })),
          urgency: cart.options.urgency,
          deliveryType: "pickup",
          promoCode: cart.options.promoCode,
          officeId: cart.options.officeId,
          languageFrom: hasTranslation ? cart.options.languageFrom : null,
          notaryRequested: cart.options.notaryRequested,
          consent: true,
          source: "mini_app",
        }),
      });
      saveOrderToken(created.orderId, created.accessToken, created.publicNumber);
      for (const f of files) {
        await uploadOrderFile(created.orderId, f, { token: created.accessToken }).catch((e: Error) =>
          toast.warning(`«${f.name}»: ${e.message}`),
        );
      }
      cart.clear();
      setOrder(created);
      setStep("pay");
      haptic("success");
    } catch (err) {
      toast.error((err as Error).message);
      haptic("error");
    } finally {
      setBusy(false);
    }
  };

  const addFiles = (list: FileList | null) => {
    if (list) setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 20));
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        {back[step] && <TgBackButton onClick={() => setStep(back[step]!)} />}

        {step === "catalog" && (
          <>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {(["translation", "printing", "insurance"] as ServiceCategory[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "min-h-9 whitespace-nowrap rounded-full border px-3.5 text-sm font-bold",
                    category === c ? "border-brand-800 bg-brand-800 text-white" : "border-slate-300 bg-white text-brand-800",
                  )}
                >
                  {SERVICE_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            {services.map((s) => {
              const qty = cart.items.find((i) => i.key === s.slug)?.quantity ?? 0;
              return (
                <div key={s.id} className="flex items-center gap-2.5 rounded-2xl bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold leading-snug">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatMoney(Number(s.price))} {UNIT[s.unit]}
                    </div>
                  </div>
                  {qty > 0 && (
                    <>
                      <button
                        type="button"
                        aria-label="Уменьшить"
                        onClick={() => cart.setQuantity(s.slug, qty - 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-brand-800"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-5 text-center font-extrabold">{qty}</span>
                    </>
                  )}
                  <button
                    type="button"
                    aria-label="Добавить"
                    onClick={() => {
                      if (qty === 0) cart.addItem(s);
                      else cart.setQuantity(s.slug, qty + 1);
                      webApp?.HapticFeedback?.impactOccurred("light");
                    }}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border",
                      qty > 0 ? "border-brand-800 bg-brand-800 text-white" : "border-slate-300 bg-white text-brand-800",
                    )}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </>
        )}

        {step === "cart" && (
          <>
            <section className="space-y-2 rounded-2xl bg-white p-3.5">
              <strong className="text-brand-800">Корзина</strong>
              {cart.items.map((i) => (
                <div key={i.key} className="flex justify-between gap-2.5 text-sm">
                  <span>
                    {i.name} × {i.quantity}
                  </span>
                  <strong className="whitespace-nowrap">{formatMoney(i.unitPrice * i.quantity)}</strong>
                </div>
              ))}
            </section>
            {hasTranslation && (
              <section className="rounded-2xl bg-white p-3.5">
                <LanguagePairPicker />
              </section>
            )}
            <section className="rounded-2xl bg-white p-3.5">
              <OfficePicker compact />
            </section>
            <section className="space-y-3 rounded-2xl bg-white p-3.5">
              <UrgencySwitch settings={settings} />
              <NotaryCheckbox settings={settings} />
            </section>
            <section className="space-y-3 rounded-2xl bg-white p-3.5">
              <PromoField deliveryType="pickup" />
              <PriceLines pricing={pricing} />
            </section>
          </>
        )}

        {step === "docs" && (
          <>
            <section className="space-y-2.5 rounded-2xl bg-white p-3.5">
              <strong className="text-brand-800">Фото или скан документа</strong>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-400 bg-slate-50 text-sm font-bold text-brand-800"
                >
                  <Camera className="h-6 w-6 text-brand-500" /> Камера
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-400 bg-slate-50 text-sm font-bold text-brand-800"
                >
                  <FileText className="h-6 w-6 text-brand-500" /> Файл
                </button>
              </div>
              <input ref={photoRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => addFiles(e.target.files)} />
              <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.zip" className="sr-only" onChange={(e) => addFiles(e.target.files)} />
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl border px-2.5 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
                  <button type="button" className="text-xs text-destructive" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    удалить
                  </button>
                </div>
              ))}
            </section>
            <section className="space-y-2.5 rounded-2xl bg-white p-3.5">
              <Label htmlFor="tg-phone">Телефон для уведомлений</Label>
              <Input
                id="tg-phone"
                type="tel"
                inputMode="tel"
                className="h-11"
                value={phone}
                onChange={(e) => setPhone(phoneMask(e.target.value))}
                placeholder="+7 (___) ___-__-__"
              />
              {webApp?.requestContact && (
                <button type="button" onClick={sharePhone} className="min-h-10 w-full rounded-xl bg-[#EAF1FB] text-sm font-bold text-brand-500">
                  Поделиться номером из Telegram
                </button>
              )}
              <label className="flex items-start gap-2.5 text-sm leading-snug text-slate-700">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5 h-5 w-5" />
                <span>
                  Согласен на{" "}
                  <Link href="/legal/consent" className="text-brand-500 underline" target="_blank">
                    обработку персональных данных
                  </Link>{" "}
                  (152-ФЗ)
                </span>
              </label>
            </section>
          </>
        )}

        {step === "pay" && order && (
          <section className="rounded-2xl bg-white p-3.5">
            <PaymentPanel
              compact
              orderId={order.orderId}
              publicNumber={order.publicNumber}
              token={order.accessToken}
              onPaid={() => {
                haptic("success");
                setStep("done");
              }}
            />
          </section>
        )}

        {step === "done" && order && (
          <section className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-700" />
            <strong className="text-xl text-brand-800">Заказ {order.publicNumber} оплачен</strong>
            <p className="text-sm text-slate-700">Мы пришлём сообщение в этот чат, когда перевод будет готов.</p>
            <Link href="/tg/orders" className="min-h-11 rounded-xl bg-brand-800 px-5 py-3 text-sm font-bold text-white">
              Мои заказы
            </Link>
          </section>
        )}
      </div>

      {step === "catalog" && (
        <TgMainButton
          text={count ? `Корзина · ${count} · ${formatMoney(pricing.total)}` : "Выберите услугу"}
          disabled={count === 0}
          onClick={() => setStep("cart")}
        />
      )}
      {step === "cart" && (
        <TgMainButton
          text={placementReady ? "Далее: документы" : hasTranslation ? "Выберите язык и точку" : "Выберите точку приёма"}
          disabled={count === 0 || !placementReady}
          onClick={() => setStep("docs")}
        />
      )}
      {step === "docs" && (
        <TgMainButton
          text={`Оформить и оплатить ${formatMoney(pricing.total)}`}
          disabled={!consent || !isValidRuPhone(phone) || auth === "pending"}
          loading={busy}
          onClick={createOrder}
        />
      )}
    </div>
  );
}
