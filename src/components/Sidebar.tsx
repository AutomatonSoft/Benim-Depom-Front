import Link from "next/link";

type ActivePage = "overview" | "products" | "sellers" | "messages" | "eans";

const links: { id: ActivePage; href: string; label: string }[] = [
  { id: "overview", href: "/", label: "Overview" },
  { id: "products", href: "/products", label: "Products" },
  { id: "sellers", href: "/sellers", label: "Sellers" },
  { id: "messages", href: "/messages", label: "Messages" },
  { id: "eans", href: "/eans", label: "EAN" },
];

export default function Sidebar({ active }: { active: ActivePage }) {
  return (
    <aside className="sidebar">
      <Link className="brand" href="/">Benim<span>Depom</span></Link>
      <nav aria-label="Main navigation">
        {links.map((link) => <Link className={`nav-item ${active === link.id ? "active" : ""}`} href={link.href} key={link.id}>
          <span className={`sidebar-icon icon-${link.id}`} aria-hidden="true" />{link.label}
        </Link>)}
        <Link className="nav-item" href="/#marketplaces"><span className="sidebar-icon icon-marketplaces" aria-hidden="true" />Marketplaces</Link>
      </nav>
      <div className="sidebar-bottom">
        <Link className="nav-item" href="/#settings"><span className="sidebar-icon icon-settings" aria-hidden="true" />Settings</Link>
        <div className="profile"><span>AK</span><div><strong>Alikhan</strong><small>Manager</small></div></div>
      </div>
    </aside>
  );
}