import test from "node:test";
import assert from "node:assert/strict";
import { sellerAvatarInitial, sellerLogin, sellerRequest, sellerLogout, clearSellerToken, errorMessage } from "../src/lib/seller.ts";
import { readSellerLocale, setSellerLocale, translateSeller } from "../src/lib/seller-i18n.ts";
import { loadOttoCatalogPages, parseOttoAttributeValue } from "../src/lib/otto-catalog.ts";
import { answerAvailabilityOnce, availabilityResponseState, SellerAvailabilityGuard } from "../src/lib/seller-availability.ts";
import { getSellerDatePreset, berlinBusinessDate, parseSellerIsoDate, sellerDateToIso, shiftSellerCalendarMonth } from "../src/lib/seller-date-range.ts";
import { firstSellerProductOptions, sellerProductSearchUrl } from "../src/lib/seller-product-search.ts";
import { toggleSellerMultiValue } from "../src/lib/seller-select.ts";
import { sellerProductErrorDetails } from "../src/lib/seller-product-errors.ts";
import { LANDING_I18N, SELLER_LOGIN_PATH } from "../src/lib/landing-content.ts";

const values = new Map([["benim_access_token", "manager-access"]]);
const events = [];
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
globalThis.window = { localStorage: globalThis.localStorage, location: { origin: "https://app.test" } };
globalThis.window.dispatchEvent = (event) => { events.push(event.type); return true; };

test("seller labels translate and interpolate in every supported language", () => {
  assert.equal(readSellerLocale("unknown"), "en");
  assert.equal(translateSeller("Profile saved.", "ru"), "Профиль сохранён.");
  assert.equal(translateSeller("Profile saved.", "tr"), "Profil kaydedildi.");
  assert.equal(translateSeller("Profile saved.", "de"), "Profil gespeichert.");
  assert.equal(translateSeller("{count} products · Page {page}", "tr", { count: 12, page: 2 }), "12 ürün · Sayfa 2");
  assert.equal(translateSeller("Filters", "ru"), "Фильтры");
  assert.equal(translateSeller("Send for review", "de"), "Zur Prüfung einreichen");
  assert.equal(translateSeller("Show password", "tr"), "Şifreyi göster");
  for (const locale of ["ru", "tr", "de"]) {
    assert.notEqual(translateSeller("Optional attributes", locale), "Optional attributes");
    assert.notEqual(translateSeller("Select or drop photos", locale), "Select or drop photos");
  }
  assert.equal(translateSeller("Server error", "de"), "Server error");
});

test("OTTO attribute values follow the supported catalog types", () => {
  assert.equal(parseOttoAttributeValue("STRING", "Oak"), "Oak");
  assert.equal(parseOttoAttributeValue("INTEGER", "12"), 12);
  assert.equal(parseOttoAttributeValue("INTEGER", "1.5"), null);
  assert.equal(parseOttoAttributeValue("FLOAT", "1.5"), 1.5);
  assert.equal(parseOttoAttributeValue("BOOLEAN", "true"), null);
});

test("OTTO catalog selectors follow the API's numbered pagination", async () => {
  const urls = [];
  const values = await loadOttoCatalogPages("/api/v1/catalog/otto/groups/en/", async url => {
    urls.push(url);
    return url.includes("page=1")
      ? { results: ["first"], next: 2 }
      : { results: ["second"], next: null };
  });
  assert.deepEqual(values, ["first", "second"]);
  assert.deepEqual(urls, [
    "/api/v1/catalog/otto/groups/en/?page=1&limit=200",
    "/api/v1/catalog/otto/groups/en/?page=2&limit=200",
  ]);
});

test("changing seller language updates only its preference", () => {
  values.set("benim_access_token", "manager-access");
  setSellerLocale("ru");
  assert.equal(values.get("benim_seller_locale"), "ru");
  assert.equal(values.get("benim_access_token"), "manager-access");
  assert.equal(events.at(-1), "seller-locale-updated");
});

test("seller login verifies role and stores a separate access token", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push([String(input), init]);
    if (String(input).endsWith("/login/")) return Response.json({ access: "seller-access" });
    return Response.json({ role: "seller", preferred_language: "de" });
  };

  const profile = await sellerLogin("seller@example.com", "password");
  assert.equal(profile.role, "seller");
  assert.equal(values.get("benim_seller_access_token"), "seller-access");
  assert.equal(values.get("benim_access_token"), "manager-access");
  assert.equal(values.get("benim_seller_locale"), "de");
  assert.equal(calls[0][1].headers["X-Refresh-Token-Cookie"], "seller");
  assert.equal(calls[0][1].credentials, "same-origin");
});

