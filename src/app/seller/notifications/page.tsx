"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BadgeDollarSign, Bell, Check, CheckCheck, CircleCheck, CircleX, Search, ShoppingBag } from "lucide-react";
import { SellerLoadingState, SellerNotice, SellerPage } from "@/components/SellerShell";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { sellerRequest, type PageResult, type SellerNotification } from "@/lib/seller";

const filters = [
  ["", "All notifications"],
  ["unread", "Unread"],
  ["review", "Review"],
  ["availability", "Availability"],
  ["price-offers", "Price offers"],
  ["price", "Price responses"],
  ["afterbuy", "Afterbuy"],
  ["outgoing", "Sent by me"],
] as const;

function categoryFor(type: string) {
  if (type.includes("price")) return "Price";
  if (type.includes("availability") || type.includes("confirmation")) return "Availability";
  if (type.includes("review") || type.includes("approved") || type.includes("rejected") || type.includes("change_requested")) return "Review";
  if (type.includes("sold")) return "Afterbuy";
  return "Update";
}

function iconFor(type: string) {
  if (type.includes("price")) return BadgeDollarSign;
  if (type.includes("availability") || type.includes("confirmation")) return CircleCheck;
  if (type.includes("sold")) return ShoppingBag;
  return Bell;
}

export default function SellerNotificationsPage() {
  const { t, locale } = useSellerI18n();
  const [items, setItems] = useState<SellerNotification[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  if (filter === "unread") query.set("is_read", "false");
  else if (filter === "outgoing" || filter === "review" || filter === "availability" || filter === "price" || filter === "afterbuy") query.set("category", filter);
  else if (filter === "price-offers") query.set("notification_type", "price_negotiation_offer");
  const queryString = query.toString();
  const firstPage = `/api/v1/notifications/${queryString ? `?${queryString}` : ""}`;

  const load = useCallback(async (url = firstPage, append = false, signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const result = await sellerRequest<PageResult<SellerNotification>>(url, { signal });
      if (signal?.aborted) return;
      setItems(previous => append ? [...previous, ...result.results] : result.results);
      setNext(result.next);
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "Unable to load notifications.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [firstPage]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(firstPage, false, controller.signal), search ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [firstPage, load, search]);

  async function reload() {
    await load();
    window.dispatchEvent(new Event("seller-notifications-updated"));
  }

  async function markRead(item: SellerNotification) {
    setBusy(true);
    try {
      await sellerRequest(`/api/v1/notifications/${item.id}/read/`, { method: "POST", body: "{}" });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark as read.");
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    setBusy(true);
    try {
      await sellerRequest("/api/v1/notifications/read-all/", { method: "POST", body: "{}" });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark notifications as read.");
    } finally {
      setBusy(false);
    }
  }

  async function availability(item: SellerNotification, is_available: boolean) {
    if (!item.product_id) return;
    setBusy(true);
    try {
      await sellerRequest(`/api/v1/products/${item.product_id}/availability/`, { method: "POST", body: JSON.stringify({ is_available }) });
      await sellerRequest(`/api/v1/notifications/${item.id}/read/`, { method: "POST", body: "{}" });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update availability.");
    } finally {
      setBusy(false);
    }
  }

  return <SellerPage title="Notifications" description="Review updates about your products and respond to supported requests." actions={filter !== "outgoing" ? <button className="seller-button" disabled={busy} onClick={() => void markAll()}><CheckCheck size={18} strokeWidth={1.8} aria-hidden="true" />{t("Mark all as read")}</button> : undefined}>
    <div className="seller-toolbar">
      <label className="search">
        <span className="sr-only">{t("Search notifications")}</span>
        <Search size={18} strokeWidth={1.8} aria-hidden="true" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Search notifications")} />
      </label>
      <label className="seller-field">
        <span className="sr-only">{t("Filter notifications")}</span>
        <select value={filter} onChange={e => setFilter(e.target.value)}>{filters.map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select>
      </label>
    </div>

    {error && <SellerNotice>{error}</SellerNotice>}
    {loading && !items.length ? <SellerLoadingState label={t("Loading notifications…")} rows={3} /> : items.length ? <div className="seller-stack">
      {items.map(item => {
        const type = item.notification_type.toLowerCase();
        const Icon = iconFor(type);
        const canConfirmAvailability = ["product_confirmation", "product_availability_reminder"].includes(type);
        const isPriceOffer = type === "price_negotiation_offer";
        return <article className={`seller-card seller-notification${item.is_read ? "" : " unread"}`} key={item.id}>
          <div className="seller-notification-heading">
            <div>
              <div className="seller-notification-meta"><span className="seller-notification-icon"><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span><span className="seller-badge">{t(categoryFor(type))}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString(locale)}</time></div>
              <h2 data-seller-translate="skip">{item.title || type.replaceAll("_", " ")}</h2>
            </div>
            {!item.is_read && <span className="seller-badge pending">{t("Unread")}</span>}
          </div>
          <p data-seller-translate="skip">{item.body}</p>
          {item.product_title && <p className="seller-notification-product">{t("Product")}: <span data-seller-translate="skip">{item.product_title}</span></p>}
          {isPriceOffer && item.proposed_unit_price && <p>{t("Proposed price")}: <strong data-seller-translate="skip">{item.proposed_unit_price} {item.proposed_currency}</strong></p>}
          <div className="seller-toolbar seller-notification-actions">
            {item.product_id && <Link className="seller-button" href={`/seller/products/${item.product_id}`}>{isPriceOffer ? t("Review offer") : t("View product")}</Link>}
            {filter !== "outgoing" && canConfirmAvailability && item.product_id && <><button className="seller-button primary" disabled={busy} onClick={() => void availability(item, true)}><CircleCheck size={18} strokeWidth={1.8} aria-hidden="true" />{t("Available")}</button><button className="seller-button" disabled={busy} onClick={() => void availability(item, false)}><CircleX size={18} strokeWidth={1.8} aria-hidden="true" />{t("Unavailable")}</button></>}
            {filter !== "outgoing" && !item.is_read && <button className="seller-button" disabled={busy} onClick={() => void markRead(item)}><Check size={18} strokeWidth={1.8} aria-hidden="true" />{t("Mark read")}</button>}
          </div>
        </article>;
      })}
    </div> : <div className="seller-card seller-empty">{t(search || filter ? "No notifications match these filters." : "You have no notifications.")}</div>}

    {next && <div className="seller-pagination"><button className="seller-button" disabled={loading || busy} onClick={() => void load(next, true)}>{loading ? t("Loading…") : t("Load more")}</button></div>}
  </SellerPage>;
}
