import type { SellerNotification } from "./seller";

export const sellerNotificationFilters = [
  ["", "All notifications"],
  ["unread", "Unread"],
  ["review", "Review"],
  ["availability", "Availability"],
  ["price-offers", "Price offers"],
  ["afterbuy", "Sale"],
  ["outgoing", "Sent by me"],
] as const;

export type PriceOfferDisplayState = "pending" | "accepted" | "declined" | "inactive" | "unknown";

export async function runNotificationActionOnce(inFlight: Set<number>, notificationId: number, action: () => Promise<void>) {
  if (inFlight.has(notificationId)) return false;
  inFlight.add(notificationId);
  try { await action(); return true; }
  finally { inFlight.delete(notificationId); }
}

export function priceOfferDisplayState(notification: Pick<SellerNotification, "price_negotiation_status" | "price_accepted" | "responded_at">): PriceOfferDisplayState {
  if (notification.price_negotiation_status === "accepted" || notification.price_accepted === true) return "accepted";
  if (notification.price_negotiation_status === "rejected" || notification.price_accepted === false) return "declined";
  if (notification.price_negotiation_status === "superseded") return "inactive";
  if (notification.responded_at) return "unknown";
  return notification.price_negotiation_status === "pending" ? "pending" : "inactive";
}

export function hasStructuredSaleDetails(notification: Pick<SellerNotification, "afterbuy_qty_sold" | "afterbuy_marketplace">) {
  return notification.afterbuy_qty_sold != null || !!notification.afterbuy_marketplace;
}

function normalizeSaleLine(value: string) {
  return value.trim().replace(/[.!?]+$/u, "").toLowerCase();
}

export function sellerSaleBodyDetails(body: string, title: string, productTitle: string | null, quantity: number | null) {
  const normalizedTitle = normalizeSaleLine(title);
  return body.split(/\r?\n/u).map(line => line.trim()).filter(line => {
    if (!line) return false;
    const normalizedLine = normalizeSaleLine(line);
    if (normalizedTitle && normalizedLine === normalizedTitle) return false;
    const productLine = line.match(/^(?:product|товар|produkt|ürün)\s*:\s*(.+)$/iu);
    if (productTitle && productLine && normalizeSaleLine(productLine[1]) === normalizeSaleLine(productTitle)) return false;
    const quantityLine = line.match(/^(?:sold|quantity|купили|количество|gekauft|menge|satılan|adet)\s*:\s*(.+)$/iu);
    if (quantity != null && quantityLine) {
      const digits = quantityLine[1].replace(/\D/gu, "");
      if (digits && Number(digits) === quantity) return false;
    }
    return true;
  }).join("\n");
}

export function formatNotificationPrice(value: string, currency: string | null, locale: string) {
  const amount = Number(value);
  const formatted = value.trim() && Number.isFinite(amount)
    ? new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
    : value;
  return [formatted, currency].filter(Boolean).join(" ");
}
