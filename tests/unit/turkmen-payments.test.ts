import { describe, expect, it, vi } from "vitest";
import { YookassaProvider } from "@/lib/payments/yookassa";

describe("платежи в манатах", () => {
  it("не отправляет TMT в российский платёжный шлюз", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const provider = new YookassaProvider();
      await expect(
        provider.createPayment({
          amount: 100,
          currency: "TMT",
          method: "card",
          idempotenceKey: "test",
          returnUrl: "http://localhost:3000",
          description: "Sargyt",
          metadata: {},
        }),
      ).rejects.toThrow("TMT");
      await expect(
        provider.createRefund({
          providerPaymentId: "test",
          amount: 100,
          currency: "TMT",
          idempotenceKey: "test",
          description: "test",
        }),
      ).rejects.toThrow("TMT");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
