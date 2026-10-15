import "server-only";
import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";

/** Отправка email через SMTP (nodemailer). Без SMTP_HOST — заглушка в лог. */
export async function sendEmail(to: string, subject: string, text: string): Promise<string | null> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP не настроен");
    logger.info("[email:mock]", { to, subject, text });
    return null;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "noreply@example.com",
    to,
    subject,
    text,
  });

  return info.messageId;
}
