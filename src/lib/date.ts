export const TIMEZONE_STORAGE_KEY = "benim_timezone";

export function getTimezone() {
  if (typeof window === "undefined") return "UTC";
  return window.localStorage.getItem(TIMEZONE_STORAGE_KEY) || "UTC";
}

export function formatDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "medium" as const } : {}),
    timeZone: getTimezone(),
  }).format(new Date(value));
}