"use client";

import { useEffect, useState } from "react";
import { Banknote, ClipboardList, PackageCheck } from "lucide-react";
import { SellerLoadingState, SellerNotice, SellerPage } from "@/components/SellerShell";
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
  const { t, locale } = useSellerI18n();
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

  const number = (value: number) => new Intl.NumberFormat(locale).format(value);

  return <SellerPage title="Sales statistics" description="Sales for the selected dates.">
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
    {loading && !dateError ? <SellerLoadingState label={t("Loading statistics…")} rows={2} /> : !dateError && stats && <>
      <div className="seller-card-grid seller-stat-grid">
        <div className="seller-kpi"><div className="seller-kpi-label"><PackageCheck size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t("Units sold")}</span></div><strong>{number(stats.quantity_sold)}</strong></div>
        <div className="seller-kpi"><div className="seller-kpi-label"><ClipboardList size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t("Orders")}</span></div><strong>{number(stats.orders_count)}</strong></div>
        <div className="seller-kpi seller-kpi-revenue">
          <div className="seller-kpi-label"><Banknote size={18} strokeWidth={1.8} aria-hidden="true" /><span>{t("Revenue")}</span></div>
          <div className="seller-stat-revenue-values">
            {([["EUR", stats.amount_eur], ["TRY", stats.amount_try], ["USD", stats.amount_usd]] as const).map(([currency, amount]) =>
              <div key={currency}><span>{currency}</span><strong>{money(amount, currency)}</strong></div>,
            )}
          </div>
        </div>
      </div>
      {stats.quantity_sold === 0 && <div className="seller-card seller-empty seller-stat-empty">{t("No sales in this period. Try another date range or product.")}</div>}
    </>}
  </SellerPage>;
}
