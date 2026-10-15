"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, CheckCircle2, Eye, Loader2, MapPin, MessageSquarePlus, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client/api";
import { formatDateTime } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import type { ProofViewModel } from "@/lib/services/proof-service";

type FieldAnswer = { state: "ok" | "fix" | null; value: string; body: string };
type Pin = { page: number; x: number; y: number; body: string };

/** При печати вместо страниц — короткая надпись (текст без кавычек и разметки, чтобы не сломать CSS). */
function printCss(message: string): string {
  const safe = message.replace(/[\\"<>\r\n]/g, " ");
  return `@media print { .proof-guard { display: none !important; } body::after { content: "${safe}"; display: block; padding: 2rem; font: 16px sans-serif; } }`;
}

interface ProofViewerProps {
  model: ProofViewModel;
  /** Токен гостя из ссылки (для вошедшего клиента не нужен). */
  token: string | null;
  /** Решение принимает клиент; сотруднику показывается только просмотр. */
  canDecide: boolean;
}

/**
 * Защита страниц — сдерживание, а не гарантия: браузер не позволяет запретить
 * скриншот. Что делаем: страницы приходят уже с водяным знаком (имя, номер заказа,
 * время), без ссылок на файл (blob), без выделения/копирования/печати/контекстного
 * меню, а при потере фокуса окна страницы закрываются.
 */
function useScreenGuard(root: React.RefObject<HTMLElement>) {
  const [covered, setCovered] = React.useState(false);

  React.useEffect(() => {
    const cover = () => setCovered(true);
    const uncover = () => setCovered(document.hidden);
    const onVisibility = () => setCovered(document.hidden);
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "printscreen") {
        navigator.clipboard?.writeText("").catch(() => undefined);
        setCovered(true);
        setTimeout(() => setCovered(document.hidden), 1500);
      }
      if ((e.ctrlKey || e.metaKey) && ["p", "s"].includes(key)) e.preventDefault();
    };
    const inRoot = (e: Event) => root.current?.contains(e.target as Node) ?? false;
    const block = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest("input, textarea")) return; // в полях ввода всё работает
      if (inRoot(e)) e.preventDefault();
    };

    window.addEventListener("blur", cover);
    window.addEventListener("focus", uncover);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKey);
    for (const type of ["contextmenu", "copy", "cut", "dragstart", "selectstart"]) document.addEventListener(type, block);
    return () => {
      window.removeEventListener("blur", cover);
      window.removeEventListener("focus", uncover);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
      for (const type of ["contextmenu", "copy", "cut", "dragstart", "selectstart"]) document.removeEventListener(type, block);
    };
  }, [root]);

  return covered;
}

