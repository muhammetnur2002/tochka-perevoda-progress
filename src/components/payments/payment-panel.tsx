"use client";

import * as React from "react";
import { CreditCard, Loader2, QrCode, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client/api";
import { formatMoney } from "@/lib/format/money";
import { cn } from "@/lib/utils";

export type PayMethod = "sbp" | "qr" | "card";

interface PaymentResponse {
  paymentId: string;
  status: string;
  amount: number;
  confirmationUrl: string | null;
  qrSvg: string | null;
  qrPayload: string | null;
  provider: "yookassa" | "mock";
  mock: boolean;
}

interface PaymentStatusResponse {
  payment: { status: string };
}

const METHODS: { id: PayMethod; label: string; hint: string; icon: typeof QrCode }[] = [
  { id: "sbp", label: "СБП", hint: "через приложение банка", icon: Smartphone },
  { id: "qr", label: "QR-код", hint: "сканируйте камерой", icon: QrCode },
  { id: "card", label: "Банковская карта", hint: "Мир, Visa, Mastercard", icon: CreditCard },
];

interface PaymentPanelProps {
  orderId: string;
  publicNumber: string;
  token?: string | null;
  initialMethod?: PayMethod;
  /** Вызывается после подтверждённой оплаты. */
  onPaid: () => void;
  compact?: boolean;
}

/**
 * Оплата заказа: выбор способа, QR для СБП (SVG генерирует сервер), переход на
 * страницу ЮKassa для карты, поллинг статуса каждые 3 с. В mock-режиме —
 * кнопка «Я оплатил(а)» имитирует успешную оплату.
 */
export function PaymentPanel({ orderId, publicNumber, token, initialMethod = "sbp", onPaid, compact }: PaymentPanelProps) {
  const [method, setMethod] = React.useState<PayMethod>(initialMethod);
  const [payment, setPayment] = React.useState<PaymentResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  const create = React.useCallback(
    async (m: PayMethod) => {
      setLoading(true);
      try {
        const data = await apiFetch<PaymentResponse>("/api/payments", {
          method: "POST",
          body: JSON.stringify({ orderId, method: m }),
          orderToken: token,
        });
        setPayment(data);
        if (m === "card" && data.confirmationUrl && data.provider === "yookassa") {
          window.location.href = data.confirmationUrl;
        }
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [orderId, token],
  );

  // Платёж создаётся один раз на способ оплаты (защита от двойного эффекта StrictMode)
  const createdFor = React.useRef<PayMethod | null>(null);
  React.useEffect(() => {
    if (createdFor.current === method) return;
    createdFor.current = method;
    void create(method);
  }, [method, create]);

  // Поллинг статуса
  React.useEffect(() => {
    if (!payment) return;
    const timer = setInterval(async () => {
      try {
        const data = await apiFetch<PaymentStatusResponse>(`/api/payments/${payment.paymentId}`, { orderToken: token });
        if (data.payment.status === "succeeded") {
          clearInterval(timer);
          onPaid();
        }
      } catch {
        /* сеть — попробуем снова */
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [payment, token, onPaid]);

  const confirmMock = async () => {
    if (!payment) return;
    setConfirming(true);
    try {
      await apiFetch(`/api/payments/${payment.paymentId}/mock-confirm`, { method: "POST", orderToken: token });
      onPaid();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className={cn("grid gap-2", compact ? "grid-cols-3" : "sm:grid-cols-3")}>
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethod(m.id)}
            aria-pressed={method === m.id}
            className={cn(
              "flex min-h-16 flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
              method === m.id ? "border-2 border-gold-400 bg-gold-50" : "border-input bg-background hover:border-brand-800",
            )}
          >
            <span className="flex items-center gap-2 font-semibold text-brand-800">
              <m.icon className="h-4 w-4" /> {m.label}
            </span>
            {!compact && <span className="text-xs text-muted-foreground">{m.hint}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-5 rounded-2xl border bg-card p-6 sm:flex-row">
        {loading || !payment ? (
          <div className="flex h-48 w-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          </div>
        ) : (
          <>
            {payment.qrSvg && method !== "card" && (
              <div
                role="img"
                aria-label="QR-код для оплаты по СБП"
                className="h-48 w-48 shrink-0 rounded-xl border bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: payment.qrSvg }}
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <span className="text-sm text-muted-foreground">Заказ {publicNumber}</span>
              <span className="text-3xl font-extrabold text-brand-800">{formatMoney(payment.amount)}</span>
              <p className="text-sm text-muted-foreground">
                {method === "card"
                  ? "Откроется защищённая страница ЮKassa. После оплаты вы вернётесь на сайт."
                  : "Отсканируйте QR камерой или откройте приложение банка — сумма подставится автоматически. Статус обновится сам."}
              </p>
              <div className="flex flex-wrap gap-2">
                {method !== "card" && payment.qrPayload && payment.provider === "yookassa" && (
                  <Button asChild variant="gold" size="lg">
                    <a href={payment.qrPayload}>Открыть приложение банка</a>
                  </Button>
                )}
                {method === "card" && payment.confirmationUrl && payment.provider === "yookassa" && (
                  <Button asChild variant="gold" size="lg">
                    <a href={payment.confirmationUrl}>Перейти к оплате</a>
                  </Button>
                )}
                {payment.mock && (
                  <Button variant="gold" size="lg" onClick={confirmMock} disabled={confirming}>
                    {confirming ? <Loader2 className="animate-spin" /> : "Я оплатил(а)"}
                  </Button>
                )}
              </div>
              {payment.mock && (
                <span className="text-xs font-semibold text-gold-800">
                  Тестовый режим: оплата имитируется mock-провайдером (ключи ЮKassa не заданы)
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
