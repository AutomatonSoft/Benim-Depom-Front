// Run with: node --experimental-strip-types --test tests/ebay.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { ebayBaseTitle, ebayDisplayTitle, ebayDraftPayload, ebayListingUrl, newEbayDraft } from "../src/lib/ebay.ts";

test("manager payload sends only editable fields; backend owns card facts and Depotum settings", () => {
  const draft = { ...newEbayDraft(), id: 9, environment: "production", account: "jv", title: "Sofa BD",
    quantity: 999, price_eur: "1.00", image_urls: ["https://images.test/original.jpg"],
    fulfillment_policy_id: "wrong-account-policy", regulatory: { manufacturer: { companyName: "Wrong company" } },
    missing_requirements: {}, aspects: { Breite: [" 40 cm "], Farbe: ["", " "] },
  };
  assert.deepEqual(ebayDraftPayload(draft), {
    sync_product: true, title: "Sofa", description: "", category_id: "", aspects: { Breite: ["40 cm"] },
  });
});

test("the field displays BD once while the payload accepts 75 characters before the suffix", () => {
  assert.equal(ebayBaseTitle("Sofa BD"), "Sofa");
  assert.equal(ebayBaseTitle("Sofa (BD)"), "Sofa");
  assert.equal(ebayBaseTitle("Sofa"), "Sofa");
  assert.equal(ebayDisplayTitle("Sofa"), "Sofa BD");
  assert.equal(ebayDisplayTitle("Sofa (BD)"), "Sofa BD");
  assert.equal(ebayDisplayTitle("Sofa BD"), "Sofa BD");
  assert.equal(ebayDisplayTitle(""), "");
  const draft = { ...newEbayDraft(), title: "A".repeat(75) + " BD" };
  assert.equal(ebayDraftPayload(draft).title.length, 75);
});

test("new drafts do not guess category, aspects or pick seller source photos", () => {
  const draft = newEbayDraft();
  assert.equal(draft.category_id, "");
  assert.deepEqual(draft.aspects, {});
  assert.deepEqual(draft.image_urls, []);
});

test("listing links distinguish sandbox from production and reject unexpected values", () => {
  assert.equal(ebayListingUrl("sandbox", "123"), "https://www.sandbox.ebay.de/itm/123");
  assert.equal(ebayListingUrl("production", "123"), "https://www.ebay.de/itm/123");
  assert.equal(ebayListingUrl("unknown", "123"), null);
  assert.equal(ebayListingUrl("production", "javascript:alert(1)"), null);
});
