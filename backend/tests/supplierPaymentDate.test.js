const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { supplierPaymentDate, statementDateKey } = require('../src/utils/supplierPaymentDate');
test('bank statement dates use WIB and validate real calendar days', () => {
  const now = new Date('2026-11-16T04:00:00Z');
  assert.equal(supplierPaymentDate('2026-11-02', now).toISOString(), '2026-11-01T17:00:00.000Z');
  assert.equal(statementDateKey(new Date('2026-11-01T18:00:00Z')), '2026-11-02');
  assert.equal(supplierPaymentDate('2024-02-29', now).toISOString(), '2024-02-28T17:00:00.000Z');
  for (const value of ['', null, '2026-02-30', '2026-02-29', '2026-13-01', '2026-11-17', '02/11/2026']) assert.throws(() => supplierPaymentDate(value, now));
  assert.equal(supplierPaymentDate(undefined, now), now);
});
describe('supplier request bank statement date', () => {
  let server, base, state, journal, expense, writes;
  const db = { $transaction: async fn => fn(tx), supplierBill: { findUnique: async () => ({ id: "bill", status: "OPEN", amount: 1262250, payments: [] }) } };
  const tx = {
    purchasePayment: {
      findFirst: async () => null,
      create: async ({ data }) => { state = { id: 'pay', status: 'WAITING_PAYMENT_APPROVAL', ...data }; writes++; return state; },
      findUnique: async args => args.include ? { ...state, supplierBill: { supplier: { name: 'Test supplier' }, invoiceNumber: 'TEST', receipts: [], repairItems: [] } } : { ...state },
      updateMany: async ({ where, data }) => { if (where.status !== state.status) return { count: 0 }; state = { ...state, ...data }; writes++; return { count: 1 }; },
    },
    supplierBill: { findUnique: async () => ({ id: 'bill', status: 'OPEN', amount: 1262250, payments: writes ? [state] : [] }), update: async () => ({}) },
    expense: { findFirst: async () => null, create: async ({ data }) => { expense = data; return data; } },
  };
  beforeEach(() => { state = { id: 'pay', number: 'PAY-TEST', amount: 1262250, status: 'WAITING_PAYMENT_APPROVAL', method: 'BANK_TRANSFER', supplierBillId: 'bill', createdById: 'staff' }; journal = null; expense = null; writes = 0; });
  before(async () => {
    const mock = (name, exports) => { const file = path.join(__dirname, '../src', name); require.cache[file] = { id: file, filename: file, loaded: true, exports }; };
    mock('prisma.js', { prisma: db });
    mock('middleware/authRequired.js', { authRequired: (_req, _res, next) => next() });
    mock('services/accounting.js', { SYSTEM_ACCOUNTS: { AP: '2001' }, cashCode: () => '1002', postJournal: async (_tx, args) => { journal = args; } });
    const express = require('express'); const app = express(); app.use(express.json());
    app.use((req, _res, next) => { req.user = { id: 'owner', role: req.headers['x-role'] || 'OWNER' }; next(); });
    app.use('/purchasing', require('../src/routes/purchasing'));
    app.use((error, _req, res, _next) => res.status(400).json({ error: error.message }));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); }); base = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => server && new Promise(resolve => server.close(resolve)));
  const approve = (body, role = 'OWNER') => fetch(`${base}/purchasing/payments/pay/approve`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-role': role }, body: JSON.stringify(body) });
  const requestPayment = data => fetch(`${base}/purchasing/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-role': 'STAFF' }, body: JSON.stringify({ supplierBillId: 'bill', amount: 1262250, method: 'BANK_TRANSFER', proofUrl: '/api/uploads/test', ...data }) });
  test('date is chosen on request and preserved at approval, expense and journal', async () => {
    const submitted = await requestPayment({ paymentDate: '2026-11-02' }); assert.equal(submitted.status, 200, await submitted.text());
    assert.equal(state.status, 'WAITING_PAYMENT_APPROVAL');
    assert.equal(journal, null); assert.equal(expense, null);
    // An approval body cannot replace the date recorded by the applicant.
    const r = await approve({ paymentDate: '2026-11-03' }); assert.equal(r.status, 200, await r.text());
    const expected = '2026-11-01T17:00:00.000Z';
    assert.equal(state.paidAt.toISOString(), expected);
    assert.equal(expense.expenseDate.toISOString(), expected);
    assert.equal(expense.paidAt.toISOString(), expected);
    assert.equal(journal.date.toISOString(), expected);
    assert.ok(state.approvedAt > state.paidAt);
    assert.equal(expense.approvedAt, state.approvedAt);
    assert.equal(expense.amount, 1262250);
  });
  test('invalid or future date does not write a payment or journal', async () => {
    for (const paymentDate of [undefined, '', '2099-02-30', '2099-01-01']) {
      const r = await requestPayment({ paymentDate }); assert.equal(r.status, 400);
    }
    assert.equal(writes, 0); assert.equal(journal, null); assert.equal(expense, null);
  });
  test('legacy pending requests without a date remain approvable', async () => {
    const r = await approve({}); assert.equal(r.status, 200, await r.text());
    assert.ok(state.paidAt instanceof Date);
    assert.equal(expense.expenseDate, state.paidAt);
  });
  test('staff cannot approve and already-approved payment cannot generate duplicate expenses', async () => {
    assert.equal((await approve({ paymentDate: '2026-11-02' }, 'STAFF')).status, 403);
    state.status = 'PAID';
    assert.equal((await approve({ paymentDate: '2026-11-02' })).status, 400);
    assert.equal(writes, 0); assert.equal(expense, null);
  });
});
