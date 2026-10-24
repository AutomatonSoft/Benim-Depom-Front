"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeDollarSign, Bell, Check, CheckCheck, CircleAlert, CircleCheck, CircleQuestionMark, CircleX, Eye, LoaderCircle, MessageCircle, Search, ShoppingBag } from "lucide-react";
import { SellerLoadingState, SellerNotice, SellerPage } from "@/components/SellerShell";
import { SellerSelect } from "@/components/seller/SellerSelect";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { readAvailabilityAnswers, rememberAvailabilityAnswer, respondToPriceNegotiation, SELLER_PROFILE_CHANGED_EVENT, sellerProfileId, sellerRequest, sellerReviewNotifications, type PageResult, type SellerNotification } from "@/lib/seller";
import { answerAvailabilityOnce, availabilityResponseState, SellerAvailabilityGuard } from "@/lib/seller-availability";
import { sellerNotificationDateFormatter } from "@/lib/seller-notification-date";
import { formatNotificationPrice, hasStructuredSaleDetails, priceOfferDisplayState, runNotificationActionOnce, sellerNotificationFilters, sellerSaleBodyDetails } from "@/lib/seller-notification-content";
import { sellerNotificationTone } from "@/lib/seller-notification-style";

function categoryFor(type: string) {
  if (type.includes("price")) return "Price";
  if (type.includes("availability") || type.includes("confirmation")) return "Availability";
  if (type.includes("review") || type.includes("approved") || type.includes("rejected") || type.includes("change_requested")) return "Review";
  if (type.includes("sold")) return "Sale";
  return "Update";
}

function iconFor(type: string) {
  if (type.includes("rejected") || type.includes("change_requested")) return CircleAlert;
  if (type.includes("approved")) return CircleCheck;
  if (type.includes("price")) return BadgeDollarSign;
  if (type.includes("availability") || type.includes("confirmation")) return CircleCheck;
  if (type.includes("message")) return MessageCircle;
  if (type.includes("sold")) return ShoppingBag;
  return Bell;
}

