import { z } from "zod";
import { nameSchema, phoneSchema, optionalEmailSchema } from "./common";

/** Карточка клиента (админка). */
export const clientSchema = z.object({
  name: nameSchema,
  phone: phoneSchema.optional().nullable(),
  email: optionalEmailSchema,
  inn: z.string().trim().max(20).optional().nullable(),
  type: z.enum(["individual", "company"]).default("individual"),
});

export type ClientInput = z.infer<typeof clientSchema>;
