import { z } from "zod";

/** Создание/редактирование услуги (админка). */
export const serviceSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/, "Только латиница, цифры и дефис"),
  category: z.enum(["translation", "printing", "insurance", "additional"]),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  price: z.number().nonnegative(),
  unit: z.enum(["page", "document", "item"]),
  duration_days: z.number().int().min(1).max(30),
  is_active: z.boolean().default(true),
  is_notarial: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

/** Правило цены. */
export const priceRuleSchema = z.object({
  service_id: z.string().uuid(),
  rule_type: z.enum(["fixed", "per_page", "urgent", "notary", "delivery", "volume"]),
  value: z.number(),
  min_qty: z.number().int().positive().optional().nullable(),
  max_qty: z.number().int().positive().optional().nullable(),
  priority: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

export type PriceRuleInput = z.infer<typeof priceRuleSchema>;
