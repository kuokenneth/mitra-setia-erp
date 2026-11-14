// Run against a disposable LOCAL database only; never uses DATABASE_URL as fallback.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const url = process.env.MARKET_TEST_DATABASE_URL;
describe('market price PostgreSQL and HTTP integration', { skip: !url }, () => {
  let db, server, base, user, supplier, item;
  const now = new Date();
  const old = new Date(now - 86400000).toISOString();
  const profile = { expectedBrand: 'Hino', expectedPartNumber: '15607-2190', productType: 'GENUINE', enabled: false, intervalDays: 7, staleDays: 14 };
  const listing = patch => ({ url: 'https://tokopedia.com/test/filter', title: 'Filter Hino', seller: 'Supplier test', brand: 'Hino', partNumber: '15607-2190', productType: 'GENUINE', condition: 'NEW', unit: 'PCS', packSize: '1', price: '147552.60', taxBasis: 'EXCLUSIVE', availability: 'IN_STOCK', observedAt: old, ...patch });
  const call = (who, route, method = 'GET', data) => fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${jwt.sign({ id: who }, process.env.JWT_SECRET)}` } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  before(async () => {
    const u = new URL(url);
    assert.ok(['127.0.0.1', 'localhost'].includes(u.hostname) && u.pathname.startsWith('/market_test'), 'Refusing to run integration tests on a non-test database');
    process.env.JWT_SECRET = 'local-market-test';
    delete process.env.SERPAPI_API_KEY; delete process.env.MARKET_SERPAPI_ENABLED;
    db = new PrismaClient({ datasources: { db: { url } } });
    await db.$executeRawUnsafe('TRUNCATE TABLE "Item", "Supplier", "User", "InventoryLocation" RESTART IDENTITY CASCADE');
    user = await db.user.create({ data: { id: 'market-owner', email: 'owner@market.test', password: 'unused', role: 'OWNER' } });
    await db.user.createMany({ data: [{ id: 'market-staff', email: 'staff@market.test', password: 'unused', role: 'STAFF' }, { id: 'market-driver', email: 'driver@market.test', password: 'unused', role: 'DRIVER' }] });
    item = await db.item.create({ data: { id: 'market-item', name: 'Filter Test', sku: 'MTEST', brand: 'Hino', partNumber: '15607-2190', unit: 'PCS' } });
    supplier = await db.supplier.create({ data: { name: 'Supplier fixture' } });
    const pr = await db.purchaseRequest.create({ data: { number: 'PR-MTEST', reason: 'Test only', createdById: user.id } });
    const po = await db.purchaseOrder.create({ data: { number: 'PO-MTEST', requestId: pr.id, supplierId: supplier.id, createdById: user.id, status: 'FULLY_RECEIVED', items: { create: { itemId: item.id, qty: 60, unitPrice: 201000, receivedQty: 60 } } }, include: { items: true } });
    const location = await db.inventoryLocation.create({ data: { name: 'Test only' } });
    await db.goodsReceipt.create({ data: { number: 'GR-MTEST', purchaseOrderId: po.id, locationId: location.id, createdById: user.id, receivedAt: new Date(now - 2 * 86400000), items: { create: { purchaseOrderItemId: po.items[0].id, qty: 60, originalUnitPrice: 201000, purchaseUnit: 'PCS' } } } });
    const prismaPath = path.join(__dirname, '../src/prisma.js');
    require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma: db } };
    const express = require('express'); const app = express(); app.use(express.json());
    app.use('/market-prices', require('../src/routes/marketPrices').createMarketPricesRouter(db));
    app.use('/price-analytics', require('../src/routes/priceAnalytics').createPriceAnalyticsRouter(db));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => { if (server) await new Promise(resolve => server.close(resolve)); if (db) await db.$disconnect(); });
  test('authentication and role permissions protect reads, writes and monitoring configuration', async () => {
    assert.equal((await call(null, '/market-prices/meta')).status, 401);
    assert.equal((await call('market-driver', '/market-prices/meta')).status, 403);
    assert.equal((await call('market-staff', '/market-prices/meta')).status, 200);
    assert.equal((await call('market-staff', `/market-prices/items/${item.id}/profile`, 'PUT', profile)).status, 403);
    assert.equal((await call(user.id, `/market-prices/items/${item.id}/profile`, 'PUT', profile)).status, 200);
    assert.equal((await call(user.id, `/market-prices/items/${item.id}/profile`, 'PUT', { ...profile, enabled: true })).status, 503);
  });
  test('unconfigured live providers never report successful automatic checks', async () => {
    assert.equal((await call(user.id, `/market-prices/items/${item.id}/check`, 'POST', {})).status, 503);
    assert.equal(await db.marketPriceCheckJob.count(), 0);
    const view = await (await call(user.id, `/market-prices/items/${item.id}`)).json();
    assert.equal(view.automaticActive, false);
    assert.equal(view.summary.count, 0);
    assert.equal(view.internal.unitPrice, 201000);
  });
  test('duplicate URL imports create one listing and preserve append-only observations', async () => {
    for (const u of ['https://tokopedia.com/test/filter', 'https://tokopedia.com/test/filter/?utm_source=test']) {
      const r = await call('market-staff', `/market-prices/items/${item.id}/listings`, 'POST', listing({ url: u }));
      assert.equal(r.status, 201, await r.text());
    }
    assert.equal(await db.marketProductListing.count(), 1);
    assert.equal(await db.marketPriceSnapshot.count(), 2);
    const view = await (await call(user.id, `/market-prices/items/${item.id}`)).json();
    assert.equal(view.summary.count, 0);
    assert.equal(view.listings[0].unitPrice, 147552.6);
  });
  test('explicit verification unlocks real median, history and purchasing warning without changing purchases', async () => {
    const l = await db.marketProductListing.findFirst();
    assert.equal((await call(user.id, `/market-prices/listings/${l.id}/review`, 'POST', { status: 'VERIFIED' })).status, 400);
    const response = await call('market-staff', `/market-prices/listings/${l.id}/review`, 'POST', { status: 'VERIFIED', acknowledgeCompatibility: true });
    assert.equal(response.status, 200, await response.text());
    const view = await (await call(user.id, `/market-prices/items/${item.id}`)).json();
    assert.equal(view.summary.median, 147552.6);
    assert.equal(view.summary.estimatedSavings, 3206844);
    assert.equal(view.marketHistory.length, 1);
    const warning = await (await call(user.id, '/price-analytics/check-price', 'POST', { itemId: item.id, unit: 'PCS', unitPrice: 201000 })).json();
    assert.equal(warning.market.price, 147552.6);
    assert.ok(warning.market.differencePct > 30);
    assert.equal((await db.purchaseOrderItem.findFirst()).unitPrice, 201000);
    assert.equal((await db.goodsReceiptItem.findFirst()).originalUnitPrice, 201000);
  });
  test('malformed batch import is atomic and wrong brand cannot be verified', async () => {
    const count = await db.marketProductListing.count();
    const r = await call(user.id, `/market-prices/items/${item.id}/listings`, 'POST', { listings: [listing({ url: 'https://supplier.example/valid' }), listing({ price: '-1' })] });
    assert.equal(r.status, 400);
    assert.equal(await db.marketProductListing.count(), count);
    const added = await (await call(user.id, `/market-prices/items/${item.id}/listings`, 'POST', listing({ url: 'https://supplier.example/wrong', brand: 'Other' }))).json();
    assert.equal((await call(user.id, `/market-prices/listings/${added.listingIds[0]}/review`, 'POST', { status: 'VERIFIED', acknowledgeCompatibility: true })).status, 400);
  });
  test('quotations validate dates/MOQ/discount and remain separate from marketplace median', async () => {
    const q = { supplierId: supplier.id, brand: 'Hino', partNumber: '15607-2190', productType: 'GENUINE', unit: 'PCS', packSize: '2', unitPrice: '250000.20', quantity: '10', minimumOrderQty: '2', discount: '10000', quotedAt: old, expiresAt: new Date(+now + 7 * 86400000).toISOString(), taxBasis: 'EXCLUSIVE' };
    for (const bad of [{ discount: '999999999' }, { minimumOrderQty: 11 }, { expiresAt: '2020-01-01' }, { proof: { url: 'https://foreign.example/photo' } }]) assert.equal((await call(user.id, `/market-prices/items/${item.id}/quotations`, 'POST', { ...q, ...bad })).status, 400);
    const r = await call('market-staff', `/market-prices/items/${item.id}/quotations`, 'POST', q);
    assert.equal(r.status, 201, 'valid quotation accepted');
    const added = await r.json();
    assert.equal((await call(user.id, `/market-prices/quotations/${added.quotation.id}/review`, 'POST', { action: 'VERIFY', acknowledgeCompatibility: true })).status, 200);
    const view = await (await call(user.id, `/market-prices/items/${item.id}`)).json();
    assert.equal(view.summary.median, 147552.6);
    assert.equal(view.quotations[0].eligible, true);
    assert.equal(view.quotations[0].comparableUnitPrice, 124500.1);
  });
  test('rejecting a listing excludes it without deleting any historical snapshot', async () => {
    const l = await db.marketProductListing.findFirst({ where: { source: 'TOKOPEDIA' } });
    const before = await db.marketPriceSnapshot.count();
    assert.equal((await call(user.id, `/market-prices/listings/${l.id}/review`, 'POST', { status: 'REJECTED' })).status, 200);
    const view = await (await call(user.id, `/market-prices/items/${item.id}`)).json();
    assert.equal(view.summary.count, 0);
    assert.equal(await db.marketPriceSnapshot.count(), before);
  });
  test('persistent queue deduplicates concurrent requests and claims exactly once across workers', async () => {
    const jobs = require('../src/services/marketPrices/jobs');
    const provider = { getProviderStatus: () => ({ available: true }), searchProducts: async () => [listing({ url: 'https://supplier.example/automated' })] };
    const enqueued = await Promise.all([jobs.enqueue(db, item.id, user.id, now, provider), jobs.enqueue(db, item.id, user.id, now, provider)]);
    assert.equal(enqueued[0].job.id, enqueued[1].job.id);
    assert.equal(await db.marketPriceCheckJob.count(), 1);
    const claimed = await Promise.all([jobs.claimJob(db, now), jobs.claimJob(db, now)]);
    assert.equal(claimed.filter(Boolean).length, 1);
    await jobs.processJob(db, claimed.find(Boolean), provider, now);
    const done = await db.marketPriceCheckJob.findFirst();
    assert.equal(done.status, 'SUCCEEDED'); assert.equal(done.activeKey, null);
    assert.equal((await db.marketPriceSnapshot.findFirst({ where: { eventKey: done.id } })).verified, false);
    assert.equal((await jobs.enqueue(db, item.id, user.id, now, provider)).cached, true);
  });
  test('failed jobs retry with persisted backoff; old lease cannot overwrite a completed job', async () => {
    const jobs = require('../src/services/marketPrices/jobs');
    const { ProviderError } = require('../src/services/marketPrices/providers');
    await db.marketPriceCheckJob.deleteMany();
    const provider = { getProviderStatus: () => ({ available: true }), searchProducts: async () => { throw new ProviderError('PROVIDER_TIMEOUT'); } };
    await jobs.enqueue(db, item.id, user.id, now, provider);
    let time = now, last;
    for (let i = 1; i <= 3; i++) {
      const job = await jobs.claimJob(db, time); assert.ok(job); last = job;
      await jobs.processJob(db, job, provider, time);
      const row = await db.marketPriceCheckJob.findUnique({ where: { id: job.id } });
      assert.equal(row.attempts, i); assert.equal(row.status, i === 3 ? 'FAILED' : 'QUEUED');
      time = new Date(+time + 10 * 60000);
    }
    const successful = { searchProducts: async () => [listing({ url: 'https://supplier.example/late' })] };
    const count = await db.marketPriceSnapshot.count();
    await jobs.processJob(db, last, successful, time);
    assert.equal(await db.marketPriceSnapshot.count(), count);
    assert.equal((await db.marketPriceCheckJob.findFirst()).status, 'FAILED');
  });
  test('market alerts derive above-market, spreads, falling prices and high spending from verified observations', async () => {
    const store = require('../src/services/marketPrices/store');
    const currentItem = await store.findItem(db, item.id);
    for (const [url, price] of [['https://supplier.example/alert-a', '100000'], ['https://supplier.example/alert-b', '200000']]) {
      await store.saveObservation(db, currentItem, listing({ url, price: '300000', observedAt: new Date(now - 5 * 86400000).toISOString() }));
      const l = await store.saveObservation(db, currentItem, listing({ url, price, observedAt: old }));
      const r = await call(user.id, `/market-prices/listings/${l.id}/review`, 'POST', { status: 'VERIFIED', acknowledgeCompatibility: true });
      assert.equal(r.status, 200);
    }
    // Add an older verified evidence point without changing any existing snapshot.
    const l = await db.marketProductListing.findFirst({ where: { url: 'https://supplier.example/alert-a' } });
    const past = await db.marketPriceSnapshot.findFirst({ where: { listingId: l.id }, orderBy: { observedAt: 'asc' } });
    const { id, recordedAt, ...copy } = past;
    await db.marketPriceSnapshot.create({ data: { ...copy, eventKey: 'test-old-verification', verified: true } });
    for (const type of ['ABOVE_MARKET', 'SPREAD', 'FALLING', 'HIGH_SPEND']) {
      const r = await call(user.id, `/market-prices/alerts?type=${type}`);
      assert.equal(r.status, 200);
      const body = await r.json();
      assert.equal(body.items.length, 1, type);
      assert.ok(body.items[0].conditions.includes(type));
    }
  });
  test('scheduled checks resume from persisted due dates and reclaim expired leases', async () => {
    const jobs = require('../src/services/marketPrices/jobs');
    await db.marketPriceCheckJob.deleteMany();
    await db.marketPriceMonitor.update({ where: { itemId: item.id }, data: { enabled: true, nextCheckAt: new Date(now - 86400000) } });
    const provider = { getProviderStatus: () => ({ available: true }), searchProducts: async () => [] };
    await jobs.tick(db, provider, now);
    assert.equal((await db.marketPriceCheckJob.findFirst()).status, 'SUCCEEDED');
    assert.ok((await db.marketPriceMonitor.findUnique({ where: { itemId: item.id } })).nextCheckAt > now);
    await db.marketPriceMonitor.update({ where: { itemId: item.id }, data: { enabled: false } });
    await db.marketPriceCheckJob.deleteMany();
    await db.marketPriceCheckJob.create({ data: { itemId: item.id, provider: 'SERPAPI_SHOPPING', activeKey: `${item.id}:SERPAPI_SHOPPING`, status: 'RUNNING', attempts: 1, lockedAt: new Date(now - 300000), startedAt: new Date(now - 300000), lockToken: 'old-worker' } });
    await jobs.tick(db, provider, now);
    const recovered = await db.marketPriceCheckJob.findFirst();
    assert.equal(recovered.status, 'SUCCEEDED'); assert.equal(recovered.attempts, 2);
  });

});
