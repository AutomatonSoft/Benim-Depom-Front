// Run with: node --experimental-strip-types --test tests/product-short-description.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPayload,
  cityOf,
  countryOf,
  draftFromProduct,
  shortDescriptionLines,
  validateDraft,
} from "../src/lib/product-short-description.ts";

const product = {
  unit_price: "3775.00",
  currency: "USD",
  warehouse_city: "IZM",
  cbm: "5.991",
  cbm_calculated: "5.991",
  cbm_override: null,
};

test("lines show seller price, volume, country and Turkish city", () => {
  assert.deepEqual(shortDescriptionLines(product), {
    price: "3775 USD", cbm: "5.991 cbm", country: "TR", city: "IZM", manualCbm: false,
  });
});

test("Italy and Poland map to IT / PL without a city", () => {
  assert.equal(countryOf("ITA"), "IT");
  assert.equal(countryOf("POL"), "PL");
  assert.equal(cityOf("ITA"), "");
  assert.equal(cityOf("INE"), "INE");
});

test("unchanged draft sends nothing", () => {
  assert.deepEqual(buildPayload(product, draftFromProduct(product)), {});
});

test("changed fields map to product fields", () => {
  const draft = { ...draftFromProduct(product), price: "4000", country: "IT", cbm: "6.5" };
  assert.deepEqual(buildPayload(product, draft), {
    unit_price: "4000.00", warehouse_city: "ITA", cbm_override: "6.500",
  });
  assert.deepEqual(buildPayload(product, { ...draftFromProduct(product), city: "IST" }), { warehouse_city: "IST" });
});

test("volume equal to calculated or empty clears the manual override", () => {
  const manual = { ...product, cbm: "7.000", cbm_override: "7.000" };
  assert.deepEqual(buildPayload(manual, { ...draftFromProduct(manual), cbm: "5.991" }), { cbm_override: null });
  assert.deepEqual(buildPayload(manual, { ...draftFromProduct(manual), cbm: "" }), { cbm_override: null });
});

test("validation rejects bad price, volume and missing Turkish city", () => {
  const draft = draftFromProduct(product);
  assert.equal(validateDraft(draft), null);
  assert.equal(validateDraft({ ...draft, price: "0" }), "price");
  assert.equal(validateDraft({ ...draft, cbm: "abc" }), "cbm");
  assert.equal(validateDraft({ ...draft, city: "" }), "city");
  assert.equal(validateDraft({ ...draft, country: "PL", city: "" }), null);
});
