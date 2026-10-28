import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import Module from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import * as availability from "../src/lib/seller-availability.ts";
import * as content from "../src/lib/seller-notification-content.ts";
import * as style from "../src/lib/seller-notification-style.ts";
import * as dates from "../src/lib/seller-notification-date.ts";

const filename = resolve("src/app/seller/notifications/page.tsx");
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten);
  return node && typeof node === "object" && "type" in node ? [node, ...flatten(node.props.children)] : [];
}

test("outgoing replies group recipient copies across languages and preserve separate answers", () => {
  const base = { id: 1, sender_id: 7, product_id: 20, notification_type: "product_confirmation", title: "Product is available", body: "", created_at: "2026-10-24T08:38:00.900Z" };
  const copies = [base, { ...base, id: 2, title: "Товар в наличии", created_at: "2026-10-24T08:38:00.700Z" }, { ...base, id: 3, title: "Produkt ist verfügbar", created_at: "2026-10-24T08:38:00.500Z" }];
  assert.deepEqual(content.sellerOutgoingNotifications(copies, "ru").map(item => item.id), [2]);
  assert.deepEqual(content.sellerOutgoingNotifications(copies, "en").map(item => item.id), [1]);
  const later = { ...base, id: 4, created_at: "2026-10-24T09:38:00Z" };
  const opposite = { ...base, id: 5, title: "Товара нет в наличии" };
  const unknown = { ...base, id: 6, title: "Custom message" };
  assert.equal(content.sellerOutgoingNotifications([...copies, later, opposite, unknown], "ru").length, 4);
  assert.equal(content.sellerAvailabilityConfirmation(opposite), "unavailable");
  assert.equal(content.sellerAvailabilityConfirmation(unknown), null);
  assert.equal(content.sellerAvailabilityConfirmation({ ...base, notification_type: "product_availability_reminder" }), null);
  const price = { ...base, notification_type: "price_negotiation_response", price_negotiation_id: 12, price_negotiation_status: "accepted", seller_comment: "OK" };
  assert.equal(content.sellerOutgoingNotifications([price, { ...price, id: 7, created_at: later.created_at }, { ...price, id: 8, price_negotiation_id: 13 }], "ru").length, 2);
  assert.equal(content.sellerOutgoingNotifications([{ ...price, price_negotiation_id: null }, { ...price, id: 9, price_negotiation_id: null }], "ru").length, 1);
  const legacyPrice = { ...price, price_negotiation_id: null, title: "Price accepted", proposed_unit_price: "100", proposed_currency: "EUR" };
  assert.equal(content.sellerOutgoingNotifications([legacyPrice, { ...legacyPrice, id: 80, title: "Цена принята" }], "ru").length, 1);
  assert.equal(content.sellerOutgoingNotifications([legacyPrice, { ...legacyPrice, id: 81, proposed_unit_price: "200" }, { ...legacyPrice, id: 82, price_negotiation_status: "rejected" }], "ru").length, 3);
  assert.equal(content.sellerOutgoingNotifications([...copies, ...copies], "ru").length, 1);
  const eventTitles = {
    product_submitted_for_review: ["New product awaiting review", "Новый товар на модерации", "Neues Produkt wartet auf Prüfung", "İnceleme bekleyen yeni ürün"],
    product_change_requested: ["Seller wants to change a product", "Продавец хочет изменить товар", "Verkäufer möchte ein Produkt ändern", "Satıcı ürünü değiştirmek istiyor"],
    product_withdrawn_from_review: ["Seller withdrew a product from review", "Продавец отозвал товар с модерации", "Verkäufer hat Produktprüfung zurückgezogen", "Satıcı ürünü incelemeden çekti"],
    product_deactivation_requested: ["Deactivation requested", "Запрос на деактивацию", "Deaktivierung angefordert", "Devre dışı bırakma talebi"],
  };
  for (const [notification_type, titles] of Object.entries(eventTitles)) {
    const recipients = titles.map((title, index) => ({ ...base, id: index + 10, notification_type, title, body: `Localized message ${index}` }));
    assert.deepEqual(content.sellerOutgoingNotifications(recipients, "ru").map(item => item.id), [11], notification_type);
    assert.equal(content.sellerOutgoingNotifications([...recipients.slice(0, 2), ...recipients.slice(2)], "ru").length, 1, "copies across page boundaries are grouped");
    assert.equal(content.sellerOutgoingNotifications([...recipients, { ...recipients[0], id: 50, created_at: later.created_at }], "ru").length, 2, "later events stay in history");
    assert.equal(content.sellerOutgoingNotifications([...recipients, { ...recipients[0], id: 51, seller_comment: "Different comment" }], "ru").length, 2);
    assert.equal(content.sellerOutgoingNotifications([...recipients, { ...recipients[0], id: 52, product_id: 21 }], "ru").length, 2);
  }
  const custom = { ...base, notification_type: "message_received", title: "Message", body: "First" };
  assert.equal(content.sellerOutgoingNotifications([custom, { ...custom, id: 60 }, { ...custom, id: 61, body: "Second" }], "ru").length, 2);
  const sale = { ...base, notification_type: "product_sold", title: "Product sold in Afterbuy", body: "Time: 2026-10-24 08:38", afterbuy_qty_sold: 2, afterbuy_marketplace: "OTTO" };
  assert.equal(content.sellerOutgoingNotifications([sale, { ...sale, id: 70, title: "Товар купили в Afterbuy", body: "Время: 2026-10-24 08:38" }], "ru").length, 1);
  assert.equal(content.sellerOutgoingNotifications([sale, { ...sale, id: 71, afterbuy_qty_sold: 3 }], "ru").length, 2);
  assert.deepEqual(content.sellerUniqueNotifications([base, later, { ...base, is_read: true }]), [{ ...base, is_read: true }, later]);
});

