import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { ExportButton } from "@/components/admin/export-button";
import { PeriodSwitch, parseDays } from "@/components/admin/period-switch";
import { ReportsCharts } from "@/components/admin/reports-charts";
import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/services/reports";

export const metadata: Metadata = { title: "Отчёты" };
export const dynamic = "force-dynamic";

export default async function AdminReportsPage({ searchParams }: { searchParams: { days?: string } }) {
  const days = parseDays(searchParams.days);
  const stats = await getDashboardStats(createClient(), days);
  return (
    <>
      <PageHeader
        title="Отчёты"
        description="Популярные услуги и языки, загрузка по дням и исполнителям"
        actions={
          <>
            <PeriodSwitch path="/admin/reports" days={days} />
            <ExportButton type="orders" />
          </>
        }
      />
      <ReportsCharts stats={stats} />
    </>
  );
}
