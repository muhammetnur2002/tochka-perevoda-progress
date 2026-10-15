import "server-only";

/** Единый интерфейс файлового хранилища (Supabase Storage / Yandex Object Storage). */
export interface StorageAdapter {
  /** Загружает объект по пути, возвращает путь/ключ. */
  upload(path: string, data: Buffer, contentType: string): Promise<string>;
  /** Создаёт подписанный URL (короткий TTL для приватных файлов). */
  getSignedUrl(path: string, expiresInSeconds: number, downloadName?: string): Promise<string>;
  /** Удаляет объект. */
  remove(path: string): Promise<void>;
}

export const STORAGE_BUCKET = "order-files";
export const SIGNED_URL_TTL = 5 * 60; // 5 минут

/** Путь объекта для заказа: orders/{order_id}/{token}-{safe_name} */
export function orderStoragePath(orderId: string, fileName: string, token: string): string {
  const safe = fileName.replace(/[^\w.\-а-яёА-ЯЁ]+/g, "_").slice(-120);
  return `orders/${orderId}/${token}-${safe}`;
}

/** Выбирает адаптер по STORAGE_DRIVER (supabase по умолчанию). */
export async function getStorage(): Promise<StorageAdapter> {
  const driver = process.env.STORAGE_DRIVER ?? "supabase";
  if (driver === "yandex") {
    const { YandexStorageAdapter } = await import("./yandex");
    return new YandexStorageAdapter();
  }
  const { SupabaseStorageAdapter } = await import("./supabase");
  return new SupabaseStorageAdapter();
}
