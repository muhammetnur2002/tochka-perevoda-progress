"use client";

/**
 * Клиентские помощники для обращения к /api/*: единая обработка ошибок и
 * хранение токенов гостевого доступа к заказам (выдаются при оформлении).
 */

export class ClientApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(input: string, init: RequestInit & { orderToken?: string | null } = {}): Promise<T> {
  const { orderToken, headers, ...rest } = init;
  const res = await fetch(input, {
    ...rest,
    headers: {
      ...(rest.body && !(rest.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(orderToken ? { "x-order-token": orderToken } : {}),
      ...headers,
    },
  });
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: { message?: string; code?: string } })
    | null;
  if (!res.ok) {
    throw new ClientApiError(
      data?.error?.message ?? (res.status === 429 ? "Слишком много запросов, попробуйте позже" : "Ошибка запроса"),
      res.status,
      data?.error?.code,
    );
  }
  return data as T;
}

const TOKENS_KEY = "tp-order-tokens";

type TokenMap = Record<string, { token: string; number: string; at: number }>;

function readTokens(): TokenMap {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? "{}") as TokenMap;
  } catch {
    return {};
  }
}

/** Сохраняет токен доступа к заказу (на 24 часа — столько живёт токен). */
export function saveOrderToken(orderId: string, token: string, publicNumber: string): void {
  try {
    const map = readTokens();
    const now = Date.now();
    for (const [id, v] of Object.entries(map)) if (now - v.at > 86_400_000) delete map[id];
    map[orderId] = { token, number: publicNumber, at: now };
    localStorage.setItem(TOKENS_KEY, JSON.stringify(map));
  } catch {
    /* приватный режим — токен останется только в URL */
  }
}

export function getOrderToken(orderId: string): string | null {
  return readTokens()[orderId]?.token ?? null;
}

/** Номер заказа, сохранённый вместе с токеном. */
export function getOrderNumber(orderId: string): string | null {
  return readTokens()[orderId]?.number ?? null;
}

/** Загрузка одного файла к заказу. */
export async function uploadOrderFile(
  orderId: string,
  file: File,
  opts: { token?: string | null; kind?: string } = {},
): Promise<{ file: { id: string; original_name: string } }> {
  const fd = new FormData();
  fd.append("orderId", orderId);
  fd.append("file", file);
  if (opts.kind) fd.append("kind", opts.kind);
  return apiFetch("/api/upload", { method: "POST", body: fd, orderToken: opts.token });
}

/** Открывает подписанную ссылку на файл (TTL 5 минут). */
export async function openFile(fileId: string, token?: string | null): Promise<void> {
  const data = await apiFetch<{ url: string }>(`/api/files/${fileId}/url`, { orderToken: token });
  window.open(data.url, "_blank", "noopener,noreferrer");
}
