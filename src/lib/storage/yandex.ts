import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { STORAGE_BUCKET, type StorageAdapter } from "./index";

/**
 * Адаптер Yandex Object Storage (S3-совместимый).
 * Включается STORAGE_DRIVER=yandex + S3_* переменными в .env.local.
 */
export class YandexStorageAdapter implements StorageAdapter {
  private get client(): S3Client {
    const endpoint = process.env.S3_ENDPOINT ?? "https://storage.yandexcloud.net";
    return new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? "ru-central1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
  }

  private get bucket(): string {
    return process.env.S3_BUCKET ?? STORAGE_BUCKET;
  }

  async upload(path: string, data: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: data,
        ContentType: contentType,
        ServerSideEncryption: "AES256", // шифрование на стороне хранилища
      }),
    );
    return path;
  }

  async getSignedUrl(path: string, expiresInSeconds: number, downloadName?: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: path,
        ResponseContentDisposition: downloadName
          ? `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
          : undefined,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async remove(path: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: path }));
  }
}
