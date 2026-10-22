"use client";

import { useEffect, useState } from "react";
import { SellerNotice, SellerPage } from "@/components/SellerShell";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { sellerAllPages, sellerRequest, type SellerProduct } from "@/lib/seller";

type Stats = {
  quantity_sold: number;
  orders_count: number;
  amount_eur: string | null;
  amount_try: string | null;
  amount_usd: string | null;
  from: string | null;
  to: string | null;
};

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function SellerStatisticsPage() {
  const { t } = useSellerI18n();
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  const [from, setFrom] = useState(localDate(start));
  const [to, setTo] = useState(localDate(today));
  const [productId, setProductId] = useState("");
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [productError, setProductError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    sellerAllPages<SellerProduct>("/api/v1/products/?page_size=100")
      .then(result => { if (active) setProducts(result); })
      .catch(e => { if (active) setProductError(e instanceof Error ? e.message : "Could not load products for filtering."); });
    return () => { active = false; };
  }, []);

  const dateError = Boolean(from && to && from > to);
  useEffect(() => {
    if (dateError) return;
    const controller = new AbortController();
    let active = true;
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
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
  }, [from, to, productId, dateError]);

  function preset(days: number | "month") {
    const startDate = new Date();
    if (days === "month") startDate.setDate(1);
    else startDate.setDate(startDate.getDate() - days + 1);
    setFrom(localDate(startDate));
    setTo(localDate(new Date()));
  }

  const money = (value: string | null, currency: string) => value === null ? "—" : `${value} ${currency}`;

  return <SellerPage title="Sales statistics" description="Afterbuy sales totals for the selected business dates.">
    <div className="seller-toolbar seller-stat-presets">
      <button type="button" className="seller-button" onClick={() => preset(7)}>{t("Last 7 days")}</button>
      <button type="button" className="seller-button" onClick={() => preset(30)}>{t("Last 30 days")}</button>
      <button type="button" className="seller-button" onClick={() => preset("month")}>{t("This month")}</button>
    </div>
    <div className="seller-card seller-stat-filters">
      <label className="seller-field">{t("From")}<Input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
      <label className="seller-field">{t("To")}<Input type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
      <label className="seller-field">{t("Product")}
        <Select value={productId} onChange={event => setProductId(event.target.value)}>
          <option value="">{t("All products")}</option>
          {products.map(product => <option data-seller-translate="skip" value={product.id} key={product.id}>{product.title}</option>)}
        </Select>
      </label>
    </div>
    {dateError && <SellerNotice>{t("Start date must be before end date.")}</SellerNotice>}
    {productError && <SellerNotice>{t("The product filter could not be loaded. Sales totals remain available for all products.")}</SellerNotice>}
    {error && <SellerNotice>{error}</SellerNotice>}
    {loading && !dateError ? <p className="seller-empty" aria-live="polite">{t("Loading statistics…")}</p> : !dateError && stats && <>
      <div className="seller-card-grid">
        <div className="seller-kpi"><span>{t("Units sold")}</span><strong>{stats.quantity_sold}</strong></div>
        <div className="seller-kpi"><span>{t("Orders")}</span><strong>{stats.orders_count}</strong></div>
        <div className="seller-kpi"><span>{t("Revenue (EUR)")}</span><strong>{money(stats.amount_eur, "EUR")}</strong></div>
        <div className="seller-kpi"><span>{t("Revenue (TRY)")}</span><strong>{money(stats.amount_try, "TRY")}</strong></div>
        <div className="seller-kpi"><span>{t("Revenue (USD)")}</span><strong>{money(stats.amount_usd, "USD")}</strong></div>
      </div>
      {stats.quantity_sold === 0 && <div className="seller-card seller-empty seller-stat-empty">{t("No sales in this period. Try another date range or product.")}</div>}
    </>}
  </SellerPage>;
}
