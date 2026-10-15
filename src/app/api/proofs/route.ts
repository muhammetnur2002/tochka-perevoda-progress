import { NextResponse, type NextRequest } from "next/server";
import { requestMeta } from "@/lib/auth/session";
import { requireOrderAccess } from "@/lib/services/order-access";
import { createProof, getProofViewModel, recordOpened } from "@/lib/services/proof-service";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { errorResponse, tooManyRequests } from "@/lib/api";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { PROOF_MAX_PAGES } from "@/lib/proof/constants";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * GET /api/proofs?orderId=…[&open=1] — текущая версия перевода на проверке (без путей
 * к файлам). open=1 — клиент открыл экран проверки: пишем событие в журнал.
 * Доступ: владелец заказа, гость с токеном, менеджер, назначенный исполнитель.
 */
export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId") ?? "";
    if (!UUID_RE.test(orderId)) throw badRequest("Не указан заказ");
    const access = await requireOrderAccess(req, orderId);
    const proof = await getProofViewModel(orderId);
    if (!proof) throw notFound("Перевод ещё не отправлен на проверку");
    const isClient = access.mode === "owner" || access.mode === "guest";
    if (req.nextUrl.searchParams.get("open") === "1" && isClient) {
      await recordOpened(proof.proofId, { actorId: access.actor?.id, actorRole: access.mode, ...requestMeta(req) });
    }
    return NextResponse.json({ proof, canDecide: isClient });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/proofs — сотрудник загружает новую версию перевода на проверку.
 * multipart: orderId, note?, keyFields (JSON: [{label, value}]), pages — файлы
 * JPEG/PNG/WebP по порядку. Клиент получает уведомление со ссылкой.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await checkRateLimit({ bucket: "proof-create", identifier: clientIp(req.headers), limit: 30, windowMs: 10 * 60_000 }))) {
      return tooManyRequests();
    }
    const form = await req.formData();
    const orderId = form.get("orderId")?.toString() ?? "";
    if (!UUID_RE.test(orderId)) throw badRequest("Не указан заказ");

    const access = await requireOrderAccess(req, orderId);
    if (access.mode !== "manager" && access.mode !== "executor") {
      throw forbidden("Загружать перевод на проверку могут сотрудники");
    }
    const actor = access.actor!;

    const files = form.getAll("pages").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw badRequest("Добавьте страницы перевода");
    if (files.length > PROOF_MAX_PAGES) throw badRequest(`Не больше ${PROOF_MAX_PAGES} страниц`);

    let keyFields: unknown = [];
    try {
      keyFields = JSON.parse(form.get("keyFields")?.toString() || "[]");
    } catch {
      throw badRequest("Некорректные ключевые данные");
    }

    const pages = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
    const proof = await createProof(
      { orderId, note: form.get("note")?.toString() ?? null, keyFields, pages },
      { actorId: actor.id, actorRole: actor.role, ...requestMeta(req) },
    );
    return NextResponse.json({ id: proof.id, version: proof.version }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
