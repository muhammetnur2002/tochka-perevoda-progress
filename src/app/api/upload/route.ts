import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStorage, orderStoragePath } from "@/lib/storage";
import { requireOrderAccess } from "@/lib/services/order-access";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { errorResponse, tooManyRequests } from "@/lib/api";
import { badRequest, forbidden } from "@/lib/errors";
import type { FileKind } from "@/types/database.types";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES_PER_ORDER = 30;

/** Разрешённые типы: фото с телефона (в т.ч. HEIC), PDF, Word, ZIP. */
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
]);

/** Сигнатуры файлов: защита от подмены расширения/Content-Type. */
function sniffMatches(mime: string, head: Buffer): boolean {
  const hex = head.subarray(0, 12).toString("hex");
  if (mime === "image/jpeg") return hex.startsWith("ffd8ff");
  if (mime === "image/png") return hex.startsWith("89504e47");
  if (mime === "image/webp") return hex.startsWith("52494646") && head.subarray(8, 12).toString() === "WEBP";
  if (mime === "image/heic" || mime === "image/heif") return head.subarray(4, 8).toString() === "ftyp";
  if (mime === "application/pdf") return head.subarray(0, 5).toString() === "%PDF-";
  if (mime === "application/msword") return hex.startsWith("d0cf11e0");
  // docx и zip — ZIP-контейнер
  return hex.startsWith("504b0304");
}

/** Определение типа по расширению (некоторые браузеры присылают пустой type для HEIC). */
function mimeFromName(name: string, given: string): string {
  if (given && given !== "application/octet-stream") return given;
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    zip: "application/zip",
  };
  return (ext && map[ext]) || given;
}

/**
 * POST /api/upload — загрузка файла к заказу (multipart: orderId, file, kind?).
 * Доступ: владелец заказа, гость с токеном заказа, менеджер; исполнитель —
 * только kind=translation (готовый перевод). Путь: orders/{order_id}/{uuid}-{имя}.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await checkRateLimit({ bucket: "upload", identifier: clientIp(req.headers), limit: 60, windowMs: 10 * 60_000 }))) {
      return tooManyRequests();
    }

    const form = await req.formData();
    const orderId = form.get("orderId")?.toString() ?? "";
    const file = form.get("file");
    const requestedKind = (form.get("kind")?.toString() ?? "source") as FileKind;

    if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw badRequest("Не указан заказ");
    if (!(file instanceof File)) throw badRequest("Файл не передан");
    if (file.size === 0) throw badRequest("Пустой файл");
    if (file.size > MAX_FILE_SIZE) throw badRequest("Файл больше 50 МБ");

    const access = await requireOrderAccess(req, orderId);
    let kind: FileKind = ["source", "photo", "other"].includes(requestedKind) ? requestedKind : "source";
    if (access.mode === "executor") {
      if (requestedKind !== "translation") throw forbidden("Исполнитель загружает только готовый перевод");
      kind = "translation";
    }
    if (access.mode === "manager" && ["translation", "receipt"].includes(requestedKind)) kind = requestedKind;

    const mime = mimeFromName(file.name, file.type);
    if (!ALLOWED_MIME.has(mime)) {
      throw badRequest("Недопустимый тип файла. Разрешены фото (JPG, PNG, HEIC), PDF, DOC/DOCX, ZIP.");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!sniffMatches(mime, bytes)) throw badRequest("Содержимое файла не соответствует его типу");

    const admin = createAdminClient();
    const { count } = await admin
      .from("files")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId)
      .is("deleted_at", null);
    if ((count ?? 0) >= MAX_FILES_PER_ORDER) throw badRequest("Слишком много файлов в заказе");

    const storage = await getStorage();
    const path = orderStoragePath(orderId, file.name, randomUUID());
    await storage.upload(path, bytes, mime);

    const { data: row, error } = await admin
      .from("files")
      .insert({
        order_id: orderId,
        storage_path: path,
        original_name: file.name.slice(0, 200),
        mime_type: mime,
        size_bytes: file.size,
        kind,
        uploaded_by: access.actor?.id ?? null,
        checksum: createHash("sha256").update(bytes).digest("hex"),
      })
      .select("id, original_name, mime_type, size_bytes, kind, created_at")
      .single();
    if (error) {
      await storage.remove(path).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ file: row }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
