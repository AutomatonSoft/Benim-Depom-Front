import type { SellerDateRange } from "@/lib/seller-date-range";

export function formatSellerCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatSellerMoney(value: string | null, currency: string, locale: string) {
  if (value === null) return "—";
  const match = value.trim().match(/^(-?)(\d+)(?:\.(\d*))?$/);
  if (!match) return "—";

  const [, sign, whole, decimal = ""] = match;
  let major = BigInt(whole);
  let minor = BigInt(decimal.slice(0, 2).padEnd(2, "0"));
  if (decimal[2] >= "5") minor += BigInt(1);
  if (minor === BigInt(100)) {
    major += BigInt(1);
    minor = BigInt(0);
  }

  const integerFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === "decimal")?.value || ".";
  const minus = integerFormat.formatToParts(-1).find(part => part.type === "minusSign")?.value || "-";
  const fraction = new Intl.NumberFormat(locale, { useGrouping: false, minimumIntegerDigits: 2, maximumFractionDigits: 0 }).format(minor);
  return `${sign ? minus : ""}${integerFormat.format(major)}${separator}${fraction} ${currency}`;
}

export function sellerSalesStatsUrl(range: SellerDateRange, productId: string) {
  const query = new URLSearchParams();
  if (range.from) query.set("from", range.from);
  if (range.to) query.set("to", range.to);
  if (productId) query.set("product_id", productId);
  return `/api/v1/products/sales-stats/${query.size ? `?${query}` : ""}`;
}
