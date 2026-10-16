import type { OrderStatus, UserRole } from "@/types/database.types";

/**
 * Матрица ролей и переходов статусов (зеркало RLS-политик в 0004_rls_policies.sql).
 * Используется в UI (что показывать) и в API (что разрешать) — финальную проверку
 * всё равно делает база через RLS.
 */

export const MANAGER_ROLES: readonly UserRole[] = ["manager", "admin"];
export const EXECUTOR_ROLES: readonly UserRole[] = ["translator", "notary", "printer"];
export const STAFF_ROLES: readonly UserRole[] = [...MANAGER_ROLES, ...EXECUTOR_ROLES];

export const ROLE_LABELS: Record<UserRole, string> = {
  guest: "Гость",
  client: "Клиент",
  manager: "Менеджер",
  translator: "Переводчик",
  notary: "Нотариус",
  printer: "Печатник",
  admin: "Администратор",
};

export function isManagerRole(role: UserRole | null | undefined): boolean {
  return !!role && MANAGER_ROLES.includes(role);
}

export function isExecutorRole(role: UserRole | null | undefined): boolean {
  return !!role && EXECUTOR_ROLES.includes(role);
}

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

/** Домашняя страница по роли (редирект после входа). */
export function homePathForRole(role: UserRole | null | undefined): string {
  if (isManagerRole(role)) return "/admin";
  if (isExecutorRole(role)) return "/workspace";
  return "/account";
}

/**
 * Допустимые переходы статуса заказа. Менеджер может двигать заказ вперёд на
 * любой шаг, на один шаг назад (ошибка в канбане) и отменять незавершённый заказ.
 */
const FLOW: OrderStatus[] = ["new", "confirmed", "in_progress", "ready", "issued", "completed"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (to === "cancelled") return from !== "completed" && from !== "cancelled";
  if (from === "cancelled") return to === "new";
  const a = FLOW.indexOf(from);
  const b = FLOW.indexOf(to);
  if (a < 0 || b < 0) return false;
  return b > a || b === a - 1;
}

/** Действия над заказом и роли, которым они разрешены. */
export type Permission =
  | "order.view_all"
  | "order.change_status"
  | "order.assign"
  | "order.view_payments"
  | "service.edit"
  | "settings.edit"
  | "promo.manage"
  | "payment.manage"
  | "audit.view"
  | "user.change_role"
  | "task.update_own";

const PERMISSIONS: Record<Permission, readonly UserRole[]> = {
  "order.view_all": MANAGER_ROLES,
  "order.change_status": MANAGER_ROLES,
  "order.assign": MANAGER_ROLES,
  "order.view_payments": MANAGER_ROLES,
  "service.edit": MANAGER_ROLES,
  "settings.edit": MANAGER_ROLES,
  "promo.manage": MANAGER_ROLES,
  "payment.manage": MANAGER_ROLES,
  "audit.view": ["admin"],
  "user.change_role": ["admin"],
  "task.update_own": EXECUTOR_ROLES,
};

export function can(role: UserRole | null | undefined, permission: Permission): boolean {
  return !!role && PERMISSIONS[permission].includes(role);
}