test("sale detail rows rename unit price without changing amounts, dates or extra text", () => {
  assert.deepEqual(content.sellerSaleDetailRows("Время: 17.09.2026 09:21\nЦена на карточке: 500.00 TRY\nКупили: 2 шт.\nСклад было: 214 шт.\nОсталось: 212 шт.\nКомментарий без двоеточия"), [
    { label: "Время", value: "17.09.2026 09:21" },
    { label: "Unit price", value: "500.00 TRY" },
    { label: "Купили", value: "2 шт." },
    { label: "Склад было", value: "214 шт." },
    { label: "Осталось", value: "212 шт." },
    { label: "", value: "Комментарий без двоеточия" },
  ]);
  assert.deepEqual(content.sellerSaleDetailRows(""), []);
  assert.equal(content.sellerSaleDetailRows("Card price: 30.00 EUR")[0].label, "Unit price");
});

test("availability cards update immediately and storage sync cannot unlock duplicate submits", async () => {
  const previousWindow = globalThis.window;
  const listeners = new Map();
  globalThis.window = {
    setTimeout: () => 0, clearTimeout() {}, dispatchEvent() {},
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener() {},
  };
  try {
    for (const answer of [true, false]) {
      const states = [], refs = [], effects = [];
      let cursor = 0;
      let finishPost;
      let posts = 0;
      const saved = {};
      const reminders = [1, 2].map(id => ({
        id, notification_type: "product_availability_reminder", product_id: 20,
        product_title: "Chair", is_read: true, created_at: "2026-10-23T10:00:00Z",
        responded_at: null, title: "Availability", body: "Is it available?",
      }));
      reminders.push({ ...reminders[0], id: 90, responded_at: "2026-10-22T10:00:00Z" });
      const react = {
        useState(initial) {
          const index = cursor++;
          if (!(index in states)) states[index] = index === 0 ? reminders : initial === true ? false : typeof initial === "function" ? initial() : initial;
          return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
        },
        useRef(initial) { const index = cursor++; return refs[index] ??= { current: initial }; },
        useMemo: fn => fn(), useCallback: fn => fn,
        useEffect: fn => effects.push(fn),
      };
      const mocks = {
        react,
        "next/link": { default: "Link" },
        "lucide-react": new Proxy({}, { get: (_, name) => String(name) }),
        "@/components/SellerShell": { SellerPage: "SellerPage", SellerNotice: "SellerNotice" },
        "@/components/seller/SellerSelect": { SellerSelect: "SellerSelect" },
        "@/components/seller/SellerI18n": { useSellerI18n: () => ({ t: value => value, locale: "en" }) },
        "@/lib/seller-availability": availability,
        "@/lib/seller-notification-content": content,
        "@/lib/seller-notification-style": style,
        "@/lib/seller-notification-date": dates,
        "@/lib/seller": {
          sellerProfileId: () => 7, readAvailabilityAnswers: () => saved,
          rememberAvailabilityAnswer: (_, id, value) => { saved[id] = value; },
          SELLER_PROFILE_CHANGED_EVENT: "seller-profile-updated",
          sellerRequest: (path, init) => {
            assert.equal(path, "/api/v2/products/20/availability/");
            assert.deepEqual(JSON.parse(init.body), { is_available: answer });
            posts++;
            return new Promise(resolve => { finishPost = resolve; });
          },
        },
      };
      const loaded = new Module(filename);
      loaded.filename = filename;
      loaded.paths = Module._nodeModulePaths(dirname(filename));
      const nativeRequire = createRequire(filename);
      loaded.require = name => mocks[name] || nativeRequire(name);
      loaded._compile(compiled, filename);
      const render = () => { cursor = 0; return flatten(loaded.exports.default()); };
      const buttons = nodes => nodes.filter(node => node.type === "button" && ["Available", "Unavailable"].includes(node.props.children?.[1]));
      let nodes = render();
      assert.equal(buttons(nodes).length, 4);
      assert.equal(nodes.filter(node => node.type === "CircleQuestionMark").length, 2);
      effects[0]();
      const chosen = buttons(nodes).find(node => node.props.children[1] === (answer ? "Available" : "Unavailable"));
      chosen.props.onClick();
      listeners.get("storage")({ key: "benim_seller_availability_answers:7" });
      nodes = render();
      assert.ok(buttons(nodes).every(button => button.props.disabled));
      buttons(nodes)[0].props.onClick();
      chosen.props.onClick();
      assert.equal(posts, 1);
      finishPost({});
      await new Promise(resolve => setImmediate(resolve));
      nodes = render();
      assert.equal(buttons(nodes).length, 0);
      assert.deepEqual(saved, { 1: answer, 2: answer });
      assert.equal(nodes.filter(node => node.props.className?.includes("seller-availability-answer")).length, 0);
      assert.equal(nodes.filter(node => node.type === "article" && /availability-(yes|no)|\banswered\b/.test(node.props.className)).length, 0);
      chosen.props.onClick();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(posts, 1);
      states[0] = [{ ...reminders[0], id: 3, created_at: "2026-10-24T10:00:00Z" }, ...states[0]];
      nodes = render();
      assert.equal(buttons(nodes).length, 2, "a new reminder for the same product needs its own answer");
      assert.equal(nodes.filter(node => node.type === "CircleQuestionMark").length, 1);
      buttons(nodes).find(node => node.props.children[1] === (answer ? "Available" : "Unavailable")).props.onClick();
      assert.equal(posts, 2, "the earlier answer must not block a new reminder");
      finishPost({});
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(buttons(render()).length, 0);
      assert.deepEqual(saved, { 1: answer, 2: answer, 3: answer });
      states[3] = "outgoing";
      const confirmation = { ...reminders[0], id: 100, sender_id: 7, notification_type: "product_confirmation", title: answer ? "Product is available" : "Product is not available", is_read: false };
      const priceReply = { ...reminders[0], id: 102, sender_id: 7, notification_type: "price_negotiation_response", price_negotiation_id: 11, price_negotiation_status: answer ? "accepted" : "rejected", proposed_unit_price: "3000", proposed_currency: "EUR", seller_comment: "My comment" };
      states[0] = [confirmation, { ...confirmation, id: 101 }, priceReply, { ...priceReply, id: 103 }];
      nodes = render();
      assert.equal(nodes.filter(node => node.type === "article").length, 2);
      assert.equal(nodes.filter(node => node.type === "h2" && node.props.children === "Availability response").length, 1);
      assert.equal(nodes.filter(node => node.type === "h2" && node.props.children === "Price response").length, 1);
      assert.equal(nodes.filter(node => node.type === "span" && node.props.children === "Sent").length, 2);
      assert.equal(nodes.filter(node => node.type === "article" && node.props.className.includes(answer ? "positive" : "negative")).length, 2);
      assert.equal(buttons(nodes).length, 0);
    }
  } finally {
    globalThis.window = previousWindow;
  }
});
