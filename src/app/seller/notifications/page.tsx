"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeDollarSign, Bell, Check, CheckCheck, CircleCheck, CircleX, LoaderCircle, MessageCircle, Search, ShoppingBag } from "lucide-react";
import { SellerLoadingState, SellerNotice, SellerPage } from "@/components/SellerShell";
import { SellerSelect } from "@/components/seller/SellerSelect";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { sellerRequest, type PageResult, type SellerNotification } from "@/lib/seller";
import { answerAvailabilityOnce, availabilityResponseState, SellerAvailabilityGuard } from "@/lib/seller-availability";

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
  if (type.includes("message")) return MessageCircle;
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
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyProducts, setBusyProducts] = useState<Set<number>>(() => new Set());
  const [answeredProducts, setAnsweredProducts] = useState<Set<number>>(() => new Set());
  const [uncertainProducts, setUncertainProducts] = useState<Set<number>>(() => new Set());
  const availabilityGuard = useRef(new SellerAvailabilityGuard());

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
      if (!signal?.aborted) {
        setItems(previous => append ? [...previous, ...result.results] : result.results);
        setNext(result.next);
      }
      return result;
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "Unable to load notifications.");
      return null;
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
    setError("");
    setNotice("");
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
    setError("");
    setNotice("");
    try {
      await sellerRequest("/api/v1/notifications/read-all/", { method: "POST", body: "{}" });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark notifications as read.");
    } finally {
      setBusy(false);
    }
  }

  async function availability(item: SellerNotification, isAvailable: boolean) {
    const productId = item.product_id;
    if (!productId || availabilityResponseState(item, answeredProducts.has(productId)) !== "pending") return;
    if (availabilityGuard.current.isBlocked(productId)) return;
    setBusyProducts(current => new Set(current).add(productId));
    setError("");
    setNotice("");
    try {
      const sent = await answerAvailabilityOnce({
        guard: availabilityGuard.current,
        productId,
        send: () => sellerRequest(`/api/v1/products/${productId}/availability/`, { method: "POST", body: JSON.stringify({ is_available: isAvailable }) }),
        markRead: () => sellerRequest(`/api/v1/notifications/${item.id}/read/`, { method: "POST", body: "{}" }),
        onAnswered: () => setAnsweredProducts(current => new Set(current).add(productId)),
        onReadError: () => setNotice(t("Response sent, but the notification could not be marked as read.")),
      });
      if (sent) await reload();
    } catch (e) {
      if (availabilityGuard.current.uncertain.has(productId)) {
        setUncertainProducts(current => new Set(current).add(productId));
        setError(t("We could not verify whether the response was sent. Refresh its status before trying again."));
      } else {
        setError(e instanceof Error ? e.message : t("Could not update availability."));
      }
    } finally {
      setBusyProducts(current => {
        const nextBusy = new Set(current);
        nextBusy.delete(productId);
        return nextBusy;
      });
      window.dispatchEvent(new Event("seller-notifications-updated"));
    }
  }

  async function refreshAvailabilityStatus(productId: number) {
    setBusyProducts(current => new Set(current).add(productId));
    setError("");
    try {
      const result = await sellerRequest<PageResult<SellerNotification>>(firstPage);
      setItems(result.results);
      setNext(result.next);
      const reminders = result.results.filter(item => item.product_id === productId && item.notification_type === "product_availability_reminder");
      const answered = reminders.some(item => availabilityResponseState(item) === "answered");
      if (answered) {
        availabilityGuard.current.answered.add(productId);
        setAnsweredProducts(current => new Set(current).add(productId));
      } else if (reminders.length) {
        availabilityGuard.current.resolveUncertain(productId);
        setUncertainProducts(current => {
          const nextUncertain = new Set(current);
          nextUncertain.delete(productId);
          return nextUncertain;
        });
        setNotice(t("No response is recorded. You can safely try again."));
      } else {
        setError(t("Could not refresh notification status."));
        return;
      }
      window.dispatchEvent(new Event("seller-notifications-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not refresh notification status."));
    } finally {
      setBusyProducts(current => {
        const nextBusy = new Set(current);
        nextBusy.delete(productId);
        return nextBusy;
      });
    }
  }

  const filterOptions = filters.map(([value, label]) => ({ value, label: t(label) }));

  return <SellerPage title="Notifications" description="Review updates about your products and respond to supported requests." actions={filter !== "outgoing" ? <button className="seller-button" disabled={busy} onClick={() => void markAll()}><CheckCheck size={18} strokeWidth={1.8} aria-hidden="true" />{t("Mark all as read")}</button> : undefined}>
    <div className="seller-toolbar seller-notifications-toolbar">
      <label className="search">
        <span className="sr-only">{t("Search notifications")}</span>
        <Search size={18} strokeWidth={1.8} aria-hidden="true" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Search notifications")} />
      </label>
      <SellerSelect ariaLabel={t("Filter notifications")} placeholder={t("All notifications")} value={filter} onValueChange={setFilter} options={filterOptions} />
    </div>

    {error && <SellerNotice>{error}</SellerNotice>}
    {notice && <SellerNotice kind="success">{notice}</SellerNotice>}
    {loading && !items.length ? <SellerLoadingState label={t("Loading notifications…")} rows={3} /> : items.length ? <div className="seller-stack seller-notifications-list">
      {items.map(item => {
        const type = item.notification_type.toLowerCase();
        const Icon = iconFor(type);
        const isPriceOffer = type === "price_negotiation_offer";
        const responseState = availabilityResponseState(item, item.product_id ? answeredProducts.has(item.product_id) : false);
        const productName = item.product_title?.trim();
        const productNameAlreadyShown = !!productName && [item.title, item.body].some(text => text.toLocaleLowerCase(locale).includes(productName.toLocaleLowerCase(locale)));
        const productId = item.product_id;
        const isBusy = productId !== null && busyProducts.has(productId);
        const uncertain = productId !== null && uncertainProducts.has(productId);
        const answered = responseState === "answered";
        const pending = responseState === "pending" && filter !== "outgoing";
        return <article className={`seller-card seller-notification${item.is_read ? " read" : " unread"}${answered ? " answered" : ""}`} key={item.id}>
          <div className="seller-notification-heading">
            <div className="seller-notification-main">
              <div className="seller-notification-meta"><span className="seller-notification-icon"><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span><span className="seller-badge">{t(categoryFor(type))}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString(locale)}</time></div>
              <h2 data-seller-translate="skip">{item.title || type.replaceAll("_", " ")}</h2>
            </div>
            <div className="seller-notification-states">
              <span className={`seller-badge${item.is_read ? "" : " pending"}`}>{t(item.is_read ? "Read" : "Unread")}</span>
              {pending && <span className="seller-badge pending">{t("Awaiting response")}</span>}
              {answered && <span className="seller-badge approved">{t("Response sent")}</span>}
            </div>
          </div>
          {item.body && <p data-seller-translate="skip">{item.body}</p>}
          {productName && !productNameAlreadyShown && <p className="seller-notification-product">{t("Product")}: <span data-seller-translate="skip">{productName}</span></p>}
          {isPriceOffer && item.proposed_unit_price && <p>{t("Proposed price")}: <strong data-seller-translate="skip">{item.proposed_unit_price} {item.proposed_currency}</strong></p>}
          {pending && <p className="seller-notification-availability-help">{t("Please confirm whether this product is currently available.")}</p>}
          <div className="seller-toolbar seller-notification-actions">
            {productId && <Link className="seller-button" href={`/seller/products/${productId}`}>{isPriceOffer ? t("Review offer") : t("View product")}</Link>}
            {pending && productId && !answered && !uncertain && <>
              <button className="seller-button primary" disabled={isBusy} onClick={() => void availability(item, true)}>
                {isBusy ? <LoaderCircle className="seller-spinner" size={18} aria-hidden="true" /> : <CircleCheck size={18} strokeWidth={1.8} aria-hidden="true" />}{t("Available")}
              </button>
              <button className="seller-button" disabled={isBusy} onClick={() => void availability(item, false)}>
                {isBusy ? <LoaderCircle className="seller-spinner" size={18} aria-hidden="true" /> : <CircleX size={18} strokeWidth={1.8} aria-hidden="true" />}{t("Unavailable")}
              </button>
            </>}
            {uncertain && productId && <button className="seller-button" disabled={isBusy} onClick={() => void refreshAvailabilityStatus(productId)}>
              {isBusy ? <LoaderCircle className="seller-spinner" size={18} aria-hidden="true" /> : <Check size={18} strokeWidth={1.8} aria-hidden="true" />}{t("Refresh status")}
            </button>}
            {filter !== "outgoing" && !item.is_read && <button className="seller-button" disabled={busy || isBusy} onClick={() => void markRead(item)}><Check size={18} strokeWidth={1.8} aria-hidden="true" />{t("Mark read")}</button>}
          </div>
        </article>;
      })}
    </div> : <div className="seller-card seller-empty seller-notifications-list">{t(search || filter ? "No notifications match these filters." : "You have no notifications.")}</div>}

    {next && <div className="seller-pagination"><button className="seller-button" disabled={loading || busy} onClick={() => void load(next, true)}>{loading ? t("Loading…") : t("Load more")}</button></div>}
  </SellerPage>;
}
