import assert from "node:assert/strict";
import { test } from "node:test";
import { setSessionItem, storeSellerOttoCatalog } from "../src/lib/browser-storage.ts";
import { saveSellerToken } from "../src/lib/seller.ts";

class MemoryStorage {
  values = new Map();
  quota = Infinity;
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  removeItem(key) { this.values.delete(key); }
  bytes() { return [...this.values].reduce((sum, [key, value]) => sum + 2 * (key.length + value.length), 0); }
  setItem(key, value) {
    const next = new Map(this.values).set(key, value);
    const size = [...next].reduce((sum, [name, text]) => sum + 2 * (name.length + text.length), 0);
    if (size > this.quota) throw new DOMException("Storage full", "QuotaExceededError");
    this.values = next;
  }
}

test("OTTO disk cache removes expired and malformed entries and evicts the oldest within 1 MiB", () => {
  const storage = new MemoryStorage();
  storage.setItem("benim_access_token", "manager");
  storage.setItem("benim_seller_locale", "tr");
  storage.setItem("seller-otto-v1:expired", JSON.stringify({ expires: 1, values: [] }));
  storage.setItem("seller-otto-v1:broken", "{");
  const expires = Date.now() + 60_000;
  for (let index = 0; index < 4; index++) {
    storeSellerOttoCatalog(storage, `seller-otto-v1:${index}`, expires + index, ["x".repeat(180_000)]);
  }
  assert.equal(storage.getItem("seller-otto-v1:expired"), null);
  assert.equal(storage.getItem("seller-otto-v1:broken"), null);
  assert.equal(storage.getItem("seller-otto-v1:0"), null);
  assert.equal(storage.getItem("seller-otto-v1:1"), null);
  assert.ok(storage.getItem("seller-otto-v1:2"));
  assert.ok(storage.getItem("seller-otto-v1:3"));
  assert.ok(storage.bytes() < 1024 * 1024);
  assert.equal(storage.getItem("benim_access_token"), "manager");
  assert.equal(storage.getItem("benim_seller_locale"), "tr");
  storeSellerOttoCatalog(storage, "seller-otto-v1:oversized", expires, ["x".repeat(600_000)]);
  assert.equal(storage.getItem("seller-otto-v1:oversized"), null);
  assert.ok(storage.getItem("seller-otto-v1:3"));
  storeSellerOttoCatalog(storage, "seller-otto-v1:3", expires, ["updated"]);
  assert.deepEqual(JSON.parse(storage.getItem("seller-otto-v1:3")).values, ["updated"]);
});

test("saving a seller token recovers from an already full browser by removing only the OTTO cache", t => {
  const previous = globalThis.localStorage;
  t.after(() => { globalThis.localStorage = previous; });
  const storage = new MemoryStorage();
  storage.setItem("benim_access_token", "manager");
  storage.setItem("benim_seller_availability_answers:42", '{"10":true}');
  storage.setItem("seller-otto-v1:old", "x".repeat(500));
  storage.quota = storage.bytes() + 10;
  globalThis.localStorage = storage;
  saveSellerToken("seller-access");
  assert.equal(storage.getItem("benim_seller_access_token"), "seller-access");
  assert.equal(storage.getItem("seller-otto-v1:old"), null);
  assert.equal(storage.getItem("benim_access_token"), "manager");
  assert.equal(storage.getItem("benim_seller_availability_answers:42"), '{"10":true}');
  setSessionItem(storage, "benim_access_token", "manager-refreshed");
  assert.equal(storage.getItem("benim_access_token"), "manager-refreshed");
});

test("unavailable storage does not break optional caching or silently discard session errors", () => {
  const storage = new MemoryStorage();
  const denied = new DOMException("Storage disabled", "SecurityError");
  storage.setItem("seller-otto-v1:existing", "cache");
  storage.setItem = () => { throw denied; };
  assert.doesNotThrow(() => storeSellerOttoCatalog(storage, "seller-otto-v1:new", Date.now() + 60_000, []));
  storage.values.set("seller-otto-v1:existing", "cache");
  assert.throws(() => setSessionItem(storage, "benim_seller_access_token", "token"), error => error === denied);
  assert.equal(storage.getItem("seller-otto-v1:existing"), "cache");
  const full = new MemoryStorage();
  full.setItem("user-setting", "keep");
  full.quota = full.bytes();
  assert.throws(() => setSessionItem(full, "benim_seller_access_token", "token"), { name: "QuotaExceededError" });
  assert.equal(full.getItem("user-setting"), "keep");
});
