const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planReturn } = require('../src/utils/purchaseReturn');
const line = (qty, returnedQty = 0, price = 100) => ({ id: 'line', billId: 'bill', qty, returnedQty, returnedAmount: Math.round(returnedQty * price), unitPrice: price, bill: { status: 'OPEN' } });
test('unbilled goods are returned first without changing existing bills', () => {
  assert.deepEqual(planReturn({ qty: 10, returnedQty: 0, supplierBillItems: [line(6)] }, 4), []);
  assert.deepEqual(planReturn({ qty: 10, returnedQty: 0, supplierBillItems: [line(6)] }, 7), [{ lineId: 'line', billId: 'bill', qty: 3, amount: 300 }]);
});
test('previous partial returns are not allocated or billed twice', () => {
  assert.deepEqual(planReturn({ qty: 10, returnedQty: 7, supplierBillItems: [line(6, 3)] }, 3), [{ lineId: 'line', billId: 'bill', qty: 3, amount: 300 }]);
  for (const qty of [0, -1, 4, Infinity, NaN]) assert.throws(() => planReturn({ qty: 10, returnedQty: 7, supplierBillItems: [] }, qty));
});
test('successive fractional returns reverse the original rounded invoice exactly', () => {
  const first = planReturn({ qty: 3, supplierBillItems: [line(3, 0, 10.5)] }, 1)[0];
  const second = planReturn({ qty: 3, returnedQty: 1, supplierBillItems: [{ ...line(3, 1, 10.5), returnedAmount: first.amount }] }, 2)[0];
  assert.equal(first.amount + second.amount, Math.round(3 * 10.5));
});