test("seller login rejects manager role without saving its token", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; clearSellerToken(); });
  globalThis.fetch = async (input) => String(input).endsWith("/login/")
    ? Response.json({ access: "manager-as-seller" })
    : Response.json({ role: "manager" });

  await assert.rejects(sellerLogin("manager@example.com", "password"), { status: 403 });
  assert.equal(values.has("benim_seller_access_token"), false);
});

test("invalid credentials remain an authentication error", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; clearSellerToken(); });
  globalThis.fetch = async () => Response.json({ detail: "No active account found." }, { status: 401 });
  await assert.rejects(sellerLogin("bad@example.com", "wrong"), { status: 401 });
  assert.equal(values.has("benim_seller_access_token"), false);
});

test("seller API pagination never sends its bearer token to an external URL", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; clearSellerToken(); });
  values.set("benim_seller_access_token", "seller-access");
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push([String(input), init]);
    return Response.json({ ok: true });
  };

  await sellerRequest("https://untrusted.example/api/v1/notifications/?page=2");
  assert.equal(calls[0][0], "/api/v1/notifications/?page=2");
  assert.equal(calls[0][1].headers.get("Authorization"), "Bearer seller-access");
});

test("nested serializer errors remain readable", () => {
  assert.equal(
    errorMessage({ variants: [{ materials: ["Enter at least one material."] }] }),
    "variants[0].materials[0]: Enter at least one material.",
  );
});

test("parallel expired requests share one refresh request", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; clearSellerToken(); });
  values.set("benim_seller_access_token", "expired");
  let refreshes = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/auth/me/")) return Response.json({ role: "seller" });
    if (url.endsWith("/refresh/")) {
      refreshes += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return Response.json({ access: "fresh" });
    }
    if (init.headers.get("Authorization") === "Bearer expired") return new Response(null, { status: 401 });
    return Response.json({ ok: true });
  };

  const [first, second] = await Promise.all([
    sellerRequest("/api/v1/first/"),
    sellerRequest("/api/v1/second/"),
  ]);
  assert.deepEqual(first, { ok: true });
  assert.deepEqual(second, { ok: true });
  assert.equal(refreshes, 1);
  assert.equal(values.get("benim_seller_access_token"), "fresh");
});

test("logout calls the seller API and clears only seller storage", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  values.set("benim_seller_access_token", "seller-access");
  globalThis.fetch = async () => new Response(null, { status: 204 });
  await sellerLogout();
  assert.equal(values.has("benim_seller_access_token"), false);
  assert.equal(values.get("benim_access_token"), "manager-access");
});

test("expired refresh clears the seller session", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; clearSellerToken(); });
  values.set("benim_seller_access_token", "expired");
  globalThis.fetch = async (input) => String(input).endsWith("/refresh/")
    ? Response.json({ detail: "Token is invalid or expired" }, { status: 401 })
    : new Response(null, { status: 401 });
  await assert.rejects(sellerRequest("/api/v1/private/"), { status: 401 });
  assert.equal(values.has("benim_seller_access_token"), false);
});

test("seller avatars use one trimmed initial and fall back to username", () => {
  assert.equal(sellerAvatarInitial({ first_name: "  Alikhan ", username: "bulkair" }), "A");
  assert.equal(sellerAvatarInitial({ first_name: "   ", username: " seller " }), "S");
  assert.equal(sellerAvatarInitial({ first_name: "", username: "" }), "");
});

test("seller multi-select toggles each selected value once", () => {
  assert.deepEqual(toggleSellerMultiValue(["oak"], "linen"), ["oak", "linen"]);
  assert.deepEqual(toggleSellerMultiValue(["oak", "linen"], "oak"), ["linen"]);
});

test("product validation errors map to friendly field names without exposing API paths", () => {
  const details = sellerProductErrorDetails({
    variants: [{ materials: ["Choose one or two materials."], width_cm: ["Enter a valid number."] }],
    otto_attributes: { 415: ["Invalid value."] },
    unknown_field: ["Invalid value."],
  });
  assert.equal(details.fields.materials, "Choose one or two materials.");
  assert.equal(details.fields.width_cm, "Enter a valid number.");
  assert.equal(details.fields.otto_attributes, "Invalid value.");
  assert.equal(details.message, "Some product details need attention. Review the form and try again.");
  assert.equal(JSON.stringify(details).includes("unknown_field"), false);
});

test("statistics product search requests one ten-item page and uses backend search", () => {
  assert.equal(sellerProductSearchUrl(), "/api/v1/products/?page_size=10");
  assert.equal(sellerProductSearchUrl("  sofa bed  "), "/api/v1/products/?page_size=10&search=sofa+bed");
  assert.deepEqual(firstSellerProductOptions(Array.from({ length: 100 }, (_, index) => index)), Array.from({ length: 10 }, (_, index) => index));
});

