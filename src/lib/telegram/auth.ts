import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateInitData } from "./init-data";

export interface TelegramAuthResult {
  userId: string;
  accessToken: string;
  refreshToken: string;
  isNew: boolean;
}

/**
 * Аутентификация пользователя Telegram Mini App:
 * валидирует initData (HMAC), создаёт/находит пользователя и выдаёт сессию Supabase.
 */
export async function signInTelegramUser(initData: string): Promise<TelegramAuthResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN не задан");

  const { valid, user } = validateInitData(initData, token);
  if (!valid || !user) throw new Error("Недействительные данные Telegram");

  const admin = createAdminClient();
  const telegramId = user.id;
  const fallbackEmail = `tg_${telegramId}@telegram.local`;

  // Ищем существующего пользователя по telegram_id
  const { data: existing } = await admin
    .from("users")
    .select("id, email")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  let userId = existing?.id;
  const email = existing?.email ?? fallbackEmail;
  let isNew = false;

  if (!userId) {
    try {
      const { data, error } = await admin.auth.admin.createUser({
        email: fallbackEmail,
        email_confirm: true,
        user_metadata: {
          telegram_id: telegramId,
          telegram_username: user.username ?? null,
          name: [user.first_name, user.last_name].filter(Boolean).join(" ") || "Клиент Telegram",
          role: "client",
        },
      });
      if (error) throw error;
      userId = data.user.id;
      isNew = true;
    } catch (err) {
      // Возможно, auth-пользователь уже существует (повторный вызов)
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list.users.find((u) => u.email === fallbackEmail);
      if (!found) throw err;
      userId = found.id;
      // Синхронизируем telegram_id в профиле
      await admin
        .from("users")
        .upsert({ id: userId, telegram_id: telegramId, role: "client" }, { onConflict: "id" });
    }
  }

  // Выпуск сессии через magic link (серверная эмиссия без пароля)
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;

  const tokenHash = new URL(linkData.properties.action_link).searchParams.get("token_hash");
  if (!tokenHash) throw new Error("Не удалось получить токен сессии");

  const { data: verifyData, error: verifyErr } = await admin.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (verifyErr) throw verifyErr;
  if (!verifyData.session) throw new Error("Supabase не вернул сессию");

  return {
    userId,
    accessToken: verifyData.session.access_token,
    refreshToken: verifyData.session.refresh_token,
    isNew,
  };
}
