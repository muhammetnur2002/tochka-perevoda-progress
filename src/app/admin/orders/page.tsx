import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { KanbanBoard } from "@/components/admin/kanban-board";
import { ExportButton } from "@/components/admin/export-button";

export const metadata: Metadata = { title: "Заказы" };

export default async function AdminOrdersPage() {
  const t = await getTranslations("admin.kanban");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={<ExportButton type="orders" />} />
      <KanbanBoard />
    </>
  );
}
