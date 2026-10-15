"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, FileText, Loader2, Plus, Send, Trash2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientApiError } from "@/lib/client/api";
import { PdfPagesError, pdfToPageBlobs } from "@/lib/client/pdf-pages";
import { PROOF_MAX_KEY_FIELDS, PROOF_MAX_PAGES, PROOF_MAX_PAGE_BYTES } from "@/lib/proof/constants";
import { cn } from "@/lib/utils";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPT = ["application/pdf", ...IMAGE_TYPES].join(",");
/** Подписи-подсказки для быстрого добавления: их видит клиент, поэтому всегда по-русски. */
const PRESET_KEYS = ["fullName", "birthDate", "docNumber", "issueDate", "birthPlace"] as const;

interface PageItem {
  id: number;
  blob: Blob;
  url: string;
  label: string;
}

interface FieldDraft {
  id: number;
  label: string;
  value: string;
}

export interface ProofUploadDialogProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Номер новой версии — для заголовка. */
  nextVersion: number;
  /** Ключевые данные прошлой версии подставляются как заготовка. */
  initialFields: { label: string; value: string }[];
  onSent: (version: number) => void;
}

function postProof(form: FormData, onProgress: (percent: number) => void): Promise<{ id: string; version: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/proofs");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new ClientApiError("", 0));
    xhr.onload = () => {
      const data = xhr.response as { id?: string; version?: number; error?: { message?: string; code?: string } } | null;
      if (xhr.status >= 200 && xhr.status < 300 && data?.id && typeof data.version === "number") {
        resolve({ id: data.id, version: data.version });
      } else {
        reject(new ClientApiError(data?.error?.message ?? "", xhr.status, data?.error?.code));
      }
    };
    xhr.send(form);
  });
}

