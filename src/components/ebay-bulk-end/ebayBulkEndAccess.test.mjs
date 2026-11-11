import assert from "node:assert/strict";
import test from "node:test";

import { managerAccessStateForStatus } from "./ebayBulkEndAccess.ts";

test("maps unauthenticated and non-manager responses to protected states", () => {
  assert.equal(managerAccessStateForStatus(401), "guest");
  assert.equal(managerAccessStateForStatus(403), "denied");
});

test("fails closed for server errors and only accepts successful responses", () => {
  assert.equal(managerAccessStateForStatus(200), "manager");
  assert.equal(managerAccessStateForStatus(503), "error");
});
