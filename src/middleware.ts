import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Глобальный middleware: обновление сессии Supabase и защита закрытых разделов.
 * Здесь проверяется только факт входа; роль (manager/translator/…) проверяют
 * серверные layout'ы по БД, а данные дополнительно защищает RLS.
 */
const PROTECTED = ["/account", "/admin", "/workspace"];

/** Редирект с переносом обновлённых cookie сессии (иначе refresh-токен потеряется). */
function redirectWithCookies(url: URL, from: NextResponse): NextResponse {
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!user && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + search);
    return redirectWithCookies(loginUrl, response);
  }

  // Вошедшему пользователю страницы входа/регистрации не нужны
  if (user && (pathname === "/login" || pathname === "/register")) {
    return redirectWithCookies(new URL("/account", request.url), response);
  }

  return response;
}

export const config = {
  matcher: [
    // Статика, картинки и API исключены (у API своя авторизация)
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|robots.txt|sitemap.xml|brand/|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
