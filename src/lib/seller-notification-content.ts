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

export function sellerNotificationMessage(notification: Pick<SellerNotification, "body" | "seller_comment">) {
  const marker = "__SELLER_COMMENT__";
  const separator = notification.body.indexOf(marker);
  const comment = notification.seller_comment?.trim() || (separator < 0 ? "" : notification.body.slice(separator + marker.length).trim());
  return {
    body: (separator < 0 ? notification.body : notification.body.slice(0, separator)).trim(),
    comment: comment === "string" ? "" : comment,
  };
}

const availabilityConfirmationTitles = {
  available: { en: "Product is available", ru: "Товар в наличии", tr: "Ürün stokta", de: "Produkt ist verfügbar" },
  unavailable: { en: "Product is not available", ru: "Товара нет в наличии", tr: "Ürün stokta yok", de: "Produkt nicht verfügbar" },
};

const outgoingEventTitles: Record<string, Record<string, string>> = {
  product_submitted_for_review: { en: "New product awaiting review", ru: "Новый товар на модерации", tr: "İnceleme bekleyen yeni ürün", de: "Neues Produkt wartet auf Prüfung" },
  product_change_requested: { en: "Seller wants to change a product", ru: "Продавец хочет изменить товар", tr: "Satıcı ürünü değiştirmek istiyor", de: "Verkäufer möchte ein Produkt ändern" },
  product_withdrawn_from_review: { en: "Seller withdrew a product from review", ru: "Продавец отозвал товар с модерации", tr: "Satıcı ürünü incelemeden çekti", de: "Verkäufer hat Produktprüfung zurückgezogen" },
  product_deactivation_requested: { en: "Deactivation requested", ru: "Запрос на деактивацию", tr: "Devre dışı bırakma talebi", de: "Deaktivierung angefordert" },
  product_sold: { en: "Product sold in Afterbuy", ru: "Товар купили в Afterbuy", tr: "Ürün Afterbuy'da satıldı", de: "Produkt in Afterbuy verkauft" },
};

const priceResponseTitles: Partial<Record<PriceOfferDisplayState, Record<string, string>>> = {
  accepted: { en: "Price accepted", ru: "Цена принята", tr: "Fiyat kabul edildi", de: "Preis akzeptiert" },
  declined: { en: "Price declined", ru: "Цена отклонена", tr: "Fiyat reddedildi", de: "Preis abgelehnt" },
};

export function sellerUniqueNotifications(items: SellerNotification[]) {
  return [...new Map(items.map(item => [item.id, item])).values()];
}

export function sellerAvailabilityConfirmation(notification: Pick<SellerNotification, "notification_type" | "title">) {
  if (notification.notification_type !== "product_confirmation") return null;
  for (const answer of ["available", "unavailable"] as const) {
    if (Object.values(availabilityConfirmationTitles[answer]).includes(notification.title.trim())) return answer;
  }
  return null;
}

export function sellerOutgoingNotifications(items: SellerNotification[], locale: string) {
  const groups = new Map<string, Array<{ item: SellerNotification; timestamp: number }>>();
  const result: SellerNotification[] = [];
  for (const item of sellerUniqueNotifications(items)) {
    const answer = sellerAvailabilityConfirmation(item);
    const priceReply = item.notification_type === "price_negotiation_response";
    const priceState = priceOfferDisplayState(item);
    const comment = sellerNotificationMessage(item).comment;
    const hasPriceId = priceReply && item.price_negotiation_id != null;
    const titles = answer ? availabilityConfirmationTitles[answer] : priceReply ? priceResponseTitles[priceState] : outgoingEventTitles[item.notification_type];
    const isTemplate = titles && Object.values(titles).includes(item.title.trim());
    const timestamp = Date.parse(item.created_at);
    const saleTime = item.notification_type === "product_sold" ? item.body?.match(/^(?:Time|Время|Zeit|Zaman):\s*(.+)$/imu)?.[1] : null;
    const content = isTemplate && (item.notification_type !== "product_sold" || saleTime)
      ? ["template", saleTime, item.afterbuy_qty_sold ?? null, item.afterbuy_marketplace ?? null, item.afterbuy_account ?? null]
      : [item.title, item.body];
    const key = item.sender_id != null && item.product_id != null
      ? hasPriceId
        ? JSON.stringify([item.sender_id, item.product_id, item.notification_type, item.price_negotiation_id, priceState, comment])
        : Number.isFinite(timestamp) ? JSON.stringify([item.sender_id, item.product_id, item.notification_type, answer, content, comment, priceReply ? [priceState, item.proposed_unit_price, item.proposed_currency] : null]) : null
      : null;
    if (key === null) { result.push(item); continue; }
    const candidates = groups.get(key) ?? [];
    // shortcut: events without an ID use a one-second recipient-copy window until the API supplies event IDs.
    const group = candidates.find(candidate => hasPriceId || Math.abs(candidate.timestamp - timestamp) <= 1000);
    if (group) {
      const preferredTitle = isTemplate ? titles[locale as "en" | "ru" | "tr" | "de"] : null;
      if (preferredTitle && item.title.trim() === preferredTitle && group.item.title.trim() !== preferredTitle) {
        result[result.indexOf(group.item)] = item;
        group.item = item;
      }
    } else {
      candidates.push({ item, timestamp });
      groups.set(key, candidates);
      result.push(item);
    }
  }
  return result;
}

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

export function sellerSaleDetailRows(details: string) {
  return details.split(/\r?\n/u).filter(line => line.trim()).map(line => {
    const separator = line.indexOf(":");
    if (separator < 0) return { label: "", value: line };
    const label = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    const unitPrice = /^(?:цена на карточке|цена за единицу|card price|unit price|kartenpreis|stückpreis|kart fiyatı|birim fiyatı)$/iu.test(label);
    return { label: unitPrice ? "Unit price" : label, value };
  });
}
