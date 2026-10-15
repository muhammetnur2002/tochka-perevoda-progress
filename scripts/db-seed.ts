/**
 * Демо-данные для разработки: пользователи всех 7 ролей, клиенты, заказы
 * в разных статусах, назначения, платежи. Прайс (24 услуги), языки и настройки
 * засеваются миграцией 0007 — здесь не дублируются.
 *
 * Запуск: pnpm db:seed  (после pnpm db:push)
 * Идемпотентно: пользователей и демо-заказы не дублирует.
 * НЕ запускайте на продакшене: создаются учётные записи с известными паролями.
 */
import "./_env";
import { createClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "../src/types/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Не заданы NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local)");
  process.exit(1);
}
if (process.env.NODE_ENV === "production" && !process.argv.includes("--yes-i-know")) {
  console.error("Сид демо-данных на продакшене запрещён (добавьте --yes-i-know, если это стенд).");
  process.exit(1);
}

const admin = createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

interface DemoUser {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  phone: string;
}

/** Пароли — только для локальной разработки (см. README «Демо-доступы»). */
const DEMO_USERS: DemoUser[] = [
  { email: "admin@tochka.local", password: "Admin123!", role: "admin", name: "Администратор", phone: "79000000001" },
  { email: "manager@tochka.local", password: "Manager123!", role: "manager", name: "Менеджер Гульнара", phone: "79000000002" },
  { email: "translator@tochka.local", password: "Translator123!", role: "translator", name: "Переводчик Ирина", phone: "79000000003" },
  { email: "notary@tochka.local", password: "Notary123!", role: "notary", name: "Нотариус Галина", phone: "79000000004" },
  { email: "printer@tochka.local", password: "Printer123!", role: "printer", name: "Печать Алсу", phone: "79000000005" },
  { email: "client@tochka.local", password: "Client123!", role: "client", name: "Айгуль Сафина", phone: "79000000006" },
  { email: "client2@tochka.local", password: "Client123!", role: "client", name: "Бехруз Ахмадов", phone: "79000000007" },
];

async function ensureUser(u: DemoUser): Promise<string> {
  const { data: existing } = await admin.from("users").select("id").eq("email", u.email).maybeSingle();
  let id = existing?.id;

  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { name: u.name, phone: u.phone },
      app_metadata: { role: u.role },
    });
    if (error) throw new Error(`${u.email}: ${error.message}`);
    id = data.user.id;
    console.log(`  + ${u.email} (${u.role})`);
  } else {
    console.log(`  · ${u.email} — уже есть`);
  }

  // Роль и подтверждённый телефон выставляет сервер (service_role)
  const { error } = await admin
    .from("users")
    .update({ role: u.role, name: u.name, phone: u.phone, phone_verified_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return id;
}

async function serviceBySlug(slug: string) {
  const { data, error } = await admin.from("services").select("id, name, price").eq("slug", slug).single();
  if (error || !data) throw new Error(`Услуга ${slug} не найдена — сначала pnpm db:push`);
  return data;
}

async function languageId(code: string): Promise<string | null> {
  const { data } = await admin.from("languages").select("id").eq("code", code).maybeSingle();
  return data?.id ?? null;
}

async function clientIdFor(userId: string): Promise<string> {
  const { data } = await admin.from("clients").select("id").eq("user_id", userId).limit(1).maybeSingle();
  if (data) return data.id;
  throw new Error("Карточка клиента не создана триггером handle_new_user");
}

interface DemoOrder {
  clientUser: string;
  items: { slug: string; quantity: number }[];
  path: ("confirmed" | "in_progress" | "ready" | "issued" | "completed")[];
  paid: boolean;
  source: "web" | "mini_app" | "walkin";
  from: string;
  to: string;
  deadlineHours: number;
  comment?: string;
  assignTranslator?: boolean;
}

async function createDemoOrder(o: DemoOrder, ids: Map<string, string>) {
  const userId = ids.get(o.clientUser)!;
  const items = await Promise.all(o.items.map(async (i) => ({ ...(await serviceBySlug(i.slug)), quantity: i.quantity })));
  const subtotal = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      client_id: await clientIdFor(userId),
      user_id: userId,
      source: o.source,
      language_from: await languageId(o.from),
      language_to: await languageId(o.to),
      subtotal,
      total_price: subtotal,
      deadline: new Date(Date.now() + o.deadlineHours * 3_600_000).toISOString(),
      comment: o.comment ?? null,
    })
    .select("id, public_number")
    .single();
  if (error) throw error;

  await admin.from("order_items").insert(
    items.map((i) => ({
      order_id: order.id,
      service_id: i.id,
      name_snapshot: i.name,
      quantity: i.quantity,
      unit_price: Number(i.price),
      price: Number(i.price) * i.quantity,
    })),
  );
  await admin.from("consents").insert({ user_id: userId, order_id: order.id, doc_version: "1.0" });

  if (o.paid) {
    await admin.from("payments").insert({
      order_id: order.id,
      amount: subtotal,
      method: "sbp",
      status: "succeeded",
      provider: "mock",
      provider_payment_id: `seed-${order.id}`,
      idempotence_key: `seed-${order.id}`,
      paid_at: new Date().toISOString(),
    }); // триггер переведёт заказ в confirmed
  }
  for (const status of o.path) {
    if (status === "confirmed" && o.paid) continue;
    await admin.rpc("change_order_status", { p_order_id: order.id, p_status: status, p_comment: "демо-данные" });
  }
  if (o.assignTranslator) {
    await admin.from("order_assignments").insert({
      order_id: order.id,
      user_id: ids.get("translator@tochka.local")!,
      role: "translator",
      status: o.path.includes("ready") ? "done" : "in_progress",
      assigned_by: ids.get("manager@tochka.local")!,
      due_at: new Date(Date.now() + o.deadlineHours * 3_600_000).toISOString(),
    });
  }
  console.log(`  + ${order.public_number}: ${o.items.map((i) => i.slug).join(", ")} → ${o.path.at(-1) ?? "new"}`);
}