/** Загружает страницу как blob (сервер ставит водяной знак), только когда она рядом с экраном. */
function usePageImage(proofId: string, n: number, token: string | null) {
  const holder = React.useRef<HTMLDivElement>(null);
  const [src, setSrc] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    const el = holder.current;
    if (!el || src) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const load = async () => {
      try {
        const res = await fetch(`/api/proofs/${proofId}/pages/${n}`, {
          headers: token ? { "x-order-token": token } : {},
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        objectUrl = URL.createObjectURL(await res.blob());
        if (!cancelled) setSrc(objectUrl);
      } catch {
        if (!cancelled) setError(true);
      }
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void load();
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proofId, n, token, attempt]);

  React.useEffect(() => () => (src ? URL.revokeObjectURL(src) : undefined), [src]);

  return {
    holder,
    src,
    error,
    retry: () => {
      setError(false);
      setAttempt((a) => a + 1);
    },
  };
}

function PageView({
  proofId,
  token,
  page,
  total,
  width,
  height,
  covered,
  pinMode,
  pins,
  readonlyComments,
  onAddPin,
  onRemovePin,
}: {
  proofId: string;
  token: string | null;
  page: number;
  total: number;
  width: number;
  height: number;
  covered: boolean;
  pinMode: boolean;
  pins: Pin[];
  readonlyComments: { x: number | null; y: number | null; body: string }[];
  onAddPin: (pin: Pin) => void;
  onRemovePin: (index: number) => void;
}) {
  const t = useTranslations("proof");
  const { holder, src, error, retry } = usePageImage(proofId, page, token);
  const [draft, setDraft] = React.useState<{ x: number; y: number; body: string } | null>(null);

  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinMode || draft) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDraft({
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
      body: "",
    });
  };

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-semibold text-muted-foreground">{t("pageOf", { n: page, total })}</figcaption>
      <div
        ref={holder}
        className="relative w-full overflow-hidden rounded-lg border bg-white shadow-sm"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={t("pageOf", { n: page, total })}
            draggable={false}
            className={cn("h-full w-full select-none object-contain transition-[filter]", covered && "blur-2xl")}
          />
        )}
        {!src && !error && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-5 w-5" /> {t("loadError")}
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              {t("retry")}
            </Button>
          </div>
        )}

        {/* Прозрачный слой: не даёт «сохранить картинку», принимает клики для меток */}
        <div
          className={cn("absolute inset-0", pinMode ? "cursor-crosshair" : "cursor-default")}
          onClick={place}
          onContextMenu={(e) => e.preventDefault()}
          aria-hidden
        />

        {readonlyComments.map((c, i) =>
          c.x != null && c.y != null ? (
            <span
              key={`r${i}`}
              title={c.body}
              className="absolute -translate-x-1/2 -translate-y-full text-amber-600 drop-shadow"
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
            >
              <MapPin className="h-6 w-6 fill-amber-300" />
            </span>
          ) : null,
        )}
        {pins.map((p, i) => (
          <button
            key={i}
            type="button"
            title={p.body}
            onClick={(e) => {
              e.stopPropagation();
              onRemovePin(i);
            }}
            className="absolute -translate-x-1/2 -translate-y-full text-red-600 drop-shadow"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          >
            <MapPin className="h-7 w-7 fill-red-300" />
          </button>
        ))}

        {draft && (
          <div
            className="absolute z-10 w-64 max-w-[80%] space-y-2 rounded-lg border bg-white p-3 shadow-xl"
            style={{
              left: `${Math.min(draft.x * 100, 60)}%`,
              top: `${Math.min(draft.y * 100 + 2, 80)}%`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Textarea
              autoFocus
              rows={3}
              maxLength={1000}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder={t("pinPlaceholder")}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)}>
                {t("pinCancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!draft.body.trim()}
                onClick={() => {
                  onAddPin({ page, x: draft.x, y: draft.y, body: draft.body.trim() });
                  setDraft(null);
                }}
              >
                {t("pinSave")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}

export function ProofViewer({ model, token, canDecide }: ProofViewerProps) {
  const t = useTranslations("proof");
  const router = useRouter();
  const root = React.useRef<HTMLDivElement>(null);
  const covered = useScreenGuard(root);

  const interactive = canDecide && model.status === "pending";
  const [answers, setAnswers] = React.useState<Record<string, FieldAnswer>>(() =>
    Object.fromEntries(model.keyFields.map((f) => [f.id, { state: null, value: "", body: "" } as FieldAnswer])),
  );
  const [pins, setPins] = React.useState<Pin[]>([]);
  const [pinMode, setPinMode] = React.useState(false);
  const [checks, setChecks] = React.useState({ names: false, dates: false, print: false });
  const [busy, setBusy] = React.useState<"approve" | "changes" | null>(null);

  // Открытие экрана — событие в журнале (один раз за заход)
  React.useEffect(() => {
    if (!canDecide) return;
    void fetch(`/api/proofs?orderId=${model.orderId}&open=1`, {
      headers: token ? { "x-order-token": token } : {},
      cache: "no-store",
    }).catch(() => undefined);
  }, [canDecide, model.orderId, token]);

  const fixes = model.keyFields.filter((f) => answers[f.id]?.state === "fix");
  const allOk = model.keyFields.every((f) => answers[f.id]?.state === "ok");
  const hasChanges = fixes.length > 0 || pins.length > 0;
  const fixesComplete = fixes.every((f) => answers[f.id]!.value.trim());
  const canApprove = interactive && !hasChanges && allOk && checks.names && checks.dates && checks.print;
  const canSendChanges = interactive && hasChanges && fixesComplete;

  const headers = token ? { "x-order-token": token } : undefined;

  const approve = async () => {
    setBusy("approve");
    try {
      await apiFetch(`/api/proofs/${model.proofId}/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({ confirmations: checks }),
      });
      toast.success(t("approveDone"));
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const sendChanges = async () => {
    setBusy("changes");
    try {
      const res = await apiFetch<{ count: number }>(`/api/proofs/${model.proofId}/changes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          fields: fixes.map((f) => ({ fieldId: f.id, value: answers[f.id]!.value, body: answers[f.id]!.body })),
          comments: pins.map((p) => ({ page: p.page, x: p.x, y: p.y, body: p.body })),
        }),
      });
      toast.success(t("changesDone", { count: res.count }));
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const setAnswer = (id: string, patch: Partial<FieldAnswer>) =>
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id]!, ...patch } }));

  const readonlyComments = model.comments.filter((c) => c.page != null);

  return (
    <div ref={root} className="proof-guard select-none">
      <style dangerouslySetInnerHTML={{ __html: printCss(t("printBlocked")) }} />

      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-extrabold text-brand-800 md:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle", { number: model.publicNumber, version: model.version })}</p>
      </div>

      {model.status === "approved" && (
        <p className="mb-6 flex items-start gap-2 rounded-xl bg-emerald-50 p-4 font-medium text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          {t("approvedBanner", { date: model.decidedAt ? formatDateTime(model.decidedAt) : "" })}
        </p>
      )}
      {model.status === "changes_requested" && (
        <p className="mb-6 flex items-start gap-2 rounded-xl bg-blue-50 p-4 font-medium text-blue-800">
          <Pencil className="mt-0.5 h-5 w-5 shrink-0" />
          {t("changesBanner")}
        </p>
      )}
      {!canDecide && model.status === "pending" && (
        <p className="mb-6 flex items-start gap-2 rounded-xl bg-amber-50 p-4 font-medium text-amber-800">
          <Eye className="mt-0.5 h-5 w-5 shrink-0" />
          {t("staffView")}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-5 lg:sticky lg:top-24 lg:order-2">
          {model.note && (
            <section className="space-y-1 rounded-2xl border bg-card p-5">
              <h2 className="font-bold text-brand-800">{t("noteTitle")}</h2>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{model.note}</p>
            </section>
          )}

          {model.keyFields.length > 0 && (
            <section className="space-y-3 rounded-2xl border bg-card p-5">
              <div>
                <h2 className="font-bold text-brand-800">{t("keyDataTitle")}</h2>
                <p className="text-xs text-muted-foreground">{t("keyDataHint")}</p>
              </div>
              <ul className="space-y-3">
                {model.keyFields.map((f) => {
                  const a = answers[f.id]!;
                  const sentFix = model.comments.find((c) => c.field_id === f.id);
                  return (
                    <li key={f.id} className="space-y-2 rounded-xl border p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</div>
                      <div className="break-words text-lg font-bold text-brand-900">{f.value}</div>
                      {interactive ? (
                        <>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={a.state === "ok" ? "default" : "outline"}
                              onClick={() => setAnswer(f.id, { state: "ok" })}
                              aria-pressed={a.state === "ok"}
                            >
                              <Check /> {t("ok")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={a.state === "fix" ? "destructive" : "outline"}
                              onClick={() => setAnswer(f.id, { state: "fix" })}
                              aria-pressed={a.state === "fix"}
                            >
                              <Pencil /> {t("fix")}
                            </Button>
                          </div>
                          {a.state === "fix" && (
                            <div className="space-y-2">
                              <Input
                                value={a.value}
                                maxLength={300}
                                onChange={(e) => setAnswer(f.id, { value: e.target.value })}
                                placeholder={t("correctValue")}
                                aria-label={t("correctValue")}
                                className="select-text"
                              />
                              <Input
                                value={a.body}
                                maxLength={500}
                                onChange={(e) => setAnswer(f.id, { body: e.target.value })}
                                placeholder={t("commentOptional")}
                                aria-label={t("commentOptional")}
                                className="select-text"
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        sentFix && (
                          <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                            {sentFix.proposed_value ? `→ ${sentFix.proposed_value}` : sentFix.body}
                          </p>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {interactive && (
            <section className="space-y-3 rounded-2xl border bg-card p-5">
              <h2 className="font-bold text-brand-800">{t("commentsTitle")}</h2>
              <Button type="button" variant={pinMode ? "default" : "outline"} onClick={() => setPinMode((v) => !v)} aria-pressed={pinMode}>
                <MessageSquarePlus /> {pinMode ? t("addCommentActive") : t("addComment")}
              </Button>
              {pins.length > 0 && (
                <ul className="space-y-2 text-sm">
                  {pins.map((p, i) => (
                    <li key={i} className="flex items-start justify-between gap-2 rounded-lg bg-red-50 p-2">
                      <span>
                        <strong>{t("commentOnPage", { page: p.page })}:</strong> {p.body}
                      </span>
                      <button
                        type="button"
                        aria-label={t("removeComment")}
                        onClick={() => setPins((prev) => prev.filter((_, j) => j !== i))}
                        className="shrink-0 rounded p-1 text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {interactive && (
            <section className="space-y-4 rounded-2xl border-2 border-gold-400 bg-card p-5">
              <h2 className="font-bold text-brand-800">{t("decisionTitle")}</h2>
              {hasChanges ? (
                <>
                  <p className="text-sm text-slate-700">{t("sendChangesHint")}</p>
                  {!fixesComplete && <p className="text-sm font-medium text-destructive">{t("fixNeedsValue")}</p>}
                  <Button type="button" size="xl" variant="gold" className="w-full" disabled={!canSendChanges || busy !== null} onClick={sendChanges}>
                    {busy === "changes" && <Loader2 className="animate-spin" />} {t("sendChanges")}
                  </Button>
                </>
              ) : (
                <>
                  {(["names", "dates", "print"] as const).map((k) => (
                    <label key={k} className="flex items-start gap-2.5 text-sm leading-snug text-slate-700">
                      <Checkbox
                        checked={checks[k]}
                        onCheckedChange={(v) => setChecks((c) => ({ ...c, [k]: v === true }))}
                        className="mt-0.5 h-5 w-5"
                      />
                      <span>{t(`check.${k}`)}</span>
                    </label>
                  ))}
                  {!allOk && model.keyFields.length > 0 && <p className="text-xs text-muted-foreground">{t("answerAllFields")}</p>}
                  <Button type="button" size="xl" variant="gold" className="w-full" disabled={!canApprove || busy !== null} onClick={approve}>
                    {busy === "approve" ? <Loader2 className="animate-spin" /> : <ShieldCheck />} {t("approve")}
                  </Button>
                </>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">{t("officeNote")}</p>
            </section>
          )}
        </aside>

        <section className="min-w-0 flex-[999_1_560px] space-y-5 lg:order-1">
          <p className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> {t("protectedNote")}
          </p>
          <div className="relative space-y-6">
            {model.pages.map((p) => (
              <PageView
                key={p.n}
                proofId={model.proofId}
                token={token}
                page={p.n}
                total={model.pages.length}
                width={p.width}
                height={p.height}
                covered={covered}
                pinMode={pinMode && interactive}
                pins={pins.filter((x) => x.page === p.n)}
                readonlyComments={readonlyComments.filter((c) => c.x != null).map((c) => ({ x: c.x, y: c.y, body: c.body }))}
                onAddPin={(pin) => {
                  setPins((prev) => [...prev, pin]);
                  setPinMode(false);
                }}
                onRemovePin={(i) => {
                  const target = pins.filter((x) => x.page === p.n)[i];
                  setPins((prev) => prev.filter((x) => x !== target));
                }}
              />
            ))}
            {covered && (
              <div className="pointer-events-none fixed inset-x-0 top-1/3 z-30 mx-auto w-fit rounded-xl bg-brand-900/90 px-5 py-3 text-center font-semibold text-white shadow-xl">
                {t("covered")}
              </div>
            )}
          </div>
        </section>
      </div>

      {!canDecide && (
        <p className="mt-8 text-sm">
          <Link href="/account" className="text-brand-500 underline">
            {t("backToOrders")}
          </Link>
        </p>
      )}
    </div>
  );
}
