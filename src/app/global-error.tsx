"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-2xl font-bold text-brand-900">Критическая ошибка</h1>
          <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
          <Button onClick={reset}>Перезагрузить</Button>
        </div>
      </body>
    </html>
  );
}