export default function SellerNotificationsPage() {
  const { t, locale } = useSellerI18n();
  const dateFormatter = useMemo(() => sellerNotificationDateFormatter(locale), [locale]);
  const [items, setItems] = useState<SellerNotification[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyProducts, setBusyProducts] = useState<Set<number>>(() => new Set());
  const [availabilityAnswers, setAvailabilityAnswers] = useState<Record<number, boolean>>({});
  const [uncertainProducts, setUncertainProducts] = useState<Set<number>>(() => new Set());
  const [priceComments, setPriceComments] = useState<Record<number, string>>({});
  const [priceOfferActions, setPriceOfferActions] = useState<Map<number, boolean>>(() => new Map());
  const priceOfferInFlight = useRef(new Set<number>());
  const availabilityGuard = useRef(new SellerAvailabilityGuard());

  useEffect(() => {
    let currentSellerId = sellerProfileId();
    const syncAnswers = () => {
      const nextSellerId = sellerProfileId();
      const storedAnswers = readAvailabilityAnswers(nextSellerId);
      if (nextSellerId !== currentSellerId) {
        currentSellerId = nextSellerId;
        setAvailabilityAnswers(storedAnswers);
        setUncertainProducts(new Set());
        availabilityGuard.current = new SellerAvailabilityGuard();
      } else {
        setAvailabilityAnswers(current => ({ ...current, ...storedAnswers }));
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "benim_seller_profile_id" || event.key.startsWith("benim_seller_availability_answers:")) syncAnswers();
    };
    const timer = window.setTimeout(syncAnswers, 0);
    window.addEventListener(SELLER_PROFILE_CHANGED_EVENT, syncAnswers);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(SELLER_PROFILE_CHANGED_EVENT, syncAnswers);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  if (filter === "unread") query.set("is_read", "false");
  else if (filter === "outgoing" || filter === "availability" || filter === "afterbuy") query.set("category", filter);
  else if (filter === "price-offers") query.set("notification_type", "price_negotiation_offer");
  const queryString = query.toString();
  const firstPage = `/api/v1/notifications/${queryString ? `?${queryString}` : ""}`;

  const load = useCallback(async (url = firstPage, append = false, signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const result = filter === "review" ? await sellerReviewNotifications(search, signal) : await sellerRequest<PageResult<SellerNotification>>(url, { signal });
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
  }, [firstPage, filter, search]);

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

  async function respondToPriceOffer(item: SellerNotification, accepted: boolean) {
    const productId = item.product_id;
    if (!productId || item.price_negotiation_status !== "pending") return;
    await runNotificationActionOnce(priceOfferInFlight.current, item.id, async () => {
      setPriceOfferActions(current => new Map(current).set(item.id, accepted));
      setError("");
      setNotice("");
      try {
        const product = await respondToPriceNegotiation(productId, accepted, priceComments[item.id] ?? "");
        const offer = product.latest_price_negotiation;
        const status = offer?.status === "accepted" || offer?.status === "rejected"
          ? offer.status
          : accepted ? "accepted" : "rejected";
        setItems(current => current.map(notification => notification.id === item.id ? {
          ...notification,
          is_read: true,
          price_negotiation_status: status,
          price_accepted: status === "accepted",
          seller_comment: offer?.seller_comment ?? priceComments[item.id]?.trim() ?? "",
          responded_at: offer?.responded_at ?? new Date().toISOString(),
        } : notification));
        setPriceComments(current => {
          const next = { ...current };
          delete next[item.id];
          return next;
        });
        setNotice(t("Response sent"));
        window.dispatchEvent(new Event("seller-notifications-updated"));
      } catch {
        setError(t("Could not respond to the offer."));
      } finally {
        setPriceOfferActions(current => {
          const next = new Map(current);
          next.delete(item.id);
          return next;
        });
      }
    });
  }

  async function availability(item: SellerNotification, isAvailable: boolean) {
    const productId = item.product_id;
    if (!productId || availabilityResponseState(item, availabilityAnswers[item.id] !== undefined) !== "pending") return;
    const guard = availabilityGuard.current;
    if (guard.isBlocked(productId, item.id)) return;
    const pendingIds = new Set(items.filter(notification => notification.product_id === productId && availabilityResponseState(notification) === "pending").map(notification => notification.id));
    setBusyProducts(current => new Set(current).add(productId));
    setError("");
    setNotice("");
    try {
      await answerAvailabilityOnce({
        guard,
        productId,
        notificationId: item.id,
        send: () => sellerRequest(`/api/v1/products/${productId}/availability/`, { method: "POST", body: JSON.stringify({ is_available: isAvailable }) }),
        markRead: async () => {
          await sellerRequest(`/api/v1/notifications/${item.id}/read/`, { method: "POST", body: "{}" });
          if (availabilityGuard.current === guard) setItems(current => current.map(notification => notification.id === item.id ? { ...notification, is_read: true } : notification));
        },
        onAnswered: () => {
          if (availabilityGuard.current !== guard) return;
          const answers = Object.fromEntries([...pendingIds].map(id => [id, isAvailable]));
          setAvailabilityAnswers(current => ({ ...current, ...answers }));
          for (const id of pendingIds) {
            guard.answered.add(id);
            rememberAvailabilityAnswer(sellerProfileId(), id, isAvailable);
          }
          const respondedAt = new Date().toISOString();
          setItems(current => current.map(notification => pendingIds.has(notification.id) ? { ...notification, responded_at: respondedAt } : notification));
          setNotice(t("Response sent"));
        },
        onReadError: () => setNotice(t("Response sent, but the notification could not be marked as read.")),
      });
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

  async function refreshAvailabilityStatus(productId: number, notificationId: number) {
    setBusyProducts(current => new Set(current).add(productId));
    setError("");
    try {
      const result = await sellerRequest<PageResult<SellerNotification>>(firstPage);
      setItems(result.results);
      setNext(result.next);
      const reminder = result.results.find(item => item.id === notificationId && item.product_id === productId && item.notification_type === "product_availability_reminder");
      if (!reminder) {
        setError(t("Could not refresh notification status."));
        return;
      }
      if (availabilityResponseState(reminder) === "answered") availabilityGuard.current.answered.add(notificationId);
      else setNotice(t("No response is recorded. You can safely try again."));
      availabilityGuard.current.resolveUncertain(productId);
      setUncertainProducts(current => {
        const nextUncertain = new Set(current);
        nextUncertain.delete(productId);
        return nextUncertain;
      });
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

  const filterOptions = sellerNotificationFilters.map(([value, label]) => ({ value, label: t(label) }));

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
        const tone = sellerNotificationTone(type);
        const isSale = tone === "sale";
        const isPriceOffer = type === "price_negotiation_offer";
        const productName = item.product_title?.trim();
        const savedAnswer = availabilityAnswers[item.id];
        const responseState = availabilityResponseState(item, savedAnswer !== undefined);
        const Icon = responseState === "pending" ? CircleQuestionMark : responseState === "answered" ? Bell : iconFor(type);
        const hasSaleDetails = isSale && hasStructuredSaleDetails(item);
        const saleBodyDetails = isSale ? sellerSaleBodyDetails(item.body, item.title, productName ?? null, item.afterbuy_qty_sold ?? null) : "";
        const priceState = priceOfferDisplayState(item);
        const priceAccepted = priceState === "accepted";
        const priceDeclined = priceState === "declined";
        const priceSuperseded = item.price_negotiation_status === "superseded";
        const priceResponded = isPriceOffer && ["accepted", "declined", "unknown"].includes(priceState);
        const pricePending = isPriceOffer && priceState === "pending" && filter !== "outgoing";
        const visibleProductContext = isPriceOffer ? item.body : `${item.title}\n${item.body}`;
        const productNameAlreadyShown = !!productName && visibleProductContext.toLocaleLowerCase(locale).includes(productName.toLocaleLowerCase(locale));
        const productId = item.product_id;
        const isBusy = productId !== null && busyProducts.has(productId);
        const uncertain = productId !== null && uncertainProducts.has(productId);
        const isPriceBusy = priceOfferActions.has(item.id);
        const answered = isPriceOffer && priceAccepted;
        const pending = isPriceOffer ? pricePending : responseState === "pending" && filter !== "outgoing";
        const availabilityClass = responseState === "answered" ? " availability-unknown" : responseState === "pending" ? " availability-pending" : "";
        return <article className={`seller-card seller-notification seller-notification-${tone}${item.is_read ? " read" : " unread"}${answered ? " answered" : ""}${availabilityClass}${isPriceOffer && priceDeclined ? " price-declined" : ""}${isPriceOffer && priceState === "unknown" ? " price-unknown" : ""}`} key={item.id}>
          <div className="seller-notification-heading">
            <div className="seller-notification-main">
              <div className="seller-notification-meta"><span className="seller-notification-icon"><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span><span className="seller-badge">{t(categoryFor(type))}</span><time dateTime={item.created_at}>{dateFormatter.format(new Date(item.created_at))}</time></div>
              <h2 data-seller-translate={isSale || isPriceOffer ? undefined : "skip"}>{isSale ? t("Product sold") : isPriceOffer ? t("Price offer") : item.title || type.replaceAll("_", " ")}</h2>
            </div>
            <div className="seller-notification-states">
              <span className={`seller-badge${item.is_read ? "" : " pending"}`}>{t(item.is_read ? "Read" : "Unread")}</span>
              {pending && <span className="seller-badge pending">{t("Awaiting response")}</span>}
              {isPriceOffer && priceSuperseded && <span className="seller-badge">{t("Offer no longer active")}</span>}
            </div>
          </div>
          {!isSale && item.body && <p data-seller-translate="skip">{item.body}</p>}
          {productName && (isSale || !productNameAlreadyShown) && <p className="seller-notification-product">{t("Product")}: <strong data-seller-translate="skip">{productName}</strong></p>}
          {isSale && <>
            {hasSaleDetails && <dl className="seller-sale-details">
              {item.afterbuy_qty_sold != null && <div><dt>{t("Quantity sold")}</dt><dd data-seller-translate="skip">{new Intl.NumberFormat(locale).format(item.afterbuy_qty_sold)}</dd></div>}
              {item.afterbuy_marketplace && <div><dt>{t("Marketplace")}</dt><dd data-seller-translate="skip">{item.afterbuy_marketplace}</dd></div>}
            </dl>}
            {item.afterbuy_stock_synced === true && <p className="seller-sale-stock"><CircleCheck size={16} aria-hidden="true" />{t("Stock synchronized")}</p>}
            {saleBodyDetails && (hasSaleDetails
              ? <details className="seller-notification-original"><summary>{t("More sale details")}</summary><p className="seller-sale-message" data-seller-translate="skip">{saleBodyDetails}</p></details>
              : <p className="seller-sale-message" data-seller-translate="skip">{saleBodyDetails}</p>)}
          </>}
          {isPriceOffer && priceResponded && <div className={`seller-price-result ${priceState}`}>
            {priceAccepted ? <CircleCheck size={18} aria-hidden="true" /> : priceDeclined ? <CircleX size={18} aria-hidden="true" /> : <Bell size={18} aria-hidden="true" />}
            <strong>{t(priceAccepted ? "Offer accepted" : priceDeclined ? "Offer declined" : "Response sent")}</strong>
          </div>}
          {isPriceOffer && item.proposed_unit_price != null && <div className="seller-price-proposal"><span>{t("Proposed price")}</span><strong data-seller-translate="skip">{formatNotificationPrice(item.proposed_unit_price, item.proposed_currency, locale)}</strong></div>}
          {isPriceOffer && priceResponded && item.seller_comment?.trim() && <p className="seller-price-offer-response-comment">{t("Your comment")}: <strong data-seller-translate="skip">{item.seller_comment}</strong></p>}
          {!isPriceOffer && pending && <p className="seller-notification-availability-help">{t("Please confirm whether this product is currently available.")}</p>}
          {pricePending && productId && <label className="seller-field seller-price-offer-comment"><span>{t("Optional comment")}</span><textarea rows={2} maxLength={2000} disabled={isPriceBusy} value={priceComments[item.id] ?? ""} placeholder={t("Optional comment")} onChange={event => setPriceComments(current => ({ ...current, [item.id]: event.target.value }))} /></label>}
          <div className={`seller-toolbar seller-notification-actions${isPriceOffer ? " seller-price-offer-actions" : ""}`}>
            {pricePending && productId && <>
              <button className="seller-button primary" disabled={isPriceBusy} onClick={() => void respondToPriceOffer(item, true)}>
                {isPriceBusy && priceOfferActions.get(item.id) ? <LoaderCircle className="seller-spinner" size={18} aria-hidden="true" /> : <CircleCheck size={18} strokeWidth={1.8} aria-hidden="true" />}{isPriceBusy && priceOfferActions.get(item.id) ? t("Sending…") : t("Accept offer")}
              </button>
              <button className="seller-button danger" disabled={isPriceBusy} onClick={() => void respondToPriceOffer(item, false)}>
                {isPriceBusy && !priceOfferActions.get(item.id) ? <LoaderCircle className="seller-spinner" size={18} aria-hidden="true" /> : <CircleX size={18} strokeWidth={1.8} aria-hidden="true" />}{isPriceBusy && !priceOfferActions.get(item.id) ? t("Sending…") : t("Decline offer")}
              </button>
            </>}
            {productId && <Link className="seller-button" href={`/seller/products/${productId}`}>{isPriceOffer ? <><Eye size={18} strokeWidth={1.8} aria-hidden="true" />{t("View product")}</> : t("View product")}</Link>}
            {!isPriceOffer && pending && productId && !answered && !uncertain && <>
              <button className="seller-button primary" disabled={isBusy} onClick={() => void availability(item, true)}>
                {isBusy ? <LoaderCircle className="seller-spinner" size={18} aria-hidden="true" /> : <CircleCheck size={18} strokeWidth={1.8} aria-hidden="true" />}{t("Available")}
              </button>
              <button className="seller-button" disabled={isBusy} onClick={() => void availability(item, false)}>
                {isBusy ? <LoaderCircle className="seller-spinner" size={18} aria-hidden="true" /> : <CircleX size={18} strokeWidth={1.8} aria-hidden="true" />}{t("Unavailable")}
              </button>
            </>}
            {uncertain && productId && <button className="seller-button" disabled={isBusy} onClick={() => void refreshAvailabilityStatus(productId, item.id)}>
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
