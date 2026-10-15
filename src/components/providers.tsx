"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { CartProvider } from "@/components/cart/cart-provider";

/**
 * Глобальные провайдеры клиента:
 * — React Query (кэширование + Realtime-инвалидация);
 * — CartProvider (корзина, localStorage);
 * — Toaster (тост-уведомления).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ duration: 4500 }}
        />
      </CartProvider>
    </QueryClientProvider>
  );
}
