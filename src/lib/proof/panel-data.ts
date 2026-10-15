import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, ProofCommentRow, ProofEventRow, ProofRow } from "@/types/database.types";

/** Замечание клиента в панели сотрудника. */
export type ProofPanelComment = Pick<ProofCommentRow, "id" | "page" | "field_id" | "proposed_value" | "body" | "created_at">;

/** Версия перевода для панели: без путей к файлам. */
export type ProofPanelProof = Pick<
  ProofRow,
  "id" | "version" | "status" | "note" | "key_fields" | "page_count" | "created_at" | "decided_at"
> & { decision: Json | null; comments: ProofPanelComment[] };

/** Событие журнала (видно только менеджерам). */
export type ProofPanelEvent = Pick<
  ProofEventRow,
  "id" | "proof_id" | "event" | "actor_role" | "ip" | "user_agent" | "meta" | "created_at"
>;

export interface ProofPanelData {
  proofs: ProofPanelProof[];
  events: ProofPanelEvent[];
}

/**
 * Версии перевода заказа (новые первыми) с замечаниями клиента и, для менеджеров,
 * журналом событий. Читает через клиент пользователя — доступ ограничивает RLS.
 */
export async function loadProofPanelData(
  supabase: SupabaseClient<Database>,
  orderId: string,
  withEvents: boolean,
): Promise<ProofPanelData> {
  const [proofsRes, eventsRes] = await Promise.all([
    supabase
      .from("proofs")
      .select(
        "id, version, status, note, key_fields, page_count, created_at, decided_at, decision, comments:proof_comments(id, page, field_id, proposed_value, body, created_at)",
      )
      .eq("order_id", orderId)
      .order("version", { ascending: false }),
    withEvents
      ? supabase
          .from("proof_events")
          .select("id, proof_id, event, actor_role, ip, user_agent, meta, created_at")
          .eq("order_id", orderId)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as ProofPanelEvent[] }),
  ]);

  const proofs = (proofsRes.data ?? []).map((p) => ({
    ...p,
    comments: [...(p.comments ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  })) as ProofPanelProof[];
  return { proofs, events: (eventsRes.data ?? []) as ProofPanelEvent[] };
}
