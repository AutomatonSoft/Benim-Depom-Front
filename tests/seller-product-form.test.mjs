import assert from "node:assert/strict";
import test from "node:test";
import { sellerProductReviewFields } from "../src/lib/seller-product-form.ts";
import { makeSellerPhotoPrimary, reorderSellerPhoto } from "../src/lib/seller-product-photos.ts";

test("rejected photo edits save without review fields until the photos are ready", () => {
  assert.deepEqual(sellerProductReviewFields("rejected", " Fixed photos ", false), {});
  assert.deepEqual(sellerProductReviewFields("rejected", " Fixed photos ", true), {
    resubmit_for_moderation: true, change_comment: "Fixed photos",
  });
  assert.deepEqual(sellerProductReviewFields("rejected", "", true), {
    resubmit_for_moderation: true, change_comment: "",
  });
});

test("draft and withdrawn products resubmit automatically without an unsupported comment", () => {
  for (const status of ["draft", "withdrawn"]) {
    assert.deepEqual(sellerProductReviewFields(status, "comment", false), {});
    assert.deepEqual(sellerProductReviewFields(status, "comment", true), { resubmit_for_moderation: true });
  }
});

test("approved edits keep their comment without a resubmission flag", () => {
  for (const ready of [true, false]) {
    assert.deepEqual(sellerProductReviewFields("approved", " Comment ", ready), { change_comment: "Comment" });
  }
  assert.deepEqual(sellerProductReviewFields("submitted", "comment", true), {});
});

test("approved photo edits do not send an empty comment before image requests", () => {
  for (const comment of ["", "  "]) {
    assert.deepEqual(sellerProductReviewFields("approved", comment, false), {});
    assert.deepEqual(sellerProductReviewFields("approved", comment, true), {});
  }
});

test("the star swaps a saved or new photo with the first photo without mutating the list", () => {
  const saved = { key: "saved", kind: "saved", image: { id: 20 } };
  const another = { key: "another", kind: "saved", image: { id: 21 } };
  const upload = { key: "upload", kind: "new", file: {}, preview: "blob:preview" };
  const photos = [saved, another, upload];
  assert.deepEqual(makeSellerPhotoPrimary(photos, 2), [upload, another, saved]);
  assert.deepEqual(makeSellerPhotoPrimary(photos, 1), [another, saved, upload]);
  assert.deepEqual(photos, [saved, another, upload]);
});

test("dragging moves photos across saved and new items while preserving their identities", () => {
  const photos = [{ key: "saved-1" }, { key: "new-1" }, { key: "saved-2" }, { key: "new-2" }];
  const moved = reorderSellerPhoto(photos, 3, 0);
  assert.deepEqual(moved, [photos[3], photos[0], photos[1], photos[2]]);
  assert.deepEqual(reorderSellerPhoto(moved, 0, 3), photos);
  assert.equal(new Set(moved).size, photos.length);
});

test("photo operations ignore invalid positions without losing images", () => {
  const photos = ["first", "second"];
  for (const index of [-1, 2]) {
    assert.deepEqual(makeSellerPhotoPrimary(photos, index), photos);
    assert.deepEqual(reorderSellerPhoto(photos, index, 0), photos);
    assert.deepEqual(reorderSellerPhoto(photos, 0, index), photos);
  }
});
