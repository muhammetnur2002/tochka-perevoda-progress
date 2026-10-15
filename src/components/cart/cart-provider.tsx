"use client";

import * as React from "react";
import type { DeliveryType, ServiceRow } from "@/types/database.types";
import type { CartItem, UrgencyKey } from "@/types/domain";

export interface CartOptions {
  urgency: UrgencyKey;
  notaryRequested: boolean;
  deliveryType: DeliveryType;
  deliveryAddress: string | null;
  languageFrom: string | null;
  languageTo: string | null;
}

interface CartState extends CartOptions {
  items: CartItem[];
}

interface CartContextValue {
  items: CartItem[];
  options: CartOptions;
  itemsCount: number;
  /** true после чтения корзины из localStorage (до этого — пустая, как на сервере). */
  hydrated: boolean;
  addItem: (service: ServiceRow, quantity?: number) => void;
  /** Заменяет состав корзины (повтор заказа). */
  replaceItems: (items: CartItem[]) => void;
  removeItem: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  setUrgency: (u: UrgencyKey) => void;
  setNotaryRequested: (v: boolean) => void;
  setDeliveryType: (v: DeliveryType) => void;
  setDeliveryAddress: (v: string) => void;
  setLanguageFrom: (v: string | null) => void;
  setLanguageTo: (v: string | null) => void;
  resetOptions: () => void;
}

const CartContext = React.createContext<CartContextValue | null>(null);

const STORAGE_KEY = "tp-progress-cart";

const DEFAULT_OPTIONS: CartOptions = {
  urgency: "standard",
  notaryRequested: false,
  deliveryType: "pickup",
  deliveryAddress: null,
  languageFrom: null,
  languageTo: null,
};

const EMPTY_STATE: CartState = { items: [], ...DEFAULT_OPTIONS };

function loadState(): CartState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CartState>;
      return {
        ...EMPTY_STATE,
        ...parsed,
        items: Array.isArray(parsed.items) ? parsed.items.filter((i) => i && i.quantity > 0) : [],
      };
    }
  } catch {
    /* повреждённые данные — начинаем с пустой корзины */
  }
  return EMPTY_STATE;
}

export function serviceToCartItem(service: ServiceRow, quantity = 1): CartItem {
  return {
    key: service.slug,
    serviceId: service.id,
    slug: service.slug,
    name: service.name,
    category: service.category,
    unit: service.unit,
    unitPrice: Number(service.price),
    quantity,
    isNotarial: service.is_notarial,
    durationDays: service.duration_days,
    meta: {},
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Корзина читается после монтирования — разметка SSR и первого рендера совпадает
  const [state, setState] = React.useState<CartState>(EMPTY_STATE);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* приватный режим */
    }
  }, [state, hydrated]);

  const value = React.useMemo<CartContextValue>(() => {
    const setItems = (updater: (items: CartItem[]) => CartItem[]) =>
      setState((s) => ({ ...s, items: updater(s.items) }));

    return {
      items: state.items,
      options: {
        urgency: state.urgency,
        notaryRequested: state.notaryRequested,
        deliveryType: state.deliveryType,
        deliveryAddress: state.deliveryAddress,
        languageFrom: state.languageFrom,
        languageTo: state.languageTo,
      },
      itemsCount: state.items.reduce((sum, i) => sum + i.quantity, 0),
      hydrated,
      replaceItems: (items) => setState((s) => ({ ...s, items })),
      addItem: (service, quantity = 1) =>
        setItems((items) => {
          const existing = items.find((i) => i.key === service.slug);
          if (existing) {
            return items.map((i) =>
              i.key === service.slug ? { ...i, quantity: i.quantity + quantity } : i,
            );
          }
          return [...items, serviceToCartItem(service, quantity)];
        }),
      removeItem: (key) => setItems((items) => items.filter((i) => i.key !== key)),
      setQuantity: (key, quantity) =>
        setItems((items) =>
          quantity <= 0
            ? items.filter((i) => i.key !== key)
            : items.map((i) => (i.key === key ? { ...i, quantity } : i)),
        ),
      clear: () => setState((s) => ({ ...s, items: [] })),
      setUrgency: (urgency) => setState((s) => ({ ...s, urgency })),
      setNotaryRequested: (notaryRequested) => setState((s) => ({ ...s, notaryRequested })),
      setDeliveryType: (deliveryType) => setState((s) => ({ ...s, deliveryType })),
      setDeliveryAddress: (deliveryAddress) => setState((s) => ({ ...s, deliveryAddress })),
      setLanguageFrom: (languageFrom) => setState((s) => ({ ...s, languageFrom })),
      setLanguageTo: (languageTo) => setState((s) => ({ ...s, languageTo })),
      resetOptions: () => setState((s) => ({ ...s, ...DEFAULT_OPTIONS })),
    };
  }, [state, hydrated]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart должен использоваться внутри <CartProvider>");
  return ctx;
}
