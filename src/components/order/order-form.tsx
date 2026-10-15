"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FileDropzone } from "./file-dropzone";
import { useCart } from "@/components/cart/cart-provider";
import { useCatalog } from "@/hooks/use-catalog";
import { isValidRuPhone, phoneMask } from "@/lib/format/phone";
import { apiFetch, saveOrderToken, uploadOrderFile } from "@/lib/client/api";
import { cn } from "@/lib/utils";

const PAY_METHODS = [
  { id: "sbp", label: "СБП", hint: "через приложение банка" },
  { id: "qr", label: "QR-код", hint: "сканируйте камерой" },
  { id: "card", label: "Банковская карта", hint: "Мир, Visa, Mastercard" },
] as const;

/** Клиентская схема формы (сервер повторно валидирует createOrderSchema). */
const formSchema = z
  .object({
    name: z.string().trim().min(2, "Укажите имя").max(120),
    phone: z.string().refine(isValidRuPhone, "Введите номер телефона РФ"),
    email: z.string().trim().email("Некорректный email").or(z.literal("")),
    telegram: z.string().trim().max(64),
    type: z.enum(["individual", "company"]),
    inn: z.string().trim().max(12),
    languageFrom: z.string(),
    languageTo: z.string(),
    deliveryAddress: z.string().trim().max(300),
    comment: z.string().trim().max(1000),
    payMethod: z.enum(["sbp", "qr", "card"]),
    consent: z.boolean().refine((v) => v, "Без согласия на обработку данных оформить заказ нельзя"),
  });

type FormValues = z.infer<typeof formSchema>;

interface CreateOrderResponse {
  orderId: string;
  publicNumber: string;
  totalPrice: number;
  accessToken: string;
}

interface OrderFormProps {
  source?: "web" | "mini_app";
  defaults?: Partial<Pick<FormValues, "name" | "phone" | "email">>;
  /** Куда вести после создания (по умолчанию — страница оплаты сайта). */
  onCreated?: (r: CreateOrderResponse & { payMethod: FormValues["payMethod"] }) => void;
}

