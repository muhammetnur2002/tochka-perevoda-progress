"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container flex flex-col items-center justify-center py-24 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
      <h1 className="mb-2 text-xl font-bold text-brand-900">Что-то пошло не так</h1>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        {error.message || "Произошла ошибка. Попробуйте ещё раз."}
      </p>
      <Button onClick={reset}>Повторить</Button>
    </div>
  );
}
