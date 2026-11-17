const { test, after } = require('node:test');
const assert = require('node:assert/strict');
// Only run against an explicitly supplied disposable local database.
const enabled = process.env.PURCHASE_RETURN_TEST_DATABASE_URL;
if (enabled && !['localhost','127.0.0.1'].includes(new URL(enabled).hostname)) throw new Error('Integration tests require a local disposable database');
if (enabled) process.env.DATABASE_URL = enabled;
const { prisma } = require('../src/prisma');
const router = require('../src/routes/purchaseReturns');
const handler = router.stack.find(layer => layer.route?.path === '/returns' && layer.route.methods.post).route.stack[0].handle;
let seq = 0;
async function fixture({ paid = false, serialized = false, pending = false } = {}) {
  const tag = `ret-test-${Date.now()}-${++seq}`;
  const user = await prisma.user.create({ data: { email: `${tag}@example.test`, password: 'test', role: 'OWNER' } });
  const supplier = await prisma.supplier.create({ data: { name: tag } });
  const location = await prisma.inventoryLocation.create({ data: { name: tag } });
  const master = await prisma.item.create({ data: { sku: tag, name: tag, isSerialized: serialized } });
  const request = await prisma.purchaseRequest.create({ data: { number: tag, reason: 'test', createdById: user.id } });
  const po = await prisma.purchaseOrder.create({ data: { number: tag, requestId: request.id, supplierId: supplier.id, createdById: user.id, status: 'FULLY_RECEIVED', items: { create: { itemId: master.id, qty: 10, receivedQty: 10, unitPrice: 100 } } }, include: { items: true } });
  const receipt = await prisma.goodsReceipt.create({ data: { number: tag, purchaseOrderId: po.id, locationId: location.id, createdById: user.id, items: { create: { purchaseOrderItemId: po.items[0].id, qty: 10, originalUnitPrice: 100 } } }, include: { items: true } });
  const batch = await prisma.inventoryBatch.create({ data: { itemId: master.id, locationId: location.id, goodsReceiptId: receipt.id, goodsReceiptItemId: receipt.items[0].id, receivedQty: 10, remainingQty: 10, unitPrice: 100 } });
  await prisma.inventoryStock.create({ data: { itemId: master.id, locationId: location.id, qty: 10 } });
  const units = serialized ? await Promise.all(Array.from({ length: 10 }, (_, i) => prisma.stockUnit.create({ data: { itemId: master.id, locationId: location.id, inventoryBatchId: batch.id, serialNumber: `${tag}-${i}` } }))) : [];
  const bill = await prisma.supplierBill.create({ data: { number: tag, supplierId: supplier.id, invoiceNumber: tag, invoiceDate: new Date(), amount: 1000, status: paid ? 'PAID' : 'OPEN', createdById: user.id, items: { create: { receiptItemId: receipt.items[0].id, qty: 10, unitPrice: 100, amount: 1000 } }, ...(paid || pending ? { payments: { create: { number: tag, amount: 1000, method: 'CASH', paidAt: new Date(), status: paid ? 'PAID' : 'WAITING_PAYMENT_APPROVAL', createdById: user.id } } } : {}) } });
  for (const [code,type] of [['2001','LIABILITY'],['1201','ASSET']]) await prisma.account.upsert({ where: { code }, create: { code, name: code, type }, update: {} });
  return { user, master, location, batch, bill, item: receipt.items[0], units };
}
async function submit(f, qty, extra = {}) {
  let status = 200, body;
  const res = { status(code) { status = code; return this; }, json(value) { body = value; return this; } };
  await handler({ user: f.user, body: { returnDate: '2026-11-17', reason: 'Barang rusak', proof: { url: '/uploads/test.jpg', mimeType: 'image/jpeg' }, items: [{ receiptItemId: f.item.id, qty, stockUnitIds: extra.stockUnitIds || [] }], ...extra } }, res);
  return { status, body };
}
test('returns reduce stock and bill atomically, preserve receipt, and post balanced journal', { skip: !enabled }, async () => {
  const f = await fixture(); const r = await submit(f, 3); assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await prisma.inventoryBatch.findUnique({ where: { id: f.batch.id } })).remainingQty, 7);
  const item = await prisma.goodsReceiptItem.findUnique({ where: { id: f.item.id } }); assert.equal(item.qty, 10); assert.equal(item.returnedQty, 3);
  assert.equal((await prisma.supplierBill.findUnique({ where: { id: f.bill.id } })).amount, 700);
  const journal = await prisma.journalEntry.findUnique({ where: { sourceType_sourceId: { sourceType: 'PURCHASE_RETURN', sourceId: r.body.purchaseReturn.id } }, include: { lines: true } });
  assert.equal(journal.lines.reduce((sum, line) => sum + line.debit - line.credit, 0n), 0n);
  assert.equal((await submit(f, 8)).status, 400); assert.equal((await prisma.inventoryBatch.findUnique({ where: { id: f.batch.id } })).remainingQty, 7);
});
test('paid bills produce supplier credit without a cash movement', { skip: !enabled }, async () => {
  const f = await fixture({ paid: true }); const r = await submit(f, 2); assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.purchaseReturn.creditAmount, 200);
  const journal = await prisma.journalEntry.findUnique({ where: { sourceType_sourceId: { sourceType: 'PURCHASE_RETURN', sourceId: r.body.purchaseReturn.id } }, include: { lines: { include: { account: true } } } });
  assert.deepEqual(journal.lines.map(line => line.account.code).sort(), ['1201','2001']);
});
test('pending payments roll back stock, units and quantities', { skip: !enabled }, async () => {
  const f = await fixture({ pending: true, serialized: true }); const r = await submit(f, 1, { stockUnitIds: [f.units[0].id] }); assert.equal(r.status, 400);
  assert.equal((await prisma.stockUnit.findUnique({ where: { id: f.units[0].id } })).status, 'IN_STOCK');
  assert.equal((await prisma.inventoryBatch.findUnique({ where: { id: f.batch.id } })).remainingQty, 10);
  assert.equal((await prisma.goodsReceiptItem.findUnique({ where: { id: f.item.id } })).returnedQty, 0);
});
test('serialized returns validate provenance and mark selected unit returned', { skip: !enabled }, async () => {
  const f = await fixture({ serialized: true });
  assert.equal((await submit(f, 1, { stockUnitIds: ['wrong'] })).status, 400);
  const r = await submit(f, 1, { stockUnitIds: [f.units[0].id] }); assert.equal(r.status, 200, JSON.stringify(r.body));
  const unit = await prisma.stockUnit.findUnique({ where: { id: f.units[0].id } }); assert.equal(unit.status, 'RETURNED_TO_SUPPLIER'); assert.equal(unit.locationId, null);
  assert.equal((await submit(f, 1, { stockUnitIds: [f.units[0].id] })).status, 400);
});
test('unbilled returns reduce stock without changing supplier bills', { skip: !enabled }, async () => {
  const f = await fixture();
  await prisma.supplierBillItem.deleteMany({ where: { billId: f.bill.id } });
  const r = await submit(f, 4); assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await prisma.inventoryBatch.findUnique({ where: { id: f.batch.id } })).remainingQty, 6);
  assert.equal((await prisma.supplierBill.findUnique({ where: { id: f.bill.id } })).amount, 1000);
  assert.equal(r.body.purchaseReturn.items[0].billAdjustments.length, 0);
});
test('used stock, missing proof, and simultaneous duplicate returns cannot overdraw inventory', { skip: !enabled }, async () => {
  const f = await fixture();
  assert.equal((await submit(f, 1, { proof: null })).status, 400);
  await prisma.inventoryBatch.update({ where: { id: f.batch.id }, data: { remainingQty: 1 } });
  assert.equal((await submit(f, 2)).status, 400);
  assert.equal((await prisma.goodsReceiptItem.findUnique({ where: { id: f.item.id } })).returnedQty, 0);
  const g = await fixture();
  const results = await Promise.all([submit(g, 7), submit(g, 7)]);
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.equal((await prisma.inventoryBatch.findUnique({ where: { id: g.batch.id } })).remainingQty, 3);
  assert.equal((await prisma.supplierBill.findUnique({ where: { id: g.bill.id } })).amount, 300);
});
after(async () => { await prisma.$disconnect(); });
