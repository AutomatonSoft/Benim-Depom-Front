"use client";

import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { FormEvent, useEffect, useState } from "react";

type ProductImage = {
  image: string;
  is_primary: boolean;
};

type Product = {
  id: number;
  title: string;
  product_type: string;
  unit_price: string;
  currency: string;
  listing_price_eur?: string | null;
  status: string;
  total_quantity: number;
  images: ProductImage[];
  created_at: string;
  seller?: { id: number; username: string; first_name: string; email: string };
  last_moderation_decision?: "approved" | "rejected" | null;
};

type ProductListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Product[];
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
  deactivated: "Deactivated",
};

const statusFilterOptions = Object.entries(statusLabels).filter(([value]) => value !== "draft");

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const access = window.localStorage.getItem("benim_access_token");
    if (!access) {
      window.location.replace("/manager/login");
      return;
    }

    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (appliedSearch) params.set("search", appliedSearch);

    async function loadProducts() {
      setLoading(true);
      setError("");

      try {
        const response = await authorizedFetch(`/api/v1/manager/products/?${params}`);

        if (response.status === 401) {
          window.localStorage.removeItem("benim_access_token");
          window.localStorage.removeItem("benim_refresh_token");
          window.location.replace("/manager/login");
          return;
        }

        if (!response.ok) throw new Error("request failed");

        const data = (await response.json()) as ProductListResponse;
        setProducts(data.results);
        setCount(data.count);
        setHasNext(Boolean(data.next));
        setHasPrevious(Boolean(data.previous));
      } catch {
        setError("Unable to load products. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    void loadProducts();
  }, [page, status, appliedSearch]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }

  function formatPrice(product: Product) {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: product.currency,
    }).format(Number(product.unit_price));
  }

  function formatListing(product: Product) {
    if (product.listing_price_eur == null || product.listing_price_eur === "") {
      return "Listing —";
    }
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(Number(product.listing_price_eur));
  }

  return (
    <main className="app-shell">
      <Sidebar active="products" />
      <section className="content products-page">
        <header className="topbar"><div><p className="eyebrow">Manager panel</p><h1>Products</h1><p className="products-subtitle">{count} products in your workspace</p></div><Link className="back-link" href="/manager">← Overview</Link></header>

        <section className="products-panel">
          <form className="products-toolbar" onSubmit={applySearch}>
            <input aria-label="Search products" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title or EAN" />
            <select aria-label="Filter by status" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
              <option value="">All statuses</option>
              {statusFilterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="submit">Search</button>
            <nav className="pagination" aria-label="Product list pages">
              <button type="button" disabled={!hasPrevious || loading} onClick={() => setPage((value) => value - 1)}>← Previous</button>
              <span>Page {page}</span>
              <button type="button" disabled={!hasNext || loading} onClick={() => setPage((value) => value + 1)}>Next →</button>
            </nav>
          </form>

          {loading && <p className="products-message">Loading products…</p>}
          {error && <p className="products-message error" role="alert">{error}</p>}
          {!loading && !error && products.length === 0 && <p className="products-message">No products match these filters.</p>}

          {!loading && !error && products.length > 0 && <div className="products-table">
            <div className="table-header"><span>Product</span><span>Status</span><span>Stock</span><span>Seller / listing</span><span>Created</span></div>
            {products.map((product) => {
              const primaryImage = product.images.find((image) => image.is_primary) ?? product.images[0];
              const showPreviousReject = product.last_moderation_decision === "rejected" && product.status !== "rejected";
              return <Link className="manager-product" href={`/manager/products/${product.id}`} key={product.id}>
                <div className="manager-product-name">
                  <div className="manager-product-image">{primaryImage ? <img src={primaryImage.image} alt="" /> : <span>▣</span>}</div>
                  <div className="manager-product-copy">
                    <p>{product.product_type}</p>
                    <h2>{product.title}</h2>
                    <div className="manager-product-meta">
                      <small>#{product.id}</small>
                      {showPreviousReject ? <span className="previous-decision">Previous: Reject</span> : null}
                    </div>
                    {product.seller && (
                      <span className="product-owner">
                        <strong>{product.seller.username}</strong>
                        {product.seller.first_name ? ` · ${product.seller.first_name}` : ""}
                        {product.seller.email ? <em>{product.seller.email}</em> : null}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`manager-status ${product.status}`}>{statusLabels[product.status] ?? product.status}</span>
                <strong>{product.total_quantity} pcs</strong>
                <strong className="price-stack"><span>{formatPrice(product)}</span><small>{formatListing(product)}</small></strong>
                <time dateTime={product.created_at}>{formatDate(product.created_at, true)}</time>
              </Link>;
            })}
          </div>}
        </section>
      </section>
    </main>
  );
}
