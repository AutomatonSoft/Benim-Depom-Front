import test from "node:test";
import assert from "node:assert/strict";
import { sellerAvatarInitial, sellerLogin, sellerRequest, sellerPublicRequest, sellerLogout, clearSellerToken, clearSellerSession, sellerProfileId, saveSellerProfileId, readAvailabilityAnswers, rememberAvailabilityAnswer, errorMessage, respondToPriceNegotiation, sellerReviewNotifications } from "../src/lib/seller.ts";
import { readSellerLocale, setSellerLocale, translateSeller } from "../src/lib/seller-i18n.ts";
import { loadOttoCatalogPages, parseOttoAttributeValue, updateOttoAttribute } from "../src/lib/otto-catalog.ts";
import { answerAvailabilityOnce, availabilityAnswerDisplayState, availabilityResponseState, SellerAvailabilityGuard } from "../src/lib/seller-availability.ts";
import { getSellerDatePreset, berlinBusinessDate, parseSellerIsoDate, sellerDateToIso, shiftSellerCalendarMonth } from "../src/lib/seller-date-range.ts";
import { firstSellerProductOptions, sellerProductSearchUrl } from "../src/lib/seller-product-search.ts";
import { toggleSellerMultiValue } from "../src/lib/seller-select.ts";
import { sellerProductErrorDetails } from "../src/lib/seller-product-errors.ts";
import { sellerMaterialInputs, sellerMaterials, sellerProductFormData, sellerProductTypeLabel, sellerProductTypes, sellerProductVariant, sellerSetPartsPayload } from "../src/lib/seller-product-form.ts";
import { sellerNotificationTone } from "../src/lib/seller-notification-style.ts";
import { sellerNotificationDateFormatter } from "../src/lib/seller-notification-date.ts";
import { formatNotificationPrice, hasStructuredSaleDetails, priceOfferDisplayState, runNotificationActionOnce, sellerNotificationFilters, sellerSaleBodyDetails } from "../src/lib/seller-notification-content.ts";
import { LANDING_I18N, SELLER_LOGIN_PATH } from "../src/lib/landing-content.ts";
import "./seller-account-deletion.test.mjs";
import "./seller-notifications.test.mjs";

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
  assert.deepEqual(
    ["en", "ru", "tr", "de"].map(locale => translateSeller("Review updates about your products and respond to supported requests.", locale)),
    ["Review updates about your products and respond to supported requests.", "Следите за изменениями товаров и сообщениями менеджеров.", "Ürünlerinizdeki değişiklikleri ve yöneticilerin mesajlarını takip edin.", "Verfolgen Sie Änderungen an Ihren Produkten und Nachrichten von Managern."],
  );
  assert.deepEqual(["en", "ru", "tr", "de"].map(locale => translateSeller("Product type", locale)), ["Product type", "Тип товара", "Ürün türü", "Produkttyp"]);
  assert.equal(translateSeller("Save product", "ru"), "Сохранить товар");
  assert.deepEqual(["en", "ru", "tr", "de"].map(locale => translateSeller("Offer accepted", locale)), ["Offer accepted", "Предложение принято", "Teklif kabul edildi", "Angebot angenommen"]);
  assert.deepEqual(["en", "ru", "tr", "de"].map(locale => translateSeller("Offer declined", locale)), ["Offer declined", "Предложение отклонено", "Teklif reddedildi", "Angebot abgelehnt"]);
  assert.deepEqual(["en", "ru", "tr", "de"].map(locale => translateSeller("Offer no longer active", locale)), ["Offer no longer active", "Предложение больше не действует", "Teklif artık etkin değil", "Angebot ist nicht mehr aktiv"]);
  assert.deepEqual(["en", "ru", "tr", "de"].map(locale => translateSeller("Product sold", locale)), ["Product sold", "Товар продан", "Ürün satıldı", "Produkt verkauft"]);
  assert.deepEqual(["en", "ru", "tr", "de"].map(locale => translateSeller("Your answer", locale)), ["Your answer", "Ваш ответ", "Yanıtınız", "Ihre Antwort"]);
  assert.deepEqual(["en", "ru", "tr", "de"].map(locale => translateSeller("More sale details", locale)), ["More sale details", "Подробности продажи", "Satış ayrıntıları", "Weitere Verkaufsdetails"]);
  assert.deepEqual(["en", "ru", "tr", "de"].map(locale => translateSeller("Sending…", locale)), ["Sending…", "Отправка…", "Gönderiliyor…", "Wird gesendet…"]);
  assert.equal(translateSeller("You may list only new products. Used products cannot be uploaded.", "ru"), "Вы можете размещать только новые товары. Уже использованные товары загружать нельзя");
  assert.equal(translateSeller("Each product has one color. To sell this product in another color, add it as a new product.", "ru"), "У каждого товара один цвет. Чтобы продавать этот товар в другом цвете, добавьте его как новый товар");
  assert.equal(translateSeller("For soft materials such as fabric: 70% polyester, 25% cotton, 5% elastane. Hard materials such as wood or metal do not require a composition.", "ru"), "Для мягких материалов, например ткани: 70% полиэстер, 25% хлопок, 5% эластан. Для твёрдых материалов, таких как дерево или металл, не требуется.");
  for (const key of [
    "You may list only new products. Used products cannot be uploaded.",
    "Each product has one color. To sell this product in another color, add it as a new product.",
    "For soft materials such as fabric: 70% polyester, 25% cotton, 5% elastane. Hard materials such as wood or metal do not require a composition.",
    "Size options", "Add attribute", "Save product",
  ]) {
    for (const locale of ["ru", "tr", "de"]) assert.notEqual(translateSeller(key, locale), key);
  }
  for (const locale of ["ru", "tr", "de"]) {
    assert.notEqual(translateSeller("Delete account?", locale), "Delete account?");
    assert.notEqual(translateSeller("Are you sure you want to delete your account? You will lose access to your products and seller workspace. Deletion may be irreversible.", locale), "Are you sure you want to delete your account? You will lose access to your products and seller workspace. Deletion may be irreversible.");
  }
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
  assert.equal(calls[0][0], "/portal-auth/seller/login/");
  assert.equal(calls[0][1].headers["X-Refresh-Token-Cookie"], undefined);
  assert.equal(calls[0][1].credentials, "same-origin");
  assert.equal(calls[0][1].body, JSON.stringify({ email: "seller@example.com", password: "password" }));
});

