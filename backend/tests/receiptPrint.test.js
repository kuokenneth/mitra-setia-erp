const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../src/prisma');
let records = [], query;
prisma.goodsReceipt.findMany = async args => {
  query = args;
  const fields = new Set(Prisma.dmmf.datamodel.models.find(model => model.name === 'GoodsReceipt').fields.map(field => field.name));
  for (const sort of args.orderBy) for (const field of Object.keys(sort)) assert.ok(fields.has(field), `Unknown GoodsReceipt sort field ${field}`);
  return records;
};
const route = require('../src/routes/purchasing').stack.find(layer => layer.route?.path === '/receipts/group/print').route.stack.at(-1).handle;
const receipt = (id, supplierId = 'supplier') => ({ id, number: `GR-${id}`, purchaseOrderId: `po-${id}`, purchaseOrder: { number: `PO-${id}`, supplierId, supplier: { name: 'SINAR BINTANG' } }, receivedAt: new Date('2026-11-18T02:00:00Z'), location: { name: 'Gudang sparepart' }, createdBy: { name: 'Staff' }, deliveryNote: 'SB1628', items: [{ qty: 6, condition: 'GOOD', purchaseOrderItem: { item: { sku: 'RMH_BUSHING_NO_MRK', name: 'RUMAH BUSHING (GK ADA MEREK)', unit: 'PCS' } } }] });
async function print(ids) {
  const result = { status: 200 };
  await route({ query: { ids } }, { status(code) { result.status = code; return this; }, json(body) { result.body = body; return this; }, type(type) { result.type = type; return this; }, send(body) { result.body = body; return this; } });
  return result;
}
test('single receipt from the group print action renders using valid Prisma sorting', async () => {
  records = [receipt('one')]; const result = await print('one');
  assert.equal(result.status, 200); assert.equal(result.type, 'html');
  assert.match(result.body, /BUKTI PENERIMAAN BARANG/); assert.match(result.body, /SB1628/); assert.match(result.body, /RUMAH BUSHING/);
  assert.deepEqual(query.orderBy, [{ receivedAt: 'asc' }, { id: 'asc' }]);
});
test('multiple POs print together while missing receipts and mixed suppliers are rejected', async () => {
  records = [receipt('one'), receipt('two')];
  assert.match((await print('one,two')).body, /2 penerimaan/);
  assert.equal((await print('one,two,missing')).status, 404);
  records = [receipt('one'), receipt('two', 'different')];
  assert.equal((await print('one,two')).status, 400);
  assert.equal((await print('')).status, 400);
});
after(async () => prisma.$disconnect());
