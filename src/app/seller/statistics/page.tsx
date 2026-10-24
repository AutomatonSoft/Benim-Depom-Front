"use client";

import { useEffect, useState } from "react";
import { Banknote, ClipboardList, Info, PackageCheck, PackageSearch } from "lucide-react";
import { SellerLoadingState, SellerNotice, SellerPage } from "@/components/SellerShell";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import SellerDateRangePicker from "@/components/seller/SellerDateRangePicker";
import { SellerSearchableSelect } from "@/components/seller/SellerSelect";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { sellerRequest, type PageResult, type SellerProduct } from "@/lib/seller";
import { firstSellerProductOptions, sellerProductSearchUrl } from "@/lib/seller-product-search";
import { getSellerDatePreset } from "@/lib/seller-date-range";
import { formatSellerCount, formatSellerMoney, sellerSalesStatsUrl } from "@/lib/seller-statistics";

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
  const [range, setRange] = useState(() => getSellerDatePreset("last30Days"));
  const [productId, setProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<SellerProduct | null>(null);
  const [initialProducts, setInitialProducts] = useState<SellerProduct[]>([]);
  const [searchResults, setSearchResults] = useState<{ query: string; products: SellerProduct[] } | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
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

  const { from: rangeFrom, to: rangeTo } = range;
  const dateError = Boolean(rangeFrom && rangeTo && rangeFrom > rangeTo);
  useEffect(() => {
    if (dateError) return;
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      sellerRequest<Stats>(sellerSalesStatsUrl({ from: rangeFrom, to: rangeTo }, productId), { signal: controller.signal })
        .then(result => { if (active) setStats(result); })
        .catch(e => { if (active && !controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not load sales statistics."); })
        .finally(() => { if (active && !controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [rangeFrom, rangeTo, productId, dateError]);

  const number = (value: number) => formatSellerCount(value, locale);
  const search = productSearch.trim();
  const products = search ? searchResults?.query === search ? searchResults.products : [] : initialProducts;
  const productOptions = [
    { value: "", label: t("All products") },
    ...products.map(product => ({ value: String(product.id), label: product.title })),
  ];

  return <SellerPage title="Sales statistics" description="Sales for the selected period.">
    <div className="seller-card seller-stat-filters">
      <label className="seller-field">{t("Date range")}
        <SellerDateRangePicker from={rangeFrom} to={rangeTo} onChange={setRange} />
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
    {loading && !dateError ? <SellerLoadingState label={t("Loading statistics…")} rows={2} /> : !dateError && stats && <>
      <div className="seller-card-grid seller-stat-grid">
        <div className="seller-kpi"><div className="seller-kpi-label"><span className="seller-stat-icon units"><PackageCheck size={18} strokeWidth={1.8} aria-hidden="true" /></span><span>{t("Units sold")}</span></div><strong>{number(stats.quantity_sold)}</strong></div>
        <div className="seller-kpi"><div className="seller-kpi-label"><span className="seller-stat-icon orders"><ClipboardList size={18} strokeWidth={1.8} aria-hidden="true" /></span><span>{t("Orders")}</span></div><strong>{number(stats.orders_count)}</strong></div>
        <div className="seller-kpi seller-kpi-revenue">
          <div className="seller-kpi-label">
            <span className="seller-stat-icon revenue"><Banknote size={18} strokeWidth={1.8} aria-hidden="true" /></span>
            <span>{t("Revenue")}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild><button type="button" className="seller-stat-info" aria-label={t("Revenue calculation details")}><Info size={16} aria-hidden="true" /></button></TooltipTrigger>
                <TooltipContent side="top" className="seller-stat-tooltip"><p>{t("Revenue amounts use different calculation methods and are not added together. EUR is based on Afterbuy listing prices. TRY uses recorded product card prices in lira. USD is converted from EUR at the latest available rate.")}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="seller-stat-revenue-values">
            {([ ["EUR", stats.amount_eur], ["TRY", stats.amount_try], ["USD", stats.amount_usd] ] as const).map(([currency, amount]) =>
              <div key={currency}><span>{currency}</span><strong>{formatSellerMoney(amount, currency, locale)}</strong></div>,
            )}
          </div>
        </div>
      </div>
      {stats.quantity_sold === 0 && <div className="seller-card seller-stat-empty" role="status"><span className="seller-stat-empty-icon"><PackageSearch size={22} aria-hidden="true" /></span><div><h2>{t("No sales yet")}</h2><p>{t("No sales in this period. Try another date range or product.")}</p></div></div>}
    </>}
  </SellerPage>;
}