test("seller price offer responses reuse the existing negotiation endpoint", async (t) => {
  const originalFetch = globalThis.fetch;
  const previousToken = values.get("benim_seller_access_token");
  t.after(() => previousToken ? values.set("benim_seller_access_token", previousToken) : values.delete("benim_seller_access_token"));
  t.after(() => { globalThis.fetch = originalFetch; });
  values.set("benim_seller_access_token", "seller-access");
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push([String(input), init]);
    return Response.json({ latest_price_negotiation: { status: "accepted" } });
  };

  await respondToPriceNegotiation(20, true, "Looks good");
  await respondToPriceNegotiation(21, false);

  assert.deepEqual(calls.map(([url, init]) => [url, init.method, init.body]), [
    ["/api/v1/products/20/price-negotiation/respond/", "POST", JSON.stringify({ accepted: true, comment: "Looks good" })],
    ["/api/v1/products/21/price-negotiation/respond/", "POST", JSON.stringify({ accepted: false, comment: "" })],
  ]);
});

test("public seller forms preserve registration and password reset API payloads", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push([String(input), init]);
    return Response.json({ ok: true });
  };
  const registration = {
    username: "seller", email: "seller@example.com", password: "password", password_confirm: "password",
    first_name: "A", last_name: "Seller", phone: "+905551234567", preferred_language: "tr",
  };
  await sellerPublicRequest("/api/v1/auth/register/", registration);
  const resetRequest = { email: "seller@example.com" };
  const resetVerification = { email: "seller@example.com", code: "123456" };
  const resetCompletion = { reset_token: "reset-token", new_password: "new-password", new_password_confirm: "new-password" };
  await sellerPublicRequest("/api/v1/auth/password/reset/request/", resetRequest);
  await sellerPublicRequest("/api/v1/auth/password/reset/verify/", resetVerification);
  await sellerPublicRequest("/api/v1/auth/password/reset/complete/", resetCompletion);
  assert.equal(calls[0][0], "/api/v1/auth/register/");
  assert.equal(calls[0][1].body, JSON.stringify(registration));
  assert.equal(calls[1][0], "/api/v1/auth/password/reset/request/");
  assert.equal(calls[1][1].body, JSON.stringify(resetRequest));
  assert.equal(calls[2][0], "/api/v1/auth/password/reset/verify/");
  assert.equal(calls[2][1].body, JSON.stringify(resetVerification));
  assert.equal(calls[3][0], "/api/v1/auth/password/reset/complete/");
  assert.equal(calls[3][1].body, JSON.stringify(resetCompletion));
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
    `${translateSeller("Materials", readSellerLocale(values.get("benim_seller_locale")))}: ${translateSeller("Add at least one material.", readSellerLocale(values.get("benim_seller_locale")))}`,
  );
});

