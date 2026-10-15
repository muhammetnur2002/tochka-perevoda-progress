"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/client/api";
import { isValidRuPhone, normalizePhone, phoneMask } from "@/lib/format/phone";

interface ProfileFormProps {
  initial: {
    name: string;
    phone: string;
    phoneVerified: boolean;
    email: string;
    telegram: string | null;
    telegramLinked: boolean;
  };
  botUsername: string | null;
}

/**
 * Профиль. Имя и пароль меняются сразу; телефон — только через SMS-код
 * (после подтверждения к аккаунту привязываются заказы, оформленные без входа).
 */
export function ProfileForm({ initial, botUsername }: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = React.useState(initial.name);
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [phone, setPhone] = React.useState(initial.phone ? phoneMask(initial.phone) : "");
  const [codeSent, setCodeSent] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [phoneBusy, setPhoneBusy] = React.useState(false);
  const phoneChanged = normalizePhone(phone) !== (initial.phone ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error("Укажите имя");
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Сессия истекла — войдите снова");
      const { error } = await supabase.from("users").update({ name: name.trim() }).eq("id", user.id);
      if (error) throw error;
      if (password) {
        if (password.length < 8) throw new Error("Пароль — минимум 8 символов");
        const { error: pwError } = await supabase.auth.updateUser({ password });
        if (pwError) throw pwError;
        setPassword("");
      }
      toast.success("Профиль сохранён");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const sendCode = async () => {
    if (!isValidRuPhone(phone)) return toast.error("Введите номер телефона РФ");
    setPhoneBusy(true);
    try {
      await apiFetch("/api/account/phone", { method: "POST", body: JSON.stringify({ phone }) });
      setCodeSent(true);
      toast.success("Код отправлен по SMS");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPhoneBusy(false);
    }
  };

  const confirmCode = async () => {
    setPhoneBusy(true);
    try {
      const r = await apiFetch<{ claimedOrders: number }>("/api/account/phone", {
        method: "PUT",
        body: JSON.stringify({ code }),
      });
      setCodeSent(false);
      setCode("");
      toast.success(r.claimedOrders > 0 ? `Телефон подтверждён. Привязано заказов: ${r.claimedOrders}` : "Телефон подтверждён");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPhoneBusy(false);
    }
  };

  return (
    <div className="grid max-w-3xl gap-5">
      <form onSubmit={save} className="grid gap-4 rounded-2xl border bg-card p-6 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Имя</Label>
          <Input id="name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" className="h-11" value={initial.email} disabled />
        </div>
        <div className="space-y-1.5">
          <Label>Telegram</Label>
          <div className="flex h-11 items-center rounded-md border bg-muted px-3 text-sm">
            {initial.telegramLinked ? `привязан${initial.telegram ? `: @${initial.telegram}` : ""}` : "не привязан"}
          </div>
          {!initial.telegramLinked && botUsername && (
            <a className="text-xs text-brand-500 underline" href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer">
              Открыть бота @{botUsername}
            </a>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Новый пароль</Label>
          <Input
            id="password"
            className="h-11"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="оставьте пустым, чтобы не менять"
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="justify-self-start" size="lg" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : "Сохранить"}
        </Button>
      </form>

      <section className="space-y-3 rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-bold text-brand-800">Телефон</h2>
        <p className="text-sm text-muted-foreground">
          На телефон приходят уведомления о заказах. После подтверждения кодом к кабинету привяжутся заказы,
          оформленные без входа на этот номер.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-56 space-y-1.5">
            <Label htmlFor="phone">Номер</Label>
            <Input
              id="phone"
              className="h-11"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => {
                setPhone(phoneMask(e.target.value));
                setCodeSent(false);
              }}
              placeholder="+7 (___) ___-__-__"
            />
          </div>
          {initial.phoneVerified && !phoneChanged ? (
            <span className="flex h-11 items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> подтверждён
            </span>
          ) : (
            <Button type="button" variant="outline" className="h-11" onClick={sendCode} disabled={phoneBusy}>
              {codeSent ? "Отправить код ещё раз" : "Получить код"}
            </Button>
          )}
        </div>
        {codeSent && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Код из SMS</Label>
              <Input
                id="code"
                className="h-11 w-40 tracking-[0.3em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <Button type="button" className="h-11" onClick={confirmCode} disabled={phoneBusy || code.length !== 6}>
              {phoneBusy ? <Loader2 className="animate-spin" /> : "Подтвердить"}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
