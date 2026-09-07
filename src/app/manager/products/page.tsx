"use client";

import Link from "next/link";
import { authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { useI18n, type MessageKey } from "@/i18n";
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
  last_moderation_decision?: "approved" | "rejected" | "returned_to_review" | "withdrawn" | null;
  ean_jv?: string | null;
  ean_xl?: string | null;
};

type ProductListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Product[];
};

const statusKeys = ["draft", "submitted", "approved", "rejected", "withdrawn", "deactivated"] as const;

const statusFilterOptions = statusKeys.filter((value) => value !== "draft");

export default function ProductsPage() {
  const { t } = useI18n();
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
        setError(t("products.loadError"));
      } finally {
        setLoading(false);
      }
    }

    void loadProducts();
  }, [page, status, appliedSearch, t]);

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
      return t("products.listingEmpty");
    }
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(Number(product.listing_price_eur));
  }

  function eanCountLabel(product: Product) {
    const count = [product.ean_jv, product.ean_xl].filter((code) => Boolean(code?.trim())).length;
    if (count === 0) return "—";
    return t("products.eanCount", { count });
  }

  return (
    <section className="content products-page">
        <header className="topbar"><div><p className="eyebrow">{t("common.panel")}</p><h1>{t("products.title")}</h1><p className="products-subtitle">{t("products.subtitle", { count })}</p></div><Link className="back-link" href="/manager">{t("products.backOverview")}</Link></header>

        <section className="products-panel">
          <form className="products-toolbar" onSubmit={applySearch}>
            <input aria-label={t("products.searchAria")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("products.searchPlaceholder")} />
            <select aria-label={t("products.statusAria")} value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
              <option value="">{t("products.allStatuses")}</option>
              {statusFilterOptions.map((value) => <option key={value} value={value}>{t(`status.${value}` as MessageKey)}</option>)}
            </select>
            <button type="submit">{t("common.search")}</button>
            <nav className="pagination" aria-label={t("products.pagesAria")}>
              <button type="button" disabled={!hasPrevious || loading} onClick={() => setPage((value) => value - 1)}>{t("common.previous")}</button>
              <span>{t("common.page", { page })}</span>
              <button type="button" disabled={!hasNext || loading} onClick={() => setPage((value) => value + 1)}>{t("common.next")}</button>
            </nav>
          </form>

          {loading && <p className="products-message">{t("products.loading")}</p>}
          {error && <p className="products-message error" role="alert">{error}</p>}
          {!loading && !error && products.length === 0 && <p className="products-message">{t("products.empty")}</p>}

          {!loading && !error && products.length > 0 && <div className="products-table">
            <div className="table-header"><span>{t("products.col.product")}</span><span>{t("products.col.status")}</span><span>{t("products.col.ean")}</span><span>{t("products.col.stock")}</span><span>{t("products.col.sellerListing")}</span><span>{t("products.col.created")}</span></div>
            {products.map((product) => {
              const primaryImage = product.images.find((image) => image.is_primary) ?? product.images[0];
              const showPreviousReject = product.status === "submitted" && product.last_moderation_decision === "rejected";
              return <Link className="manager-product" href={`/manager/products/${product.id}`} key={product.id}>
                <div className="manager-product-name">
                  <div className="manager-product-image">{primaryImage ? <img src={primaryImage.image} alt="" /> : <span>▣</span>}</div>
                  <div className="manager-product-copy">
                    <p>{product.product_type}</p>
                    <h2>{product.title}</h2>
                    <div className="manager-product-meta">
                      <small>#{product.id}</small>
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
                <div className="manager-status-cell"><span className={`manager-status ${product.status}`}>{t(`status.${product.status}` as MessageKey)}</span>{showPreviousReject ? <small className="previous-decision">{t("products.previouslyRejected")}</small> : null}</div>
                <strong className="ean-count">{eanCountLabel(product)}</strong>
                <strong>{t("products.pcs", { count: product.total_quantity })}</strong>
                <strong className="price-stack"><span>{formatPrice(product)}</span><small>{formatListing(product)}</small></strong>
                <time dateTime={product.created_at}>{formatDate(product.created_at, true)}</time>
              </Link>;
            })}
          </div>}
        </section>
      </section>
  );
}
