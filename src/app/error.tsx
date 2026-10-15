"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");
  return (
    <div className="container flex flex-col items-center justify-center py-24 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
      <h1 className="mb-2 text-xl font-bold text-brand-900">{t("error")}</h1>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        {error.message || t("errorText")}
      </p>
      <Button onClick={reset}>{t("retry")}</Button>
    </div>
  );
}
