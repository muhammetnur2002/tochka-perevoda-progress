/**
 * Проверки входящих уведомлений ЮKassa.
 * Источник адресов: https://yookassa.ru/developers/using-api/webhooks#ip
 * Список можно переопределить через YOOKASSA_WEBHOOK_IPS (через запятую, CIDR или IP).
 */
export const YOOKASSA_IP_RANGES = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11/32",
  "77.75.156.35/32",
  "77.75.154.128/25",
  "2a02:5180::/32",
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function expandIpv6(ip: string): number[] | null {
  const [head, tail] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  if (tail === undefined && h.length !== 8) return null;
  const groups = [...h, ...Array(8 - h.length - t.length).fill("0"), ...t];
  if (groups.length !== 8) return null;
  const out = groups.map((g) => parseInt(g || "0", 16));
  return out.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff) ? null : out;
}

/** Входит ли IP в CIDR-диапазон (IPv4 или IPv6). */
export function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split("/");
  if (!range) return false;
  const clean = ip.replace(/^::ffff:/, "");

  if (range.includes(".")) {
    const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
    const a = ipv4ToInt(clean);
    const b = ipv4ToInt(range);
    if (a === null || b === null) return false;
    if (bits === 0) return true;
    const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
    return ((a & mask) >>> 0) === ((b & mask) >>> 0);
  }

  const bits = bitsRaw === undefined ? 128 : Number(bitsRaw);
  const a = expandIpv6(clean);
  const b = expandIpv6(range);
  if (!a || !b) return false;
  let remaining = bits;
  for (let i = 0; i < 8 && remaining > 0; i++) {
    const take = Math.min(16, remaining);
    const mask = (0xffff << (16 - take)) & 0xffff;
    if (((a[i] ?? 0) & mask) !== ((b[i] ?? 0) & mask)) return false;
    remaining -= take;
  }
  return true;
}

/** Разрешён ли IP отправителя вебхука. */
export function isYookassaIp(ip: string | null, overrides = process.env.YOOKASSA_WEBHOOK_IPS): boolean {
  if (!ip) return false;
  const list = overrides
    ? overrides.split(",").map((s) => s.trim()).filter(Boolean)
    : YOOKASSA_IP_RANGES;
  return list.some((cidr) => ipInCidr(ip, cidr));
}

export interface YookassaNotification {
  type?: string;
  event?: string;
  object?: { id?: string; status?: string };
}

/** Достаёт id платежа из уведомления (payment.* события). */
export function parseNotification(body: unknown): { paymentId: string; event: string } | null {
  if (!body || typeof body !== "object") return null;
  const n = body as YookassaNotification;
  if (typeof n.event !== "string" || !n.event.startsWith("payment.")) return null;
  const id = n.object?.id;
  if (typeof id !== "string" || !/^[\w-]{10,64}$/.test(id)) return null;
  return { paymentId: id, event: n.event };
}
