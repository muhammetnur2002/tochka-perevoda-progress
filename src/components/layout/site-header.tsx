"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, ShoppingCart, User } from "lucide-react";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { useCart } from "@/components/cart/cart-provider";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { homePathForRole, isStaffRole } from "@/lib/auth/roles";
import { LocaleSwitcher } from "./locale-switcher";

type NavKey = "home" | "services" | "calculator" | "status" | "myOrders";

const NAV: readonly { href: string; key: NavKey }[] = [
  { href: "/", key: "home" },
  { href: "/services", key: "services" },
  { href: "/calculator", key: "calculator" },
  { href: "/status", key: "status" },
];

export function SiteHeader() {
  const t = useTranslations("nav");
  const tr = useTranslations("roles");
  const pathname = usePathname();
  const { itemsCount } = useCart();
  const { user, profile, signOut } = useAuth();
  const [cartOpen, setCartOpen] = React.useState(false);

  const isStaff = isStaffRole(profile?.role);
  // Вошедший клиент вместо поиска по номеру видит «Мои заказы» — статусы там же
  const navItems = NAV.map((item) =>
    item.key === "status" && user && !isStaff ? { href: "/account", key: "myOrders" as const } : item,
  );

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Logo size={44} />
          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                  (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) && "text-brand-800",
                )}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <Button
            variant="outline"
            size="icon"
            className="relative"
            aria-label={t("cart")}
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="h-5 w-5" />
            {itemsCount > 0 && (
              <Badge
                variant="gold"
                className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px]"
              >
                {itemsCount}
              </Badge>
            )}
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t("account")}>
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  {profile?.name || user.email}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {tr(profile?.role ?? "client")}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account">{t("account")}</Link>
                </DropdownMenuItem>
                {isStaff && (
                  <DropdownMenuItem asChild>
                    <Link href={homePathForRole(profile?.role)}>
                      {homePathForRole(profile?.role) === "/admin" ? t("crm") : t("workspace")}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>{t("logout")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">{t("login")}</Link>
            </Button>
          )}

          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t("menu")}>
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>{t("menu")}</SheetTitle>
                </SheetHeader>
                <LocaleSwitcher className="mt-4 w-full [&_select]:w-full" />
                <nav className="mt-4 flex flex-col gap-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-md px-3 py-3 text-base font-medium hover:bg-muted"
                    >
                      {t(item.key)}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </header>
  );
}
