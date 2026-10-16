"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { LanguagePairPicker, OfficePicker } from "./placement-pickers";
import { PaymentModePicker } from "./payment-mode-picker";
import { useCart } from "@/components/cart/cart-provider";
import { isValidRuPhone, phoneMask } from "@/lib/format/phone";
import { apiFetch, saveOrderToken, uploadOrderFile } from "@/lib/client/api";
import { cn } from "@/lib/utils";

const PAY_METHODS = ["sbp", "qr", "card"] as const;

function buildSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(2, t("errors.name")).max(120),
    phone: z.string().refine(isValidRuPhone, t("errors.phone")),
    email: z.string().trim().email(t("errors.email")).or(z.literal("")),
    telegram: z.string().trim().max(64),
    type: z.enum(["individual", "company"]),
    inn: z.string().trim().max(12),
    deliveryAddress: z.string().trim().max(300),
    comment: z.string().trim().max(1000),
    payMethod: z.enum(PAY_METHODS),
    consent: z.boolean().refine((v) => v, t("errors.consent")),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

interface CreateOrderResponse {
  orderId: string;
  publicNumber: string;
  totalPrice: number;
  accessToken: string;
}

interface OrderFormProps {
  source?: "web" | "mini_app";
  defaults?: Partial<Pick<FormValues, "name" | "phone" | "email">>;
  onCreated?: (r: CreateOrderResponse & { payMethod: FormValues["payMethod"] }) => void;
}