async function main() {
  console.log("Пользователи:");
  const ids = new Map<string, string>();
  for (const u of DEMO_USERS) ids.set(u.email, await ensureUser(u));

  const translatorId = ids.get("translator@tochka.local")!;
  const langs = (await Promise.all(["en", "uz", "tg", "de"].map(languageId))).filter((x): x is string => Boolean(x));
  await admin
    .from("translators")
    .upsert(
      { user_id: translatorId, languages: langs, specialization: "юридические, документы личного статуса", capacity_per_day: 5 },
      { onConflict: "user_id" },
    );

  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ids.get("client@tochka.local")!);
  if ((count ?? 0) > 0) {
    console.log("Демо-заказы уже созданы — пропуск.");
  } else {
    console.log("Заказы:");
    const orders: DemoOrder[] = [
      { clientUser: "client@tochka.local", items: [{ slug: "passport-all", quantity: 1 }], path: ["confirmed", "in_progress"], paid: true, source: "web", from: "uz", to: "ru", deadlineHours: 20, comment: "ФИО латиницей как в загранпаспорте", assignTranslator: true },
      { clientUser: "client@tochka.local", items: [{ slug: "diploma", quantity: 1 }, { slug: "diploma-stitching", quantity: 1 }], path: ["confirmed", "in_progress", "ready"], paid: true, source: "mini_app", from: "tg", to: "ru", deadlineHours: -80, assignTranslator: true },
      { clientUser: "client@tochka.local", items: [{ slug: "dms-student", quantity: 1 }], path: ["confirmed", "in_progress", "ready", "issued", "completed"], paid: true, source: "walkin", from: "ru", to: "ru", deadlineHours: -240 },
      { clientUser: "client2@tochka.local", items: [{ slug: "legal", quantity: 12 }], path: [], paid: false, source: "web", from: "en", to: "ru", deadlineHours: 44 },
      { clientUser: "client2@tochka.local", items: [{ slug: "photo", quantity: 1 }, { slug: "laminating", quantity: 2 }], path: ["confirmed"], paid: false, source: "walkin", from: "ru", to: "ru", deadlineHours: 6 },
    ];
    for (const o of orders) await createDemoOrder(o, ids);
  }

  console.log("\nГотово. Демо-доступы (только для разработки):");
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(10)} ${u.email} / ${u.password}`);
}

main().catch((err) => {
  console.error("Ошибка сида:", err instanceof Error ? err.message : err);
  process.exit(1);
});
