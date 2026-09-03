"use client";

import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { useEffect, useState } from "react";

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

type QueueItem = {
  id: number;
  title: string;
  product_type: string;
  created_at: string;
  image: string;
  seller_name: string;
};

type Dashboard = {
  awaiting_review: number;
  awaiting_review_today: number;
  published_today: number;
  published_today_marketplaces: number;
  active_sellers: number;
  sellers_joined_this_month: number;
  queue: QueueItem[];
};

type Profile = {
  username: string;
  first_name: string;
};

function greetingName(profile: Profile | null) {
  const name = profile?.first_name.trim() || profile?.username || "";
  return name || "there";
}

function greeting(profile: Profile | null) {
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  if (!profile) return hello;
  return `${hello}, ${greetingName(profile)}`;
}

export default function Home() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!window.localStorage.getItem("benim_access_token")) {
      window.location.replace("/manager/login");
      return;
    }

    async function loadOverview() {
      setLoading(true);
      setError("");
      try {
        const [dashboardResponse, meResponse] = await Promise.all([
          authorizedFetch("/api/v1/manager/dashboard/"),
          authorizedFetch("/api/v1/auth/me/"),
        ]);

        if (dashboardResponse.status === 401 || meResponse.status === 401) {
          window.localStorage.removeItem("benim_access_token");
          window.localStorage.removeItem("benim_refresh_token");
          window.location.replace("/manager/login");
          return;
        }

        if (!dashboardResponse.ok) throw new Error("dashboard failed");
        setDashboard((await dashboardResponse.json()) as Dashboard);
        if (meResponse.ok) setProfile((await meResponse.json()) as Profile);
      } catch {
        setError("Unable to load the overview. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    void loadOverview();
  }, []);

  return (
    <main className="app-shell"><Sidebar active="overview" />

      <section className="content" id="overview">
        <header className="topbar">
          <div><p className="eyebrow">Manager panel</p><h1>{greeting(profile)}</h1></div>
          <Link className="notification" href="/manager/messages" aria-label="Messages">♢</Link>
        </header>

        {error && <p className="form-feedback error" role="alert">{error}</p>}

        <div className="summary-grid">
          <article className="metric-card blue"><div><p>Awaiting review</p><strong>{loading ? "—" : dashboard?.awaiting_review ?? 0}</strong><small>+{dashboard?.awaiting_review_today ?? 0} today</small></div><Icon>▣</Icon></article>
          <article className="metric-card orange"><div><p>Published today</p><strong>{loading ? "—" : dashboard?.published_today ?? 0}</strong><small>{(dashboard?.published_today_marketplaces ?? 0) === 0 ? "No marketplace listings today" : `Across ${dashboard?.published_today_marketplaces} marketplace${dashboard?.published_today_marketplaces === 1 ? "" : "s"}`}</small></div><Icon>↗</Icon></article>
          <article className="metric-card white"><div><p>Active sellers</p><strong>{loading ? "—" : dashboard?.active_sellers ?? 0}</strong><small>+{dashboard?.sellers_joined_this_month ?? 0} this month</small></div><Icon>♙</Icon></article>
        </div>

        <section className="review-panel" id="products">
          <div className="panel-heading"><div><p className="eyebrow">Moderation queue</p><h2>Review seller products</h2></div><Link className="link-button" href="/manager/products">Open products <span>→</span></Link></div>
          {loading && <div className="dashboard-empty"><span>▣</span><div><strong>Loading the queue…</strong><p>Fetching products waiting for review.</p></div></div>}
          {!loading && dashboard && dashboard.queue.length === 0 && (
            <div className="dashboard-empty"><span>▣</span><div><strong>Nothing is waiting for review.</strong><p>New seller submissions will show up here.</p></div></div>
          )}
          {!loading && dashboard && dashboard.queue.length > 0 && (
            <div className="product-list">
              {dashboard.queue.map((item) => (
                <Link className="product-row" href={`/manager/products/${item.id}`} key={item.id}>
                  <div className="product-image">{item.image ? <img src={item.image} alt="" /> : <span>▣</span>}</div>
                  <div className="product-main">
                    <p>{item.product_type}</p>
                    <h3>{item.title}</h3>
                    <small>{item.seller_name} · {formatDate(item.created_at, true)}</small>
                  </div>
                  <span className="status review">Awaiting review</span>
                  <span className="more" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
