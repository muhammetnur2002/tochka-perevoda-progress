import { redirect } from "next/navigation";

/** Прямая ссылка на задачу (например, из уведомления) — открывает её на рабочем месте. */
export default function WorkspaceTaskPage({ params }: { params: { id: string } }) {
  redirect(`/workspace?task=${encodeURIComponent(params.id)}`);
}
