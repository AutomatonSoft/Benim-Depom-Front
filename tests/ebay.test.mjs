// Run with: node --experimental-strip-types --test tests/ebay.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { ebayAspectDefaults, ebayDraftPayload, ebayListingUrl, newEbayDraft } from "../src/lib/ebay.ts";

const product = {
  title: "Table", variants: [{ width_cm: "40.00", length_cm: "40", height_cm: "47", quantity: 2, color: "Beige" }],
  images: [{ id: 1, image: "https://images.test/original.jpg", is_primary: true, generated_images: [
    { mode: "human", image: "https://images.test/human.jpg" }, { mode: "white", image: "https://images.test/white.jpg" },
  ] }],
};
const policy = (id) => ({ id, name: id, applicable_to_furniture: true });
const account = (environment, id) => ({ environment, policies: {
  fulfillment: [policy(id)], payment: [policy(`${id}-pay`)], return: [policy(`${id}-return`)],
}, inventory_locations: [{ merchant_location_key: `${id}-warehouse`, usable: true }] });

test("new drafts use the current account policies in both environments and never guess among several", () => {
  for (const env of ["sandbox", "production"]) {
    const settings = account(env, env);
    const draft = newEbayDraft(product, settings);
    assert.equal(draft.fulfillment_policy_id, env);
    assert.equal(draft.merchant_location_key, `${env}-warehouse`);
    assert.equal(draft.quantity, 2);
    assert.deepEqual(draft.image_urls, ["https://images.test/white.jpg", "https://images.test/human.jpg"]);
    assert.deepEqual(draft.regulatory, {});
    settings.policies.fulfillment.push(policy("other"));
    assert.equal(newEbayDraft(product, settings).fulfillment_policy_id, "");
  }
});

test("saving strips server metadata and blank aspects without losing regulatory contacts", () => {
  const draft = { ...newEbayDraft(product, account("sandbox", "test")), id: 9, environment: "production", account: "jv",
    missing_requirements: {}, aspects: { Breite: [" 40 cm "], Farbe: ["", " "] },
    regulatory: { manufacturer: { companyName: "Confirmed manufacturer" } },
  };
  const payload = ebayDraftPayload(draft);
  assert.equal("id" in payload, false);
  assert.equal("environment" in payload, false);
  assert.equal("account" in payload, false);
  assert.equal("missing_requirements" in payload, false);
  assert.deepEqual(payload.aspects, { Breite: ["40 cm"] });
  assert.deepEqual(payload.regulatory, draft.regulatory);
});

test("aspect defaults use product dimensions and skip values forbidden by the category", () => {
  const schema = { aspects: [
    { localizedAspectName: "Breite", aspectConstraint: {} },
    { localizedAspectName: "Farbe", aspectConstraint: { aspectMode: "SELECTION_ONLY" }, aspectValues: [{ localizedValue: "Schwarz" }] },
  ] };
  assert.deepEqual(ebayAspectDefaults(schema, product), { Breite: ["40 cm"] });
  assert.deepEqual(ebayAspectDefaults(schema, product, { color: "Schwarz" }), { Breite: ["40 cm"], Farbe: ["Schwarz"] });
});

test("listing links distinguish sandbox from production and reject unexpected values", () => {
  assert.equal(ebayListingUrl("sandbox", "123"), "https://www.sandbox.ebay.de/itm/123");
  assert.equal(ebayListingUrl("production", "123"), "https://www.ebay.de/itm/123");
  assert.equal(ebayListingUrl("unknown", "123"), null);
  assert.equal(ebayListingUrl("production", "javascript:alert(1)"), null);
});