export function OrderForm({ source = "web", defaults, onCreated }: OrderFormProps) {
  const t = useTranslations("checkout");
  const tp = useTranslations("payment");
  const router = useRouter();
  const { items, options, clear, setDeliveryAddress } = useCart();
  const [files, setFiles] = React.useState<File[]>([]);
  const [stage, setStage] = React.useState<string | null>(null);
  const [placementErrors, setPlacementErrors] = React.useState<{ office?: string; language?: string }>({});
  const schema = React.useMemo(() => buildSchema(t), [t]);
  const needsLanguage = items.some((i) => i.category === "translation");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaults?.name ?? "",
      phone: defaults?.phone ? phoneMask(defaults.phone) : "",
      email: defaults?.email ?? "",
      telegram: "",
      type: "individual",
      inn: "",
      deliveryAddress: options.deliveryAddress ?? "",
      comment: "",
      payMethod: "sbp",
      consent: false,
    },
  });

  // Ошибки выбора точки и языка снимаются, как только клиент их выбрал
  React.useEffect(() => {
    setPlacementErrors((e) => ({
      office: options.officeId ? undefined : e.office,
      language: options.languageFrom ? undefined : e.language,
    }));
  }, [options.officeId, options.languageFrom]);

  const onSubmit = async (values: FormValues) => {
    if (stage) return; // защита от двойной отправки
    const errors = {
      office: options.officeId ? undefined : t("errors.office"),
      language: needsLanguage && !options.languageFrom ? t("errors.language") : undefined,
    };
    setPlacementErrors(errors);
    if (errors.office || errors.language) {
      document.getElementById("placement")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (options.deliveryType === "delivery" && !values.deliveryAddress) {
      form.setError("deliveryAddress", { message: t("errors.address") });
      return;
    }
    try {
      setStage(t("stageCreating"));
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
          languageFrom: needsLanguage ? options.languageFrom : null,
          officeId: options.officeId,
          promoCode: options.promoCode,
          paymentMode: options.paymentMode,
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
        setStage(t("stageUploading", { current: i + 1, total: files.length }));
        try {
          await uploadOrderFile(order.orderId, file, { token: order.accessToken });
        } catch (err) {
          toast.warning(t("fileFailed", { name: file.name, error: (err as Error).message }));
        }
      }

      clear();
      if (onCreated) onCreated({ ...order, payMethod: values.payMethod });
      else if (options.paymentMode === "office") {
        // оплата в точке: онлайн ничего не платим, показываем, куда и сколько принести
        router.push(`/checkout/success/${encodeURIComponent(order.publicNumber)}?order=${order.orderId}&office=1`);
      } else router.push(`/checkout/pay/${order.orderId}?method=${values.payMethod}`);
    } catch (err) {
      toast.error((err as Error).message);
      setStage(null);
    }
  };

  if (items.length === 0 && !stage) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed p-12 text-center">
        <p className="text-muted-foreground">{t("emptyCart")}</p>
        <Button asChild variant="gold">
          <Link href="/calculator">{t("toCalculator")}</Link>
        </Button>
      </div>
    );
  }

  const isDelivery = options.deliveryType === "delivery";

  return (
    <Form {...form}>
      <form id="order-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <section id="placement" className="grid gap-5 rounded-2xl border bg-card p-5 lg:grid-cols-2">
          <OfficePicker error={placementErrors.office} />
          {needsLanguage && <LanguagePairPicker error={placementErrors.language} />}
        </section>

        <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
          <h2 className="text-lg font-bold text-brand-800 sm:col-span-2">{t("contacts")}</h2>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("name")}</FormLabel>
                <FormControl>
                  <Input autoComplete="name" placeholder={t("namePlaceholder")} className="h-11" {...field} />
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
                <FormLabel>{t("phone")}</FormLabel>
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
                <FormLabel>{t("email")}</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" placeholder={t("emailPlaceholder")} className="h-11" {...field} />
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
                <FormLabel>{t("telegram")}</FormLabel>
                <FormControl>
                  <Input placeholder="@username" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <div className="flex flex-wrap gap-4 text-sm" role="radiogroup">
                  {(["individual", "company"] as const).map((v) => (
                    <label key={v} className="flex min-h-11 cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="client-type"
                        value={v}
                        checked={field.value === v}
                        onChange={() => field.onChange(v)}
                        className="h-4 w-4 accent-brand-800"
                      />
                      {t(v)}
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
                  <FormLabel>{t("inn")}</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" placeholder={t("innPlaceholder")} className="h-11" {...field} />
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
                  <FormLabel>{t("deliveryAddress")}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="street-address"
                      placeholder={t("deliveryAddressPlaceholder")}
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
                <FormLabel>{t("comment")}</FormLabel>
                <FormControl>
                  <Textarea placeholder={t("commentPlaceholder")} rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-bold text-brand-800">{t("files")}</h2>
          <FileDropzone files={files} onChange={setFiles} />
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-bold text-brand-800">{tp("modeTitle")}</h2>
          <PaymentModePicker />
        </section>

        {options.paymentMode === "online" && (
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-bold text-brand-800">{t("payMethod")}</h2>
          <FormField
            control={form.control}
            name="payMethod"
            render={({ field }) => (
              <div className="grid gap-2.5 sm:grid-cols-3">
                {PAY_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={field.value === m}
                    onClick={() => field.onChange(m)}
                    className={cn(
                      "flex min-h-16 flex-col items-start gap-0.5 rounded-xl p-3 text-left text-brand-800",
                      field.value === m ? "border-2 border-gold-400 bg-gold-50" : "border border-input bg-background",
                    )}
                  >
                    <strong>{tp(m)}</strong>
                    <span className="text-xs text-muted-foreground">{tp(`${m}Hint`)}</span>
                  </button>
                ))}
              </div>
            )}
          />
        </section>
        )}

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
                  {t("consentPrefix")}{" "}
                  <Link href="/legal/consent" target="_blank" className="text-brand-500 underline">
                    {t("consentLink")}
                  </Link>{" "}
                  {t("consentMiddle")}{" "}
                  <Link href="/legal/privacy" target="_blank" className="text-brand-500 underline">
                    {t("privacyLink")}
                  </Link>{" "}
                  {t("consentAnd")}{" "}
                  <Link href="/legal/terms" target="_blank" className="text-brand-500 underline">
                    {t("termsLink")}
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
          ) : options.paymentMode === "office" ? (
            tp("submitOffice")
          ) : (
            t("submit")
          )}
        </Button>
      </form>
    </Form>
  );
}

/** Кнопка отправки для боковой колонки (связана с формой через form="order-form"). */
export function OrderSubmitButton() {
  const t = useTranslations("checkout");
  const tp = useTranslations("payment");
  const { options } = useCart();
  return (
    <Button type="submit" form="order-form" variant="gold" size="xl" className="hidden w-full lg:inline-flex">
      {options.paymentMode === "office" ? tp("submitOffice") : t("submit")}
    </Button>
  );
}
