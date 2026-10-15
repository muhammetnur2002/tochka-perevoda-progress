import "server-only";
import type { Json, PaymentStatus } from "@/types/database.types";
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProvider,
  ProviderPaymentStatus,
} from "./provider";

const API_BASE = "https://api.yookassa.ru/v3";

interface YookassaAmount {
  value: string;
  currency: string;
}

interface YookassaPaymentResponse {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount?: YookassaAmount;
  confirmation?: {
    type: string;
    confirmation_url?: string;
    confirmation_data?: string;
  };
}

const STATUS_MAP: Record<string, PaymentStatus> = {
  pending: "pending",
  waiting_for_capture: "waiting_for_capture",
  succeeded: "succeeded",
  canceled: "canceled",
};

/**
 * Провайдер ЮKassa. Документация: https://yookassa.ru/developers/api
 * Для карт — confirmation redirect, для СБП — confirmation qr.
 */
export class YookassaProvider implements PaymentProvider {
  readonly name = "yookassa" as const;

  private get credentials(): { shopId: string; secretKey: string } {
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secretKey) {
      throw new Error(
        "Не заданы YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY. Укажите их в .env.local или " +
          "переключите PAYMENT_PROVIDER=mock для локальной разработки.",
      );
    }
    return { shopId, secretKey };
  }

  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const { shopId, secretKey } = this.credentials;
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`,
        ...(options.headers ?? {}),
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`ЮKassa ошибка ${res.status}: ${body}`);
    }
    return (await res.json()) as T;
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const isSbp = params.method === "sbp" || params.method === "qr";

    const body: Record<string, unknown> = {
      amount: {
        value: params.amount.toFixed(2),
        currency: params.currency,
      },
      capture: true,
      description: params.description.slice(0, 128),
      payment_method_data: isSbp ? { type: "sbp" } : { type: "bank_card" },
      confirmation: isSbp
        ? { type: "qr", return_url: params.returnUrl }
        : { type: "redirect", return_url: params.returnUrl },
      metadata: params.metadata,
    };

    // Чек 54-ФЗ: включается YOOKASSA_SEND_RECEIPT=true (нужна настройка онлайн-кассы в ЮKassa)
    if (params.receipt && process.env.YOOKASSA_SEND_RECEIPT === "true") {
      body.receipt = {
        customer: params.receipt.customer,
        items: params.receipt.items.map((item) => ({
          description: item.description.slice(0, 128),
          quantity: item.quantity.toFixed(2),
          amount: { value: item.amount.toFixed(2), currency: params.currency },
          vat_code: Number(process.env.YOOKASSA_VAT_CODE ?? 1),
          payment_subject: "service",
          payment_mode: "full_payment",
        })),
      };
    }

    const res = await this.request<YookassaPaymentResponse>("/payments", {
      method: "POST",
      headers: { "Idempotence-Key": params.idempotenceKey },
      body: JSON.stringify(body),
    });

    return {
      providerPaymentId: res.id,
      status: STATUS_MAP[res.status] ?? "pending",
      confirmationUrl: res.confirmation?.confirmation_url ?? null,
      confirmationData: res.confirmation?.confirmation_data ?? null,
      raw: res as unknown as Json,
    };
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    const res = await this.request<YookassaPaymentResponse>(`/payments/${providerPaymentId}`, {
      method: "GET",
    });
    return {
      status: STATUS_MAP[res.status] ?? "pending",
      paid: res.status === "succeeded",
      amount: res.amount ? Number(res.amount.value) : null,
      raw: res as unknown as Json,
    };
  }
}
