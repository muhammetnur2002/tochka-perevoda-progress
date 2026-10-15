import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET, type StorageAdapter } from "./index";

/** Адаптер Supabase Storage (по умолчанию). */
export class SupabaseStorageAdapter implements StorageAdapter {
  async upload(path: string, data: Buffer, contentType: string): Promise<string> {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(STORAGE_BUCKET).upload(path, data, {
      contentType,
      upsert: false,
    });
    if (error) throw new Error(`Ошибка загрузки файла: ${error.message}`);
    return path;
  }

  async getSignedUrl(path: string, expiresInSeconds: number, downloadName?: string): Promise<string> {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, expiresInSeconds, downloadName ? { download: downloadName } : undefined);
    if (error) throw new Error(`Не удалось создать ссылку: ${error.message}`);
    return data.signedUrl;
  }

  async download(path: string): Promise<Buffer> {
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(STORAGE_BUCKET).download(path);
    if (error || !data) throw new Error(`Не удалось прочитать файл: ${error?.message ?? "пусто"}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async remove(path: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(STORAGE_BUCKET).remove([path]);
    if (error) throw new Error(`Ошибка удаления файла: ${error.message}`);
  }
}