test("seller review filter requests seller decisions and follows every result page", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; clearSellerToken(); });
  values.set("benim_seller_access_token", "seller-access");
  const calls = [];
  const controller = new AbortController();
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input), "https://app.test");
    calls.push(url);
    assert.equal(init.signal, controller.signal);
    const type = url.searchParams.get("notification_type");
    assert.ok(["product_approved", "product_rejected"].includes(type));
    assert.equal(url.searchParams.get("search"), "chair");
    assert.equal(url.searchParams.has("category"), false);
    if (type === "product_approved" && !url.searchParams.has("page")) {
      return Response.json({ results: [{ id: 1, created_at: "2026-10-01T10:00:00Z" }], next: `${url}&page=2` });
    }
    return Response.json({ results: [{ id: type === "product_rejected" ? 2 : 3, created_at: type === "product_rejected" ? "2026-10-03T10:00:00Z" : "2026-10-02T10:00:00Z" }], next: null });
  };
  const result = await sellerReviewNotifications(" chair ", controller.signal);
  assert.deepEqual(result.results.map(item => item.id), [2, 3, 1]);
  assert.equal(result.count, 3);
  assert.equal(result.next, null);
  assert.equal(calls.length, 3);
});

test("temporary refresh and profile verification failures preserve the existing seller token", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; clearSellerToken(); });
  for (const failingStep of ["refresh", "profile"]) {
    values.set("benim_seller_access_token", "expired-access");
    globalThis.fetch = async input => {
      const url = String(input);
      if (url.endsWith("/refresh/")) return failingStep === "refresh" ? new Response(null, { status: 503 }) : Response.json({ access: "fresh" });
      if (url.endsWith("/auth/me/")) return new Response(null, { status: 503 });
      return new Response(null, { status: 401 });
    };
    await assert.rejects(sellerRequest("/api/v1/products/"), { status: 503 });
    assert.equal(values.get("benim_seller_access_token"), "expired-access");
  }
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

test("product material inputs preserve the existing materials array payload", () => {
  assert.deepEqual(sellerMaterialInputs(["Cotton", "Linen"]), { material1: "Cotton", material2: "Linen" });
  assert.deepEqual(sellerMaterials(" Cotton ", ""), ["Cotton"]);
  assert.deepEqual(sellerMaterials("Cotton", "Linen"), ["Cotton", "Linen"]);
});

