// Run with: node --test tests/pricing-margin.test.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");

const compiled = ts.transpileModule(
  readFileSync(`${__dirname}/../src/lib/pricing-margin.ts`, "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const compiledModule = { exports: {} };
new Function("exports", compiled)(compiledModule.exports);
const { calculateMarginEur } = compiledModule.exports;

const box = { width_cm: "100", height_cm: "100", length_cm: "100" };
const product = { unit_price: "100", currency: "EUR", warehouse_city: "IST", variants: [box] };
const formula = {
  margin: "0.75", eur_to_try: "50", eur_to_usd: "1.25",
  city_tariffs_eur_per_cbm: { IST: "84" },
  de_size_tiers: [{ min_cbm: "0", max_cbm: "2.5", price_eur: "170" }],
};

test("margin includes logistics and uses the largest variant plus all set pieces", () => {
  assert.equal(calculateMarginEur(product, formula), 265.5);
  assert.equal(calculateMarginEur({ ...product, variants: [box, box], set_parts: [box] }, formula), 328.5);
  assert.equal(calculateMarginEur(product, { ...formula, margin: "0" }), 0);
});

test("currency conversion rounds purchase to cents before calculating margin", () => {
  assert.equal(calculateMarginEur({ ...product, currency: "TRY", unit_price: "5000" }, formula), 265.5);
  assert.equal(calculateMarginEur({ ...product, currency: "USD", unit_price: "125" }, formula), 265.5);
});

test("missing or invalid data cannot produce a misleading amount", () => {
  assert.equal(calculateMarginEur({ ...product, variants: [] }, formula), null);
  assert.equal(calculateMarginEur(product, { ...formula, margin: "" }), null);
  assert.equal(calculateMarginEur(product, { ...formula, de_size_tiers: [] }), null);
  assert.equal(calculateMarginEur({ ...product, currency: "TRY" }, { ...formula, eur_to_try: "0" }), null);
});
