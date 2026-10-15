"use client";

import * as React from "react";
import { Camera, FileText, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";

interface FileDropzoneProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number;
}

const ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,.zip";
const EXTENSIONS = ACCEPT.split(",");

/**
 * Загрузчик: перетаскивание (HTML5 DnD), выбор файлов и съёмка камерой
 * (capture="environment" — на телефоне сразу открывается основная камера).
 */
export function FileDropzone({ files, onChange, maxFiles = 20, maxSize = 50 * 1024 * 1024 }: FileDropzoneProps) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const addFiles = (incoming: FileList | File[]) => {
    setError(null);
    const accepted: File[] = [];
    for (const f of Array.from(incoming)) {
      const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
      if (!EXTENSIONS.includes(ext) && !f.type.startsWith("image/")) {
        setError(`Формат файла «${f.name}» не поддерживается`);
        continue;
      }
      if (f.size > maxSize) {
        setError(`Файл «${f.name}» больше ${formatBytes(maxSize)}`);
        continue;
      }
      if (files.some((x) => x.name === f.name && x.size === f.size)) continue;
      accepted.push(f);
    }
    const merged = [...files, ...accepted];
    if (merged.length > maxFiles) setError(`Не больше ${maxFiles} файлов в заказе`);
    onChange(merged.slice(0, maxFiles));
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-7 text-center transition-colors",
          dragOver ? "border-gold-400 bg-gold-50" : "border-slate-300 bg-slate-50",
        )}
      >
        <UploadCloud className="h-9 w-9 text-brand-500" aria-hidden />
        <p className="font-bold text-brand-800">Перетащите файлы сюда</p>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, HEIC, PDF, DOC/DOCX, ZIP · до {formatBytes(maxSize)}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={() => fileRef.current?.click()}>
            <FileText /> Выбрать файлы
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => cameraRef.current?.click()}>
            <Camera /> Сфотографировать
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, idx) => (
            <li key={`${f.name}-${idx}`} className="flex items-center gap-3 rounded-xl border px-3 py-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-extrabold uppercase text-brand-500">
                {f.name.split(".").pop()?.slice(0, 4)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{f.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange(files.filter((_, i) => i !== idx))}
                aria-label={`Удалить ${f.name}`}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
