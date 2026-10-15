import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStorage } from "@/lib/storage";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { formatDateTime } from "@/lib/format/date";
import { notifyProofDecision, notifyProofRequested } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { normalizeUploadedPage, watermarkPage } from "@/lib/proof/watermark";
import {
  PROOF_MAX_COMMENTS,
  PROOF_MAX_KEY_FIELDS,
  PROOF_MAX_PAGES,
  PROOF_MAX_PAGE_BYTES,
} from "@/lib/proof/constants";
import type { Json, ProofCommentRow, ProofEventName, ProofKeyField, ProofPageMeta, ProofRow } from "@/types/database.types";

/** Кто и откуда выполняет действие (для журнала и согласия 152-ФЗ/юридической значимости). */
export interface ProofContext {
  actorId?: string | null;
  actorRole: string;
  ip?: string | null;
  userAgent?: string | null;
}

async function logEvent(
  proof: Pick<ProofRow, "id" | "order_id">,
  event: ProofEventName,
  ctx: ProofContext,
  meta: Record<string, unknown> = {},
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("proof_events").insert({
    proof_id: proof.id,
    order_id: proof.order_id,
    event,
    actor_id: ctx.actorId ?? null,
    actor_role: ctx.actorRole,
    ip: ctx.ip ?? null,
    user_agent: ctx.userAgent?.slice(0, 300) ?? null,
    meta: meta as Json,
  });
  if (error) logger.warn("Не удалось записать событие сверки", { error: error.message, event });
}

const keyFieldsSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(80),
      value: z.string().trim().min(1).max(300),
    }),
  )
  .max(PROOF_MAX_KEY_FIELDS);

export interface CreateProofInput {
  orderId: string;
  note?: string | null;
  keyFields: unknown;
  /** Страницы по порядку: JPEG/PNG/WebP. PDF сотрудник превращает в страницы в браузере. */
  pages: Buffer[];
}

