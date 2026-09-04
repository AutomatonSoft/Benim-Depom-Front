"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { useI18n, type MessageKey } from "@/i18n";

type Marketplace = "hood" | "otto" | "kaufland";
type Account = "jv" | "xl";
type Product = { id: number; title: string; product_type: string };
type Publication = { id: number; product_id: number; product_title: string; marketplace: Marketplace; account: Account; ean: string; status: string; updated_at: string };
type ListResponse<T> = { count: number; next: string | null; previous: string | null; results: T[] };
type Target = { marketplace: Marketplace; account: Account };

const targets: Target[] = [{ marketplace: "otto", account: "jv" }, { marketplace: "otto", account: "xl" }, { marketplace: "hood", account: "jv" }, { marketplace: "hood", account: "xl" }, { marketplace: "kaufland", account: "jv" }, { marketplace: "kaufland", account: "xl" }];
const targetKey = (target: Target) => `${target.marketplace}:${target.account}`;
const marketplaceName: Record<Marketplace, string> = { otto: "OTTO", hood: "Hood", kaufland: "Kaufland" };
const publicationStatusKeys = ["pending", "publishing", "active", "deactivating", "deactivated", "deleting", "deleted", "failed"] as const;

function apiError(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  return Object.entries(data).map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(" ") : value}`).join(" ");
}

export default function MarketplacesPage() {
  const { t } = useI18n();
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
      if (!access) return void window.location.replace("/manager/login");

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
          window.location.replace("/manager/login");
          return;
        }
        if (!publicationResponse.ok || !productResponse.ok) throw new Error();
        setPublications(((await publicationResponse.json()) as ListResponse<Publication>).results);
        setApprovedProducts(((await productResponse.json()) as ListResponse<Product>).results);
      } catch {
        setError(t("marketplaces.loadError"));
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [marketplace, account, status, reloadKey, t]);

  function toggleTarget(target: Target) {
    const key = targetKey(target);
    setSelectedTargets((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  async function publish() {
    if (!selectedProductId || selectedTargets.length === 0) return;
    const access = window.localStorage.getItem("benim_access_token");
    if (!access) return void window.location.replace("/manager/login");

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
        window.location.replace("/manager/login");
        return;
      }
      if (!response.ok) {
        setError(apiError(await response.json().catch(() => null), t("marketplaces.publishError")));
        return;
      }
      const job = (await response.json()) as { id: string };
      setNotice(t("marketplaces.jobQueued", { id: job.id }));
      setReloadKey((value) => value + 1);
    } catch {
      setError(t("common.apiUnreachable"));
    } finally {
      setPublishing(false);
    }
  }

  function linkedCopy(text: string, href: string, label: string) {
    const [before, after = ""] = text.split("{link}");
    return <span>{before}<Link href={href}>{label}</Link>{after}</span>;
  }

  return (
    <section className="content marketplaces-page">
        <header className="topbar"><div><p className="eyebrow">{t("common.panel")}</p><h1>{t("marketplaces.title")}</h1><p className="products-subtitle">{t("marketplaces.subtitle")}</p></div><button className="refresh-button" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>{t("common.refresh")}</button></header>
        <section className="marketplace-workflow">
          <article><b>1</b><div><strong>{t("marketplaces.step1Title")}</strong>{linkedCopy(t("marketplaces.step1"), "/manager/messages", t("nav.messages"))}</div></article>
          <article><b>2</b><div><strong>{t("marketplaces.step2Title")}</strong>{linkedCopy(t("marketplaces.step2"), "/manager/products", t("nav.products"))}</div></article>
          <article><b>3</b><div><strong>{t("marketplaces.step3Title")}</strong><span>{t("marketplaces.step3")}</span></div></article>
          <article><b>4</b><div><strong>{t("marketplaces.step4Title")}</strong><span>{t("marketplaces.step4")}</span></div></article>
        </section>
        <section className="publish-card"><div className="publish-card-heading"><div><p className="eyebrow">{t("marketplaces.publication")}</p><h2>{t("marketplaces.publishTitle")}</h2></div><span>{t("marketplaces.queuedHint")}</span></div><div className="publish-controls"><label>{t("marketplaces.approvedProduct")}<select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}><option value="">{t("marketplaces.selectProduct")}</option>{approvedProducts.map((product) => <option key={product.id} value={product.id}>#{product.id} · {product.title || product.product_type}</option>)}</select></label><div className="target-picker"><div className="target-picker-heading"><strong>{t("marketplaces.targets")}</strong><button type="button" onClick={() => setSelectedTargets(selectedTargets.length === targets.length ? [] : targets.map(targetKey))}>{selectedTargets.length === targets.length ? t("marketplaces.clearAll") : t("marketplaces.selectAll")}</button></div><div className="target-grid">{targets.map((target) => <label key={targetKey(target)}><input checked={selectedTargets.includes(targetKey(target))} onChange={() => toggleTarget(target)} type="checkbox" /><span>{marketplaceName[target.marketplace]} <small>{target.account.toUpperCase()}</small></span></label>)}</div></div><button className="publish-button" disabled={!selectedProductId || selectedTargets.length === 0 || publishing} onClick={() => void publish()}>{publishing ? t("marketplaces.queueing") : selectedTargets.length === 1 ? t("marketplaces.publish", { count: selectedTargets.length }) : t("marketplaces.publishPlural", { count: selectedTargets.length })}</button></div>{error && <p className="form-feedback error" role="alert">{error}</p>}{notice && <p className="form-feedback success" role="status">{notice}</p>}</section>
        <section className="products-panel marketplace-list"><div className="marketplace-list-heading"><div><p className="eyebrow">{t("marketplaces.listingStatus")}</p><h2>{t("marketplaces.recent")}</h2></div><div className="marketplace-filters"><select aria-label={t("marketplaces.filterMarketplace")} value={marketplace} onChange={(event) => setMarketplace(event.target.value)}><option value="">{t("marketplaces.allMarketplaces")}</option><option value="otto">OTTO</option><option value="hood">Hood</option><option value="kaufland">Kaufland</option></select><select aria-label={t("marketplaces.filterAccount")} value={account} onChange={(event) => setAccount(event.target.value)}><option value="">{t("marketplaces.allAccounts")}</option><option value="jv">JV</option><option value="xl">XL</option></select><select aria-label={t("marketplaces.filterStatus")} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{t("marketplaces.allStatuses")}</option>{publicationStatusKeys.map((value) => <option key={value} value={value}>{t(`pub.${value}` as MessageKey)}</option>)}</select></div></div>{loading && <p className="products-message">{t("marketplaces.loading")}</p>}{!loading && !error && publications.length === 0 && <p className="products-message">{t("marketplaces.empty")}</p>}{!loading && !error && publications.length > 0 && <div className="publication-table"><div className="publication-header"><span>{t("marketplaces.col.product")}</span><span>{t("marketplaces.col.marketplace")}</span><span>{t("marketplaces.col.ean")}</span><span>{t("marketplaces.col.status")}</span><span>{t("marketplaces.col.updated")}</span></div>{publications.map((publication) => <article key={publication.id}><div><strong>{publication.product_title}</strong><small>#{publication.product_id} · {publication.account.toUpperCase()}</small></div><span>{marketplaceName[publication.marketplace]}</span><code>{publication.ean}</code><span className={`publication-status ${publication.status}`}>{t(`pub.${publication.status}` as MessageKey)}</span><time dateTime={publication.updated_at}>{formatDate(publication.updated_at, true)}</time></article>)}</div>}</section>
      </section>
  );
}
