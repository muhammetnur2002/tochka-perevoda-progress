import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { KanbanBoard } from "@/components/admin/kanban-board";
import { ExportButton } from "@/components/admin/export-button";

export const metadata: Metadata = { title: "Заказы" };

export default function AdminOrdersPage() {
  return (
    <>
      <PageHeader title="Заказы" description="Канбан: новые → подтверждены → в работе → готовы → выданы → завершены" actions={<ExportButton type="orders" />} />
      <KanbanBoard />
    </>
  );
}
