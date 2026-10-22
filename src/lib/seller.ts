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
export type SellerNotification = { id: number; notification_type: string; product_id: number | null; product_title: string | null; is_read: boolean; created_at: string; title: string; body: string; proposed_unit_price: string | null; proposed_currency: string | null; price_negotiation_status: string | null; seller_comment?: string; price_accepted?: boolean | null; responded_at?: string | null; sender_name?: string | null; manager_name?: string | null };
export type PageResult<T> = { count: number; next: string | null; previous: string | null; results: T[] };

const TOKEN_KEY = "benim_seller_access_token";
let refreshInFlight: Promise<string | null> | null = null;

export function sellerToken() {
  return typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
}
export function saveSellerToken(token: string) { localStorage.setItem(TOKEN_KEY, token); }
export function clearSellerToken() { if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY); }

function sellerApiPath(path: string) {
  const url = new URL(path, window.location.origin);
  if (!url.pathname.startsWith("/api/v1/")) throw new SellerApiError(0, "Invalid seller API URL.");
  return `${url.pathname}${url.search}`;
}

async function refreshSellerToken() {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/v1/auth/refresh/", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: "{}",
    }).then(async (response) => {
      if (!response.ok) { clearSellerToken(); return null; }
      const data = await response.json() as { access?: string };
      if (!data.access) { clearSellerToken(); return null; }
      const profileResponse = await fetch("/api/v1/auth/me/", { credentials: "same-origin", headers: { Authorization: `Bearer ${data.access}` } });
      if (!profileResponse.ok || (await profileResponse.json() as { role?: string }).role !== "seller") { clearSellerToken(); return null; }
      saveSellerToken(data.access);
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
  catch { throw new SellerApiError(0, "Unable to reach the server. Check your connection and try again."); }
  if (!token) throw new SellerApiError(401, "Your session has expired. Please sign in again.");
  let response: Response;
  try { response = await request(token); }
  catch { throw new SellerApiError(0, "Unable to reach the server. Check your connection and try again."); }
  if (response.status === 401) {
    try { token = await refreshSellerToken(); }
    catch { throw new SellerApiError(0, "Unable to reach the server. Check your connection and try again."); }
    if (!token) throw new SellerApiError(401, "Your session has expired. Please sign in again.");
    try { response = await request(token); }
    catch { throw new SellerApiError(0, "Unable to reach the server. Check your connection and try again."); }
  }
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { body = null; }
    throw new SellerApiError(response.status, errorMessage(body, response.statusText || "Request failed"), body);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function sellerAllPages<T>(path: string): Promise<T[]> {
  const first = await sellerRequest<T[] | PageResult<T>>(path);
  if (Array.isArray(first)) return first;
  const items = [...first.results];
  let next = first.next;
  while (next) {
    const page = await sellerRequest<PageResult<T>>(next);
    items.push(...page.results);
    next = page.next;
  }
  return items;
}

export async function sellerPublicRequest<T = unknown>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
  } catch { throw new SellerApiError(0, "Unable to reach the server. Check your connection and try again."); }
  if (!response.ok) {
    let data: unknown; try { data = await response.json(); } catch { data = null; }
    throw new SellerApiError(response.status, errorMessage(data, response.statusText || "Request failed"), data);
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

function flattenErrors(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => flattenErrors(item, path ? `${path}[${index}]` : ""));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => flattenErrors(item, path ? `${path}.${key}` : key));
  if (typeof value !== "string" && typeof value !== "number") return [];
  const message = String(value);
  return [path ? `${path}: ${message}` : message];
}

export function errorMessage(data: unknown, fallback = "Request failed") {
  if (!data || typeof data !== "object") return fallback;
  const object = data as Record<string, unknown>;
  if (typeof object.detail === "string") return object.detail;
  return Object.entries(object).flatMap(([field, value]) => flattenErrors(value, field)).join("; ") || fallback;
}

export async function sellerLogin(email: string, password: string) {
  const response = await fetch("/api/v1/auth/login/", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Refresh-Token-Cookie": "seller" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    let data: unknown; try { data = await response.json(); } catch { data = null; }
    throw new SellerApiError(response.status, errorMessage(data, "Email or password is incorrect."), data);
  }
  const token = (await response.json() as { access: string }).access;
  const profileResponse = await fetch("/api/v1/auth/me/", { credentials: "same-origin", headers: { Authorization: `Bearer ${token}` } });
  if (!profileResponse.ok) throw new SellerApiError(profileResponse.status, "Could not verify your account role.");
  const profile = await profileResponse.json() as SellerProfile;
  if (profile.role !== "seller") { clearSellerToken(); throw new SellerApiError(403, "This portal is available to seller accounts only."); }
  localStorage.setItem("benim_seller_locale", profile.preferred_language);
  window.dispatchEvent(new Event("seller-locale-updated"));
  saveSellerToken(token);
  return profile;
}

export async function sellerLogout() {
  try { await sellerRequest("/api/v1/auth/logout/", { method: "POST", body: "{}" }); } finally { clearSellerToken(); }
}
