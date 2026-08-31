import type { ReactNode } from "react";

import Link from "next/link";

type ActivePage =
  | "overview"
  | "products"
  | "sellers"
  | "messages"
  | "eans"
  | "marketplaces"
  | "settings";

type IconName = ActivePage;

const links: { id: Exclude<ActivePage, "settings">; href: string; label: string }[] = [
  { id: "overview", href: "/manager", label: "Overview" },
  { id: "products", href: "/manager/products", label: "Products" },
  { id: "sellers", href: "/manager/sellers", label: "Sellers" },
  { id: "messages", href: "/manager/messages", label: "Messages" },
  { id: "eans", href: "/manager/eans", label: "EAN" },
];

function SidebarIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    products: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
    sellers: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 21c.7-3.7 3.2-5.5 7.5-5.5s6.8 1.8 7.5 5.5" /></>,
    messages: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    eans: <><path d="M5 4v16M8 4v16M12 4v16M15 4v16M19 4v16" /><path d="M3 7h18M3 17h18" /></>,
    marketplaces: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5S14.3 18.1 12 20.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5Z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.2 2.2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.2v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L6.2 17l.1-.1A1.7 1.7 0 0 0 6.6 15a1.7 1.7 0 0 0-1.5-1H5v-3.2h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.2-2.2.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h3.2v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.2 2.2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1V14h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  };

  return <svg className="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function Sidebar({ active }: { active: ActivePage }) {
  return (
    <aside className="sidebar">
      <Link className="brand" href="/manager">Benim<span>Depom</span></Link>
      <nav aria-label="Main navigation">
        {links.map((link) => (
          <Link className={`nav-item ${active === link.id ? "active" : ""}`} href={link.href} key={link.id}>
            <SidebarIcon name={link.id} />
            {link.label}
          </Link>
        ))}
        <Link className={`nav-item ${active === "marketplaces" ? "active" : ""}`} href="/manager/marketplaces"><SidebarIcon name="marketplaces" />Marketplaces</Link>
      </nav>
      <div className="sidebar-bottom">
        <Link className={`nav-item ${active === "settings" ? "active" : ""}`} href="/manager/settings"><SidebarIcon name="settings" />Settings</Link>
        <div className="profile"><span>AK</span><div><strong>Alikhan</strong><small>Manager</small></div></div>
      </div>
    </aside>
  );
}
