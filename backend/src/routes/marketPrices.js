const express = require('express');
const { prisma } = require('../prisma');
const { authRequired } = require('../middleware/authRequired');
const { requireRole } = require('../middleware/requireRole');
const { randomUUID } = require('node:crypto');
const c = require('../services/marketPrices/core');
const store = require('../services/marketPrices/store');
const { providerStatus } = require('../services/marketPrices/providers');
const { enqueue } = require('../services/marketPrices/jobs');
const pa = require('../services/priceAnalytics');
const ACCESS = ['OWNER', 'ADMIN', 'STAFF', 'SPAREPART_ADMIN'];
function createMarketPricesRouter(db = prisma) {
  const router = express.Router();
  router.use(authRequired, requireRole(...ACCESS));
  const handle = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
  const canManage = user => ['OWNER', 'ADMIN'].includes(user.role);
  router.get('/meta', handle(async (req, res) => {
    const suppliers = await db.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
    res.json({ providers: providerStatus(), suppliers, canManage: canManage(req.user) });
  }));
  router.get('/items/:id', handle(async (req, res) => {
    const view = await store.marketView(db, req.params.id);
    const history = await store.historyPoints(db, view.item, view.profile);
    res.json({ ...view, marketHistory: history.points, historyTruncated: history.truncated, canManage: canManage(req.user) });
  }));
  router.put('/items/:id/profile', requireRole('OWNER', 'ADMIN'), handle(async (req, res) => {
    const item = await store.findItem(db, req.params.id);
    const body = req.body || {};
    const intervalDays = Number(body.intervalDays ?? 7), staleDays = Number(body.staleDays ?? 14);
    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 90 || !Number.isInteger(staleDays) || staleDays < 1 || staleDays > 90) throw new c.MarketInputError('Interval dan masa berlaku harus 1–90 hari.');
    if (typeof body.enabled !== 'boolean') throw new c.MarketInputError('Status pemantauan tidak valid.');
    const data = { intervalDays, staleDays, enabled: body.enabled, expectedBrand: c.clean(body.expectedBrand), expectedPartNumber: c.clean(body.expectedPartNumber), productType: c.choice(body.productType, c.TYPES, 'UNKNOWN', 'Jenis produk'), specifications: c.clean(body.specifications, 1000), vehicleCompatibility: c.clean(body.vehicleCompatibility, 500), updatedById: req.user.id };
    if (data.enabled && !providerStatus().some(p => p.automatic && p.available)) throw new c.MarketInputError('Pemantauan otomatis belum dapat diaktifkan: penyedia belum dikonfigurasi.', 503);
    if (data.enabled && !c.profileReady(c.profileFor(item, data))) throw new c.MarketInputError('Isi merek, nomor part atau spesifikasi, dan jenis produk.');
    const nextCheckAt = new Date();
    res.json({ profile: await db.marketPriceMonitor.upsert({ where: { itemId: item.id }, create: { itemId: item.id, ...data, nextCheckAt }, update: { ...data, nextCheckAt } }) });
  }));
  router.post('/items/:id/check', handle(async (req, res) => {
    const result = await enqueue(db, req.params.id, req.user.id);
    res.status(result.cached ? 200 : 202).json(result);
  }));
  router.post('/items/:id/listings', handle(async (req, res) => {
    const item = await store.findItem(db, req.params.id);
    const rows = Array.isArray(req.body.listings) ? req.body.listings : [req.body];
    if (!rows.length || rows.length > 50) throw new c.MarketInputError('Impor 1–50 listing per permintaan.');
    // Validate the whole batch before writing; no partial imports on malformed input.
    for (const row of rows) { c.safeUrl(row.url); c.observation(row); }
    const ids = await db.$transaction(async tx => {
      const result = [];
      for (const row of rows) result.push((await store.saveObservation(tx, item, row)).id);
      return [...new Set(result)];
    }, { timeout: 60000 });
    res.status(201).json({ listingIds: ids });
  }));
  router.post('/listings/:id/review', handle(async (req, res) => {
    if (!['VERIFIED', 'REJECTED'].includes(req.body.status)) throw new c.MarketInputError('Pilih verifikasi atau kecualikan listing.');
    if (req.body.status === 'VERIFIED' && req.body.acknowledgeCompatibility !== true) throw new c.MarketInputError('Konfirmasi bahwa barang, spesifikasi, pajak, satuan, stok, dan sumber sudah diperiksa.');
    await db.$transaction(async tx => {
      const listing = await tx.marketProductListing.findUnique({ where: { id: req.params.id }, include: { item: { include: { marketMonitor: true } }, snapshots: store.latestSnapshot } });
      if (!listing?.snapshots[0]) throw new c.MarketInputError('Listing tidak ditemukan.', 404);
      const s = listing.snapshots[0];
      const profile = c.profileFor(listing.item, listing.item.marketMonitor);
      const compared = c.comparable(profile, { ...s, verified: true });
      if (req.body.status === 'VERIFIED' && !compared.eligible) throw new c.MarketInputError(compared.reasons.join('. '));
      const notes = c.clean(req.body.notes, 1000);
      await tx.marketProductListing.update({ where: { id: listing.id }, data: { reviewStatus: req.body.status, reviewedIdentity: req.body.status === 'VERIFIED' ? c.identity(s) : null, reviewedById: req.user.id, reviewedAt: new Date(), reviewNotes: notes } });
      if (req.body.status === 'VERIFIED') {
        const { id, recordedAt, ...copy } = s;
        await tx.marketPriceSnapshot.create({ data: { ...copy, eventKey: `review:${randomUUID()}`, verified: true, matchConfidence: compared.confidence } });
      }
    }, { timeout: 30000 });
    res.json({ ok: true });
  }));
  router.post('/items/:id/quotations', handle(async (req, res) => {
    const item = await store.findItem(db, req.params.id), b = req.body || {};
    const supplierId = c.clean(b.supplierId);
    if (!await db.supplier.findUnique({ where: { id: supplierId }, select: { id: true } })) throw new c.MarketInputError('Supplier tidak ditemukan.');
    const quantity = c.decimal(b.quantity, 'Jumlah kemasan', { positive: true, scale: 3 });
    const minimumOrderQty = c.decimal(b.minimumOrderQty || 1, 'Minimum order (kemasan)', { positive: true, scale: 3 });
    if (quantity.lt(minimumOrderQty)) throw new c.MarketInputError('Jumlah penawaran tidak boleh di bawah minimum order.');
    const unitPrice = c.decimal(b.unitPrice, 'Harga per kemasan', { positive: true }), discount = c.decimal(b.discount || 0, 'Diskon total');
    if (discount.gte(unitPrice.mul(quantity))) throw new c.MarketInputError('Diskon harus lebih kecil dari nilai penawaran.');
    const quotedAt = c.date(b.quotedAt, 'Tanggal penawaran');
    const expiresAt = c.date(b.expiresAt, 'Berlaku sampai', { future: true });
    // Date-only expiry lasts through the end of the quoted day in WIB.
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(b.expiresAt))) expiresAt.setTime(expiresAt.getTime() + c.DAY - 1);
    if (expiresAt < quotedAt || expiresAt < new Date()) throw new c.MarketInputError('Penawaran harus masih berlaku dan masa berlaku tidak boleh sebelum tanggal penawaran.');
    const proof = b.proof?.url ? { url: c.clean(b.proof.url, 300), fileName: c.clean(b.proof.fileName), mimeType: c.clean(b.proof.mimeType, 100) } : undefined;
    if (proof && !/^\/api\/uploads\/[a-zA-Z0-9_-]+$/.test(proof.url)) throw new c.MarketInputError('Lampiran harus diunggah melalui aplikasi.');
    const data = { itemId: item.id, supplierId, reference: c.clean(b.reference), brand: c.clean(b.brand), partNumber: c.clean(b.partNumber), productType: c.choice(b.productType, c.TYPES, 'UNKNOWN', 'Jenis produk'), specifications: c.clean(b.specifications, 1000), vehicleCompatibility: c.clean(b.vehicleCompatibility, 500), unit: c.clean(b.unit, 30).toUpperCase(), packSize: c.decimal(b.packSize || 1, 'Isi per kemasan', { positive: true, scale: 3 }), unitPrice, quantity, minimumOrderQty, discount, shippingCost: b.shippingCost == null || b.shippingCost === '' ? null : c.decimal(b.shippingCost, 'Ongkir'), currency: c.choice(b.currency, ['IDR'], 'IDR', 'Mata uang'), taxBasis: c.choice(b.taxBasis, c.TAXES, 'UNKNOWN', 'Pajak'), quotedAt, expiresAt, ...(proof ? { proof } : {}), notes: c.clean(b.notes, 2000), createdById: req.user.id };
    if (!data.unit) throw new c.MarketInputError('Satuan wajib diisi.');
    res.status(201).json({ quotation: await db.supplierPriceQuotation.create({ data }) });
  }));
  router.post('/quotations/:id/review', handle(async (req, res) => {
    if (!['VERIFY', 'VOID'].includes(req.body.action)) throw new c.MarketInputError('Aksi penawaran tidak valid.');
    const q = await db.supplierPriceQuotation.findUnique({ where: { id: req.params.id }, include: { supplier: true, item: { include: { marketMonitor: true } } } });
    if (!q) throw new c.MarketInputError('Penawaran tidak ditemukan.', 404);
    if (req.body.action === 'VERIFY') {
      if (req.body.acknowledgeCompatibility !== true) throw new c.MarketInputError('Periksa dokumen dan kecocokan barang terlebih dahulu.');
      const row = store.quoteRow({ ...q, verified: true }, c.profileFor(q.item, q.item.marketMonitor));
      if (!row.eligible) throw new c.MarketInputError(row.reasons.join('. '));
      await db.supplierPriceQuotation.update({ where: { id: q.id }, data: { verified: true, verifiedById: req.user.id } });
    } else await db.supplierPriceQuotation.update({ where: { id: q.id }, data: { status: 'VOID' } });
    res.json({ ok: true });
  }));
  router.get('/alerts', handle(async (req, res) => {
    const now = new Date();
    const [monitors, settings, dataset] = await Promise.all([
      db.marketPriceMonitor.findMany({ include: { item: true }, orderBy: { updatedAt: 'desc' }, take: 100 }),
      pa.loadSettings(db), pa.loadDataset(db, { useCache: true }),
    ]);
    const ids = monitors.map(m => m.itemId);
    const [listings, past] = await Promise.all([
      db.marketProductListing.findMany({ where: { itemId: { in: ids } }, include: { snapshots: store.latestSnapshot }, take: 10000 }),
      db.marketPriceSnapshot.findMany({ where: { verified: true, observedAt: { gte: new Date(now - 30 * c.DAY), lte: now }, listing: { itemId: { in: ids } } }, include: { listing: { select: { itemId: true } } }, orderBy: [{ observedAt: 'desc' }, { recordedAt: 'desc' }], take: 10000 }),
    ]);
    const grouped = new Map();
    for (const listing of listings) {
      if (!grouped.has(listing.itemId)) grouped.set(listing.itemId, []);
      grouped.get(listing.itemId).push(listing);
    }
    const trend = new Map();
    for (const snapshot of [...past].reverse()) {
      const monitor = monitors.find(m => m.itemId === snapshot.listing.itemId);
      if (!monitor || c.match(c.profileFor(monitor.item, monitor), snapshot).reasons.length || snapshot.availability !== 'IN_STOCK') continue;
      const day = new Date(snapshot.observedAt.getTime() + 7 * 3600000).toISOString().slice(0, 10);
      if (!trend.has(monitor.itemId)) trend.set(monitor.itemId, new Map());
      const days = trend.get(monitor.itemId);
      if (!days.has(day)) days.set(day, new Map());
      days.get(day).set(snapshot.listingId, c.unitPrice(snapshot));
    }
    const highSpendThreshold = Number(process.env.MARKET_HIGH_SPEND_IDR) > 0 ? Number(process.env.MARKET_HIGH_SPEND_IDR) : 10000000;
    const rows = [];
    for (const monitor of monitors) {
      const item = monitor.item, profile = c.profileFor(item, monitor);
      const current = (grouped.get(item.id) || []).map(l => store.listingRow(l, profile, now)).filter(Boolean);
      const internal = dataset.byKey.get(pa.primaryKeyFor(item)) || [];
      const last = internal[internal.length - 1];
      const stats = c.summary(current, last?.unitPrice, last?.qty || 0);
      const staleCount = current.filter(r => r.status === 'STALE').length;
      const conditions = [];
      if (!stats.count) conditions.push(staleCount ? 'STALE' : 'INSUFFICIENT');
      else {
        if (stats.differencePct > settings.mildPct) conditions.push('ABOVE_MARKET');
        if (stats.lowest > 0 && (stats.highest - stats.lowest) / stats.lowest * 100 > settings.strongPct) conditions.push('SPREAD');
        const days = [...(trend.get(item.id)?.values() || [])].map(entries => c.median([...entries.values()]));
        if (days.length > 1 && days[0].gt(0) && days[days.length - 1].minus(days[0]).div(days[0]).mul(100).lt(-settings.mildPct)) conditions.push('FALLING');
        if (!conditions.length) conditions.push('COMPETITIVE');
      }
      const yearly = internal.filter(line => now - new Date(line.date) <= 365 * c.DAY);
      const annualSpend = c.number(yearly.reduce((sum, line) => sum.plus(line.amount), new c.D(0)));
      if (annualSpend >= highSpendThreshold) conditions.push('HIGH_SPEND');
      const type = req.query.type ? conditions.find(t => t === req.query.type) : conditions[0];
      if (!type) continue;
      const priority = stats.differencePct >= settings.highPct ? 'HIGH' : stats.differencePct >= settings.strongPct ? 'MEDIUM' : 'LOW';
      if (req.query.priority && req.query.priority !== priority) continue;
      rows.push({ itemId: item.id, itemName: item.name, type, conditions, priority, ...stats, latestInternal: last?.unitPrice ?? null, staleCount, annualSpend });
    }
    rows.sort((a, b) => req.query.sort === 'difference' ? (b.differencePct || 0) - (a.differencePct || 0) : (b.estimatedSavings || 0) - (a.estimatedSavings || 0));
    res.json({ items: rows, highSpendThreshold, truncated: monitors.length === 100 || listings.length === 10000 || past.length === 10000 });
  }));
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof c.MarketInputError) return res.status(error.status).json({ error: error.message });
    if (['P2021', 'P2022'].includes(error.code)) return res.status(503).json({ error: 'Modul Harga Pasar belum dimigrasikan. Hubungi admin.' });
    console.error('[market-prices]', error.code || error.name);
    res.status(500).json({ error: 'Harga pasar belum dapat diproses. Coba lagi.' });
  });
  return router;
}
module.exports = createMarketPricesRouter();
module.exports.createMarketPricesRouter = createMarketPricesRouter;
