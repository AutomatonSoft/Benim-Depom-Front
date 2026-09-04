"use client";

import Link from "next/link";
import { authorizedFetch, apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { useI18n } from "@/i18n";
import { FormEvent, useEffect, useState } from "react";

type Seller = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  date_joined: string;
  is_email_verified: boolean;
  product_count?: number;
};

type SellerListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Seller[];
};

function fullName(seller: Seller) {
  return `${seller.first_name} ${seller.last_name}`.trim() || seller.username;
}

export default function SellersPage() {
  const { t } = useI18n();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [activity, setActivity] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingSeller, setPendingSeller] = useState<Seller | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const access = window.localStorage.getItem("benim_access_token");
    if (!access) {
      window.location.replace("/manager/login");
      return;
    }

    const params = new URLSearchParams({ page: String(page) });
    if (activity) params.set("is_active", activity);
    if (appliedSearch) params.set("search", appliedSearch);

    async function loadSellers() {
      setLoading(true);
      setError("");

      try {
        const response = await authorizedFetch(`/api/v1/manager/users/sellers/?${params}`);

        if (response.status === 401) {
          window.localStorage.removeItem("benim_access_token");
          window.localStorage.removeItem("benim_refresh_token");
          window.location.replace("/manager/login");
          return;
        }

        if (!response.ok) throw new Error("request failed");

        const data = (await response.json()) as SellerListResponse;
        setSellers(data.results);
        setCount(data.count);
        setHasNext(Boolean(data.next));
        setHasPrevious(Boolean(data.previous));
      } catch {
        setError(t("sellers.loadError"));
      } finally {
        setLoading(false);
      }
    }

    void loadSellers();
  }, [page, activity, appliedSearch, t]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }

  async function confirmDelete() {
    if (!pendingSeller || deleting) return;
    setDeleting(true);
    setActionError("");
    setFeedback("");
    try {
      const response = await authorizedFetch(`/api/v1/manager/users/sellers/${pendingSeller.id}/`, { method: "DELETE" });
      if (response.status === 401) return void window.location.replace("/manager/login");
      if (response.status === 204) {
        setSellers((items) => items.filter((item) => item.id !== pendingSeller.id));
        setCount((value) => Math.max(0, value - 1));
        setFeedback(t("sellers.deleted", { name: fullName(pendingSeller) }));
        setPendingSeller(null);
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (response.status === 202) {
        setFeedback(typeof data.detail === "string" ? data.detail : t("sellers.blocked"));
        setPendingSeller(null);
        return;
      }
      throw new Error(apiErrorMessage(data, t("sellers.deleteFailed")));
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : t("sellers.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="content products-page">
        <header className="topbar"><div><p className="eyebrow">{t("common.panel")}</p><h1>{t("sellers.title")}</h1><p className="products-subtitle">{t("sellers.subtitle", { count })}</p></div><Link className="primary-link" href="/manager/managers/new">{t("sellers.createManager")}</Link></header>

        <section className="products-panel">
          <form className="products-toolbar" onSubmit={applySearch}>
            <input aria-label={t("sellers.searchAria")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("sellers.searchPlaceholder")} />
            <select aria-label={t("sellers.filterAria")} value={activity} onChange={(event) => { setPage(1); setActivity(event.target.value); }}>
              <option value="">{t("sellers.all")}</option>
              <option value="true">{t("common.active")}</option>
              <option value="false">{t("common.inactive")}</option>
            </select>
            <button type="submit">{t("common.search")}</button>
          </form>

          {loading && <p className="products-message">{t("sellers.loading")}</p>}
          {error && <p className="products-message error" role="alert">{error}</p>}
          {actionError && !loading && <p className="form-feedback error" role="alert">{actionError}</p>}
          {feedback && !error && !actionError && <p className="form-feedback success" role="status">{feedback}</p>}
          {!loading && !error && sellers.length === 0 && <p className="products-message">{t("sellers.empty")}</p>}

          {!loading && !error && sellers.length > 0 && <div className="sellers-table">
            <div className="seller-table-header"><span>{t("sellers.col.seller")}</span><span>{t("sellers.col.contact")}</span><span>{t("sellers.col.verification")}</span><span>{t("sellers.col.joined")}</span><span /></div>
            {sellers.map((seller) => <article className="seller-row" key={seller.id}>
              <div className="seller-name"><span>{fullName(seller).slice(0, 1).toUpperCase()}</span><div><h2>{fullName(seller)}</h2><small>@{seller.username}</small></div></div>
              <div className="seller-contact"><strong>{seller.email || t("sellers.noEmail")}</strong><small>{seller.phone || t("sellers.noPhone")}</small></div>
              <span className={`verification ${seller.is_email_verified ? "verified" : "unverified"}`}>{seller.is_email_verified ? t("common.verified") : t("common.unverified")}</span>
              <time dateTime={seller.date_joined}>{formatDate(seller.date_joined)}</time>
              <button type="button" className="seller-delete-button" aria-label={t("sellers.deleteAria", { name: fullName(seller) })} onClick={() => { setActionError(""); setFeedback(""); setPendingSeller(seller); }}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2m-7 3v9m4-9v9M6 7l1 14h10l1-14" /></svg>
              </button>
            </article>)}
          </div>}

          <footer className="pagination"><button disabled={!hasPrevious || loading} onClick={() => setPage((value) => value - 1)}>{t("common.previous")}</button><span>{t("common.page", { page })}</span><button disabled={!hasNext || loading} onClick={() => setPage((value) => value + 1)}>{t("common.next")}</button></footer>
        </section>

        {pendingSeller ? <div className="price-help-overlay" role="dialog" aria-modal="true" aria-labelledby="seller-delete-title" onClick={() => { if (!deleting) setPendingSeller(null); }}>
          <div className="price-help-dialog seller-delete-dialog" onClick={(event) => event.stopPropagation()}>
            <h2 id="seller-delete-title">{t("sellers.deleteTitle")}</h2>
            <p>{t("sellers.deleteWarning")}</p>
            <p>{t("sellers.productCount", { count: pendingSeller.product_count ?? 0 })}</p>
            <p>{t("sellers.confirm")}</p>
            {actionError ? <p className="form-feedback error" role="alert">{actionError}</p> : null}
            <div className="seller-delete-actions">
              <button type="button" className="seller-delete-cancel" disabled={deleting} onClick={() => setPendingSeller(null)}>{t("sellers.no")}</button>
              <button type="button" className="seller-delete-confirm" disabled={deleting} onClick={() => void confirmDelete()}>{deleting ? t("sellers.deleting") : t("sellers.yes")}</button>
            </div>
          </div>
        </div> : null}
      </section>
  );
}
