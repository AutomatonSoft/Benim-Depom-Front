"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Sidebar from "@/components/Sidebar";
import { authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";

type Marketplace = "hood" | "otto" | "kaufland";
type Account = "jv" | "xl";
type Product = { id: number; title: string; product_type: string };
type Publication = { id: number; product_id: number; product_title: string; marketplace: Marketplace; account: Account; ean: string; status: string; updated_at: string };
type ListResponse<T> = { count: number; next: string | null; previous: string | null; results: T[] };
type Target = { marketplace: Marketplace; account: Account };

const targets: Target[] = [{ marketplace: "otto", account: "jv" }, { marketplace: "otto", account: "xl" }, { marketplace: "hood", account: "jv" }, { marketplace: "hood", account: "xl" }, { marketplace: "kaufland", account: "jv" }, { marketplace: "kaufland", account: "xl" }];
const targetKey = (target: Target) => `${target.marketplace}:${target.account}`;
const marketplaceName: Record<Marketplace, string> = { otto: "OTTO", hood: "Hood", kaufland: "Kaufland" };
const publicationStatus: Record<string, string> = { pending: "Pending", publishing: "Publishing", active: "Active", deactivating: "Deactivating", deactivated: "Deactivated", deleting: "Deleting", deleted: "Deleted", failed: "Failed" };

function apiError(data: unknown) {
  if (!data || typeof data !== "object") return "Unable to start publication.";
  return Object.entries(data).map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(" ") : value}`).join(" ");
}

export default function MarketplacesPage() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [approvedProducts, setApprovedProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedTargets, setSelectedTargets] = useState(() => targets.map(targetKey));
  const [marketplace, setMarketplace] = useState("");
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function loadData() {
      const access = window.localStorage.getItem("benim_access_token");
      if (!access) return void window.location.replace("/login");

      setLoading(true);
      setError("");
      const publicationParams = new URLSearchParams({ page: "1" });
      if (marketplace) publicationParams.set("marketplace", marketplace);
      if (account) publicationParams.set("account", account);
      if (status) publicationParams.set("status", status);

      try {
        const [publicationResponse, productResponse] = await Promise.all([
          authorizedFetch(`/api/v1/orchestrator/publications/?${publicationParams}`),
          authorizedFetch("/api/v1/manager/products/?status=approved&page=1"),
        ]);
        if (publicationResponse.status === 401 || productResponse.status === 401) {
          window.localStorage.removeItem("benim_access_token");
          window.localStorage.removeItem("benim_refresh_token");
          window.location.replace("/login");
          return;
        }
        if (!publicationResponse.ok || !productResponse.ok) throw new Error();
        setPublications(((await publicationResponse.json()) as ListResponse<Publication>).results);
        setApprovedProducts(((await productResponse.json()) as ListResponse<Product>).results);
      } catch {
        setError("Unable to load marketplace data. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [marketplace, account, status, reloadKey]);

  function toggleTarget(target: Target) {
    const key = targetKey(target);
    setSelectedTargets((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  async function publish() {
    if (!selectedProductId || selectedTargets.length === 0) return;
    const access = window.localStorage.getItem("benim_access_token");
    if (!access) return void window.location.replace("/login");

    setPublishing(true);
    setError("");
    setNotice("");
    try {
      const response = await authorizedFetch(`/api/v1/orchestrator/products/${selectedProductId}/publish/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ targets: targets.filter((target) => selectedTargets.includes(targetKey(target))) }),
      });
      if (response.status === 401) {
        window.localStorage.removeItem("benim_access_token");
        window.localStorage.removeItem("benim_refresh_token");
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        setError(apiError(await response.json().catch(() => null)));
        return;
      }
      const job = (await response.json()) as { id: string };
      setNotice(`Publication job ${job.id} was queued. Statuses will appear below after processing.`);
      setReloadKey((value) => value + 1);
    } catch {
      setError("Unable to reach the API. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="app-shell"><Sidebar active="marketplaces" />
      <section className="content marketplaces-page">
        <header className="topbar"><div><p className="eyebrow">Manager panel</p><h1>Marketplaces</h1><p className="products-subtitle">Prepare approved products, select targets and monitor listing status.</p></div><button className="refresh-button" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>Refresh</button></header>
        <section className="marketplace-workflow"><article><b>1</b><div><strong>Review</strong><span>Seller submits a product in <Link href="/messages">Messages</Link>.</span></div></article><article><b>2</b><div><strong>Approve</strong><span>Approve it in <Link href="/products">Products</Link>; EAN codes are assigned automatically.</span></div></article><article><b>3</b><div><strong>Prepare</strong><span>Complete marketplace fields and generate images before publication.</span></div></article><article><b>4</b><div><strong>Publish</strong><span>Select marketplaces and accounts below. All targets are selected by default.</span></div></article></section>
        <section className="publish-card"><div className="publish-card-heading"><div><p className="eyebrow">Publication</p><h2>Publish approved product</h2></div><span>All requests are queued safely</span></div><div className="publish-controls"><label>Approved product<select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}><option value="">Select a product</option>{approvedProducts.map((product) => <option key={product.id} value={product.id}>#{product.id} · {product.title || product.product_type}</option>)}</select></label><div className="target-picker"><div className="target-picker-heading"><strong>Publication targets</strong><button type="button" onClick={() => setSelectedTargets(selectedTargets.length === targets.length ? [] : targets.map(targetKey))}>{selectedTargets.length === targets.length ? "Clear all" : "Select all"}</button></div><div className="target-grid">{targets.map((target) => <label key={targetKey(target)}><input checked={selectedTargets.includes(targetKey(target))} onChange={() => toggleTarget(target)} type="checkbox" /><span>{marketplaceName[target.marketplace]} <small>{target.account.toUpperCase()}</small></span></label>)}</div></div><button className="publish-button" disabled={!selectedProductId || selectedTargets.length === 0 || publishing} onClick={() => void publish()}>{publishing ? "Queueing…" : `Publish to ${selectedTargets.length} target${selectedTargets.length === 1 ? "" : "s"}`}</button></div>{error && <p className="form-feedback error" role="alert">{error}</p>}{notice && <p className="form-feedback success" role="status">{notice}</p>}</section>
        <section className="products-panel marketplace-list"><div className="marketplace-list-heading"><div><p className="eyebrow">Listing status</p><h2>Recent publications</h2></div><div className="marketplace-filters"><select aria-label="Filter marketplace" value={marketplace} onChange={(event) => setMarketplace(event.target.value)}><option value="">All marketplaces</option><option value="otto">OTTO</option><option value="hood">Hood</option><option value="kaufland">Kaufland</option></select><select aria-label="Filter account" value={account} onChange={(event) => setAccount(event.target.value)}><option value="">All accounts</option><option value="jv">JV</option><option value="xl">XL</option></select><select aria-label="Filter listing status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{Object.entries(publicationStatus).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>{loading && <p className="products-message">Loading publications…</p>}{!loading && !error && publications.length === 0 && <p className="products-message">No publications match these filters.</p>}{!loading && !error && publications.length > 0 && <div className="publication-table"><div className="publication-header"><span>Product</span><span>Marketplace</span><span>EAN</span><span>Status</span><span>Updated</span></div>{publications.map((publication) => <article key={publication.id}><div><strong>{publication.product_title}</strong><small>#{publication.product_id} · {publication.account.toUpperCase()}</small></div><span>{marketplaceName[publication.marketplace]}</span><code>{publication.ean}</code><span className={`publication-status ${publication.status}`}>{publicationStatus[publication.status] ?? publication.status}</span><time dateTime={publication.updated_at}>{formatDate(publication.updated_at, true)}</time></article>)}</div>}</section>
      </section>
    </main>
  );
}
