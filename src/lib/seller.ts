import { sellerApiErrorDetails } from "./seller-error-messages.ts";

export type SellerProfile = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  preferred_language: "en" | "ru" | "de" | "tr";
  role: string;
  date_joined: string;
  product_count: number;
};

export function sellerAvatarInitial(profile: Pick<SellerProfile, "first_name" | "username">) {
  const firstName = profile.first_name?.trim();
  const username = profile.username?.trim();
  const initial = Array.from(firstName || username || "")[0];
  return initial ? initial.toUpperCase() : "";
}

export type SellerImage = { id: number; image: string; preview: string; thumbnail: string; position: number; is_primary: boolean };
export type SellerVariant = { id?: number; color: string; materials: string[]; material_composition?: string; width_cm: string; height_cm: string; length_cm: string; quantity: number };
export type SellerProduct = {
  id: number; title: string; product_type: string; unit_price: string; currency: "TRY" | "EUR" | "USD";
  warehouse_city: string; status: string; is_available: boolean; deactivated_at: string | null; deactivation_requested_at?: string | null; total_quantity: number; total_amount: string;
  variants: SellerVariant[]; set_parts: Array<{ id?: number; description: string; width_cm: string; height_cm: string; length_cm: string }>;
  images: SellerImage[]; otto_category_id: number | null; otto_category_group_id: number | null; otto_attributes: Record<string, unknown>;
  created_at: string; updated_at: string; last_moderation_decision: string | null;
  active_price_negotiation: PriceNegotiation | null; latest_price_negotiation: PriceNegotiation | null;
  otto_category_name?: string | null; otto_category_group_name?: string | null;
  pending_changes?: Record<string, unknown> | null; pending_changes_submitted_at?: string | null;
};
export type PriceNegotiation = { id: number; manager_username: string; proposed_unit_price: string; current_unit_price: string; currency: string; message: string; status: string; seller_comment: string; created_at: string; responded_at: string | null };
export type SellerNotification = { id: number; notification_type: string; product_id: number | null; product_title: string | null; is_read: boolean; created_at: string; title: string; body: string; proposed_unit_price: string | null; proposed_currency: string | null; price_negotiation_status: string | null; price_negotiation_id?: number | null; sender_id?: number | null; seller_comment?: string; price_accepted?: boolean | null; responded_at?: string | null; sender_name?: string | null; manager_name?: string | null; afterbuy_marketplace?: string | null; afterbuy_account?: string | null; afterbuy_qty_sold?: number | null; afterbuy_stock_synced?: boolean; afterbuy_seller_notified?: boolean };
export type PageResult<T> = { count: number; next: string | null; previous: string | null; results: T[] };

const TOKEN_KEY = "benim_seller_access_token";
const SELLER_PROFILE_ID_KEY = "benim_seller_profile_id";
const availabilityAnswersKey = (id: number) => `benim_seller_availability_answers:${id}`;
export const SELLER_PROFILE_CHANGED_EVENT = "seller-profile-updated";
let refreshInFlight: Promise<string | null> | null = null;

export function sellerToken() {
  return typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
}
export function saveSellerToken(token: string) { localStorage.setItem(TOKEN_KEY, token); }
export function sellerProfileId() {
  if (typeof window === "undefined") return null;
  try {
    const id = Number(window.localStorage.getItem(SELLER_PROFILE_ID_KEY));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch { return null; }
}
function clearAvailabilityAnswers(sellerId: number | null) {
  if (sellerId === null || typeof window === "undefined") return;
  try { window.localStorage.removeItem(availabilityAnswersKey(sellerId)); } catch { /* Browser storage can be disabled. */ }
}
export function readAvailabilityAnswers(sellerId: number | null): Record<number, boolean> {
  if (sellerId === null || !Number.isSafeInteger(sellerId) || typeof window === "undefined") return {};
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(availabilityAnswersKey(sellerId)) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id, answer]) => /^\d+$/.test(id) && Number(id) > 0 && typeof answer === "boolean")) as Record<number, boolean>;
  } catch { return {}; }
}
export function rememberAvailabilityAnswer(sellerId: number | null, notificationId: number, answer: boolean) {
  if (sellerId === null || !Number.isSafeInteger(sellerId) || !Number.isSafeInteger(notificationId) || notificationId <= 0 || typeof answer !== "boolean" || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(availabilityAnswersKey(sellerId), JSON.stringify({ ...readAvailabilityAnswers(sellerId), [notificationId]: answer }));
  } catch { /* Keep the confirmed answer in page state when browser storage is unavailable. */ }
}
export function saveSellerProfileId(id: number) {
  if (typeof window === "undefined" || !Number.isSafeInteger(id) || id <= 0) return;
  const previousId = sellerProfileId();
  if (previousId !== null && previousId !== id) clearAvailabilityAnswers(previousId);
  window.localStorage.setItem(SELLER_PROFILE_ID_KEY, String(id));
  if (previousId !== id) window.dispatchEvent(new Event(SELLER_PROFILE_CHANGED_EVENT));
}
export function clearSellerToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}
export function clearSellerSession() {
  if (typeof window === "undefined") return;
  clearAvailabilityAnswers(sellerProfileId());
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SELLER_PROFILE_ID_KEY);
  window.dispatchEvent(new Event(SELLER_PROFILE_CHANGED_EVENT));
}

function sellerApiPath(path: string) {
  const url = new URL(path, window.location.origin);
  if (!url.pathname.startsWith("/api/v2/")) throw new SellerApiError(0, "Invalid seller API URL.");
  return `${url.pathname}${url.search}`;
}