/** Загружает новую версию перевода на проверку и уведомляет клиента. */
export async function createProof(input: CreateProofInput, ctx: ProofContext): Promise<ProofRow> {
  if (input.pages.length === 0) throw badRequest("Добавьте хотя бы одну страницу перевода");
  if (input.pages.length > PROOF_MAX_PAGES) throw badRequest(`Не больше ${PROOF_MAX_PAGES} страниц`);
  const parsedFields = keyFieldsSchema.safeParse(input.keyFields);
  if (!parsedFields.success) throw badRequest("Проверьте ключевые данные: нужны название и значение");
  const note = input.note?.trim().slice(0, 1000) || null;

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, status").eq("id", input.orderId).maybeSingle();
  if (!order) throw notFound("Заказ не найден");
  if (order.status === "cancelled") throw badRequest("Заказ отменён");

  // Нормализуем страницы (sharp сам отклонит не-изображения)
  const normalized: { data: Buffer; width: number; height: number }[] = [];
  for (const [i, page] of input.pages.entries()) {
    if (page.length > PROOF_MAX_PAGE_BYTES) throw badRequest(`Страница ${i + 1} больше 12 МБ`);
    try {
      normalized.push(await normalizeUploadedPage(page));
    } catch {
      throw badRequest(`Страница ${i + 1} — не изображение (нужны JPG, PNG или WebP)`);
    }
  }

  const { data: last } = await admin
    .from("proofs")
    .select("version")
    .eq("order_id", input.orderId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (last?.version ?? 0) + 1;

  const proofId = randomUUID();
  const storage = await getStorage();
  const hash = createHash("sha256");
  const pages: ProofPageMeta[] = [];
  const uploaded: string[] = [];
  try {
    for (const [i, page] of normalized.entries()) {
      const path = `proofs/${input.orderId}/${proofId}/${i + 1}.jpg`;
      await storage.upload(path, page.data, "image/jpeg");
      uploaded.push(path);
      hash.update(createHash("sha256").update(page.data).digest());
      pages.push({ n: i + 1, path, width: page.width, height: page.height });
    }

    const fields: ProofKeyField[] = parsedFields.data.map((f, i) => ({ id: `f${i + 1}`, ...f }));
    const { data: proof, error } = await admin
      .from("proofs")
      .insert({
        id: proofId,
        order_id: input.orderId,
        version,
        status: "pending",
        note,
        key_fields: fields,
        pages,
        page_count: pages.length,
        content_hash: hash.digest("hex"),
        created_by: ctx.actorId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    // Прежние незавершённые версии заменены новой
    const { data: old } = await admin
      .from("proofs")
      .select("id, order_id")
      .eq("order_id", input.orderId)
      .in("status", ["pending", "changes_requested"])
      .neq("id", proofId);
    if (old?.length) {
      await admin.from("proofs").update({ status: "superseded" }).in("id", old.map((o) => o.id));
      for (const o of old) await logEvent(o, "superseded", ctx, { by_version: version });
    }

    await admin.from("orders").update({ proof_status: "awaiting_client" }).eq("id", input.orderId);
    await logEvent(proof as unknown as ProofRow, "created", ctx, { version, pages: pages.length });

    const sent = await notifyProofRequested(input.orderId).catch((e: unknown) => {
      logger.error("Не удалось уведомить клиента о сверке", { error: (e as Error).message });
      return false;
    });
    await logEvent(proof as unknown as ProofRow, "sent", ctx, { delivered: sent });
    return proof as unknown as ProofRow;
  } catch (err) {
    // откат: файлы без записи не оставляем
    await Promise.all(uploaded.map((p) => storage.remove(p).catch(() => undefined)));
    throw err;
  }
}

/** Данные для экрана клиента: без путей к файлам, только то, что нужно показать. */
export interface ProofViewModel {
  orderId: string;
  publicNumber: string;
  proofId: string;
  version: number;
  status: ProofRow["status"];
  note: string | null;
  keyFields: ProofKeyField[];
  pages: { n: number; width: number; height: number }[];
  comments: Pick<ProofCommentRow, "id" | "page" | "x" | "y" | "field_id" | "proposed_value" | "body">[];
  decidedAt: string | null;
}

/** Последняя версия перевода заказа (кроме замещённых) в виде модели экрана. */
export async function getProofViewModel(orderId: string): Promise<ProofViewModel | null> {
  const admin = createAdminClient();
  const { data: proof } = await admin
    .from("proofs")
    .select("*, order:orders(public_number)")
    .eq("order_id", orderId)
    .neq("status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!proof) return null;
  const { data: comments } = await admin
    .from("proof_comments")
    .select("id, page, x, y, field_id, proposed_value, body")
    .eq("proof_id", proof.id)
    .order("created_at");
  return {
    orderId,
    publicNumber: proof.order?.public_number ?? "",
    proofId: proof.id,
    version: proof.version,
    status: proof.status,
    note: proof.note,
    keyFields: proof.key_fields,
    pages: proof.pages.map((p) => ({ n: p.n, width: p.width, height: p.height })),
    comments: comments ?? [],
    decidedAt: proof.decided_at,
  };
}

async function loadProof(proofId: string): Promise<ProofRow & { order: { public_number: string; client: { name: string; phone: string } | null } }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("proofs")
    .select("*, order:orders(public_number, client:clients(name, phone))")
    .eq("id", proofId)
    .maybeSingle();
  if (!data || !data.order) throw notFound("Версия перевода не найдена");
  return data as never;
}

/** Идентификатор заказа версии — для проверки доступа до чтения страниц. */
export async function proofOrderId(proofId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("proofs").select("order_id").eq("id", proofId).maybeSingle();
  if (!data) throw notFound("Версия перевода не найдена");
  return data.order_id;
}

export interface ViewerInfo {
  /** Клиент (владелец/гость) или сотрудник — от этого зависит подпись на странице. */
  kind: "client" | "staff";
}

/** Страница для просмотра с водяным знаком: номер заказа, имя, время. */
export async function renderProofPage(proofId: string, n: number, viewer: ViewerInfo): Promise<Buffer> {
  const proof = await loadProof(proofId);
  const meta = proof.pages.find((p) => p.n === n);
  if (!meta) throw notFound("Страницы нет");
  const source = await (await getStorage()).download(meta.path);

  const client = proof.order.client;
  const phoneTail = client?.phone ? ` …${client.phone.slice(-4)}` : "";
  const who = viewer.kind === "staff" ? "ПРЕДПРОСМОТР СОТРУДНИКА" : `${client?.name ?? "клиент"}${phoneTail}`;
  return watermarkPage(source, {
    tile: `${proof.order.public_number} · ${who} · ${formatDateTime(new Date())}`,
    banner: "ПРОВЕРКА ПЕРЕВОДА — НЕ ЯВЛЯЕТСЯ КОПИЕЙ ДОКУМЕНТА",
  });
}

/** Клиент открыл страницу проверки (не чаще раза в 30 минут на версию). */
export async function recordOpened(proofId: string, ctx: ProofContext): Promise<void> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { count } = await admin
    .from("proof_events")
    .select("id", { count: "exact", head: true })
    .eq("proof_id", proofId)
    .eq("event", "opened")
    .gte("created_at", since);
  if ((count ?? 0) > 0) return;
  const { data: proof } = await admin.from("proofs").select("id, order_id").eq("id", proofId).maybeSingle();
  if (proof) await logEvent(proof, "opened", ctx);
}

const approveSchema = z.object({
  /** Три обязательные галочки: имена, даты/номера, согласие на печать. */
  confirmations: z.object({
    names: z.literal(true),
    dates: z.literal(true),
    print: z.literal(true),
  }),
});

const changesSchema = z.object({
  fields: z
    .array(z.object({ fieldId: z.string().max(20), value: z.string().trim().max(300).default(""), body: z.string().trim().max(1000).default("") }))
    .max(PROOF_MAX_KEY_FIELDS)
    .default([]),
  comments: z
    .array(
      z.object({
        page: z.number().int().min(1).max(PROOF_MAX_PAGES),
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        body: z.string().trim().min(1).max(1000),
      }),
    )
    .max(PROOF_MAX_COMMENTS)
    .default([]),
});

async function requirePending(proofId: string) {
  const proof = await loadProof(proofId);
  if (proof.status !== "pending") {
    throw conflict(
      proof.status === "approved"
        ? "Этот перевод уже подтверждён"
        : "Эта версия уже обработана — обновите страницу, возможно, загружена новая",
    );
  }
  return proof;
}

/** Клиент подтвердил перевод: печать разрешена. Фиксируем галочки, IP, устройство, версию и хэш. */
export async function approveProof(proofId: string, payload: unknown, ctx: ProofContext): Promise<void> {
  const parsed = approveSchema.safeParse(payload);
  if (!parsed.success) throw badRequest("Отметьте все подтверждения");
  const proof = await requirePending(proofId);

  const decision = {
    method: "online",
    confirmations: parsed.data.confirmations,
    key_fields: proof.key_fields.map((f) => ({ id: f.id, label: f.label, value: f.value, answer: "ok" })),
    version: proof.version,
    content_hash: proof.content_hash,
    ip: ctx.ip ?? null,
    user_agent: ctx.userAgent?.slice(0, 300) ?? null,
  };
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("proofs")
    .update({ status: "approved", decided_at: new Date().toISOString(), decision: decision as unknown as Json })
    .eq("id", proofId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!updated) throw conflict("Эта версия уже обработана — обновите страницу");

  await admin.from("orders").update({ proof_status: "approved" }).eq("id", proof.order_id);
  await logEvent(proof, "approved", ctx, { version: proof.version });
  await notifyProofDecision(proof.order_id, "approved").catch((e: unknown) =>
    logger.error("Не удалось уведомить менеджеров", { error: (e as Error).message }),
  );
}

/** Клиент отправил замечания: исправления ключевых данных и метки на страницах. */
export async function requestChanges(proofId: string, payload: unknown, ctx: ProofContext): Promise<number> {
  const parsed = changesSchema.safeParse(payload);
  if (!parsed.success) throw badRequest("Проверьте замечания");
  const proof = await requirePending(proofId);

  const fieldIds = new Set(proof.key_fields.map((f) => f.id));
  const fieldComments = parsed.data.fields
    .filter((f) => fieldIds.has(f.fieldId) && (f.value || f.body))
    .map((f) => {
      const field = proof.key_fields.find((k) => k.id === f.fieldId)!;
      return {
        proof_id: proofId,
        page: null,
        x: null,
        y: null,
        field_id: f.fieldId,
        proposed_value: f.value || null,
        body: f.body || `«${field.label}»: исправить`,
      };
    });
  const pageComments = parsed.data.comments
    .filter((c) => c.page <= proof.page_count)
    .map((c) => ({
      proof_id: proofId,
      page: c.page,
      x: Math.round(c.x * 10000) / 10000,
      y: Math.round(c.y * 10000) / 10000,
      field_id: null,
      proposed_value: null,
      body: c.body,
    }));
  const rows = [...fieldComments, ...pageComments];
  if (rows.length === 0) throw badRequest("Опишите, что нужно исправить");

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("proofs")
    .update({
      status: "changes_requested",
      decided_at: new Date().toISOString(),
      decision: { method: "online", ip: ctx.ip ?? null, user_agent: ctx.userAgent?.slice(0, 300) ?? null, comments: rows.length } as Json,
    })
    .eq("id", proofId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!updated) throw conflict("Эта версия уже обработана — обновите страницу");

  const { error: commentsError } = await admin.from("proof_comments").insert(rows);
  if (commentsError) throw commentsError;
  await admin.from("orders").update({ proof_status: "changes_requested" }).eq("id", proof.order_id);
  await logEvent(proof, "changes_requested", ctx, { comments: rows.length });
  await notifyProofDecision(proof.order_id, "changes", rows.length).catch((e: unknown) =>
    logger.error("Не удалось уведомить менеджеров", { error: (e as Error).message }),
  );
  return rows.length;
}

/** Подтверждение в офисе: клиент проверил распечатку/экран и расписался — сотрудник фиксирует это. */
export async function officeApprove(proofId: string, ctx: ProofContext): Promise<void> {
  const proof = await loadProof(proofId);
  if (proof.status === "approved") throw conflict("Перевод уже подтверждён");
  if (proof.status === "superseded") throw conflict("Это не последняя версия");

  const admin = createAdminClient();
  const decision = {
    method: "office",
    version: proof.version,
    content_hash: proof.content_hash,
    confirmed_by: ctx.actorId ?? null,
  };
  await admin
    .from("proofs")
    .update({ status: "approved", decided_at: new Date().toISOString(), decision: decision as unknown as Json })
    .eq("id", proofId);
  await admin.from("orders").update({ proof_status: "approved" }).eq("id", proof.order_id);
  await logEvent(proof, "office_approved", ctx, { version: proof.version });
}

/** Сотрудник просит клиента проверить ещё раз (повторное уведомление, не чаще раза в 10 минут). */
export async function remindClient(proofId: string, ctx: ProofContext): Promise<boolean> {
  const proof = await loadProof(proofId);
  if (proof.status !== "pending") throw conflict("Версия уже не ожидает ответа клиента");
  const admin = createAdminClient();
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await admin
    .from("proof_events")
    .select("id", { count: "exact", head: true })
    .eq("proof_id", proofId)
    .in("event", ["sent", "reminded"])
    .gte("created_at", since);
  if ((count ?? 0) > 0) throw conflict("Напоминание уже отправлено недавно");
  const ok = await notifyProofRequested(proof.order_id, true);
  await logEvent(proof, "reminded", ctx, { delivered: ok });
  return ok;
}
