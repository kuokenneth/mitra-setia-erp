// Optional PostgreSQL regression. Requires a disposable LOCAL market_test* database.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const url = process.env.FLEET_TEST_DATABASE_URL;
describe('fleet profitability expense regression', { skip: !url }, () => {
  let db, server, base, truck, user;
  const suffix = randomUUID();
  before(async () => {
    const u = new URL(url);
    assert.ok(['localhost', '127.0.0.1'].includes(u.hostname) && u.pathname.startsWith('/market_test'), 'Local disposable database required');
    db = new PrismaClient({ datasources: { db: { url } } });
    user = await db.user.create({ data: { email: `${suffix}@fleet.test`, password: 'unused', role: 'OWNER' } });
    truck = await db.truck.create({ data: { plateNumber: `TEST-${suffix}` } });
    await db.expense.createMany({ data: [
      { amount: 2000000, notes: null, status: 'PAID', expenseDate: new Date('2026-10-31T00:00:00+07:00'), createdAt: new Date('2026-11-06T12:00:00+07:00') },
      { amount: 100000, notes: 'Normal expense', status: 'APPROVED', expenseDate: new Date('2026-10-20T00:00:00+07:00') },
      { amount: 300000, notes: '', status: 'PAID', expenseDate: new Date('2026-11-01T00:00:00+07:00') },
      { amount: 700000, notes: 'AUTO_SUPPLIER_PAYMENT:test', status: 'PAID', expenseDate: new Date('2026-10-20T00:00:00+07:00') },
      { amount: 800000, notes: null, status: 'SUBMITTED', expenseDate: new Date('2026-10-20T00:00:00+07:00') },
    ].map(data => ({ ...data, truckId: truck.id, createdById: user.id, reason: 'Regression fixture' })) });
    process.env.JWT_SECRET = 'fleet-local-regression';
    const prismaPath = path.join(__dirname, '../src/prisma.js');
    require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma: db } };
    const app = require('express')();
    app.use('/fleet', require('../src/routes/fleetProfitability'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (db && truck) await db.expense.deleteMany({ where: { truckId: truck.id } });
    if (db && truck) await db.truck.delete({ where: { id: truck.id } });
    if (db && user) await db.user.delete({ where: { id: user.id } });
    if (db) await db.$disconnect();
  });
  const request = async month => {
    const r = await fetch(`${base}/fleet?month=${month}`, { headers: { Authorization: `Bearer ${jwt.sign({ id: user.id }, process.env.JWT_SECRET)}` } });
    const data = await r.json(); assert.equal(r.status, 200, JSON.stringify(data));
    return data.rows.find(row => row.truck.id === truck.id);
  };
  test('paid expenses with null notes count in their expense month, regardless of entry date', async () => {
    const row = await request('2026-10');
    assert.equal(row.vehicleExpenses, 2100000);
    assert.equal(row.profit, -2100000);
    assert.equal(row.vehicleExpenseDetails.length, 2);
  });
  test('November boundary uses WIB; automatic supplier payments and pending expenses stay excluded', async () => {
    const row = await request('2026-11');
    assert.equal(row.vehicleExpenses, 300000);
    assert.equal(row.profit, -300000);
    assert.equal(row.vehicleExpenseDetails.length, 1);
  });
});
