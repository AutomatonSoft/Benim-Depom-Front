"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, ChartNoAxesCombined, CircleAlert, CircleCheck, CircleUserRound, House, LogOut, Package, Plus, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { clearSellerSession, clearSellerToken, saveSellerProfileId, sellerAvatarInitial, sellerLogout, sellerRequest, type SellerProfile } from "@/lib/seller";
import { readSellerLocale, setSellerLocale } from "@/lib/seller-i18n";
import { SellerLocalized, useSellerI18n } from "@/components/seller/SellerI18n";
import SellerAuthFrame from "@/components/seller/SellerAuthFrame";
import { prefetchSellerOttoCatalog } from "@/lib/seller-otto-catalog";

const links = [
  ["/seller/products", "My products", Package], ["/seller/products/new", "Add product", Plus],
  ["/seller/notifications", "Notifications", Bell], ["/seller/statistics", "Sales statistics", ChartNoAxesCombined],
  ["/seller/profile", "Profile", CircleUserRound], ["/seller/settings", "Settings", Settings],
] as const;
const mobileLinks = [["/seller/products", "Products", Package], ["/seller/products/new", "Add", Plus], ["/seller/more", "More", House]] as const;
const publicRoutes = ["/seller/login", "/seller/register", "/seller/verify-email", "/seller/forgot-password"];

export function SellerPage({ title, description, children, actions, dynamicTitle = false, dynamicDescription = false }: { title: string; description?: string; children: ReactNode; actions?: ReactNode; dynamicTitle?: boolean; dynamicDescription?: boolean }) {
  const { t } = useSellerI18n();
  return <main className="seller-page"><header className="seller-page-heading"><div><h1>{dynamicTitle ? title : t(title)}</h1>{description && <p>{dynamicDescription ? description : t(description)}</p>}</div><SellerLocalized>{actions}</SellerLocalized></header><SellerLocalized>{children}</SellerLocalized></main>;
}

export function SellerNotice({ children, kind = "error" }: { children: ReactNode; kind?: "error" | "success" }) {
  const Icon = kind === "success" ? CircleCheck : CircleAlert;
  return <p role={kind === "error" ? "alert" : "status"} aria-atomic="true" className={`seller-notice seller-notice-${kind}`}><Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span><SellerLocalized>{children}</SellerLocalized></span></p>;
}

export function SellerLoadingState({ label, rows = 3 }: { label: string; rows?: number }) {
  const { t } = useSellerI18n();
  return <div className="seller-loading-state" role="status" aria-label={t(label)}>
    <div className="seller-loading-intro" aria-hidden="true"><Skeleton className="seller-loading-title" /><Skeleton className="seller-loading-copy" /></div>
    <div className="seller-loading-rows" aria-hidden="true">{Array.from({ length: rows }, (_, index) =>
      <div className="seller-loading-row" key={index}><Skeleton className="seller-loading-thumb" /><div><Skeleton className="seller-loading-line" /><Skeleton className="seller-loading-line short" /></div></div>,
    )}</div>
  </div>;
}