function UploadForm({
  orderId,
  initialFields,
  onClose,
  onSent,
}: Pick<ProofUploadDialogProps, "orderId" | "initialFields" | "onSent"> & { onClose: () => void }) {
  const t = useTranslations("admin.proof");
  const tCommon = useTranslations("common");
  const [pages, setPages] = React.useState<PageItem[]>([]);
  const [fields, setFields] = React.useState<FieldDraft[]>(() =>
    initialFields.map((f, i) => ({ id: i + 1, label: f.label, value: f.value })),
  );
  const [note, setNote] = React.useState("");
  const [convert, setConvert] = React.useState<{ name: string; done: number; total: number } | null>(null);
  const [sending, setSending] = React.useState(false);
  const [percent, setPercent] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const nextId = React.useRef(1000);
  const urlsRef = React.useRef<Set<string>>(new Set());

  // Освобождаем превью при закрытии окна
  React.useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  const makeItem = (blob: Blob, label: string): PageItem => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.add(url);
    return { id: nextId.current++, blob, url, label };
  };

  const revoke = (url: string) => {
    URL.revokeObjectURL(url);
    urlsRef.current.delete(url);
  };

  const busy = convert !== null || sending;
  const mb = Math.round(PROOF_MAX_PAGE_BYTES / 1024 / 1024);

  const addFiles = async (list: FileList | File[]) => {
    const files = Array.from(list);
    if (files.length === 0 || busy) return;
    setError(null);
    let count = pages.length;
    for (const file of files) {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isImage = IMAGE_TYPES.includes(file.type);
      if (!isPdf && !isImage) {
        setError(t("errors.badType", { name: file.name }));
        continue;
      }
      if (count >= PROOF_MAX_PAGES) {
        setError(t("errors.tooManyPages", { max: PROOF_MAX_PAGES }));
        break;
      }
      if (isImage) {
        if (file.size > PROOF_MAX_PAGE_BYTES) {
          setError(t("errors.tooBig", { name: file.name, mb }));
          continue;
        }
        const item = makeItem(file, file.name);
        setPages((prev) => [...prev, item]);
        count += 1;
        continue;
      }
      try {
        setConvert({ name: file.name, done: 0, total: 0 });
        const blobs = await pdfToPageBlobs(file, {
          maxPages: PROOF_MAX_PAGES - count,
          onProgress: (done, total) => setConvert({ name: file.name, done, total }),
        });
        const items = blobs.map((b, i) => makeItem(b, blobs.length > 1 ? `${file.name} · ${i + 1}` : file.name));
        setPages((prev) => [...prev, ...items]);
        count += items.length;
      } catch (err) {
        if (err instanceof PdfPagesError && err.code === "TOO_MANY_PAGES") {
          setError(t("errors.pdfTooManyPages", { name: file.name, pages: err.pages ?? 0, max: PROOF_MAX_PAGES - count }));
        } else {
          setError(t("errors.pdfFailed", { name: file.name }));
        }
      } finally {
        setConvert(null);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const move = (index: number, dir: -1 | 1) =>
    setPages((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j]!, next[index]!];
      return next;
    });

  const removePage = (id: number) =>
    setPages((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) revoke(item.url);
      return prev.filter((p) => p.id !== id);
    });

  const clearPages = () => {
    pages.forEach((p) => revoke(p.url));
    setPages([]);
  };

  const patchField = (id: number, patch: Partial<FieldDraft>) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const addField = (label = "") =>
    setFields((prev) => {
      if (prev.length >= PROOF_MAX_KEY_FIELDS) return prev;
      if (label) {
        const empty = prev.find((f) => !f.label.trim() && !f.value.trim());
        if (empty) return prev.map((f) => (f.id === empty.id ? { ...f, label } : f));
      }
      return [...prev, { id: nextId.current++, label, value: "" }];
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (pages.length === 0) {
      setError(t("errors.noPages"));
      return;
    }
    const filled = fields.filter((f) => f.label.trim() || f.value.trim());
    if (filled.some((f) => !f.label.trim() || !f.value.trim())) {
      setError(t("errors.fieldIncomplete"));
      return;
    }
    setError(null);
    setSending(true);
    setPercent(0);
    try {
      const form = new FormData();
      form.append("orderId", orderId);
      if (note.trim()) form.append("note", note.trim());
      form.append("keyFields", JSON.stringify(filled.map((f) => ({ label: f.label.trim(), value: f.value.trim() }))));
      pages.forEach((p, i) => {
        const ext = p.blob.type === "image/png" ? "png" : p.blob.type === "image/webp" ? "webp" : "jpg";
        form.append("pages", p.blob, `page-${String(i + 1).padStart(2, "0")}.${ext}`);
      });
      const res = await postProof(form, setPercent);
      onSent(res.version);
    } catch (err) {
      const e2 = err as ClientApiError;
      const message = e2.message || (e2.status === 0 ? t("errors.network") : e2.status === 429 ? t("errors.rateLimit") : t("errors.upload"));
      setError(message);
      toast.error(message);
      setSending(false);
    }
  };

  const presetUsed = (label: string) => fields.some((f) => f.label.trim().toLowerCase() === label.toLowerCase());

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <div className="space-y-2">
        <Label>{t("pagesTitle", { n: pages.length, max: PROOF_MAX_PAGES })}</Label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-5 text-center text-sm",
            dragOver ? "border-gold-400 bg-gold-50" : "border-slate-300 bg-slate-50",
          )}
        >
          <UploadCloud className="h-7 w-7 text-brand-500" aria-hidden />
          <p className="font-semibold text-brand-800">{t("dropTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("dropHint", { max: PROOF_MAX_PAGES, mb })}</p>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            aria-label={t("chooseFiles")}
            onChange={(e) => e.target.files && void addFiles(e.target.files)}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy || pages.length >= PROOF_MAX_PAGES} onClick={() => fileRef.current?.click()}>
            <FileText aria-hidden /> {t("chooseFiles")}
          </Button>
        </div>

        {convert && (
          <div role="status" className="space-y-1 rounded-lg bg-brand-50 p-2.5 text-xs text-brand-800">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              <span className="truncate">
                {convert.total > 0 ? t("converting", { name: convert.name, done: convert.done, total: convert.total }) : t("reading", { name: convert.name })}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white">
              <div
                className="h-full bg-brand-500 transition-all"
                style={{ width: `${convert.total > 0 ? Math.round((convert.done / convert.total) * 100) : 5}%` }}
              />
            </div>
          </div>
        )}

        {pages.length > 0 && (
          <>
            <ol className="grid gap-2 sm:grid-cols-2">
              {pages.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg border bg-white p-1.5">
                  <span className="w-5 shrink-0 text-center text-xs font-extrabold text-brand-800">{i + 1}</span>
                  <img src={p.url} alt="" className="h-14 w-10 shrink-0 rounded border bg-slate-100 object-cover object-top" />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={p.label}>
                    {p.label}
                  </span>
                  <span className="flex shrink-0">
                    <button
                      type="button"
                      disabled={busy || i === 0}
                      onClick={() => move(i, -1)}
                      aria-label={t("moveUp", { n: i + 1 })}
                      className="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={busy || i === pages.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label={t("moveDown", { n: i + 1 })}
                      className="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removePage(p.id)}
                      aria-label={t("removePage", { n: i + 1 })}
                      className="flex h-8 w-8 items-center justify-center rounded text-red-700 hover:bg-red-50 disabled:opacity-30"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
            <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:text-red-800" disabled={busy} onClick={clearPages}>
              <Trash2 aria-hidden /> {t("clearPages")}
            </Button>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t("keyFieldsTitle")}</Label>
        <p className="text-xs text-muted-foreground">{t("keyFieldsHint")}</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_KEYS.map((k) => {
            const label = t(`presets.${k}`);
            return (
              <button
                key={k}
                type="button"
                disabled={busy || fields.length >= PROOF_MAX_KEY_FIELDS || presetUsed(label)}
                onClick={() => addField(label)}
                className="inline-flex min-h-8 items-center gap-1 rounded-full border border-input bg-white px-3 text-xs font-bold text-brand-800 disabled:opacity-40"
              >
                <Plus className="h-3 w-3" aria-hidden /> {label}
              </button>
            );
          })}
        </div>
        {fields.map((f, i) => (
          <div key={f.id} className="flex items-center gap-2">
            <Input
              value={f.label}
              maxLength={80}
              disabled={busy}
              aria-label={`${t("fieldLabel")} ${i + 1}`}
              placeholder={t("fieldLabel")}
              className="w-2/5"
              onChange={(e) => patchField(f.id, { label: e.target.value })}
            />
            <Input
              value={f.value}
              maxLength={300}
              disabled={busy}
              aria-label={`${t("fieldValue")} ${i + 1}`}
              placeholder={t("fieldValue")}
              className="flex-1"
              onChange={(e) => patchField(f.id, { value: e.target.value })}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => setFields((prev) => prev.filter((x) => x.id !== f.id))}
              aria-label={t("removeField", { n: i + 1 })}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-red-700 hover:bg-red-50 disabled:opacity-30"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={busy || fields.length >= PROOF_MAX_KEY_FIELDS} onClick={() => addField()}>
          <Plus aria-hidden /> {t("addField")}
        </Button>
      </div>

      <div className="space-y-1">
        <Label htmlFor="proof-note">{t("noteLabel")}</Label>
        <Textarea
          id="proof-note"
          rows={2}
          maxLength={1000}
          value={note}
          disabled={busy}
          placeholder={t("notePlaceholder")}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {sending && (
        <div role="status" className="space-y-1 rounded-lg bg-brand-50 p-2.5 text-xs text-brand-800">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {percent >= 100 ? t("processing") : t("uploading", { percent })}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={sending} onClick={onClose}>
          {tCommon("cancel")}
        </Button>
        <Button type="submit" disabled={busy || pages.length === 0}>
          {sending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />} {t("submit")}
        </Button>
      </div>
    </form>
  );
}

/** Окно загрузки версии перевода на проверку клиенту: PDF/картинки → страницы, ключевые данные, сообщение. */
export function ProofUploadDialog({ orderId, open, onOpenChange, nextVersion, initialFields, onSent }: ProofUploadDialogProps) {
  const t = useTranslations("admin.proof");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] max-w-2xl overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{nextVersion > 1 ? t("dialogTitleNew", { n: nextVersion }) : t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        {open && <UploadForm orderId={orderId} initialFields={initialFields} onSent={onSent} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
