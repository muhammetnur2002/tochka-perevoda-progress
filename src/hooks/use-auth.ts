"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { UserRow } from "@/types/database.types";

interface AuthState {
  user: User | null;
  profile: UserRow | null;
  loading: boolean;
}

const configured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Текущий пользователь и его профиль (роль). Клиент Supabase создаётся только
 * в браузере (в эффектах), поэтому компонент безопасно пререндерится на сервере.
 */
export function useAuth(): AuthState & { signOut: () => Promise<void>; refresh: () => Promise<void> } {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });

  const load = useCallback(async () => {
    if (!configured()) {
      setState({ user: null, profile: null, loading: false });
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState({ user: null, profile: null, loading: false });
      return;
    }
    const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
    setState({ user, profile: profile ?? null, loading: false });
  }, []);

  useEffect(() => {
    void load();
    if (!configured()) return;
    const { data } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void load();
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const signOut = async () => {
    if (configured()) await createClient().auth.signOut();
    setState({ user: null, profile: null, loading: false });
    router.push("/");
    router.refresh();
  };

  return { ...state, signOut, refresh: load };
}
