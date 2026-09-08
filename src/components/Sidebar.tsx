"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Package,
  Users,
  Mail,
  Barcode,
  Globe,
  Settings,
  Menu,
} from "lucide-react";

import { authorizedFetch } from "@/lib/api";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type ActivePage =
  | "overview"
  | "products"
  | "sellers"
  | "messages"
  | "eans"
  | "marketplaces"
  | "settings";

const links: {
  id: Exclude<ActivePage, "settings">;
  href: string;
  key: "nav.overview" | "nav.products" | "nav.sellers" | "nav.messages" | "nav.eans" | "nav.marketplaces";
  icon: typeof LayoutDashboard;
}[] = [
  { id: "overview", href: "/manager", key: "nav.overview", icon: LayoutDashboard },
  { id: "products", href: "/manager/products", key: "nav.products", icon: Package },
  { id: "sellers", href: "/manager/sellers", key: "nav.sellers", icon: Users },
  { id: "messages", href: "/manager/messages", key: "nav.messages", icon: Mail },
  { id: "eans", href: "/manager/eans", key: "nav.eans", icon: Barcode },
  { id: "marketplaces", href: "/manager/marketplaces", key: "nav.marketplaces", icon: Globe },
];

function activeFromPath(pathname: string): ActivePage {
  if (pathname.startsWith("/manager/products")) return "products";
  if (pathname.startsWith("/manager/sellers") || pathname.startsWith("/manager/managers")) return "sellers";
  if (pathname.startsWith("/manager/messages")) return "messages";
  if (pathname.startsWith("/manager/eans")) return "eans";
  if (pathname.startsWith("/manager/marketplaces")) return "marketplaces";
  if (pathname.startsWith("/manager/settings")) return "settings";
  return "overview";
}

function NavLink({
  href,
  active,
  icon: Icon,
  children,
  onNavigate,
}: {
  href: string;
  active: boolean;
  icon: typeof LayoutDashboard;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors duration-150",
        active
          ? "bg-white/10 text-white shadow-[inset_3px_0_0_0_#f7941d]"
          : "text-white/70 hover:bg-white/5 hover:text-white",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0 stroke-[2.25]", active ? "text-[#f7941d]" : "text-white/55 group-hover:text-white/85")} aria-hidden />
      <span>{children}</span>
    </Link>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const active = activeFromPath(pathname);
  const [profile, setProfile] = useState<{ username: string; first_name: string; role: string } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const response = await authorizedFetch("/api/v1/auth/me/");
      if (!response.ok) return;
      setProfile((await response.json()) as { username: string; first_name: string; role: string });
    }
    void loadProfile();
  }, []);

  const displayName = profile?.first_name.trim() || profile?.username || t("common.role.manager");
  const initials = displayName.slice(0, 2).toUpperCase();
  const roleLabel = profile?.role === "admin" ? t("common.role.admin") : t("common.role.manager");

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Link href="/manager" onClick={onNavigate} className="block text-[1.35rem] font-extrabold tracking-tight text-white">
          Benim<span className="text-[#f7941d]">Depom</span>
        </Link>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white/45">{t("common.panel")}</p>
      </div>

      <ScrollArea className="flex-1 px-3">
        <nav className="flex flex-col gap-1 pb-4" aria-label={t("nav.main")}>
          {links.map((link) => (
            <NavLink key={link.id} href={link.href} active={active === link.id} icon={link.icon} onNavigate={onNavigate}>
              {t(link.key)}
            </NavLink>
          ))}
        </nav>
      </ScrollArea>

      <div className="mt-auto space-y-3 px-3 pb-4 pt-2">
        <Separator className="bg-white/10" />
        <NavLink href="/manager/settings" active={active === "settings"} icon={Settings} onNavigate={onNavigate}>
          {t("nav.settings")}
        </NavLink>
        <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          <Avatar className="size-9 border border-white/10">
            <AvatarFallback className="bg-[#f7941d] text-xs font-extrabold text-white">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <strong className="block truncate text-sm font-bold text-white">{displayName}</strong>
            <small className="block text-xs font-medium text-white/50">{roleLabel}</small>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[256px] shrink-0 bg-[#12284a] lg:flex lg:flex-col">
      <SidebarBody />
    </aside>
  );
}

export function MobileHeader() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-[rgba(255,255,255,0.92)] px-4 backdrop-blur lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("nav.main")}>
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] border-0 bg-[#12284a] p-0 text-white [&>button]:text-white">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("nav.main")}</SheetTitle>
          </SheetHeader>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Link href="/manager" className="text-base font-extrabold tracking-tight text-primary">
        Benim<span className="text-[var(--brand-accent)]">Depom</span>
      </Link>
    </header>
  );
}

export default function Sidebar() {
  return <AppSidebar />;
}
