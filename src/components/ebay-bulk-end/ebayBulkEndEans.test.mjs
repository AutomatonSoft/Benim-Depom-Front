import assert from "node:assert/strict";
import test from "node:test";

import { eanIsValid, parseEanTokens, parseEans } from "./ebayBulkEndEans.ts";

test("validates EAN-8 and EAN-13 without dropping leading zeroes", () => {
  assert.equal(eanIsValid("01234565"), true);
  assert.equal(eanIsValid("4006381333931"), true);
  assert.equal(eanIsValid("0123456"), false);
});

test("rejects invalid checksums, non-ASCII digits, and punctuation", () => {
  assert.equal(eanIsValid("4006381333932"), false);
  assert.equal(eanIsValid("４００６３８１３３３９３１"), false);
  assert.equal(eanIsValid("4006381333931x"), false);
});

test("splits supported separators and trims surrounding whitespace", () => {
  assert.deepEqual(parseEanTokens(" 01234565\n4006381333931, 9780201379624; "), [
    "01234565",
    "4006381333931",
    "9780201379624",
  ]);
});

test("deduplicates exact EAN strings while preserving first-seen order", () => {
  assert.deepEqual(parseEans("01234565,4006381333931\n01234565"), [
    "01234565",
    "4006381333931",
  ]);
});
