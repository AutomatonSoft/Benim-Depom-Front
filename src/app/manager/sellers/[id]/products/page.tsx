"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, MouseEvent, useEffect, useState } from "react";

import { EmptyState, Feedback, PageFrame, PageHeader, PaginationBar, Panel, PanelToolbar, StatusBadge } from "@/components/manager/ui";
import { ProductShortDescriptionCell } from "@/components/manager/product-short-description";
import { DEFAULT_PRODUCT_ORDERING, SortableHeader } from "@/components/manager/sortable-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelectMenu } from "@/components/ui/filter-select";
import { authorizedFetch } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/date";
import { useI18n, type MessageKey } from "@/i18n";

type ProductImage = {
  image: string;
  thumbnail?: string | null;
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
  active_listing_count?: number;
  images: ProductImage[];
  created_at: string;
  seller?: { id: number; username: string; first_name: string; email: string };
  last_moderation_decision?: "approved" | "rejected" | "returned_to_review" | "withdrawn" | null;
  ean_jv?: string | null;
  ean_xl?: string | null;
  warehouse_city?: string | null;
  cbm?: string | null;
  cbm_calculated?: string | null;
  cbm_override?: string | null;
};

type ProductListResponse = {
  count: number;
  archived_count?: number;
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
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const sellerId = Number(params.id);
  const sellerIdValid = Number.isInteger(sellerId) && sellerId > 0;
  const [products, setProducts] = useState<Product[]>([]);
  const [count, setCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [page, setPage] = useState(1);
  const [availability, setAvailability] = useState("");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState(DEFAULT_PRODUCT_ORDERING);
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
    if (ordering !== DEFAULT_PRODUCT_ORDERING) query.set("ordering", ordering);

    let cancelled = false;

    async function loadProducts() {
      setLoading(true);
      setError("");

      try {
        const response = await authorizedFetch(`/api/v2/manager/products/?${query}`);
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
        setArchivedCount(data.archived_count ?? 0);
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
  }, [page, availability, appliedSearch, ordering, sellerId, sellerIdValid, t]);

  function openProduct(event: MouseEvent, href: string) {
    if (window.getSelection()?.toString()) return;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener");
      return;
    }
    router.push(href);
  }

  function handleProductSaved(updated: Partial<Product> & { id: number }) {
    setProducts((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
  }

  function changeOrdering(next: string) {
    setPage(1);
    setOrdering(next);
  }

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

  const loadError = sellerIdValid ? error : t("sellerProducts.loadError");
  const subtitle = sellerName
    ? t("sellerProducts.namedSubtitle", { name: sellerName, count })
    : t("sellerProducts.subtitle", { count });

  return (
    <PageFrame>
      <PageHeader
        eyebrow={t("common.panel")}
        title={t("sellerProducts.title")}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{subtitle}</span>
            {archivedCount > 0 ? (
              <span className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {t("sellerProducts.archivedCount", { count: archivedCount })}
              </span>
            ) : null}
          </span>
        }
        actions={
          <Button asChild variant="secondary">
            <Link href="/manager/sellers">{t("sellerProducts.back")}</Link>
          </Button>
        }
      />

      <Panel>
        <PanelToolbar>
          <form className="flex w-full flex-wrap items-center gap-3" onSubmit={applySearch}>
            <Input
              className="min-w-[220px] flex-1"
              aria-label={t("sellerProducts.searchAria")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("sellerProducts.searchPlaceholder")}
            />
            <FilterSelectMenu
              className="w-[180px]"
              aria-label={t("sellerProducts.filterAria")}
              value={availability}
              onValueChange={(value) => {
                setPage(1);
                setAvailability(value);
              }}
              options={[
                { value: "", label: t("sellerProducts.all") },
                { value: "true", label: t("common.active") },
                { value: "false", label: t("common.inactive") },
              ]}
            />
            <Button type="submit">{t("common.search")}</Button>
          </form>
        </PanelToolbar>

        {sellerIdValid && loading ? <p className="px-4 py-6 text-sm font-semibold text-muted-foreground">{t("sellerProducts.loading")}</p> : null}
        {loadError ? <Feedback className="px-4 py-4">{loadError}</Feedback> : null}
        {sellerIdValid && !loading && !error && products.length === 0 ? <EmptyState title={t("sellerProducts.empty")} /> : null}

        {sellerIdValid && !loading && !error && products.length > 0 ? (
          <>
            <PaginationBar
              page={page}
              hasPrevious={hasPrevious}
              hasNext={hasNext}
              loading={loading}
              onPrevious={() => setPage((value) => value - 1)}
              onNext={() => setPage((value) => value + 1)}
              previousLabel={t("common.previous")}
              nextLabel={t("common.next")}
              pageLabel={t("common.page", { page })}
            />
            <div className="overflow-x-auto">
            <div className="grid min-w-[1390px] grid-cols-[minmax(240px,2fr)_210px_140px_110px_110px_90px_140px_120px_140px] gap-3 border-b border-border bg-[#f8fafc] items-center px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">
              <span>{t("products.col.product")}</span>
              <span>{t("products.col.shortDescription")}</span>
              <span>{t("products.col.status")}</span>
              <SortableHeader label={t("sellerProducts.col.availability")} sortKey="available" ordering={ordering} onOrderingChange={changeOrdering} />
              <span>{t("products.col.ean")}</span>
              <SortableHeader label={t("products.col.stock")} sortKey="stock" ordering={ordering} onOrderingChange={changeOrdering} />
              <SortableHeader label={t("products.col.sellerListing")} sortKey="price" ordering={ordering} onOrderingChange={changeOrdering} />
              <SortableHeader label={t("products.col.activeListings")} sortKey="active_listings" align="center" ordering={ordering} onOrderingChange={changeOrdering} />
              <SortableHeader label={t("products.col.created")} sortKey="created_at" ordering={ordering} onOrderingChange={changeOrdering} />
            </div>
            {products.map((product) => {
              const primaryImage = product.images.find((image) => image.is_primary) ?? product.images[0];
              const showPreviousReject = product.status === "submitted" && product.last_moderation_decision === "rejected";
              const available = product.is_available !== false;
              return (
                <div
                  key={product.id}
                  onClick={(event) => openProduct(event, `/manager/products/${product.id}`)}
                  className="grid cursor-pointer min-w-[1390px] select-text grid-cols-[minmax(240px,2fr)_210px_140px_110px_110px_90px_140px_120px_140px] items-center gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-[#f8fafc]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-muted-foreground">
                      {primaryImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={primaryImage.thumbnail || primaryImage.image} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                      ) : (
                        <span aria-hidden>▣</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{product.product_type}</p>
                      <h2 className="truncate text-sm font-extrabold text-primary">
                        <Link
                          href={`/manager/products/${product.id}`}
                          draggable={false}
                          onClick={(event) => event.stopPropagation()}
                          className="outline-none hover:underline focus-visible:underline"
                        >
                          {product.title}
                        </Link>
                      </h2>
                      <small className="text-xs font-semibold text-muted-foreground">#{product.id}</small>
                    </div>
                  </div>
                  <ProductShortDescriptionCell product={product} onSaved={handleProductSaved} />
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={product.status}>{t(`status.${product.status}` as MessageKey)}</StatusBadge>
                    {showPreviousReject ? <small className="text-[11px] font-bold text-[var(--ui-danger)]">{t("products.previouslyRejected")}</small> : null}
                  </div>
                  <StatusBadge status={available ? "available" : "unavailable"}>
                    {available ? t("sellerProducts.available") : t("sellerProducts.unavailable")}
                  </StatusBadge>
                  <strong className="text-[11px] font-bold tabular-nums tracking-tight text-primary">
                    <span className="block">{product.ean_jv?.trim() || "—"}</span>
                    {product.ean_jv?.trim() || product.ean_xl?.trim() ? (
                      <span className="block">{product.ean_xl?.trim() || "—"}</span>
                    ) : null}
                  </strong>
                  <strong className="text-sm font-bold text-primary">{t("products.pcs", { count: product.total_quantity })}</strong>
                  <strong className="text-sm font-bold text-primary">
                    <span className="block">{formatPrice(product)}</span>
                    <small className="font-semibold text-muted-foreground">{formatListing(product)}</small>
                  </strong>
                  <span className="text-center">
                    <strong className={`inline-flex min-w-8 justify-center rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ${(product.active_listing_count ?? 0) > 0 ? "bg-emerald-50 text-emerald-700" : "bg-secondary text-muted-foreground"}`}>
                      {product.active_listing_count ?? "—"}
                    </strong>
                  </span>
                  <time className="text-xs font-semibold text-muted-foreground" dateTime={product.created_at}>
                    <span className="block whitespace-nowrap">{formatDate(product.created_at)}</span>
                    <span className="mt-1 block text-[11px] font-normal tabular-nums">{formatTime(product.created_at)}</span>
                  </time>
                </div>
              );
            })}
          </div>
          </>
        ) : null}
      </Panel>
    </PageFrame>
  );
}
