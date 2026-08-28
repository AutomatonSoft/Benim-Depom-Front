"use client";

import Link from "next/link";
import Sidebar from "@/components/Sidebar";
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
  status: string;
  total_quantity: number;
  images: ProductImage[];
  created_at: string;
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
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  deactivated: "Deactivated",
};

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
      window.location.replace("/login");
      return;
    }

    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (appliedSearch) params.set("search", appliedSearch);

    async function loadProducts() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/v1/manager/products/?${params}`, {
          headers: { Authorization: `Bearer ${access}` },
        });

        if (response.status === 401) {
          window.localStorage.removeItem("benim_access_token");
          window.localStorage.removeItem("benim_refresh_token");
          window.location.replace("/login");
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

  return (
    <main className="app-shell">
      <Sidebar active="products" />
      <section className="content products-page">
        <header className="topbar"><div><p className="eyebrow">Manager panel</p><h1>Products</h1><p className="products-subtitle">{count} products in your workspace</p></div><Link className="back-link" href="/">← Overview</Link></header>

        <section className="products-panel">
          <form className="products-toolbar" onSubmit={applySearch}>
            <input aria-label="Search products" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by product title" />
            <select aria-label="Filter by status" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
              <option value="">All statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="submit">Search</button>
          </form>

          {loading && <p className="products-message">Loading products…</p>}
          {error && <p className="products-message error" role="alert">{error}</p>}
          {!loading && !error && products.length === 0 && <p className="products-message">No products match these filters.</p>}

          {!loading && !error && products.length > 0 && <div className="products-table">
            <div className="table-header"><span>Product</span><span>Status</span><span>Stock</span><span>Price</span><span>Created</span></div>
            {products.map((product) => {
              const primaryImage = product.images.find((image) => image.is_primary) ?? product.images[0];
              return <article className="manager-product" key={product.id}>
                <div className="manager-product-name">
                  <div className="manager-product-image">{primaryImage ? <img src={primaryImage.image} alt="" /> : <span>▣</span>}</div>
                  <div><p>{product.product_type}</p><h2>{product.title}</h2><small>#{product.id}</small></div>
                </div>
                <span className={`manager-status ${product.status}`}>{statusLabels[product.status] ?? product.status}</span>
                <strong>{product.total_quantity} pcs</strong>
                <strong>{formatPrice(product)}</strong>
                <time dateTime={product.created_at}>{formatDate(product.created_at)}</time>
              </article>;
            })}
          </div>}

          <footer className="pagination"><button disabled={!hasPrevious || loading} onClick={() => setPage((value) => value - 1)}>← Previous</button><span>Page {page}</span><button disabled={!hasNext || loading} onClick={() => setPage((value) => value + 1)}>Next →</button></footer>
        </section>
      </section>
    </main>
  );
}
