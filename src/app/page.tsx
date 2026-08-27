"use client";

import Link from "next/link";
import { useEffect } from "react";

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

export default function Home() {
  useEffect(() => {
    if (!window.localStorage.getItem("benim_access_token")) {
      window.location.replace("/login");
    }
  }, []);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview">Benim<span>Depom</span></a>
        <nav aria-label="Main navigation">
          <a className="nav-item active" href="#overview"><Icon>⌂</Icon> Overview</a>
          <Link className="nav-item" href="/products"><Icon>▣</Icon> Products</Link>
          <Link className="nav-item" href="/sellers"><Icon>♙</Icon> Sellers</Link>
          <Link className="nav-item" href="/messages"><Icon>✉</Icon> Messages</Link>
          <a className="nav-item" href="#marketplaces"><Icon>◫</Icon> Marketplaces</a>
        </nav>
        <div className="sidebar-bottom">
          <a className="nav-item" href="#settings"><Icon>⚙</Icon> Settings</a>
          <div className="profile"><span>AK</span><div><strong>Alikhan</strong><small>Manager</small></div></div>
        </div>
      </aside>

      <section className="content" id="overview">
        <header className="topbar">
          <div><p className="eyebrow">Manager panel</p><h1>Good morning, Alikhan</h1></div>
          <button className="notification" aria-label="Notifications">♢<i /></button>
        </header>

        <div className="summary-grid">
          <article className="metric-card blue"><div><p>Awaiting review</p><strong>12</strong><small>+4 today</small></div><Icon>▣</Icon></article>
          <article className="metric-card orange"><div><p>Published today</p><strong>28</strong><small>Across 3 marketplaces</small></div><Icon>↗</Icon></article>
          <article className="metric-card white"><div><p>Active sellers</p><strong>146</strong><small>+9 this month</small></div><Icon>♙</Icon></article>
        </div>

        <section className="review-panel" id="products">
          <div className="panel-heading"><div><p className="eyebrow">Moderation queue</p><h2>Review seller products</h2></div><Link className="link-button" href="/products">Open products <span>→</span></Link></div>
          <div className="dashboard-empty"><span>▣</span><div><strong>Products are loaded from the manager API.</strong><p>Open the Products page to review the current moderation queue.</p></div></div>
        </section>
      </section>
    </main>
  );
}
