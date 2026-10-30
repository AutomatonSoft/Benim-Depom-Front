import assert from "node:assert/strict";
import test from "node:test";
import { ebayCheckedListingStatus } from "../src/lib/ebay.ts";

const checkedJob = (remoteStatus, listingStatus = null) => ({
  status: "succeeded",
  reconciliation_action: "check",
  results: [{ marketplace: "ebay", ok: true, details: { remote_status: remoteStatus, listing_status: listingStatus } }],
});

test("a successful eBay check displays the confirmed listing state", () => {
  assert.equal(ebayCheckedListingStatus(checkedJob("UNPUBLISHED")), "deactivated");
  assert.equal(ebayCheckedListingStatus(checkedJob("PUBLISHED", "ACTIVE")), "active");
  assert.equal(ebayCheckedListingStatus(checkedJob("PUBLISHED")), "active");
});

test("failed, unfinished and inconclusive checks do not claim a listing state", () => {
  const job = checkedJob("UNPUBLISHED");
  for (const status of ["queued", "running", "failed"]) {
    assert.equal(ebayCheckedListingStatus({ ...job, status }), null);
  }
  assert.equal(ebayCheckedListingStatus(checkedJob("UNKNOWN")), null);
  assert.equal(ebayCheckedListingStatus(checkedJob("PUBLISHED", "ENDED")), null);
  assert.equal(ebayCheckedListingStatus({ ...job, results: [{ ...job.results[0], ok: false }] }), null);
  assert.equal(ebayCheckedListingStatus({ ...job, results: [] }), null);
});

test("other operations and marketplaces keep the normal job status", () => {
  const job = checkedJob("UNPUBLISHED");
  assert.equal(ebayCheckedListingStatus({ ...job, reconciliation_action: "set_manual" }), null);
  assert.equal(ebayCheckedListingStatus({ ...job, results: [{ ...job.results[0], marketplace: "otto" }] }), null);
  assert.equal(ebayCheckedListingStatus({ ...job, results: [job.results[0], job.results[0]] }), null);
});
