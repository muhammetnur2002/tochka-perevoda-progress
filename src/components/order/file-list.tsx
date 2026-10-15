"use client";

import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openFile } from "@/lib/client/api";
import { formatBytes } from "@/lib/utils";

const KIND: Record<string, string> = {
  source: "исходник",
  translation: "перевод",
  receipt: "чек",
  photo: "фото",
  other: "файл",
};

interface FileItem {
  id: string;
  original_name: string;
  kind: string;
  size_bytes: number;
}

/** Список файлов заказа с выдачей подписанной ссылки (5 минут) по клику. */
export function FileList({ files, token }: { files: FileItem[]; token?: string | null }) {
  if (files.length === 0) return <p className="text-sm text-muted-foreground">Файлов нет.</p>;
  return (
    <ul className="space-y-2">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{f.original_name}</span>
            <span className="text-xs text-muted-foreground">
              {KIND[f.kind] ?? f.kind} · {formatBytes(Number(f.size_bytes))}
            </span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openFile(f.id, token).catch((e: Error) => toast.error(e.message))}
            aria-label={`Скачать ${f.original_name}`}
          >
            <Download /> Скачать
          </Button>
        </li>
      ))}
    </ul>
  );
}
