import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const source = readFileSync(new URL("../src/app/portal-auth/[portal]/[action]/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function handler(fetch, nodeEnv = "development") {
  const compiledModule = { exports: {} };
  new Function("module", "exports", "require", "fetch", "process", compiled)(compiledModule, compiledModule.exports, require, fetch, {
    env: { NODE_ENV: nodeEnv, BACKEND_URL: "http://backend.test" },
  });
  return compiledModule.exports.POST;
}
function request(portal, action, cookies = {}, body, origin = "https://frontend.test") {
  return new NextRequest(`https://frontend.test/portal-auth/${portal}/${action}/`, {
    method: "POST", headers: {
      Host: "frontend.test", Origin: origin, "Content-Type": "application/json",
      Cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join("; "),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const context = (portal, action) => ({ params: Promise.resolve({ portal, action }) });

test("seller and manager keep independent cookies through login, rotation and logout", async () => {
  const revoked = [];
  const post = handler(async (url, init) => {
    assert.ok(url.startsWith("http://backend.test/api/v2/auth/"));
    assert.equal(init.credentials, "omit");
    assert.equal(new Headers(init.headers).has("cookie"), false);
    assert.equal(new Headers(init.headers).has("X-Refresh-Token-Cookie"), false);
    assert.equal(new Headers(init.headers).get("host"), "frontend.test");
    assert.equal(new Headers(init.headers).get("x-forwarded-proto"), "https");
    if (url.endsWith("/me/")) {
      const access = new Headers(init.headers).get("authorization");
      return Response.json({ role: access.includes("seller") ? "seller" : "manager" });
    }
    const body = JSON.parse(init.body);
    if (url.endsWith("/login/")) return Response.json({ access: `${body.phone || body.email}-access`, refresh: `${body.phone || body.email}-refresh` });
    assert.match(body.refresh, /^(seller|manager)-refresh/);
    if (url.endsWith("/logout/")) {
      revoked.push(body.refresh);
      return new Response(null, { status: 204 });
    }
    return Response.json({ access: `${body.refresh}-access`, refresh: `${body.refresh}-rotated` });
  }, "production");
  const cookies = { benim_refresh: "legacy-shared-token" };
  for (const portal of ["seller", "manager"]) {
    const credentials = { [portal === "seller" ? "phone" : "email"]: portal, password: "password" };
    const response = await post(request(portal, "login", cookies, credentials), context(portal, "login"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { access: `${portal}-access` });
    const cookie = response.cookies.get(`benim_${portal}_refresh`);
    assert.equal(cookie.path, `/portal-auth/${portal}/`);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.secure, true);
    assert.equal(cookie.sameSite, "strict");
    assert.equal(response.cookies.get("benim_refresh"), undefined);
    cookies[cookie.name] = cookie.value;
  }
  const sellerRefresh = await post(request("seller", "refresh", cookies), context("seller", "refresh"));
  assert.equal(sellerRefresh.cookies.get("benim_seller_refresh").value, "seller-refresh-rotated");
  assert.equal(sellerRefresh.cookies.get("benim_manager_refresh"), undefined);
  cookies.benim_seller_refresh = "seller-refresh-rotated";
  const logout = await post(request("seller", "logout", cookies), context("seller", "logout"));
  assert.equal(logout.status, 204);
  assert.equal(logout.cookies.get("benim_seller_refresh").maxAge, 0);
  assert.equal(logout.cookies.get("benim_manager_refresh"), undefined);
  assert.deepEqual(revoked, ["seller-refresh-rotated-rotated"]);
  const managerRefresh = await post(request("manager", "refresh", cookies), context("manager", "refresh"));
  assert.equal(managerRefresh.status, 200);
  assert.equal(managerRefresh.cookies.get("benim_manager_refresh").value, "manager-refresh-rotated");
});

test("shared cookies, foreign origins and unknown portals cannot supply a session", async () => {
  const post = handler(async () => { assert.fail("No backend request expected"); });
  const legacy = { benim_refresh: "legacy", benim_manager_refresh: "manager" };
  assert.equal((await post(request("seller", "refresh", legacy), context("seller", "refresh"))).status, 401);
  assert.equal((await post(request("seller", "login", {}, {}, "https://foreign.test"), context("seller", "login"))).status, 403);
  assert.equal((await post(request("admin", "login"), context("admin", "login"))).status, 404);
  assert.equal((await post(request("seller", "login", {}, { refresh: "injected" }), context("seller", "login"))).status, 400);
  assert.equal((await post(request("seller", "login", {}, { email: "seller@example.com", password: "password" }), context("seller", "login"))).status, 400);
  assert.equal((await post(request("manager", "login", {}, { phone: "+905551234567", password: "password" }), context("manager", "login"))).status, 400);
});

test("a wrong role never replaces an existing portal cookie", async () => {
  const post = handler(async url => Response.json(url.endsWith("/me/") ? { role: "manager" } : { access: "access", refresh: "secret" }));
  const response = await post(request("seller", "login", {}, { phone: "manager", password: "password" }), context("seller", "login"));
  assert.equal(response.status, 403);
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(JSON.stringify(await response.json()).includes("secret"), false);
});

test("transient refresh failures preserve the cookie; logout clears only its own cookie", async () => {
  const post = handler(async () => { throw new Error("Network unavailable"); });
  const cookies = { benim_seller_refresh: "seller", benim_manager_refresh: "manager" };
  const refresh = await post(request("seller", "refresh", cookies), context("seller", "refresh"));
  assert.equal(refresh.status, 503);
  assert.equal(refresh.headers.has("set-cookie"), false);
  const logout = await post(request("seller", "logout", cookies), context("seller", "logout"));
  assert.equal(logout.cookies.get("benim_seller_refresh").maxAge, 0);
  assert.equal(logout.cookies.get("benim_manager_refresh"), undefined);
});
