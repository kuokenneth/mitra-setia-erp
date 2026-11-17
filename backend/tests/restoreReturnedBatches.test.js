const { test } = require('node:test');
const assert = require('node:assert/strict');
const { restoreReturnedBatches } = require('../src/utils/restoreReturnedBatches');
function mock(rows) {
  const restored = [], created = [];
  const tx = { stockMovementBatchAllocation: { findMany: async () => rows }, inventoryBatch: { updateMany: async args => { restored.push(args); return { count: 1 }; }, create: async ({ data }) => { created.push(data); return { id: 'legacy' }; } } };
  return { tx, restored, created };
}
const movement = { id: 'out', itemId: 'item', fromLocationId: 'warehouse', unitPrice: 447000 };
const allocation = (id, qty) => ({ batchId: id, qty, batch: { itemId: 'item', locationId: 'warehouse', receivedQty: qty } });
test('service stock return restores the original receipt batch, without making a new batch', async () => {
  const f = mock([allocation('receipt', 1)]);
  assert.deepEqual(await restoreReturnedBatches(f.tx, movement, 1), [{ batchId: 'receipt', qty: 1 }]);
  assert.equal(f.created.length, 0); assert.equal(f.restored[0].data.remainingQty.increment, 1);
});
test('repeated partial returns skip quantities already restored', async () => {
  const f = mock([allocation('a', 3), allocation('b', 4)]);
  assert.deepEqual(await restoreReturnedBatches(f.tx, movement, 3, 2), [{ batchId: 'a', qty: 1 }, { batchId: 'b', qty: 2 }]);
  assert.equal(f.created.length, 0);
});
test('legacy usage without FIFO links still returns its quantity to inventory', async () => {
  const f = mock([]);
  assert.deepEqual(await restoreReturnedBatches(f.tx, movement, 2), [{ batchId: 'legacy', qty: 2 }]);
  assert.equal(f.created[0].remainingQty, 2);
});