test("product type choices use API keys and retain legacy product labels", () => {
  assert.deepEqual(sellerProductTypes, ["Sofa", "Armchair", "Table", "Chair", "Bed", "Wardrobe", "Cabinet", "Bookshelf", "Desk", "Dresser", "Nightstand", "TV Unit", "Other"]);
  assert.equal(sellerProductTypeLabel("Стол"), "Table");
  assert.equal(sellerProductTypeLabel("Vintage cupboard"), "Vintage cupboard");
  assert.equal(sellerProductTypeLabel(""), "");
  for (const [key, english, russian, turkish, german] of [
    ["Sofa", "Sofa", "Диван", "Kanepe", "Sofa"],
    ["Armchair", "Armchair", "Кресло", "Koltuk", "Sessel"],
    ["Table", "Table", "Стол", "Masa", "Tisch"],
    ["Chair", "Chair", "Стул", "Sandalye", "Stuhl"],
    ["Bed", "Bed", "Кровать", "Yatak", "Bett"],
    ["Wardrobe", "Wardrobe", "Шкаф", "Gardırop", "Kleiderschrank"],
    ["Cabinet", "Cabinet", "Тумба", "Dolap", "Schrank"],
    ["Bookshelf", "Bookshelf", "Книжный шкаф", "Kitaplık", "Bücherregal"],
    ["Desk", "Desk", "Письменный стол", "Çalışma masası", "Schreibtisch"],
    ["Dresser", "Dresser", "Комод", "Şifonyer", "Kommode"],
    ["Nightstand", "Nightstand", "Прикроватная тумбочка", "Komodin", "Nachttisch"],
    ["TV Unit", "TV Unit", "ТВ-тумба", "TV Ünitesi", "TV-Möbel"],
    ["Other", "Other", "Другое", "Diğer", "Sonstiges"],
  ]) {
    assert.deepEqual(["en", "ru", "tr", "de"].map(locale => translateSeller(key, locale)), [english, russian, turkish, german]);
  }
});

test("main dimensions, materials, OTTO IDs, and set parts keep their API shapes", () => {
  assert.deepEqual(sellerProductVariant({
    color: " Navy ", material_composition: " cotton ", width_cm: "30", height_cm: "40", length_cm: "50", quantity: "3",
  }, ["Oak", "Linen"]), {
    color: "Navy", materials: ["Oak", "Linen"], material_composition: "cotton", width_cm: "30", height_cm: "40", length_cm: "50", quantity: 3,
  });
  assert.deepEqual(sellerSetPartsPayload([{ id: 7, description: " Table top ", width_cm: "80", height_cm: "4", length_cm: "120" }]), [
    { description: "Table top", width_cm: "80", height_cm: "4", length_cm: "120" },
  ]);
  assert.deepEqual(updateOttoAttribute({ "415": "Oak", "416": [2, 3] }, 415, "Walnut"), { "415": "Walnut", "416": [2, 3] });
  assert.deepEqual(updateOttoAttribute({ "415": "Oak", "416": [2, 3] }, 415, undefined), { "416": [2, 3] });
});

test("seller notifications receive category-specific visual tones", () => {
  assert.equal(sellerNotificationTone("product_sold"), "sale");
  assert.equal(sellerNotificationTone("product_rejected"), "warning");
  assert.equal(sellerNotificationTone("manager_message"), "message");
  assert.equal(sellerNotificationTone("product_availability_reminder"), "availability");
});

test("notification dates are localized and omit seconds", () => {
  const date = new Date("2026-10-15T13:00:01Z");
  for (const locale of ["en", "ru", "tr", "de"]) {
    const formatter = sellerNotificationDateFormatter(locale);
    assert.equal(formatter.resolvedOptions().second, undefined);
    assert.doesNotMatch(formatter.format(date), /:\d{2}:\d{2}/);
  }
});

test("seller notification filters retain useful categories and remove price responses", () => {
  assert.deepEqual(sellerNotificationFilters.map(([value]) => value), ["", "unread", "review", "availability", "price-offers", "afterbuy", "outgoing"]);
});

