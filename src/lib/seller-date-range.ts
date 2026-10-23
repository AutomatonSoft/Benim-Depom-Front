export type SellerDateRange = { from: string; to: string };
export type SellerDatePreset = "allTime" | "today" | "yesterday" | "thisWeek" | "lastWeek" | "last7Days" | "last30Days" | "thisMonth" | "lastMonth";

const pad = (value: number) => String(value).padStart(2, "0");

export function sellerDateToIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseSellerIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function berlinBusinessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: "year" | "month" | "day") => parts.find(part => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function startOfWeekMonday(date: Date) {
  const result = new Date(date);
  const weekday = result.getDay();
  result.setDate(result.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return result;
}

export function getSellerDatePreset(preset: SellerDatePreset, todayIso = berlinBusinessDate()): SellerDateRange {
  const today = parseSellerIsoDate(todayIso);
  const to = sellerDateToIso(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  switch (preset) {
    case "allTime": return { from: "", to: "" };
    case "today": return { from: to, to };
    case "yesterday": {
      const date = sellerDateToIso(yesterday);
      return { from: date, to: date };
    }
    case "thisWeek": return { from: sellerDateToIso(startOfWeekMonday(today)), to };
    case "lastWeek": {
      const lastWeekEnd = startOfWeekMonday(today);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
      const lastWeekStart = startOfWeekMonday(lastWeekEnd);
      return { from: sellerDateToIso(lastWeekStart), to: sellerDateToIso(lastWeekEnd) };
    }
    case "last7Days":
    case "last30Days": {
      const from = new Date(today);
      from.setDate(from.getDate() - (preset === "last7Days" ? 6 : 29));
      return { from: sellerDateToIso(from), to };
    }
    case "thisMonth": return { from: sellerDateToIso(new Date(today.getFullYear(), today.getMonth(), 1)), to };
    case "lastMonth": {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: sellerDateToIso(from), to: sellerDateToIso(end) };
    }
  }
}

export function shiftSellerCalendarMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}
