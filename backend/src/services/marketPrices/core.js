const { Prisma } = require('@prisma/client');
const { createHash } = require('node:crypto');
const D = Prisma.Decimal;
const DAY = 86400000;
const TYPES = ['UNKNOWN', 'GENUINE', 'OEM', 'AFTERMARKET'];
const TAXES = ['UNKNOWN', 'EXCLUSIVE', 'INCLUSIVE'];
class MarketInputError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const norm = value => clean(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
const text = value => clean(value, 2000).toLocaleLowerCase('id-ID').replace(/\s+/g, ' ');
function decimal(value, field, { positive = false, scale = 2 } = {}) {
  const raw = String(value ?? '').trim();
  if (!new RegExp(`^\\d{1,12}(?:\\.\\d{1,${scale}})?$`).test(raw)) throw new MarketInputError(`${field}: isi angka valid, maksimal ${scale} desimal.`);
  const n = new D(raw);
  if (positive ? !n.gt(0) : n.lt(0)) throw new MarketInputError(`${field} harus ${positive ? 'lebih dari' : 'minimal'} nol.`);
  return n;
}
function choice(value, allowed, fallback, field) {
  const v = clean(value || fallback).toUpperCase();
  if (!allowed.includes(v)) throw new MarketInputError(`${field} tidak valid.`);
  return v;
}
function date(value, field, { future = false, now = new Date() } = {}) {
  const raw = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))?$/.test(raw)) throw new MarketInputError(`${field} tidak valid.`);
  const result = new Date(raw.length === 10 ? `${raw}T00:00:00+07:00` : raw);
  if (!Number.isFinite(result.getTime()) || (raw.length === 10 && new Date(result.getTime() + 7 * 3600000).toISOString().slice(0, 10) !== raw)) throw new MarketInputError(`${field} tidak valid.`);
  if (!future && result.getTime() > now.getTime() + 60000) throw new MarketInputError(`${field} tidak boleh di masa depan.`);
  return result;
}
function safeUrl(raw) {
  let u;
  try { u = new URL(clean(raw, 2048)); } catch { throw new MarketInputError('Tautan produk harus berupa URL HTTPS.'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !u.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname) || u.hostname.endsWith('.local')) throw new MarketInputError('Gunakan tautan HTTPS situs publik.');
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|spm)/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  u.pathname = u.pathname.replace(/\/$/, '') || '/';
  return u.toString();
}
const hash = value => createHash('sha256').update(value).digest('hex');
function sourceFor(url) {
  const host = new URL(url).hostname.toLowerCase();
  if (/(^|\.)tokopedia\.com$/.test(host)) return 'TOKOPEDIA';
  if (/(^|\.)shopee\.co\.id$/.test(host)) return 'SHOPEE';
  if (/(^|\.)blibli\.com$/.test(host)) return 'BLIBLI';
  if (/(^|\.)google\.(com|co\.id)$/.test(host)) return 'GOOGLE_SHOPPING';
  return 'DISTRIBUTOR';
}
function metadata(body) {
  const title = clean(body.title, 300), seller = clean(body.seller);
  if (!title || !seller) throw new MarketInputError('Nama produk dan penjual wajib diisi.');
  return { title, seller, brand: clean(body.brand), partNumber: clean(body.partNumber), productType: choice(body.productType, TYPES, 'UNKNOWN', 'Jenis produk'), specifications: clean(body.specifications, 1000), vehicleCompatibility: clean(body.vehicleCompatibility, 500), condition: choice(body.condition, ['NEW', 'USED', 'UNKNOWN'], 'UNKNOWN', 'Kondisi') };
}
function observation(body, now = new Date()) {
  const data = metadata(body);
  return {
    data, price: decimal(body.price, 'Harga', { positive: true }),
    shippingCost: body.shippingCost == null || body.shippingCost === '' ? null : decimal(body.shippingCost, 'Ongkir'),
    packSize: decimal(body.packSize ?? 1, 'Isi per kemasan', { positive: true, scale: 3 }),
    currency: choice(body.currency, ['IDR'], 'IDR', 'Mata uang'),
    unit: clean(body.unit, 30).toUpperCase(), taxBasis: choice(body.taxBasis, TAXES, 'UNKNOWN', 'Pajak'),
    availability: choice(body.availability, ['IN_STOCK', 'OUT_OF_STOCK', 'UNKNOWN'], 'UNKNOWN', 'Stok'),
    observedAt: date(body.observedAt || now.toISOString(), 'Tanggal pengamatan', { now }),
  };
}
function profileFor(item, monitor) {
  return { intervalDays: 7, staleDays: 14, enabled: false, productType: 'UNKNOWN', specifications: '', vehicleCompatibility: '', ...monitor, expectedBrand: monitor?.expectedBrand || item.brand || '', expectedPartNumber: monitor?.expectedPartNumber || item.partNumber || '', unit: item.unit };
}
function profileReady(profile) {
  return profile.productType !== 'UNKNOWN' && Boolean(profile.expectedBrand && (profile.expectedPartNumber || profile.specifications));
}
function identity(snapshot) {
  const { evidence, observationMethod, ...data } = snapshot.data || {};
  return hash(JSON.stringify({ data, unit: norm(snapshot.unit), packSize: String(snapshot.packSize), currency: snapshot.currency, taxBasis: snapshot.taxBasis }));
}
function match(profile, s) {
  const d = s.data || {};
  const conflicts = [];
  if (norm(profile.unit) !== norm(s.unit)) conflicts.push('Satuan berbeda');
  if (s.currency !== 'IDR') conflicts.push('Mata uang berbeda');
  if (s.taxBasis !== 'EXCLUSIVE') conflicts.push('Pajak belum sebanding (harus belum termasuk pajak)');
  if (profile.expectedPartNumber && d.partNumber && norm(profile.expectedPartNumber) !== norm(d.partNumber)) conflicts.push('Nomor part berbeda');
  if (profile.expectedBrand && d.brand && norm(profile.expectedBrand) !== norm(d.brand)) conflicts.push('Merek berbeda');
  if (profile.productType !== 'UNKNOWN' && d.productType !== 'UNKNOWN' && profile.productType !== d.productType) conflicts.push('Original/OEM/aftermarket berbeda');
  if (d.condition !== 'NEW') conflicts.push('Kondisi baru belum dikonfirmasi');
  if (conflicts.length) return { confidence: 'NOT_COMPARABLE', reasons: conflicts };
  const missing = [];
  if (!profileReady(profile)) missing.push('Lengkapi profil pembanding barang');
  if (profile.expectedPartNumber && !d.partNumber) missing.push('Nomor part listing belum ada');
  if (profile.expectedBrand && !d.brand) missing.push('Merek listing belum ada');
  if (d.productType === 'UNKNOWN') missing.push('Jenis produk belum dikonfirmasi');
  if (profile.specifications && text(profile.specifications) !== text(d.specifications)) missing.push('Spesifikasi perlu dicocokkan');
  if (profile.vehicleCompatibility && text(profile.vehicleCompatibility) !== text(d.vehicleCompatibility)) missing.push('Kompatibilitas kendaraan perlu dicocokkan');
  if (missing.length) return { confidence: 'NEEDS_REVIEW', reasons: missing };
  return { confidence: profile.expectedPartNumber ? 'EXACT' : 'LIKELY', reasons: [] };
}
function comparable(profile, s, now = new Date()) {
  const result = match(profile, s);
  if (!s.verified) result.reasons.push('Belum diverifikasi staf');
  if (s.availability !== 'IN_STOCK') result.reasons.push('Stok tersedia belum dikonfirmasi');
  if (new Date(s.observedAt) > now || now - new Date(s.observedAt) > profile.staleDays * DAY) result.reasons.push('Data kedaluwarsa');
  return { ...result, eligible: result.reasons.length === 0 };
}
const unitPrice = snapshot => new D(snapshot.price).div(snapshot.packSize).toDecimalPlaces(2);
const number = value => value == null ? null : Number(value);
function median(values) {
  if (!values.length) return null;
  const sorted = values.map(v => new D(v)).sort((a, b) => a.cmp(b));
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : sorted[mid - 1].plus(sorted[mid]).div(2).toDecimalPlaces(2);
}
function summary(rows, internalPrice, relevantQty = 0) {
  const valid = rows.filter(row => row.eligible);
  if (!valid.length) return { count: 0, lowest: null, highest: null, median: null, differencePct: null, estimatedSavings: null };
  const prices = valid.map(row => new D(row.unitPrice));
  const med = median(prices), low = D.min(...prices), high = D.max(...prices);
  const internal = internalPrice == null ? null : new D(internalPrice);
  const differencePct = internal && med.gt(0) ? internal.minus(med).div(med).mul(100).toDecimalPlaces(2) : null;
  const savings = internal ? D.max(0, internal.minus(med)).mul(relevantQty).toDecimalPlaces(2) : null;
  return { count: valid.length, lowest: number(low), highest: number(high), median: number(med), differencePct: number(differencePct), estimatedSavings: number(savings) };
}
function retryPlan(attempts, now = new Date()) {
  return attempts >= 3 ? { status: 'FAILED', availableAt: now } : { status: 'QUEUED', availableAt: new Date(now.getTime() + 60000 * 2 ** (attempts - 1)) };
}
module.exports = { D, DAY, TYPES, TAXES, MarketInputError, clean, norm, decimal, choice, date, safeUrl, hash, sourceFor, observation, profileFor, profileReady, identity, match, comparable, unitPrice, number, median, summary, retryPlan };
