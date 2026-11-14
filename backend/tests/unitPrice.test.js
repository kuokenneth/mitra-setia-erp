const { test } = require("node:test");
const assert = require("node:assert/strict");
const { roundUnitPrice } = require("../src/utils/unitPrice");
test("unit prices retain cents and totals round after multiplication", () => {
  assert.equal(roundUnitPrice("147552.60"), 147552.6);
  assert.equal(roundUnitPrice(147552.605), 147552.61);
  assert.equal(Math.round(60 * roundUnitPrice("147552.60")), 8853156);
  assert.equal(roundUnitPrice(201000), 201000);
  assert.ok(Number.isNaN(roundUnitPrice("invalid")));
});

test("printed prices show two decimal places without rounding to whole rupiah", () => {
  const { money } = require("../src/utils/printDocument");
  assert.match(money(147552.6), /147\.552,60/);
  assert.match(money(201000), /201\.000$/);
});
