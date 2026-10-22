import test from "node:test";
import assert from "node:assert/strict";
import { sellerLogin, sellerRequest, sellerLogout, clearSellerToken } from "../src/lib/seller.ts";
import { readSellerLocale, setSellerLocale, translateSeller } from "../src/lib/seller-i18n.ts";

const values = new Map([["benim_access_token", "manager-access"]]);
const events = [];
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
globalThis.window = { localStorage: globalThis.localStorage };
globalThis.window.dispatchEvent = (event) => { events.push(event.type); return true; };

test("seller labels translate and interpolate in every supported language", () => {
  assert.equal(readSellerLocale("unknown"), "en");
  assert.equal(translateSeller("Profile saved.", "ru"), "Профиль сохранён.");
  assert.equal(translateSeller("Profile saved.", "tr"), "Profil kaydedildi.");
  assert.equal(translateSeller("Profile saved.", "de"), "Profil gespeichert.");
  assert.equal(translateSeller("{count} products · Page {page}", "tr", { count: 12, page: 2 }), "12 ürün · Sayfa 2");
  assert.equal(translateSeller("Server error", "de"), "Server error");
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
    sellerRequest("/api/first/"),
    sellerRequest("/api/second/"),
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
  await assert.rejects(sellerRequest("/api/private/"), { status: 401 });
  assert.equal(values.has("benim_seller_access_token"), false);
});
