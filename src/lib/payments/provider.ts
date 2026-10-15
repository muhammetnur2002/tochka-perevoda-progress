import type { Json, PaymentStatus } from "@/types/database.types";

export type PaymentMethodKind = "card" | "sbp" | "qr";

/** Данные чека 54-ФЗ (передаются в ЮKassa, если включена фискализация). */
export interface ReceiptData {
  customer: { phone?: string; email?: string };
  items: { description: string; quantity: number; amount: number }[];
}

export interface CreatePaymentParams {
  amount: number; // рубли
  currency: string;
  method: PaymentMethodKind;
  idempotenceKey: string;
  returnUrl: string;
  description: string;
  metadata: Record<string, string>;
  receipt?: ReceiptData;
}

export interface CreatePaymentResult {
  providerPaymentId: string;
  status: PaymentStatus;
  confirmationUrl: string | null;
  /** Содержимое QR-кода для СБП (ссылка для кодирования в QR). */
  confirmationData: string | null;
  raw: Json;
}

export interface ProviderPaymentStatus {
  status: PaymentStatus;
  paid: boolean;
  amount: number | null;
  raw: Json;
}

/** Единый интерфейс платёжного провайдера (ЮKassa / mock). */
export interface PaymentProvider {
  readonly name: "yookassa" | "mock";
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  getPayment(providerPaymentId: string): Promise<ProviderPaymentStatus>;
}