export function OrderForm({ source = "web", defaults, onCreated }: OrderFormProps) {
  const router = useRouter();
  const { items, options, clear, setDeliveryAddress } = useCart();
  const { data: catalog } = useCatalog();
  const languages = catalog?.languages ?? [];
  const [files, setFiles] = React.useState<File[]>([]);
  const [stage, setStage] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaults?.name ?? "",
      phone: defaults?.phone ? phoneMask(defaults.phone) : "",
      email: defaults?.email ?? "",
      telegram: "",
      type: "individual",
      inn: "",
      languageFrom: options.languageFrom ?? "",
      languageTo: options.languageTo ?? "",
      deliveryAddress: options.deliveryAddress ?? "",
      comment: "",
      payMethod: "sbp",
      consent: false,
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (stage) return; // защита от двойной отправки (две кнопки: мобильная и в итоге)
    if (options.deliveryType === "delivery" && !values.deliveryAddress) {
      form.setError("deliveryAddress", { message: "Укажите адрес доставки" });
      return;
    }
    try {
      setStage("Оформляем заказ…");
      const order = await apiFetch<CreateOrderResponse>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          phone: values.phone,
          email: values.email || null,
          telegram: values.telegram || null,
          type: values.type,
          inn: values.type === "company" ? values.inn || null : null,
          items: items.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity })),
          urgency: options.urgency,
          languageFrom: values.languageFrom || null,
          languageTo: values.languageTo || null,
          deliveryType: options.deliveryType,
          deliveryAddress: options.deliveryType === "delivery" ? values.deliveryAddress : null,
          comment: values.comment || null,
          notaryRequested: options.notaryRequested,
          consent: values.consent,
          source,
        }),
      });
      saveOrderToken(order.orderId, order.accessToken, order.publicNumber);

      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        setStage(`Загружаем файлы: ${i + 1} из ${files.length}`);
        try {
          await uploadOrderFile(order.orderId, file, { token: order.accessToken });
        } catch (err) {
          toast.warning(`Файл «${file.name}» не загружен: ${(err as Error).message}. Его можно отправить позже.`);
        }
      }

      clear();
      if (onCreated) onCreated({ ...order, payMethod: values.payMethod });
      else router.push(`/checkout/pay/${order.orderId}?method=${values.payMethod}`);
    } catch (err) {
      toast.error((err as Error).message);
      setStage(null);
    }
  };

  if (items.length === 0 && !stage) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed p-12 text-center">
        <p className="text-muted-foreground">Корзина пуста — выберите услуги.</p>
        <Button asChild variant="gold">
          <Link href="/calculator">Перейти к калькулятору</Link>
        </Button>
      </div>
    );
  }

  const isDelivery = options.deliveryType === "delivery";

  return (
    <Form {...form}>
      <form id="order-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
          <h2 className="text-lg font-bold text-brand-800 sm:col-span-2">Контакты</h2>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Имя *</FormLabel>
                <FormControl>
                  <Input autoComplete="name" placeholder="Как к вам обращаться" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Телефон *</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+7 (___) ___-__-__"
                    className="h-11"
                    {...field}
                    onChange={(e) => field.onChange(phoneMask(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" placeholder="для чека и уведомлений" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="telegram"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telegram</FormLabel>
                <FormControl>
                  <Input placeholder="@username" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {(["languageFrom", "languageTo"] as const).map((name) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{name === "languageFrom" ? "Язык оригинала" : "Язык перевода"}</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                      {...field}
                    >
                      <option value="">Не важно / уточню</option>
                      {languages.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                </FormItem>
              )}
            />
          ))}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <div className="flex flex-wrap gap-4 text-sm">
                  {(["individual", "company"] as const).map((t) => (
                    <label key={t} className="flex min-h-11 cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="client-type"
                        checked={field.value === t}
                        onChange={() => field.onChange(t)}
                        className="h-4 w-4 accent-brand-800"
                      />
                      {t === "individual" ? "Физическое лицо" : "Организация (счёт, ИНН)"}
                    </label>
                  ))}
                </div>
              </FormItem>
            )}
          />
          {form.watch("type") === "company" && (
            <FormField
              control={form.control}
              name="inn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ИНН</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" placeholder="10 или 12 цифр" className="h-11" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {isDelivery && (
            <FormField
              control={form.control}
              name="deliveryAddress"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Адрес доставки *</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="street-address"
                      placeholder="Город, улица, дом, квартира"
                      className="h-11"
                      {...field}
                      onBlur={() => setDeliveryAddress(field.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="comment"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Комментарий</FormLabel>
                <FormControl>
                  <Textarea placeholder="Например: имена латиницей как в загранпаспорте" rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-bold text-brand-800">Файлы документов</h2>
          <FileDropzone files={files} onChange={setFiles} />
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-bold text-brand-800">Способ оплаты</h2>
          <FormField
            control={form.control}
            name="payMethod"
            render={({ field }) => (
              <div className="grid gap-2.5 sm:grid-cols-3">
                {PAY_METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={field.value === m.id}
                    onClick={() => field.onChange(m.id)}
                    className={cn(
                      "flex min-h-16 flex-col items-start gap-0.5 rounded-xl p-3 text-left text-brand-800",
                      field.value === m.id ? "border-2 border-gold-400 bg-gold-50" : "border border-input bg-background",
                    )}
                  >
                    <strong>{m.label}</strong>
                    <span className="text-xs text-muted-foreground">{m.hint}</span>
                  </button>
                ))}
              </div>
            )}
          />
        </section>

        <FormField
          control={form.control}
          name="consent"
          render={({ field }) => (
            <FormItem className="rounded-2xl border bg-card p-5">
              <div className="flex items-start gap-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    className="mt-0.5 h-5 w-5"
                    aria-describedby="consent-text"
                  />
                </FormControl>
                <span id="consent-text" className="text-sm leading-relaxed text-slate-700">
                  Я даю{" "}
                  <Link href="/legal/consent" target="_blank" className="text-brand-500 underline">
                    согласие на обработку персональных данных
                  </Link>{" "}
                  в соответствии с 152-ФЗ, ознакомлен(а) с{" "}
                  <Link href="/legal/privacy" target="_blank" className="text-brand-500 underline">
                    политикой конфиденциальности
                  </Link>{" "}
                  и принимаю{" "}
                  <Link href="/legal/terms" target="_blank" className="text-brand-500 underline">
                    условия оказания услуг
                  </Link>
                  .
                </span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" variant="gold" size="xl" className="w-full lg:hidden" disabled={!!stage}>
          {stage ? (
            <>
              <Loader2 className="animate-spin" /> {stage}
            </>
          ) : (
            "Перейти к оплате"
          )}
        </Button>
      </form>
    </Form>
  );
}

/** Кнопка отправки для боковой колонки (связана с формой через form="order-form"). */
export function OrderSubmitButton({ busy }: { busy?: boolean }) {
  return (
    <Button type="submit" form="order-form" variant="gold" size="xl" className="hidden w-full lg:inline-flex" disabled={busy}>
      Перейти к оплате
    </Button>
  );
}
