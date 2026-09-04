"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { useI18n, type MessageKey } from "@/i18n";

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
  is_available?: boolean;
  total_quantity: number;
  images: ProductImage[];
  created_at: string;
  seller?: { id: number; username: string; first_name: string; email: string };
  last_moderation_decision?: "approved" | "rejected" | "returned_to_review" | null;
  ean_jv?: string | null;
  ean_xl?: string | null;
};

type ProductListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Product[];
};

const PAGE_SIZE = 10;

function sellerLabel(product: Product) {
  const name = product.seller?.first_name?.trim() || product.seller?.username;
  return name || "";
}

export default function SellerProductsPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const sellerId = Number(params.id);
  const sellerIdValid = Number.isInteger(sellerId) && sellerId > 0;
  const [products, setProducts] = useState<Product[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [availability, setAvailability] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading, setLoading] = useState(sellerIdValid);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sellerIdValid) return;

    const access = window.localStorage.getItem("benim_access_token");
    if (!access) {
      window.location.replace("/manager/login");
      return;
    }

    const query = new URLSearchParams({
      page: String(page),
      page_size: String(PAGE_SIZE),
      owner_id: String(sellerId),
    });
    if (availability) query.set("is_available", availability);
    if (appliedSearch) query.set("search", appliedSearch);

    let cancelled = false;

    async function loadProducts() {
      setLoading(true);
      setError("");

      try {
        const response = await authorizedFetch(`/api/v1/manager/products/?${query}`);
        if (cancelled) return;

        if (response.status === 401) {
          window.localStorage.removeItem("benim_access_token");
          window.localStorage.removeItem("benim_refresh_token");
          window.location.replace("/manager/login");
          return;
        }

        if (!response.ok) throw new Error("request failed");

        const data = (await response.json()) as ProductListResponse;
        if (cancelled) return;
        setProducts(data.results);
        setCount(data.count);
        setHasNext(Boolean(data.next));
        setHasPrevious(Boolean(data.previous));
        const name = data.results.map(sellerLabel).find(Boolean);
        if (name) setSellerName(name);
      } catch {
        if (!cancelled) setError(t("sellerProducts.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [page, availability, appliedSearch, sellerId, sellerIdValid, t]);

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
    const eanCount = [product.ean_jv, product.ean_xl].filter((code) => Boolean(code?.trim())).length;
    if (eanCount === 0) return "—";
    return t("products.eanCount", { count: eanCount });
  }

  const loadError = sellerIdValid ? error : t("sellerProducts.loadError");
  const subtitle = sellerName
    ? t("sellerProducts.namedSubtitle", { name: sellerName, count })
    : t("sellerProducts.subtitle", { count });

  return (
    <section className="content products-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t("common.panel")}</p>
          <h1>{t("sellerProducts.title")}</h1>
          <p className="products-subtitle">{subtitle}</p>
        </div>
        <Link className="back-link" href="/manager/sellers">{t("sellerProducts.back")}</Link>
      </header>

      <section className="products-panel">
        <form className="products-toolbar" onSubmit={applySearch}>
          <input aria-label={t("sellerProducts.searchAria")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("sellerProducts.searchPlaceholder")} />
          <select aria-label={t("sellerProducts.filterAria")} value={availability} onChange={(event) => { setPage(1); setAvailability(event.target.value); }}>
            <option value="">{t("sellerProducts.all")}</option>
            <option value="true">{t("common.active")}</option>
            <option value="false">{t("common.inactive")}</option>
          </select>
          <button type="submit">{t("common.search")}</button>
          <nav className="pagination" aria-label={t("sellerProducts.pagesAria")}>
            <button type="button" disabled={!hasPrevious || loading} onClick={() => setPage((value) => value - 1)}>{t("common.previous")}</button>
            <span>{t("common.page", { page })}</span>
            <button type="button" disabled={!hasNext || loading} onClick={() => setPage((value) => value + 1)}>{t("common.next")}</button>
          </nav>
        </form>

        {sellerIdValid && loading && <p className="products-message">{t("sellerProducts.loading")}</p>}
        {loadError && <p className="products-message error" role="alert">{loadError}</p>}
        {sellerIdValid && !loading && !error && products.length === 0 && <p className="products-message">{t("sellerProducts.empty")}</p>}

        {sellerIdValid && !loading && !error && products.length > 0 && <div className="products-table seller-products-table">
          <div className="table-header">
            <span>{t("products.col.product")}</span>
            <span>{t("products.col.status")}</span>
            <span>{t("sellerProducts.col.availability")}</span>
            <span>{t("products.col.ean")}</span>
            <span>{t("products.col.stock")}</span>
            <span>{t("products.col.sellerListing")}</span>
            <span>{t("products.col.created")}</span>
          </div>
          {products.map((product) => {
            const primaryImage = product.images.find((image) => image.is_primary) ?? product.images[0];
            const showPreviousReject = product.status === "submitted" && product.last_moderation_decision === "rejected";
            const available = product.is_available !== false;
            return <Link className="manager-product" href={`/manager/products/${product.id}`} key={product.id}>
              <div className="manager-product-name">
                <div className="manager-product-image">
                  {primaryImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={primaryImage.image} alt="" />
                  ) : <span>▣</span>}
                </div>
                <div className="manager-product-copy">
                  <p>{product.product_type}</p>
                  <h2>{product.title}</h2>
                  <div className="manager-product-meta">
                    <small>#{product.id}</small>
                  </div>
                </div>
              </div>
              <div className="manager-status-cell">
                <span className={`manager-status ${product.status}`}>{t(`status.${product.status}` as MessageKey)}</span>
                {showPreviousReject ? <small className="previous-decision">{t("products.previouslyRejected")}</small> : null}
              </div>
              <span className={`seller-availability ${available ? "available" : "unavailable"}`}>
                {available ? t("sellerProducts.available") : t("sellerProducts.unavailable")}
              </span>
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
