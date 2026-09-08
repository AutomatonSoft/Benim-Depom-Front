"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Package } from "lucide-react";

import { EmptyState, Feedback, PageContainer, PageHeader, PaginationBar, SectionCard, SectionToolbar, StatusBadge } from "@/components/manager/ui";
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
    <PageContainer>
      <PageHeader
        eyebrow={t("common.panel")}
        title={t("products.title")}
        description={t("products.subtitle", { count })}
        secondaryActions={
          <Button asChild variant="secondary">
            <Link href="/manager">{t("products.backOverview")}</Link>
          </Button>
        }
      />

      <SectionCard>
        <SectionToolbar>
          <form className="flex w-full flex-wrap items-center gap-3" onSubmit={applySearch}>
            <Input
              className="min-w-[220px] flex-1"
              aria-label={t("products.searchAria")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("products.searchPlaceholder")}
            />
            <FilterSelect
              className="w-[180px]"
              aria-label={t("products.statusAria")}
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
            >
              <option value="">{t("products.allStatuses")}</option>
              {statusFilterOptions.map((value) => (
                <option key={value} value={value}>
                  {t(`status.${value}` as MessageKey)}
                </option>
              ))}
            </FilterSelect>
            <Button type="submit">{t("common.search")}</Button>
          </form>
        </SectionToolbar>

        {loading ? <p className="px-5 py-6 text-sm font-semibold text-muted-foreground">{t("products.loading")}</p> : null}
        {error ? <Feedback className="px-5 py-4">{error}</Feedback> : null}
        {!loading && !error && products.length === 0 ? <EmptyState icon={Package} title={t("products.empty")} /> : null}

        {!loading && !error && products.length > 0 ? (
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
            <div className="grid min-w-[980px] grid-cols-[minmax(280px,2fr)_140px_90px_90px_140px_140px] gap-3 border-b border-border bg-[#f8fafc] px-5 py-2 text-[11px] font-extrabold uppercase tracking-[0.04em] text-muted-foreground">
              <span>{t("products.col.product")}</span>
              <span>{t("products.col.status")}</span>
              <span className="text-right">{t("products.col.ean")}</span>
              <span className="text-right">{t("products.col.stock")}</span>
              <span className="text-right">{t("products.col.sellerListing")}</span>
              <span>{t("products.col.created")}</span>
            </div>
            {products.map((product) => {
              const primaryImage = product.images.find((image) => image.is_primary) ?? product.images[0];
              const showPreviousReject = product.status === "submitted" && product.last_moderation_decision === "rejected";
              return (
                <Link
                  key={product.id}
                  href={`/manager/products/${product.id}`}
                  className="grid min-w-[980px] grid-cols-[minmax(280px,2fr)_140px_90px_90px_140px_140px] items-center gap-3 border-b border-border px-5 py-2.5 transition-colors hover:bg-[#f8fafc]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary text-muted-foreground">
                      {primaryImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={primaryImage.image} alt="" className="size-full object-cover" />
                      ) : (
                        <Package className="size-4" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{product.product_type}</p>
                      <h2 className="truncate text-sm font-extrabold text-primary">{product.title}</h2>
                      <small className="text-xs font-semibold text-muted-foreground">#{product.id}</small>
                      {product.seller ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          <strong className="font-bold text-primary">{product.seller.username}</strong>
                          {product.seller.first_name ? ` · ${product.seller.first_name}` : ""}
                          {product.seller.email ? ` · ${product.seller.email}` : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={product.status}>{t(`status.${product.status}` as MessageKey)}</StatusBadge>
                    {showPreviousReject ? <small className="text-[11px] font-bold text-[var(--ui-danger)]">{t("products.previouslyRejected")}</small> : null}
                  </div>
                  <strong className="text-right text-sm font-bold tabular-nums text-primary">{eanCountLabel(product)}</strong>
                  <strong className="text-right text-sm font-bold tabular-nums text-primary">{t("products.pcs", { count: product.total_quantity })}</strong>
                  <strong className="text-right text-sm font-bold tabular-nums text-primary">
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
      </SectionCard>
    </PageContainer>
  );
}
