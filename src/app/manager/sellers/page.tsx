"use client";

import Link from "next/link";
import { authorizedFetch, apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/date";
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
        setError("Unable to load sellers. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    void loadSellers();
  }, [page, activity, appliedSearch]);

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
        setFeedback(`${fullName(pendingSeller)} was deleted.`);
        setPendingSeller(null);
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (response.status === 202) {
        setFeedback(typeof data.detail === "string" ? data.detail : "Seller blocked. Marketplace listings are being removed.");
        setPendingSeller(null);
        return;
      }
      throw new Error(apiErrorMessage(data, "Seller could not be deleted."));
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Seller could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="content products-page">
        <header className="topbar"><div><p className="eyebrow">Manager panel</p><h1>Sellers</h1><p className="products-subtitle">{count} registered sellers</p></div><Link className="primary-link" href="/manager/managers/new">+ Create manager</Link></header>

        <section className="products-panel">
          <form className="products-toolbar" onSubmit={applySearch}>
            <input aria-label="Search sellers" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, phone or username" />
            <select aria-label="Filter sellers by activity" value={activity} onChange={(event) => { setPage(1); setActivity(event.target.value); }}>
              <option value="">All sellers</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <button type="submit">Search</button>
          </form>

          {loading && <p className="products-message">Loading sellers…</p>}
          {error && <p className="products-message error" role="alert">{error}</p>}
          {actionError && !loading && <p className="form-feedback error" role="alert">{actionError}</p>}
          {feedback && !error && !actionError && <p className="form-feedback success" role="status">{feedback}</p>}
          {!loading && !error && sellers.length === 0 && <p className="products-message">No sellers match these filters.</p>}

          {!loading && !error && sellers.length > 0 && <div className="sellers-table">
            <div className="seller-table-header"><span>Seller</span><span>Contact</span><span>Verification</span><span>Joined</span><span /></div>
            {sellers.map((seller) => <article className="seller-row" key={seller.id}>
              <div className="seller-name"><span>{fullName(seller).slice(0, 1).toUpperCase()}</span><div><h2>{fullName(seller)}</h2><small>@{seller.username}</small></div></div>
              <div className="seller-contact"><strong>{seller.email || "No email"}</strong><small>{seller.phone || "No phone"}</small></div>
              <span className={`verification ${seller.is_email_verified ? "verified" : "unverified"}`}>{seller.is_email_verified ? "Verified" : "Unverified"}</span>
              <time dateTime={seller.date_joined}>{formatDate(seller.date_joined)}</time>
              <button type="button" className="seller-delete-button" aria-label={`Delete ${fullName(seller)}`} onClick={() => { setActionError(""); setFeedback(""); setPendingSeller(seller); }}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2m-7 3v9m4-9v9M6 7l1 14h10l1-14" /></svg>
              </button>
            </article>)}
          </div>}

          <footer className="pagination"><button disabled={!hasPrevious || loading} onClick={() => setPage((value) => value - 1)}>← Previous</button><span>Page {page}</span><button disabled={!hasNext || loading} onClick={() => setPage((value) => value + 1)}>Next →</button></footer>
        </section>

        {pendingSeller ? <div className="price-help-overlay" role="dialog" aria-modal="true" aria-labelledby="seller-delete-title" onClick={() => { if (!deleting) setPendingSeller(null); }}>
          <div className="price-help-dialog seller-delete-dialog" onClick={(event) => event.stopPropagation()}>
            <h2 id="seller-delete-title">Удаление продавца</h2>
            <p>Удаление продавца приведет к удалению всех его товаров без возможности возврата.</p>
            <p>Количество товаров: <strong>{pendingSeller.product_count ?? 0}</strong></p>
            <p>Вы точно хотите удалить?</p>
            {actionError ? <p className="form-feedback error" role="alert">{actionError}</p> : null}
            <div className="seller-delete-actions">
              <button type="button" className="seller-delete-cancel" disabled={deleting} onClick={() => setPendingSeller(null)}>Нет</button>
              <button type="button" className="seller-delete-confirm" disabled={deleting} onClick={() => void confirmDelete()}>{deleting ? "Удаление…" : "Да"}</button>
            </div>
          </div>
        </div> : null}
      </section>
  );
}
