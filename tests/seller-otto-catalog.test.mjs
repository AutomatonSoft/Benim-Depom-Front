import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSellerOttoCategories, prefetchSellerOttoCatalog } from "../src/lib/seller-otto-catalog.ts";
import { loadOttoCatalogPages } from "../src/lib/otto-catalog.ts";

test("seller OTTO cache shares requests, separates languages, retries failures and survives reload", async t => {
  const originals = { window: globalThis.window, localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage, fetch: globalThis.fetch };
  t.after(() => Object.assign(globalThis, originals));
  const saved = new Map();
  globalThis.window = { location: { origin: "https://seller.example" } };
  globalThis.localStorage = { getItem: key => key === "benim_seller_access_token" ? "seller-access" : saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  globalThis.sessionStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  let requests = 0;
  globalThis.fetch = async () => { requests++; return Response.json({ results: [{ category_id: 1, name: "Chair" }], next: null }); };
  const [first, second] = await Promise.all([loadSellerOttoCategories("en", 610), loadSellerOttoCategories("en", 610)]);
  assert.deepEqual(first, second);
  assert.equal(requests, 1);
  await loadSellerOttoCategories("ru", 610);
  assert.equal(requests, 2);
  const reloaded = await import("../src/lib/seller-otto-catalog.ts?reload");
  await reloaded.loadSellerOttoCategories("en", 610);
  assert.equal(requests, 2);
  globalThis.fetch = async () => Response.json({ detail: "Service unavailable" }, { status: 503 });
  await assert.rejects(loadSellerOttoCategories("en", 611));
  globalThis.fetch = async () => Response.json({ results: [], next: null });
  assert.deepEqual(await loadSellerOttoCategories("en", 611), []);

  let active = 0;
  let peak = 0;
  const urls = [];
  globalThis.fetch = async input => {
    const url = String(input);
    urls.push(url);
    if (!url.includes("/categories/")) return Response.json({ results: Array.from({ length: 7 }, (_, index) => ({ category_group_id: 700 + index, category_group: `Group ${index}` })), next: null });
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return Response.json({ results: [], next: null });
  };
  await prefetchSellerOttoCatalog("tr", new AbortController().signal);
  assert.equal(peak, 3);
  assert.equal(urls.length, 8);
  assert.equal(urls.some(url => url.includes("/attributes/")), false);
  await prefetchSellerOttoCatalog("tr", new AbortController().signal);
  assert.equal(urls.length, 8);
  const stopped = new AbortController();
  stopped.abort();
  await prefetchSellerOttoCatalog("de", stopped.signal);
  assert.equal(urls.length, 9);
  assert.equal(urls.at(-1).includes("/categories/"), false);

  saved.set("seller-otto-v1:/api/v1/catalog/otto/category-groups/612/categories/en/", JSON.stringify({ expires: 0, values: [{ category_id: 99, name: "Outdated" }] }));
  assert.deepEqual(await loadSellerOttoCategories("en", 612), []);
  globalThis.localStorage = { getItem(key) { if (key === "benim_seller_access_token") return "seller-access"; throw new Error("Storage disabled"); }, setItem() { throw new Error("Storage disabled"); } };
  assert.deepEqual(await loadSellerOttoCategories("en", 613), []);
});

test("catalog page preloading is bounded and preserves page order", async () => {
  let active = 0;
  let peak = 0;
  const pages = [];
  const values = await loadOttoCatalogPages("/groups/", async url => {
    const page = Number(new URL(url, "https://example.test").searchParams.get("page"));
    pages.push(page);
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, page === 2 ? 15 : 1));
    active--;
    return { results: [page], count: 1200, next: page < 6 ? page + 1 : null };
  }, 3);
  assert.equal(peak, 3);
  assert.deepEqual(values, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...pages].sort(), [1, 2, 3, 4, 5, 6]);
});
