import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { authorizedFetch } from "../src/lib/api.ts";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
let values;
let calls;

beforeEach(() => {
  values = new Map([["benim_access_token", "old-access"], ["benim_seller_access_token", "seller-session"]]);
  calls = [];
  globalThis.window = { localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
});

function respondWith(...responses) {
  globalThis.fetch = async (url, init) => {
    calls.push({ url, headers: new Headers(init?.headers) });
    assert.ok(responses.length, "unexpected API request");
    const [status, body] = responses.shift();
    return Response.json(body, { status });
  };
}

test("manager refresh rejects a seller token from the shared cookie", async () => {
  respondWith([401, {}], [200, { access: "seller-access" }], [200, { role: "seller" }]);
  const response = await authorizedFetch("/api/v2/manager/dashboard/");
  assert.equal(response.status, 401);
  assert.equal(values.has("benim_access_token"), false);
  assert.equal(values.get("benim_seller_access_token"), "seller-session");
  assert.equal(calls.length, 3);
});

test("a stored seller token sends the manager back through sign-in", async () => {
  respondWith([403, {}], [200, { role: "seller" }]);
  assert.equal((await authorizedFetch("/api/v2/manager/dashboard/")).status, 401);
  assert.equal(values.has("benim_access_token"), false);
});

test("a genuine manager permission denial stays forbidden", async () => {
  respondWith([403, { detail: "Denied" }], [200, { role: "manager" }]);
  assert.equal((await authorizedFetch("/api/v2/manager/dashboard/")).status, 403);
  assert.equal(values.get("benim_access_token"), "old-access");
});

for (const role of ["manager", "admin"]) {
  test(`${role} refresh saves and retries with the verified token`, async () => {
    respondWith([401, {}], [200, { access: "new-access" }], [200, { role }], [200, { count: 1 }]);
    assert.equal((await authorizedFetch("/api/v2/manager/dashboard/")).status, 200);
    assert.equal(values.get("benim_access_token"), "new-access");
    assert.equal(calls[3].headers.get("Authorization"), "Bearer new-access");
  });
}
