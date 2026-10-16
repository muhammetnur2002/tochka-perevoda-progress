import "server-only";
import { randomUUID } from "node:crypto";
import type { Json } from "@/types/database.types";
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  CreateRefundParams,
  PaymentProvider,
  ProviderPaymentStatus,
  ProviderRefund,
} from "./provider";

/**
 * Mock-провайдер для запуска без ключей ЮKassa. Платёж создаётся в статусе
 * pending; подтвердить его можно кнопкой «Я оплатил(а)» на странице оплаты
 * (POST /api/payments/[id]/mock-confirm, работает только с mock-провайдером)
 * или менеджером в админке («Отметить оплату»).
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const id = `mock-${randomUUID()}`;
    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    return {
      providerPaymentId: id,
      status: "pending",
      confirmationUrl: params.method === "card" ? params.returnUrl : null,
      confirmationData: params.method === "card" ? null : `${site}/checkout/mock-sbp?payment=${id}`,
      raw: { mock: true, amount: params.amount, method: params.method } as Json,
    };
  }

  /** Тестовый возврат проходит сразу. */
  async createRefund(params: CreateRefundParams): Promise<ProviderRefund> {
    return {
      providerRefundId: `mock-refund-${randomUUID()}`,
      status: "succeeded",
      amount: params.amount,
      raw: { mock: true, payment: params.providerPaymentId } as Json,
    };
  }

  async getRefund(providerRefundId: string): Promise<ProviderRefund> {
    return { providerRefundId, status: "succeeded", amount: null, raw: { mock: true } as Json };
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    return { status: "pending", paid: false, amount: null, raw: { mock: true, providerPaymentId } as Json };
  }
}