test("seller date presets use Berlin dates and calendar-day arithmetic", () => {
  assert.equal(berlinBusinessDate(new Date("2025-12-31T23:30:00.000Z")), "2026-01-01");
  assert.deepEqual(getSellerDatePreset("last7Days", "2026-01-01"), { from: "2025-12-26", to: "2026-01-01" });
  assert.deepEqual(getSellerDatePreset("thisWeek", "2026-01-01"), { from: "2025-12-29", to: "2026-01-01" });
  assert.deepEqual(getSellerDatePreset("lastWeek", "2026-01-01"), { from: "2025-12-22", to: "2025-12-28" });
  assert.deepEqual(getSellerDatePreset("lastMonth", "2026-01-01"), { from: "2025-12-01", to: "2025-12-31" });
  assert.equal(sellerDateToIso(parseSellerIsoDate("2026-01-01")), "2026-01-01");
  const month = shiftSellerCalendarMonth(new Date(2025, 11, 1), 1);
  assert.equal(sellerDateToIso(month), "2026-01-01");
});

test("availability actions only apply to unanswered incoming reminders", () => {
  const unanswered = { notification_type: "product_availability_reminder", product_id: 12, is_read: true, responded_at: null };
  assert.equal(availabilityResponseState(unanswered), "pending");
  assert.equal(availabilityResponseState({ ...unanswered, responded_at: "2026-01-01T00:00:00Z" }), "answered");
  assert.equal(availabilityResponseState({ ...unanswered, notification_type: "product_confirmation" }), "none");
  assert.equal(availabilityResponseState(unanswered, true), "answered");
});

test("one availability response guards same-product double clicks and duplicate reminders", async () => {
  const guard = new SellerAvailabilityGuard();
  let resolvePost;
  let postCount = 0;
  const send = () => {
    postCount += 1;
    return new Promise(resolve => { resolvePost = resolve; });
  };
  const noop = async () => {};
  const onAnswered = () => {};
  const onReadError = () => {};
  const first = answerAvailabilityOnce({ guard, productId: 12, send, markRead: noop, onAnswered, onReadError });
  const doubleClick = await answerAvailabilityOnce({ guard, productId: 12, send, markRead: noop, onAnswered, onReadError });
  const secondReminder = await answerAvailabilityOnce({ guard, productId: 12, send, markRead: noop, onAnswered, onReadError });
  assert.equal(doubleClick, false);
  assert.equal(secondReminder, false);
  assert.equal(postCount, 1);
  resolvePost();
  assert.equal(await first, true);
  assert.equal(availabilityResponseState({ notification_type: "product_availability_reminder", product_id: 12, responded_at: null }, guard.answered.has(12)), "answered");
  assert.equal(await answerAvailabilityOnce({ guard, productId: 12, send, markRead: noop, onAnswered, onReadError }), false);
  assert.equal(postCount, 1);
});

test("mark-as-read failure does not repeat a successful availability response", async () => {
  const guard = new SellerAvailabilityGuard();
  let posts = 0;
  let readErrors = 0;
  const request = () => answerAvailabilityOnce({
    guard,
    productId: 21,
    send: async () => { posts += 1; },
    markRead: async () => { throw new Error("Read request failed"); },
    onAnswered: () => {},
    onReadError: () => { readErrors += 1; },
  });
  assert.equal(await request(), true);
  assert.equal(await request(), false);
  assert.equal(posts, 1);
  assert.equal(readErrors, 1);
});

test("availability failures stay visible and ambiguous failures require a status refresh", async () => {
  const guard = new SellerAvailabilityGuard();
  const rejected = Object.assign(new Error("Availability was rejected"), { status: 422 });
  await assert.rejects(guard.submit(31, async () => { throw rejected; }), /Availability was rejected/);
  assert.equal(guard.isBlocked(31), false);

  const ambiguous = Object.assign(new Error("Connection lost"), { status: 0 });
  await assert.rejects(guard.submit(32, async () => { throw ambiguous; }), /Connection lost/);
  assert.equal(guard.isBlocked(32), true);
  guard.resolveUncertain(32);
  assert.equal(guard.isBlocked(32), false);
});

test("landing exposes localized seller sign-in and keeps the destination fixed", () => {
  assert.equal(SELLER_LOGIN_PATH, "/seller/login");
  assert.deepEqual([LANDING_I18N.en.nav.sellerLogin, LANDING_I18N.de.nav.sellerLogin, LANDING_I18N.tr.nav.sellerLogin], ["Sign in", "Anmelden", "Giriş Yap"]);
});
