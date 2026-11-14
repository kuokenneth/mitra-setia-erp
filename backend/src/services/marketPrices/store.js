const { randomUUID } = require('node:crypto');
const c = require('./core');
const pa = require('../priceAnalytics');
const providers = require('./providers');
const latestSnapshot = { orderBy: [{ observedAt: 'desc' }, { recordedAt: 'desc' }], take: 1 };
async function findItem(db, itemId) {
  const item = await db.item.findUnique({ where: { id: itemId }, select: { id: true, name: true, sku: true, brand: true, partNumber: true, unit: true, marketMonitor: true } });
  if (!item) throw new c.MarketInputError('Sparepart tidak ditemukan.', 404);
  return item;
}
async function saveObservation(db, item, body, { provider = 'MANUAL', eventKey = randomUUID(), now = new Date() } = {}) {
  const url = c.safeUrl(body.url), urlHash = c.hash(url);
  const s = c.observation(body, now);
  if (!s.unit) throw new c.MarketInputError('Satuan wajib diisi.');
  s.data.observationMethod = provider;
  if (provider !== 'MANUAL' && body.evidence) s.data.evidence = { searchId: c.clean(body.evidence.searchId), externalId: c.clean(body.evidence.externalId) };
  const profile = c.profileFor(item, item.marketMonitor);
  const confidence = c.match(profile, s).confidence;
  // The provider cannot mark products verified. Only an explicit human review can.
  const listing = await db.marketProductListing.upsert({ where: { itemId_urlHash: { itemId: item.id, urlHash } }, create: { itemId: item.id, url, urlHash, source: c.sourceFor(url), provider }, update: {} });
  const verified = listing.reviewStatus === 'VERIFIED' && listing.reviewedIdentity === c.identity(s);
  await db.marketPriceSnapshot.createMany({ data: [{ ...s, listingId: listing.id, eventKey, matchConfidence: confidence, verified }], skipDuplicates: true });
  return listing;
}
function listingRow(listing, profile, now = new Date()) {
  const s = listing.snapshots[0];
  if (!s) return null;
  const comparison = c.comparable(profile, s, now);
  if (listing.reviewStatus !== 'VERIFIED' || listing.reviewedIdentity !== c.identity(s)) { comparison.eligible = false; comparison.reasons.push('Listing belum disetujui atau sudah dikecualikan'); }
  const stale = now - new Date(s.observedAt) > profile.staleDays * c.DAY;
  return {
    id: listing.id, source: listing.source, provider: listing.provider, url: listing.url, reviewStatus: listing.reviewStatus,
    ...s.data, snapshotId: s.id, price: c.number(s.price), packSize: c.number(s.packSize), unitPrice: c.number(c.unitPrice(s)),
    shippingCost: c.number(s.shippingCost), landedCost: s.shippingCost == null ? null : c.number(new c.D(s.price).plus(s.shippingCost).div(s.packSize).toDecimalPlaces(2)),
    unit: s.unit, currency: s.currency, taxBasis: s.taxBasis, availability: s.availability,
    observedAt: s.observedAt, recordedAt: s.recordedAt, reviewedAt: listing.reviewedAt, reviewNotes: listing.reviewNotes,
    status: stale ? 'STALE' : listing.reviewStatus === 'REJECTED' ? 'REJECTED' : comparison.eligible ? 'SAVED' : 'NEEDS_REVIEW', ...comparison,
  };
}
function quoteRow(quote, profile, now = new Date()) {
  const price = new c.D(quote.unitPrice).mul(quote.quantity).minus(quote.discount).div(quote.quantity);
  const s = { ...quote, price, data: { title: quote.reference || 'Penawaran supplier', seller: quote.supplier.name, brand: quote.brand || '', partNumber: quote.partNumber || '', productType: quote.productType, specifications: quote.specifications || '', vehicleCompatibility: quote.vehicleCompatibility || '', condition: 'NEW' }, observedAt: quote.quotedAt, availability: 'IN_STOCK' };
  const m = c.match(profile, s);
  const reasons = [...m.reasons];
  if (!quote.verified) reasons.push('Penawaran belum diverifikasi');
  if (new Date(quote.expiresAt) < now) reasons.push('Penawaran kedaluwarsa');
  if (quote.status !== 'ACTIVE') reasons.push('Penawaran dibatalkan');
  return { ...quote, unitPrice: c.number(quote.unitPrice), packSize: c.number(quote.packSize), quantity: c.number(quote.quantity), minimumOrderQty: c.number(quote.minimumOrderQty), discount: c.number(quote.discount), shippingCost: c.number(quote.shippingCost),
    comparableUnitPrice: c.number(c.unitPrice(s)), landedUnitCost: quote.shippingCost == null ? null : c.number(price.plus(new c.D(quote.shippingCost).div(quote.quantity)).div(quote.packSize).toDecimalPlaces(2)),
    eligible: reasons.length === 0, reasons, confidence: m.confidence };
}
async function marketView(db, itemId, now = new Date(), options = {}) {
  const item = await findItem(db, itemId);
  const profile = c.profileFor(item, item.marketMonitor);
  const [listings, quotes, jobs, history, lastSuccess] = await Promise.all([
    db.marketProductListing.findMany({ where: { itemId }, include: { snapshots: latestSnapshot }, orderBy: { createdAt: 'desc' }, take: 500 }),
    db.supplierPriceQuotation.findMany({ where: { itemId }, include: { supplier: { select: { id: true, name: true } } }, orderBy: { quotedAt: 'desc' }, take: 200 }),
    db.marketPriceCheckJob.findMany({ where: { itemId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    pa.loadDataset(db, { itemId, useCache: true }),
    db.marketPriceCheckJob.findFirst({ where: { itemId, status: 'SUCCEEDED' }, orderBy: { finishedAt: 'desc' } }),
  ]);
  const internal = (history.byKey.get(pa.primaryKeyFor(item)) || []).filter(row => !(options.excludeIds || []).includes(row.id));
  const last = internal[internal.length - 1];
  const rows = listings.map(row => listingRow(row, profile, now)).filter(Boolean).sort((a, b) => a.unitPrice - b.unitPrice);
  const stats = c.summary(rows, last?.unitPrice, last?.qty || 0);
  const activeProviders = providers.providerStatus().filter(p => p.automatic && p.available);
  const { marketMonitor, ...publicItem } = item;
  return { item: publicItem, profile, providers: providers.providerStatus(), automaticActive: profile.enabled && activeProviders.length > 0, profileReady: c.profileReady(profile),
    summary: stats, internal: last ? { unitPrice: last.unitPrice, qty: last.qty, date: last.date, supplierName: last.supplierName, average: pa.summarize(internal).averagePrice } : null,
    listings: rows, quotations: quotes.map(q => quoteRow(q, profile, now)), jobs, lastSuccessfulCheck: lastSuccess?.finishedAt || null,
    internalPoints: internal.slice(-300).map(row => ({ id: row.id, date: row.date, price: row.unitPrice, supplier: row.supplierName })),
    quality: { pending: rows.filter(r => r.reviewStatus === 'PENDING').length, stale: rows.filter(r => r.status === 'STALE').length, valid: stats.count, truncated: listings.length === 500 || quotes.length === 200 },
    basis: 'Harga per satuan barang, IDR, belum termasuk pajak dan ongkir. Ongkir ditampilkan terpisah; harga listing bukan jaminan harga transaksi.' };
}
async function historyPoints(db, item, profile, now = new Date()) {
  const snapshots = await db.marketPriceSnapshot.findMany({ where: { listing: { itemId: item.id }, observedAt: { gte: new Date(now - 365 * c.DAY), lte: now }, verified: true }, include: { listing: { select: { id: true, source: true } } }, orderBy: [{ observedAt: 'desc' }, { recordedAt: 'desc' }], take: 5000 });
  // Each point is an observation date, not a purchase date. Do not carry old prices forward.
  const days = new Map();
  for (const s of [...snapshots].reverse()) {
    if (c.match(profile, s).reasons.length || s.availability !== 'IN_STOCK') continue;
    const day = new Date(s.observedAt.getTime() + 7 * 3600000).toISOString().slice(0, 10);
    if (!days.has(day)) days.set(day, new Map());
    days.get(day).set(s.listingId, { unitPrice: c.number(c.unitPrice(s)), eligible: true });
  }
  return { points: [...days].map(([day, entries]) => ({ date: `${day}T12:00:00+07:00`, ...c.summary([...entries.values()]) })), truncated: snapshots.length === 5000 };
}
async function marketReference(db, itemId, price, { now = new Date() } = {}) {
  if (!db.marketProductListing) return null;
  const item = await findItem(db, itemId);
  const profile = c.profileFor(item, item.marketMonitor);
  const listings = await db.marketProductListing.findMany({ where: { itemId, reviewStatus: 'VERIFIED' }, include: { snapshots: latestSnapshot }, take: 500 });
  const rows = listings.map(l => listingRow(l, profile, now)).filter(Boolean);
  const stats = c.summary(rows, price);
  if (!stats.count) return { sufficient: false, count: 0 };
  const valid = rows.filter(r => r.eligible);
  return { sufficient: true, price: stats.median, lowest: stats.lowest, count: stats.count, differencePct: stats.differencePct,
    sources: [...new Set(valid.map(r => r.source))], checkedAt: valid.reduce((latest, r) => !latest || r.observedAt > latest ? r.observedAt : latest, null), confidence: 'VERIFIED', staleDays: profile.staleDays };
}
module.exports = { latestSnapshot, findItem, saveObservation, listingRow, quoteRow, marketView, historyPoints, marketReference };
