import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/confirm — подтверждение email / сброс пароля
 * (стандартный шаблон письма Supabase: token_hash + type).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: type as "email" | "recovery" | "magiclink",
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth", req.url));
  }

  return NextResponse.redirect(new URL(type === "recovery" ? "/update-password" : "/account", req.url));
}
