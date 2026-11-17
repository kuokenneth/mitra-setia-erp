const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../src/prisma');
let stored;
prisma.customer.findUnique = async () => ({ id: 'customer', name: 'Customer Uji' });
prisma.truck.findMany = async () => [{ id: 'truck', plateNumber: 'BK TEST' }];
prisma.$transaction = async fn => fn({ invoice: {
  findFirst: async () => null,
  create: async ({ data }) => { stored = { id: 'invoice', status: 'DRAFT', payments: [], ...data }; return { id: stored.id }; },
} });
prisma.invoice.findUnique = async () => stored;
const router = require('../src/routes/receivables');
const handler = router.stack.find(layer => layer.route?.path === '/manual-invoices').route.stack.at(-1).handle;
async function create(issuedAt, receiptDate = '2026-11-05') {
  const result = {};
  await handler({ user: { id: 'owner' }, body: { issuedAt, receiptDate, customerId: 'customer', dueAt: '2026-12-17', type: 'FERTILIZER', pph23Rate: 0, lines: [{ truckId: 'truck', cargoName: 'Pupuk', billableKg: 1000, rate: 100 }] } }, {
    status(status) { result.status = status; return this; }, json(body) { result.body = body; },
  });
  return result;
}
test('manual invoice persists the chosen issue date and explicit zero PPh23', async () => {
  const result = await create('2026-11-01'); assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(stored.issuedAt.toISOString(), '2026-10-31T17:00:00.000Z');
  assert.equal(result.body.invoice.issuedAt, stored.issuedAt);
  assert.equal(stored.manualData.receiptDate, '2026-11-05');
  assert.equal(stored.manualData.pph23Rate, 0); assert.equal(stored.discount, 0); assert.equal(stored.total, 100000);
});
test('invalid invoice date is rejected before the invoice is written', async () => {
  stored = null; const result = await create('2026-02-30');
  assert.equal(result.status, 400); assert.equal(stored, null);
});
after(async () => prisma.$disconnect());

test('an invalid receipt date cannot create an invoice', async () => {
  stored = null; const result = await create('2026-11-01', '2026-02-30');
  assert.equal(result.status, 400); assert.equal(stored, null);
});
