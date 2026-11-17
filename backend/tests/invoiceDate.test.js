const { test } = require('node:test');
const assert = require('node:assert/strict');
const { invoiceDate, receiptDate } = require('../src/utils/invoiceDate');
test('invoice date is midnight WIB and remains in the selected reporting period', () => {
  assert.equal(invoiceDate('2026-11-01').toISOString(), '2026-10-31T17:00:00.000Z');
  assert.equal(invoiceDate('2024-02-29').toISOString(), '2024-02-28T17:00:00.000Z');
  for (const value of ['', null, '2026-02-29', '2026-02-30', '2026-13-01', '01/11/2026']) assert.throws(() => invoiceDate(value));
});
test('legacy requests and edits without a date preserve their fallback', () => {
  const original = new Date('2026-10-14T10:30:00Z');
  assert.equal(invoiceDate(undefined, original), original);
});

test('receipt date is separate, optional, and preserved when an edit omits it', () => {
  assert.equal(receiptDate('2026-11-05'), '2026-11-05');
  assert.equal(receiptDate(undefined, '2026-10-01'), '2026-10-01');
  assert.equal(receiptDate(undefined), null);
  assert.equal(receiptDate(''), null);
  assert.throws(() => receiptDate('2026-02-30'));
});
