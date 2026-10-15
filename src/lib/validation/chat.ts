import { z } from "zod";
import { uuidSchema } from "./common";

/** Сообщение в чате Mini App. */
export const chatMessageSchema = z.object({
  orderId: uuidSchema,
  body: z.string().trim().min(1, "Введите сообщение").max(2000),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
