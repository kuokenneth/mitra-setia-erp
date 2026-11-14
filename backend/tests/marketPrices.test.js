const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../src/services/marketPrices/core');
const { createShoppingProvider, providerStatus } = require('../src/services/marketPrices/providers');
const { listingRow, quoteRow } = require('../src/services/marketPrices/store');
const now = new Date('2026-11-14T06:00:00Z');
const profile = { expectedBrand: 'Hino', expectedPartNumber: '15607-2190', productType: 'GENUINE', unit: 'PCS', staleDays: 14 };
const fixture = (patch = {}) => c.observation({ title: 'Filter Hino', seller: 'Distributor A', brand: 'Hino', partNumber: '15607 2190', productType: 'GENUINE', condition: 'NEW', unit: 'PCS', price: '147552.60', packSize: '1', currency: 'IDR', taxBasis: 'EXCLUSIVE', availability: 'IN_STOCK', observedAt: now.toISOString(), ...patch }, now);
test('exact OEM matching ignores separators, never different brands or variants', () => {
  assert.equal(c.match(profile, fixture()).confidence, 'EXACT');
  for (const patch of [{ brand: 'Sakura' }, { partNumber: '15607-9999' }, { productType: 'AFTERMARKET' }, { unit: 'BOX' }, { taxBasis: 'INCLUSIVE' }, { condition: 'USED' }]) assert.equal(c.match(profile, fixture(patch)).confidence, 'NOT_COMPARABLE');
});
test('missing details and specifications cannot silently become a verified reference', () => {
  assert.equal(c.match(profile, fixture({ brand: '' })).confidence, 'NEEDS_REVIEW');
  assert.equal(c.match(profile, fixture({ partNumber: '' })).confidence, 'NEEDS_REVIEW');
  assert.equal(c.match({ ...profile, specifications: 'Ukuran 10 cm' }, fixture()).confidence, 'NEEDS_REVIEW');
  assert.equal(c.profileReady(c.profileFor({ unit: 'PCS', partNumber: '123' })), false);
  assert.equal(c.profileReady({ ...profile, expectedBrand: '' }), false);
});
test('stale, future, unavailable stock and unverified listings are excluded', () => {
  const base = { ...fixture(), verified: true };
  assert.equal(c.comparable(profile, base, now).eligible, true);
  for (const patch of [{ verified: false }, { availability: 'UNKNOWN' }, { availability: 'OUT_OF_STOCK' }, { observedAt: new Date(now - 15 * c.DAY) }, { observedAt: new Date(+now + c.DAY) }]) assert.equal(c.comparable(profile, { ...base, ...patch }, now).eligible, false);
});
test('decimal-safe pack normalization, median, difference and positive savings', () => {
  assert.equal(c.unitPrice(fixture({ price: '295105.20', packSize: '2' })).toString(), '147552.6');
  const stats = c.summary([{ eligible: true, unitPrice: '147552.60' }, { eligible: true, unitPrice: '147552.62' }, { eligible: false, unitPrice: 1 }], '201000', 60);
  assert.equal(stats.median, 147552.61);
  assert.equal(stats.count, 2);
  assert.equal(stats.estimatedSavings, 3206843.4);
  assert.equal(c.summary([{ eligible: true, unitPrice: 200 }], 100, 10).estimatedSavings, 0);
  assert.equal(c.summary([], 100).median, null);
  assert.equal(c.median(['100.01', '100.03']).toString(), '100.02');
});
test('invalid money, fractional cents, invalid dates and future observations rejected', () => {
  for (const price of ['0', '-2', 'NaN', 'Infinity', '1.234', '1,23', '1e6']) assert.throws(() => fixture({ price }));
  assert.throws(() => fixture({ packSize: '0' }));
  assert.throws(() => fixture({ currency: 'USD' }));
  assert.throws(() => fixture({ observedAt: '2026-02-30' }));
  assert.throws(() => fixture({ observedAt: '2027-01-01' }));
});
test('canonical URLs deduplicate tracking variants and reject unsafe protocols', () => {
  assert.equal(c.safeUrl('https://www.tokopedia.com/toko/filter/?utm_source=x#stock'), c.safeUrl('https://www.tokopedia.com/toko/filter'));
  for (const url of ['http://shop.example/p', 'javascript:alert(1)', 'https://127.0.0.1/p', 'https://user:pass@shop.example/p', 'https://172.16.1.1/p', 'https://192.168.1.1/p']) assert.throws(() => c.safeUrl(url));
  assert.equal(c.sourceFor('https://evil-tokopedia.com/item'), 'DISTRIBUTOR');
});
test('rejected or changed listing identity cannot use previous verification', () => {
  const s = { ...fixture(), verified: true, id: 's' };
  const listing = { id: 'l', source: 'DISTRIBUTOR', reviewStatus: 'VERIFIED', reviewedIdentity: c.identity(s), snapshots: [s] };
  assert.equal(listingRow(listing, profile, now).eligible, true);
  assert.equal(listingRow({ ...listing, reviewStatus: 'REJECTED' }, profile, now).eligible, false);
  assert.equal(listingRow({ ...listing, snapshots: [{ ...s, data: { ...s.data, partNumber: '999' } }] }, profile, now).eligible, false);
});
test('expired/void supplier quotations excluded, discount and shipping normalized separately', () => {
  const q = { id: 'q', supplier: { name: 'A' }, reference: 'Q1', ...profile, brand: 'Hino', partNumber: '15607-2190', unitPrice: '200000', packSize: '2', quantity: '10', minimumOrderQty: '1', discount: '100000', shippingCost: '50000', currency: 'IDR', taxBasis: 'EXCLUSIVE', verified: true, status: 'ACTIVE', quotedAt: new Date(now - c.DAY), expiresAt: new Date(+now + c.DAY) };
  assert.equal(quoteRow(q, profile, now).eligible, true);
  assert.equal(quoteRow(q, profile, now).comparableUnitPrice, 95000);
  assert.equal(quoteRow(q, profile, now).landedUnitCost, 97500);
  assert.equal(quoteRow({ ...q, expiresAt: new Date(now - 1) }, profile, now).eligible, false);
  assert.equal(quoteRow({ ...q, status: 'VOID' }, profile, now).eligible, false);
});
test('provider unavailable without both configured credentials and explicit enablement', async () => {
  for (const env of [{}, { SERPAPI_API_KEY: 'test' }, { MARKET_SERPAPI_ENABLED: 'true' }]) {
    assert.equal(providerStatus(env)[0].available, false);
    await assert.rejects(createShoppingProvider({ env }).searchProducts({}, {}), /PROVIDER_UNAVAILABLE/);
  }
});
test('provider uses only fixed API endpoint, rejects foreign prices, preserves cached observation date', async () => {
  let requested;
  const provider = createShoppingProvider({ env: { SERPAPI_API_KEY: 'test', MARKET_SERPAPI_ENABLED: 'true' }, fetchImpl: async url => { requested = url; return { ok: true, text: async () => JSON.stringify({ search_metadata: { status: 'Success', created_at: '2026-11-01 06:00:00 UTC', id: 'search-1' }, shopping_results: [{ title: 'Filter', source: 'Shop', price: 'Rp147.552,60', extracted_price: 147552.6, product_link: 'https://store.example/filter' }, { title: 'USD', price: '$5', extracted_price: 5, product_link: 'https://store.example/other' }] }) }; } });
  const rows = await provider.searchProducts({ name: 'Filter', unit: 'PCS' }, profile);
  assert.equal(requested.origin, 'https://serpapi.com');
  assert.equal(requested.searchParams.get('gl'), 'id');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].observedAt, '2026-11-01T06:00:00.000Z');
  assert.equal(rows[0].brand, '');
  assert.equal(rows[0].taxBasis, 'UNKNOWN');
});
test('provider handles timeout, authorization errors and invalid payload without leaking API key', async () => {
  const env = { SERPAPI_API_KEY: 'secret-test', MARKET_SERPAPI_ENABLED: 'true' };
  for (const fetchImpl of [async () => { throw Error('url includes secret-test'); }, async () => ({ ok: false, status: 401 }), async () => ({ ok: true, text: async () => '{' })]) {
    await assert.rejects(createShoppingProvider({ env, fetchImpl }).searchProducts({ name: 'F' }, profile), error => !error.message.includes('secret-test'));
  }
});
test('retries persist exponential backoff and stop after three attempts', () => {
  assert.equal(+c.retryPlan(1, now).availableAt, +now + 60000);
  assert.equal(+c.retryPlan(2, now).availableAt, +now + 120000);
  assert.equal(c.retryPlan(3, now).status, 'FAILED');
});
