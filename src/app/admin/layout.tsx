import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: { default: "CRM", template: "%s · CRM «Точка Перевода»" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(MANAGER_ROLES, "/admin");
  return (
    <AdminShell user={{ name: profile.name ?? profile.email ?? "Менеджер", role: profile.role }}>{children}</AdminShell>
  );
}
