"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Выгрузка в Excel/CSV (браузер скачивает файл по ссылке с cookie сессии). */
export function ExportButton({ type, from, to }: { type: "orders" | "payments" | "clients"; from?: string; to?: string }) {
  const qs = (format: string) => {
    const p = new URLSearchParams({ type, format });
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return `/api/admin/export?${p.toString()}`;
  };
  return (
    <>
      <Button asChild variant="outline">
        <a href={qs("xlsx")} download>
          <Download /> Excel
        </a>
      </Button>
      <Button asChild variant="outline">
        <a href={qs("csv")} download>
          CSV
        </a>
      </Button>
    </>
  );
}
