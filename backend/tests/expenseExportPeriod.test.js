const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { prisma } = require('../src/prisma');
const router = require('../src/routes/expenses');
const handler = router.stack.find(layer => layer.route?.path === '/export').route.stack.at(-1).handle;
let query, reads = 0;
const fixtures = [
  ['2026-10-31T16:59:59.999Z', 'Oktober'],
  ['2026-10-31T17:00:00.000Z', 'Awal November'],
  ['2026-11-30T16:59:59.999Z', 'Akhir November'],
  ['2026-11-30T17:00:00.000Z', 'Desember'],
];
prisma.expense.findMany = async args => {
  reads++; query = args;
  return fixtures.filter(([date]) => new Date(date) >= args.where.expenseDate.gte && new Date(date) < args.where.expenseDate.lt)
    .map(([date, reason]) => ({ expenseDate: new Date(date), reason, category: 'OTHER', amount: 1000, currency: 'IDR', status: 'PAID', paymentMethod: 'CASH' }));
};
async function request(month, role = 'OWNER') {
  const result = { status: 200, headers: {} };
  await handler({ query: { month }, user: { role } }, {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
    setHeader(key, value) { result.headers[key] = value; },
    end(buffer) { result.buffer = buffer; },
  });
  return result;
}
test('Excel includes only the selected month, including WIB month boundaries', async () => {
  const result = await request('2026-11'); assert.equal(result.status, 200);
  assert.equal(query.where.expenseDate.gte.toISOString(), '2026-10-31T17:00:00.000Z');
  assert.equal(query.where.expenseDate.lt.toISOString(), '2026-11-30T17:00:00.000Z');
  assert.match(result.headers['Content-Disposition'], /pengeluaran-2026-11.xlsx/);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(result.buffer);
  const sheet = workbook.getWorksheet('Pengeluaran 2026-11');
  assert.equal(sheet.rowCount, 3);
  assert.deepEqual([sheet.getRow(2).getCell(4).value, sheet.getRow(3).getCell(4).value], ['Awal November', 'Akhir November']);
});
test('missing/invalid month is rejected without querying all expenses', async () => {
  const before = reads;
  for (const month of [undefined, '', '2026-00', '2026-13', '2026-1', 'all']) assert.equal((await request(month)).status, 400);
  assert.equal(reads, before);
  assert.equal((await request('2026-11', 'DRIVER')).status, 403);
});
test('December uses January of the next year as the exclusive boundary', async () => {
  await request('2026-12'); assert.equal(query.where.expenseDate.lt.toISOString(), '2026-12-31T17:00:00.000Z');
});
after(async () => prisma.$disconnect());