export default function SellerShell({ children }: { children: ReactNode }) {
  const { t, locale } = useSellerI18n();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = publicRoutes.includes(pathname);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [retry, setRetry] = useState(0);
  const [unread, setUnread] = useState(0);
  const profileMenuRef = useRef<HTMLDetailsElement>(null);
  const sellerId = profile?.id;

  useEffect(() => {
    if (isPublic || !sellerId) return;
    const controller = new AbortController();
    void prefetchSellerOttoCatalog(locale, controller.signal).catch(() => controller.abort());
    return () => controller.abort();
  }, [isPublic, sellerId, locale]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      document.documentElement.style.setProperty("--seller-viewport-height", `${viewport.height}px`);
      document.documentElement.style.setProperty("--seller-viewport-top", `${viewport.offsetTop}px`);
      document.documentElement.style.setProperty("--seller-viewport-left", `${viewport.offsetLeft}px`);
      document.documentElement.style.setProperty("--seller-viewport-width", `${viewport.width}px`);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--seller-viewport-height");
      document.documentElement.style.removeProperty("--seller-viewport-top");
      document.documentElement.style.removeProperty("--seller-viewport-left");
      document.documentElement.style.removeProperty("--seller-viewport-width");
    };
  }, []);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const menu = profileMenuRef.current;
      if (menu && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const menu = profileMenuRef.current;
      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (isPublic) return;
    let active = true;
    sellerRequest<SellerProfile>("/api/v1/auth/me/").then((data) => {
      if (!active) return;
      if (data.role !== "seller") { clearSellerToken(); router.replace("/seller/login?denied=1"); return; }
      saveSellerProfileId(data.id);
      if (data.preferred_language) setSellerLocale(readSellerLocale(data.preferred_language));
      setProfile(data); setSessionError("");
      sellerRequest<{ unread_total?: number }>("/api/v1/notifications/summary/").then((summary) => active && setUnread(summary.unread_total ?? 0)).catch(() => undefined);
    }).catch((error: unknown) => {
      if (!active) return;
      const status = error && typeof error === "object" && "status" in error ? (error as { status: number }).status : 0;
      if (status === 403) { clearSellerToken(); router.replace("/seller/login?denied=1"); }
      else if (status === 401) { clearSellerToken(); router.replace("/seller/login"); }
      else setSessionError(error instanceof Error ? error.message : "Could not verify your seller session. Check your connection and retry.");
    });
    return () => { active = false; };
  }, [isPublic, pathname, router, retry]);

  useEffect(() => {
    if (isPublic || !profile) return;
    const refresh = () => {
      sellerRequest<{ unread_total?: number }>("/api/v1/notifications/summary/").then((summary) => setUnread(summary.unread_total ?? 0)).catch(() => undefined);
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("seller-notifications-updated", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("seller-notifications-updated", refresh); };
  }, [isPublic, profile]);

  if (isPublic) return <div className="seller-auth-wrap"><SellerAuthFrame>{children}</SellerAuthFrame></div>;
  if (!profile && sessionError) return <main className="seller-loading"><div className="seller-card"><p role="alert">{t(sessionError)}</p><button className="seller-button" onClick={()=>setRetry(value=>value+1)}>{t("Retry session check")}</button></div></main>;
  if (!profile) return <main className="seller-loading"><SellerLoadingState label={t("Loading your workspace…")} rows={4} /></main>;

  async function logout() { try { await sellerLogout(); } catch { clearSellerSession(); } router.replace("/seller/login"); }
  const avatarInitial = sellerAvatarInitial(profile);

  return <div className="seller-shell">
    <aside className="seller-sidebar">
      <Link className="seller-brand" href="/seller"><span className="seller-brand-content"><span>BENIM</span><b>DEPOM</b><small>{t("SELLER WORKSPACE")}</small></span></Link>
      <nav aria-label={t("Seller navigation")}>{links.map(([href, label, Icon]) => {
        const active = href === "/seller/products"
          ? pathname === href || /^\/seller\/products\/\d/.test(pathname)
          : pathname === href || pathname.startsWith(`${href}/`);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? "active" : ""}><span className="seller-nav-link-content"><Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t(label)}</span>{href === "/seller/notifications" && unread > 0 && <i>{unread > 99 ? "99+" : unread}</i>}</span></Link>;
      })}</nav>
      <button className="seller-logout" type="button" onClick={logout}><LogOut size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t("Sign out")}</span></button>
    </aside>
    <div className="seller-main-column">
      <header className="seller-topbar">
        <Link href="/seller/products" className="seller-brand-mobile"><span className="seller-brand-inline"><span>BENIM</span><b>DEPOM</b></span></Link>
        <div className="seller-topbar-actions">
          <Link aria-label={`${t("Notifications")}${unread ? `, ${unread} ${t("unread")}` : ""}`} className="seller-bell" href="/seller/notifications"><span className="seller-bell-content"><Bell size={18} strokeWidth={1.8} aria-hidden="true" />{unread > 0 && <i>{unread > 99 ? "99+" : unread}</i>}</span></Link>
          <details ref={profileMenuRef} className="seller-profile-menu">
            <summary className="seller-user"><span className="seller-user-name">{[profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.username}</span><span className="seller-avatar" aria-hidden="true">{avatarInitial || <CircleUserRound size={17} strokeWidth={1.8} />}</span></summary>
            <div className="seller-profile-menu-panel">
              <Link href="/seller/profile" onClick={e=>e.currentTarget.closest("details")?.removeAttribute("open")}><span className="seller-link-content"><CircleUserRound size={18} strokeWidth={1.8} aria-hidden="true" />{t("Profile")}</span></Link>
              <Link href="/seller/settings" onClick={e=>e.currentTarget.closest("details")?.removeAttribute("open")}><span className="seller-link-content"><Settings size={18} strokeWidth={1.8} aria-hidden="true" />{t("Settings")}</span></Link>
              <button type="button" onClick={logout}><LogOut size={18} strokeWidth={1.8} aria-hidden="true" />{t("Sign out")}</button>
            </div>
          </details>
        </div>
      </header>
      <SellerLocalized>{children}</SellerLocalized>
      <nav className="seller-bottom-nav" aria-label={t("Mobile navigation")}>{mobileLinks.map(([href,label,Icon]) => {
        const active = href === "/seller/products" ? pathname === href || /^\/seller\/products\/\d/.test(pathname) : pathname === href || pathname.startsWith(`${href}/`);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? "active" : ""}><span className="seller-bottom-nav-content"><Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t(label)}</span></span></Link>;
      })}</nav>
    </div>
  </div>;
}