async function refreshSellerToken() {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/portal-auth/seller/refresh/", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: "{}",
    }).then(async (response) => {
      if (!response.ok) {
        if (response.status === 400 || response.status === 401 || response.status === 403) { clearSellerToken(); return null; }
        throw new SellerApiError(response.status, "Unable to reach the server. Check your connection and try again.");
      }
      const data = await response.json() as { access?: string };
      if (!data.access) { clearSellerToken(); return null; }
      const profileResponse = await fetch("/api/v2/auth/me/", { credentials: "same-origin", headers: { Authorization: `Bearer ${data.access}` } });
      if (!profileResponse.ok) {
        if (profileResponse.status === 401 || profileResponse.status === 403) { clearSellerToken(); return null; }
        throw new SellerApiError(profileResponse.status, "Could not verify your account role.");
      }
      const profile = await profileResponse.json() as SellerProfile;
      if (profile.role !== "seller") { clearSellerToken(); return null; }
      saveSellerToken(data.access);
      saveSellerProfileId(profile.id);
      return data.access;
    }).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function sellerRequest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const apiPath = sellerApiPath(path);
  const request = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return fetch(apiPath, { ...init, headers, credentials: "same-origin" });
  };
  let token: string | null;
  try { token = sellerToken() ?? await refreshSellerToken(); }
  catch (error) { if (error instanceof SellerApiError) throw error; throw new SellerApiError(0, "Unable to reach the server. Check your connection and try again."); }
  if (!token) throw new SellerApiError(401, "Your session has expired. Please sign in again.");
  let response: Response;
  try { response = await request(token); }
  catch { throw new SellerApiError(0, "Unable to reach the server. Check your connection and try again."); }
  if (response.status === 401) {
    try { token = await refreshSellerToken(); }
    catch (error) { if (error instanceof SellerApiError) throw error; throw new SellerApiError(0, "Unable to reach the server. Check your connection and try again."); }
    if (!token) throw new SellerApiError(401, "Your session has expired. Please sign in again.");
    try { response = await request(token); }
    catch { throw new SellerApiError(0, "Unable to reach the server. Check your connection and try again."); }
  }
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { body = null; }
    throw new SellerApiError(response.status, errorMessage(body, "Request failed", response.status), body);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function respondToPriceNegotiation(productId: number, accepted: boolean, comment = "") {
  return sellerRequest<SellerProduct>(`/api/v2/products/${productId}/price-negotiation/respond/`, {
    method: "POST",
    body: JSON.stringify({ accepted, comment: comment.trim() }),
  });
}

export async function sellerAllPages<T>(path: string, init: RequestInit = {}): Promise<T[]> {
  const first = await sellerRequest<T[] | PageResult<T>>(path, init);
  if (Array.isArray(first)) return first;
  const items = [...first.results];
  let next = first.next;
  while (next) {
    const page = await sellerRequest<PageResult<T>>(next, init);
    items.push(...page.results);
    next = page.next;
  }
  return items;
}

export async function sellerReviewNotifications(search: string, signal?: AbortSignal): Promise<PageResult<SellerNotification>> {
  // The backend review category contains manager requests, not seller decisions.
  const pages = await Promise.all(["product_approved", "product_rejected"].map(notification_type => {
    const query = new URLSearchParams({ notification_type, page_size: "100" });
    if (search.trim()) query.set("search", search.trim());
    return sellerAllPages<SellerNotification>(`/api/v2/notifications/?${query}`, { signal });
  }));
  const results = pages.flat().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return { count: results.length, results, next: null, previous: null };
}

export async function sellerPublicRequest<T = unknown>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
  } catch { throw new SellerApiError(0, "Unable to reach the server. Check your connection and try again."); }
  if (!response.ok) {
    let data: unknown; try { data = await response.json(); } catch { data = null; }
    throw new SellerApiError(response.status, errorMessage(data, "Request failed", response.status), data);
  }
  if (response.status === 204) return undefined as T;
  if (response.status === 202 && response.headers.get("Content-Length") === "0") return undefined as T;
  try { return await response.json() as T; } catch { return undefined as T; }
}

export class SellerApiError extends Error {
  readonly status: number;
  readonly data?: unknown;
  constructor(status: number, message: string, data?: unknown) { super(message); this.status = status; this.data = data; this.name = "SellerApiError"; }
}

export function errorMessage(data: unknown, fallback = "Request failed", status = 400) {
  return sellerApiErrorDetails(data || (status >= 500 || status === 413 || status === 429 ? null : { detail: fallback }), status).message;
}

export async function sellerLogin(phone: string, password: string) {
  const response = await fetch("/portal-auth/seller/login/", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  if (!response.ok) {
    let data: unknown; try { data = await response.json(); } catch { data = null; }
    throw new SellerApiError(response.status, errorMessage(data, "Phone or password is incorrect.", response.status), data);
  }
  const token = (await response.json() as { access: string }).access;
  const profileResponse = await fetch("/api/v2/auth/me/", { credentials: "same-origin", headers: { Authorization: `Bearer ${token}` } });
  if (!profileResponse.ok) throw new SellerApiError(profileResponse.status, "Could not verify your account role.");
  const profile = await profileResponse.json() as SellerProfile;
  if (profile.role !== "seller") { clearSellerToken(); throw new SellerApiError(403, "This portal is available to seller accounts only."); }
  localStorage.setItem("benim_seller_locale", profile.preferred_language);
  window.dispatchEvent(new Event("seller-locale-updated"));
  saveSellerToken(token);
  saveSellerProfileId(profile.id);
  return profile;
}

export async function sellerLogout() {
  try { await fetch("/portal-auth/seller/logout/", { method: "POST", credentials: "same-origin" }); } finally { clearSellerSession(); }
}
