"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { EmptyState, Feedback, PageFrame, PageHeader, PaginationBar, Panel, PanelToolbar, StatusBadge } from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
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
    <PageFrame>
      <PageHeader
        eyebrow={t("common.panel")}
        title={t("sellerProducts.title")}
        description={subtitle}
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
            <FilterSelect
              className="w-[180px]"
              aria-label={t("sellerProducts.filterAria")}
              value={availability}
              onChange={(event) => {
                setPage(1);
                setAvailability(event.target.value);
              }}
            >
              <option value="">{t("sellerProducts.all")}</option>
              <option value="true">{t("common.active")}</option>
              <option value="false">{t("common.inactive")}</option>
            </FilterSelect>
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
            <div className="grid min-w-[1040px] grid-cols-[minmax(260px,2fr)_140px_110px_90px_90px_140px_140px] gap-3 border-b border-border bg-[#f8fafc] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">
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
              return (
                <Link
                  key={product.id}
                  href={`/manager/products/${product.id}`}
                  className="grid min-w-[1040px] grid-cols-[minmax(260px,2fr)_140px_110px_90px_90px_140px_140px] items-center gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-[#f8fafc]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-muted-foreground">
                      {primaryImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={primaryImage.image} alt="" className="size-full object-cover" />
                      ) : (
                        <span aria-hidden>▣</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{product.product_type}</p>
                      <h2 className="truncate text-sm font-extrabold text-primary">{product.title}</h2>
                      <small className="text-xs font-semibold text-muted-foreground">#{product.id}</small>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={product.status}>{t(`status.${product.status}` as MessageKey)}</StatusBadge>
                    {showPreviousReject ? <small className="text-[11px] font-bold text-[var(--ui-danger)]">{t("products.previouslyRejected")}</small> : null}
                  </div>
                  <StatusBadge status={available ? "available" : "unavailable"}>
                    {available ? t("sellerProducts.available") : t("sellerProducts.unavailable")}
                  </StatusBadge>
                  <strong className="text-sm font-bold text-primary">{eanCountLabel(product)}</strong>
                  <strong className="text-sm font-bold text-primary">{t("products.pcs", { count: product.total_quantity })}</strong>
                  <strong className="text-sm font-bold text-primary">
                    <span className="block">{formatPrice(product)}</span>
                    <small className="font-semibold text-muted-foreground">{formatListing(product)}</small>
                  </strong>
                  <time className="text-xs font-semibold text-muted-foreground" dateTime={product.created_at}>
                    {formatDate(product.created_at, true)}
                  </time>
                </Link>
              );
            })}
          </div>
          </>
        ) : null}
      </Panel>
    </PageFrame>
  );
}
