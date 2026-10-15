import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { ProfileForm } from "./profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("metaProfile") };
}
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await requireUser("/account/profile");
  return (
    <ProfileForm
      initial={{
        name: profile.name ?? "",
        phone: profile.phone ?? "",
        phoneVerified: Boolean(profile.phone_verified_at),
        email: profile.email ?? "",
        telegram: profile.telegram_username ?? null,
        telegramLinked: Boolean(profile.telegram_id),
      }}
      botUsername={process.env.TELEGRAM_BOT_USERNAME ?? null}
    />
  );
}
