"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateClientAction } from "@/app/admin/actions";
import { isValidRuPhone, normalizePhone } from "@/lib/format/phone";

interface ClientEditFormProps {
  clientId: string;
  initial: { name: string; phone: string | null; email: string | null; inn: string | null; type: "individual" | "company" };
}

/** Редактирование карточки клиента менеджером. */
export function ClientEditForm({ clientId, initial }: ClientEditFormProps) {
  const router = useRouter();
  const [form, setForm] = React.useState({
    name: initial.name,
    phone: initial.phone ?? "",
    email: initial.email ?? "",
    inn: initial.inn ?? "",
    type: initial.type,
  });
  const [pending, start] = React.useTransition();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.phone && !isValidRuPhone(form.phone)) return toast.error("Телефон РФ в формате +7…");
    start(async () => {
      const r = await updateClientAction(clientId, {
        name: form.name.trim(),
        phone: form.phone ? normalizePhone(form.phone) : null,
        email: form.email.trim() || null,
        inn: form.inn.trim() || null,
        type: form.type,
      });
      if (r.ok) {
        toast.success(r.message ?? "Сохранено");
        router.refresh();
      } else toast.error(r.error);
    });
  };

  return (
    <form onSubmit={save} className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 className="font-bold text-brand-800">Данные клиента</h2>
      <div className="space-y-1">
        <Label htmlFor="c-name">Имя / организация</Label>
        <Input id="c-name" value={form.name} onChange={set("name")} required minLength={2} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="c-phone">Телефон</Label>
        <Input id="c-phone" value={form.phone} onChange={set("phone")} inputMode="tel" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="c-email">Email</Label>
        <Input id="c-email" type="email" value={form.email} onChange={set("email")} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="c-type">Тип</Label>
          <select id="c-type" value={form.type} onChange={set("type")} className="h-10 w-full rounded-md border bg-white px-2 text-sm">
            <option value="individual">Физ. лицо</option>
            <option value="company">Юр. лицо</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="c-inn">ИНН</Label>
          <Input id="c-inn" value={form.inn} onChange={set("inn")} inputMode="numeric" />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        Сохранить
      </Button>
    </form>
  );
}