test("product multipart forms send empty optional OTTO IDs instead of the string null", () => {
  const form = sellerProductFormData({ otto_category_id: null, otto_category_group_id: null, otto_attributes: {}, variants: [{ quantity: 0 }], set_parts: [], title: "Office chair" });
  assert.equal(form.get("otto_category_id"), "");
  assert.equal(form.get("otto_category_group_id"), "");
  assert.equal(form.get("otto_attributes"), "{}");
  assert.equal(form.get("variants"), '[{"quantity":0}]');
  assert.equal(form.get("title"), "Office chair");
  const selected = sellerProductFormData({ otto_category_id: 12, otto_category_group_id: 3 });
  assert.equal(selected.get("otto_category_id"), "12");
  assert.equal(selected.get("otto_category_group_id"), "3");
  assert.deepEqual(["ru", "en", "tr", "de"].map(locale => translateSeller("Yes", locale)), ["Да", "Yes", "Evet", "Ja"]);
  assert.deepEqual(["ru", "en", "tr", "de"].map(locale => translateSeller("No", locale)), ["Нет", "No", "Hayır", "Nein"]);
});

test("price offer state comes from negotiation response fields, not read state", () => {
  assert.equal(priceOfferDisplayState({ price_negotiation_status: "pending", price_accepted: null, responded_at: null, is_read: true }), "pending");
  assert.equal(priceOfferDisplayState({ price_negotiation_status: "accepted", price_accepted: true, responded_at: "2026-10-20T10:00:00Z" }), "accepted");
  assert.equal(priceOfferDisplayState({ price_negotiation_status: "rejected", price_accepted: false, responded_at: "2026-10-20T10:00:00Z" }), "declined");
  assert.equal(priceOfferDisplayState({ price_negotiation_status: null, price_accepted: null, responded_at: "2026-10-20T10:00:00Z" }), "unknown");
  assert.equal(priceOfferDisplayState({ price_negotiation_status: "superseded", price_accepted: null, responded_at: null }), "inactive");
});

test("price offer responses are protected from duplicate in-flight requests", async () => {
  const inFlight = new Set();
  let resolveAction;
  let calls = 0;
  const action = () => { calls++; return new Promise(resolve => { resolveAction = resolve; }); };
  const first = runNotificationActionOnce(inFlight, 4201, action);
  assert.equal(await runNotificationActionOnce(inFlight, 4201, action), false);
  assert.equal(calls, 1);
  resolveAction();
  assert.equal(await first, true);
  assert.equal(inFlight.has(4201), false);
});

test("sale cards preserve legacy details and remove only represented duplicate lines", () => {
  const body = "Your product was sold.\n\nProduct: Black office chair\nTime: 2026-10-20 11:45\nSold: 2 pcs.";
  assert.equal(sellerSaleBodyDetails(body, "Your product was sold", "Black office chair", 2), "Time: 2026-10-20 11:45");
  assert.equal(sellerSaleBodyDetails("Your product was sold.\n\nProduct: Black office chair\nTime: 11:45", "Your product was sold", "Black office chair", null), "Time: 11:45");
  assert.equal(sellerSaleBodyDetails("Your product was sold.\nTime: 11:45", "Your product was sold", null, null), "Time: 11:45");
  assert.equal(sellerSaleBodyDetails("Time: 11:45\nPrice: 500 TRY", "Different title", null, null), "Time: 11:45\nPrice: 500 TRY");
});

test("only real sale fields complete the structured summary and negotiated prices are localized", () => {
  assert.equal(hasStructuredSaleDetails({ afterbuy_qty_sold: 2, afterbuy_marketplace: "OTTO", afterbuy_stock_synced: false }), true);
  assert.equal(hasStructuredSaleDetails({ afterbuy_qty_sold: null, afterbuy_marketplace: null, afterbuy_stock_synced: false }), false);
  assert.equal(formatNotificationPrice("3000.00", "EUR", "en"), "3,000.00 EUR");
  assert.equal(formatNotificationPrice("unknown", "TRY", "en"), "unknown TRY");
});

