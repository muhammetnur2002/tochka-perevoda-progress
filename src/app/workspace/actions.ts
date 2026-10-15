"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTelegram } from "@/lib/notifications/telegram";
import { managerChatIds } from "@/lib/notifications";
import { logger } from "@/lib/logger";

export type TaskActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Исполнитель меняет статус своей задачи: accepted → in_progress → done.
 * RLS пускает только к своим назначениям, триггер assignments_guard
 * запрещает менять что-либо, кроме статуса.
 */
export async function setTaskStatusAction(
  assignmentId: string,
  status: "accepted" | "in_progress" | "done" | "rejected",
): Promise<TaskActionResult> {
  try {
    const actor = await requirePermission("task.update_own");
    const parsed = z.enum(["accepted", "in_progress", "done", "rejected"]).parse(status);

    if (parsed === "done") {
      const { data: a } = await actor.supabase
        .from("order_assignments")
        .select("order_id, role")
        .eq("id", assignmentId)
        .maybeSingle();
      if (!a) throw new Error("Задача не найдена");
      if (a.role === "translator") {
        const { count } = await actor.supabase
          .from("files")
          .select("id", { count: "exact", head: true })
          .eq("order_id", a.order_id)
          .eq("kind", "translation");
        if (!count) throw new Error("Сначала загрузите файл перевода");
      }
    }

    const { data, error } = await actor.supabase
      .from("order_assignments")
      .update({ status: parsed })
      .eq("id", assignmentId)
      .eq("user_id", actor.id)
      .select("order_id, order:orders(public_number)")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Задача не найдена");

    if (parsed === "done" || parsed === "rejected") {
      const number = data.order?.public_number ?? "";
      const text =
        parsed === "done"
          ? `✅ ${actor.name ?? "Исполнитель"} сдал(а) задачу по заказу <b>${number}</b> — проверьте и переведите в «Готов».`
          : `↩️ ${actor.name ?? "Исполнитель"} отказался(ась) от задачи по заказу <b>${number}</b> — нужен другой исполнитель.`;
      for (const chatId of await managerChatIds().catch(() => [])) {
        await sendTelegram(chatId, text).catch((e: Error) => logger.warn("Не удалось уведомить менеджера", { error: e.message }));
      }
      // Внутреннее уведомление в БД — для колокольчика/Realtime в CRM
      await createAdminClient()
        .from("notifications")
        .insert({ order_id: data.order_id, channel: "inapp", subject: "Задача исполнителя", message: text.replace(/<[^>]+>/g, ""), status: "sent" });
    }

    revalidatePath("/workspace");
    return { ok: true, message: parsed === "done" ? "Задача сдана менеджеру" : "Статус обновлён" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
