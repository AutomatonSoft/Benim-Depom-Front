"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Banknote, ClipboardList, PackageCheck } from "lucide-react";
import { SellerLoadingState, SellerNotice, SellerPage } from "@/components/SellerShell";
import SellerDateRangePicker from "@/components/seller/SellerDateRangePicker";
import { SellerSearchableSelect } from "@/components/seller/SellerSelect";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { sellerRequest, type PageResult, type SellerProduct } from "@/lib/seller";
import { firstSellerProductOptions, sellerProductSearchUrl } from "@/lib/seller-product-search";
import { getSellerDatePreset } from "@/lib/seller-date-range";

type Stats = {
  quantity_sold: number;
  orders_count: number;
  amount_eur: string | null;
  amount_try: string | null;
  amount_usd: string | null;
  from: string | null;
  to: string | null;
};

export default function SellerStatisticsPage() {
  const { t, locale } = useSellerI18n();
  const router = useRouter();
  const [range, setRange] = useState(() => getSellerDatePreset("last30Days"));
  const [productId, setProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<SellerProduct | null>(null);
  const [initialProducts, setInitialProducts] = useState<SellerProduct[]>([]);
  const [searchResults, setSearchResults] = useState<{ query: string; products: SellerProduct[] } | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [sale, setSale] = useState<{ query: string; product: SellerProduct; stats: Stats } | null>(null);
  const [saleError, setSaleError] = useState("");
  const [error, setError] = useState("");
  const [productError, setProductError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialProductsLoading, setInitialProductsLoading] = useState(true);
  const [productSearchLoading, setProductSearchLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    sellerRequest<PageResult<SellerProduct>>(sellerProductSearchUrl(), { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setInitialProducts(firstSellerProductOptions(result.results)); })
      .catch(e => { if (!controller.signal.aborted) setProductError(e instanceof Error ? e.message : "Could not load products for filtering."); })
      .finally(() => { if (!controller.signal.aborted) setInitialProductsLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const search = productSearch.trim();
    if (!search) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setProductSearchLoading(true);
      setProductError("");
      sellerRequest<PageResult<SellerProduct>>(sellerProductSearchUrl(search), { signal: controller.signal })
        .then(result => { if (!controller.signal.aborted) setSearchResults({ query: search, products: firstSellerProductOptions(result.results) }); })
        .catch(e => { if (!controller.signal.aborted) setProductError(e instanceof Error ? e.message : "Could not search products."); })
        .finally(() => { if (!controller.signal.aborted) setProductSearchLoading(false); });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [productSearch]);

  const dateError = Boolean(range.from && range.to && range.from > range.to);
  useEffect(() => {
    if (dateError) return;
    const controller = new AbortController();
    let active = true;
    const query = new URLSearchParams();
    if (range.from) query.set("from", range.from);
    if (range.to) query.set("to", range.to);
    if (productId) query.set("product_id", productId);
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      sellerRequest<Stats>(`/api/v1/products/sales-stats/?${query}`, { signal: controller.signal })
        .then(result => { if (active) setStats(result); })
        .catch(e => { if (active && !controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not load sales statistics."); })
        .finally(() => { if (active && !controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [range.from, range.to, productId, dateError]);

  const saleParams = new URLSearchParams({ product_id: "20" });
  if (range.from) saleParams.set("from", range.from);
  if (range.to) saleParams.set("to", range.to);
  const saleQuery = saleParams.toString();
  const showSale = !dateError && (!productId || productId === "20");

  useEffect(() => {
    if (!showSale) return;
    const controller = new AbortController();
    Promise.all([
      sellerRequest<SellerProduct>("/api/v1/products/20/", { signal: controller.signal }),
      sellerRequest<Stats>(`/api/v1/products/sales-stats/?${saleQuery}`, { signal: controller.signal }),
    ])
      .then(([product, stats]) => {
        if (!controller.signal.aborted) {
          setSale({ query: saleQuery, product, stats });
          setSaleError("");
        }
      })
      .catch(e => { if (!controller.signal.aborted) setSaleError(e instanceof Error ? e.message : "Could not load sales statistics."); });
    return () => controller.abort();
  }, [showSale, saleQuery]);

  const currentSale = showSale && sale?.query === saleQuery ? sale : null;

  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const money = (value: string | null, currency: string) => value === null ? "—" : `${value} ${currency}`;
  const search = productSearch.trim();
  const products = search ? searchResults?.query === search ? searchResults.products : [] : initialProducts;
  const productOptions = [
    { value: "", label: t("All products") },
    ...products.map(product => ({ value: String(product.id), label: product.title })),
  ];

  return <SellerPage title="Sales statistics" description="Sales for the selected dates.">
    <div className="seller-card seller-stat-filters">
      <label className="seller-field">{t("Date range")}
        <SellerDateRangePicker from={range.from} to={range.to} onChange={setRange} />
      </label>
      <label className="seller-field">{t("Product")}
        <SellerSearchableSelect
          value={productId}
          selectedLabel={productId ? selectedProduct?.title : t("All products")}
          placeholder={t("All products")}
          ariaLabel={t("Product")}
          options={productOptions}
          searchValue={productSearch}
          onSearchChange={setProductSearch}
          loading={productSearch.trim() ? productSearchLoading : initialProductsLoading}
          emptyMessage={productSearch.trim() ? "No products match your search." : "No products available."}
          onValueChange={value => {
            setProductId(value);
            setSelectedProduct(value ? products.find(product => String(product.id) === value) || selectedProduct : null);
          }}
        />
      </label>
    </div>
    {dateError && <SellerNotice>{t("Start date must be before end date.")}</SellerNotice>}
    {productError && <SellerNotice>{t("The product filter could not be loaded. Sales totals remain available for all products.")}</SellerNotice>}
    {error && <SellerNotice>{error}</SellerNotice>}
    {showSale && saleError && <SellerNotice>{saleError}</SellerNotice>}
    {loading && !dateError ? <SellerLoadingState label={t("Loading statistics…")} rows={2} /> : !dateError && stats && <>
      <div className="seller-card-grid seller-stat-grid">
        <div className="seller-kpi"><div className="seller-kpi-label"><PackageCheck size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t("Units sold")}</span></div><strong>{number(stats.quantity_sold)}</strong></div>
        <div className="seller-kpi"><div className="seller-kpi-label"><ClipboardList size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t("Orders")}</span></div><strong>{number(stats.orders_count)}</strong></div>
        <div className="seller-kpi seller-kpi-revenue">
          <div className="seller-kpi-label"><Banknote size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t("Revenue")}</span></div>
          <div className="seller-stat-revenue-values">
            {([ ["EUR", stats.amount_eur], ["TRY", stats.amount_try], ["USD", stats.amount_usd] ] as const).map(([currency, amount]) =>
              <div key={currency}><span>{currency}</span><strong>{money(amount, currency)}</strong></div>,
            )}
          </div>
        </div>
      </div>
      {stats.quantity_sold === 0 && <div className="seller-card seller-empty seller-stat-empty">{t("No sales in this period. Try another date range or product.")}</div>}
    </>}
    {!loading && !error && !saleError && currentSale && currentSale.stats.quantity_sold > 0 && <section className="seller-card seller-stat-preview">
      <div className="seller-stat-preview-row">
        <div className="seller-stat-preview-product"><strong><button type="button" className="seller-link seller-link-button seller-product-title-button" data-seller-translate="skip" onClick={() => router.push(`/seller/products/${currentSale.product.id}`)}>{currentSale.product.title}</button></strong></div>
        <span>{t("Units sold")}: {number(currentSale.stats.quantity_sold)}</span>
        <strong data-seller-translate="skip">{money(currentSale.stats.amount_eur, "EUR")}</strong>
      </div>
    </section>}
  </SellerPage>;
}