test("product validation errors map to friendly field names without exposing API paths", () => {
  const details = sellerProductErrorDetails({
    variants: [{ materials: ["Choose one or two materials."], width_cm: ["Enter a valid number."] }],
    otto_attributes: { 415: ["Invalid value."] },
    unknown_field: ["Invalid value."],
  });
  const language = readSellerLocale(values.get("benim_seller_locale"));
  assert.equal(details.fields.materials, translateSeller("Choose one or two materials.", language));
  assert.equal(details.fields.width_cm, translateSeller("Enter a valid number.", language));
  assert.equal(details.fields.otto_attributes, translateSeller("Enter a valid value for this field.", language));
  assert.equal(details.message, translateSeller("Enter a valid value for this field.", language));
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

test("availability answer state distinguishes Yes, No and unknown history", () => {
  const reminder = { notification_type: "product_availability_reminder", product_id: 12 };
  assert.equal(availabilityAnswerDisplayState(reminder, "answered", true), "available");
  assert.equal(availabilityAnswerDisplayState(reminder, "answered", false), "unavailable");
  assert.equal(availabilityAnswerDisplayState(reminder, "answered"), "unknown");
  assert.equal(availabilityAnswerDisplayState(reminder, "pending", true), "pending");
  assert.equal(availabilityAnswerDisplayState({ ...reminder, notification_type: "product_confirmation" }, "none"), "none");
});

test("only successful availability answers persist by seller and notification ID", async (t) => {
  const sellerId = 9201;
  const notificationId = 9301;
  clearSellerSession();
  saveSellerProfileId(sellerId);
  t.after(() => clearSellerSession());
  const reminder = { id: notificationId, notification_type: "product_availability_reminder", product_id: 92, responded_at: null };
  const guard = new SellerAvailabilityGuard();
  await answerAvailabilityOnce({
    guard,
    productId: 92,
    send: async () => {},
    markRead: async () => {},
    onAnswered: () => rememberAvailabilityAnswer(sellerId, notificationId, false),
    onReadError: () => {},
  });

  const refreshedAnswers = readAvailabilityAnswers(sellerId);
  assert.equal(refreshedAnswers[notificationId], false);
  assert.equal(availabilityResponseState(reminder, refreshedAnswers[notificationId] !== undefined), "answered");
  assert.equal(availabilityAnswerDisplayState(reminder, "answered", refreshedAnswers[notificationId]), "unavailable");
  // A changed current product value is not input to the saved historical answer.
  assert.equal(availabilityAnswerDisplayState(reminder, "answered", readAvailabilityAnswers(sellerId)[notificationId]), "unavailable");

  const failedId = notificationId + 1;
  const failedGuard = new SellerAvailabilityGuard();
  await assert.rejects(answerAvailabilityOnce({
    guard: failedGuard,
    productId: 93,
    send: async () => { throw Object.assign(new Error("Rejected"), { status: 422 }); },
    markRead: async () => {},
    onAnswered: () => rememberAvailabilityAnswer(sellerId, failedId, true),
    onReadError: () => {},
  }), /Rejected/);
  assert.equal(readAvailabilityAnswers(sellerId)[failedId], undefined);
});

test("availability history is isolated by seller and cleared on account change or logout", (t) => {
  clearSellerSession();
  t.after(() => clearSellerSession());
  saveSellerProfileId(9401);
  rememberAvailabilityAnswer(9401, 9501, true);
  saveSellerProfileId(9402);
  assert.equal(readAvailabilityAnswers(9401)[9501], undefined);
  assert.equal(sellerProfileId(), 9402);
  rememberAvailabilityAnswer(9402, 9501, false);
  assert.equal(readAvailabilityAnswers(9402)[9501], false);
  clearSellerSession();
  assert.equal(sellerProfileId(), null);
  assert.equal(readAvailabilityAnswers(9402)[9501], undefined);
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
