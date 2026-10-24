import assert from "node:assert/strict";
import test from "node:test";
import { formatSellerCount, formatSellerMoney, sellerSalesStatsUrl } from "../src/lib/seller-statistics.ts";

test("formats the existing sales counts with the selected locale", () => {
  assert.equal(formatSellerCount(12345, "ru-RU"), "12\u00a0345");
  assert.equal(formatSellerCount(1, "en-GB"), "1");
});

test("formats revenue with the selected locale and two decimal places", () => {
  assert.equal(formatSellerMoney("3000.00", "EUR", "ru-RU"), "3\u00a0000,00 EUR");
  assert.equal(formatSellerMoney("167250.00", "TRY", "tr-TR"), "167.250,00 TRY");
  assert.equal(formatSellerMoney("3371.40", "USD", "de-DE"), "3.371,40 USD");
  assert.equal(formatSellerMoney("3000.00", "EUR", "en-GB"), "3,000.00 EUR");
  assert.equal(formatSellerMoney("0.29", "EUR", "ru-RU"), "0,29 EUR");
  assert.equal(formatSellerMoney("1.005", "EUR", "en-GB"), "1.01 EUR");
  assert.equal(formatSellerMoney("90071992547409.99", "EUR", "en-GB"), "90,071,992,547,409.99 EUR");
});

test("preserves zero and null revenue values", () => {
  assert.equal(formatSellerMoney("0.00", "TRY", "ru-RU"), "0,00 TRY");
  assert.equal(formatSellerMoney(null, "TRY", "ru-RU"), "—");
  assert.equal(formatSellerMoney("invalid", "TRY", "ru-RU"), "—");
});

test("keeps the date range and selected product in the existing API query", () => {
  assert.equal(
    sellerSalesStatsUrl({ from: "2026-09-24", to: "2026-10-23" }, "20"),
    "/api/v1/products/sales-stats/?from=2026-09-24&to=2026-10-23&product_id=20",
  );
  assert.equal(sellerSalesStatsUrl({ from: "2026-09-24", to: "2026-10-23" }, ""), "/api/v1/products/sales-stats/?from=2026-09-24&to=2026-10-23");
  assert.equal(sellerSalesStatsUrl({ from: "", to: "" }, "20"), "/api/v1/products/sales-stats/?product_id=20");
  assert.equal(sellerSalesStatsUrl({ from: "", to: "" }, ""), "/api/v1/products/sales-stats/");
});
