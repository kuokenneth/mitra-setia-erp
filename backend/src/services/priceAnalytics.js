const { Prisma } = require('@prisma/client');
const sql = Prisma.sql;
const ROLES = ['OWNER', 'ADMIN', 'STAFF', 'SPAREPART_ADMIN'];
function config(env = process.env) {
  const positive = (key, fallback) => Number.isFinite(Number(env[key])) && Number(env[key]) > 0 ? Number(env[key]) : fallback;
  const thresholds = [positive('PRICE_WARNING_MILD', 5), positive('PRICE_WARNING_STRONG', 10), positive('PRICE_WARNING_HIGH', 20)].sort((a,b)=>a-b);
  return { lookbackDays: Math.min(730, positive('PRICE_LOOKBACK_DAYS', 90)), minTransactions: Math.ceil(positive('PRICE_MIN_TRANSACTIONS', 2)), thresholds };
}
function parseFilters(q = {}) {
  const date = (v, end) => {
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,10) !== v) throw new Error('Tanggal tidak valid');
    return new Date(`${v}T${end ? '23:59:59.999' : '00:00:00.000'}+07:00`);
  };
  const from = date(q.from, false), to = date(q.to, true);
  if (from && to && from > to) throw new Error('Tanggal awal harus sebelum tanggal akhir');
  const page = Math.max(1, Math.min(100000, Math.floor(Number(q.page) || 1)));
  return { from, to, itemId: String(q.itemId || ''), supplierId: String(q.supplierId || ''), category: String(q.category || ''), q: String(q.q || '').slice(0,150), direction: String(q.direction || ''), page, limit: Math.min(100, Math.max(1, Math.floor(Number(q.limit) || 20))) };
}
// Compute lag BEFORE filtering: the preceding purchase may be outside the selected dates/supplier.
const historyCTE = sql`WITH valid AS (
 SELECT * FROM "SparepartPurchaseHistory" WHERE "unitPrice" > 0 AND currency='IDR' AND "taxBasis"='BEFORE_ORDER_ADJUSTMENTS'
), history AS (
 SELECT *, LAG("unitPrice") OVER (PARTITION BY "itemId", unit, currency, "taxBasis" ORDER BY date, id) "previousPrice"
 FROM valid
), changes AS (
 SELECT *, 100 * ("unitPrice" - "previousPrice") / NULLIF("previousPrice",0) change FROM history
)`;
function where(f, alias = 'h') {
  // alias is internal only, never request input.
  const c = (name) => Prisma.raw(`${alias}."${name}"`);
  const parts = [sql`TRUE`];
  if (f.from) parts.push(sql`${c('date')} >= ${f.from}`);
  if (f.to) parts.push(sql`${c('date')} <= ${f.to}`);
  if (f.itemId) parts.push(sql`${c('itemId')} = ${f.itemId}`);
  if (f.supplierId) parts.push(sql`${c('supplierId')} = ${f.supplierId}`);
  if (f.category) parts.push(sql`${c('category')} = ${f.category}`);
  if (f.direction === 'up') parts.push(sql`${c('change')} > 0`);
  if (f.direction === 'down') parts.push(sql`${c('change')} < 0`);
  if (f.q) { const pattern = `%${f.q.replace(/[\\%_]/g, '\\$&')}%`; parts.push(sql`(${c('name')} ILIKE ${pattern} OR ${c('sku')} ILIKE ${pattern} OR ${c('supplierName')} ILIKE ${pattern} OR ${c('poNumber')} ILIKE ${pattern} OR ${c('receiptNumber')} ILIKE ${pattern} OR ${c('brand')} ILIKE ${pattern} OR ${c('partNumber')} ILIKE ${pattern})`); }
  return Prisma.join(parts, ' AND ');
}
function order(q) {
  const column = { date: 'date', price: 'unitPrice', qty: 'qty', supplier: 'supplierName', value: 'amount' }[q.sort] || 'date';
  return Prisma.raw(`h."${column}" ${q.order === 'asc' ? 'ASC' : 'DESC'}, h.id ${q.order === 'asc' ? 'ASC' : 'DESC'}`);
}
function warning(price, reference, settings = config()) {
  if (!reference || Number(reference.count) < settings.minTransactions || !(Number(reference.unitPrice) > 0)) return { level: 'insufficient', change: null };
  const change = new Prisma.Decimal(price).minus(reference.unitPrice).div(reference.unitPrice).times(100).toNumber();
  const [mild,strong,high] = settings.thresholds;
  return { change, level: change > high ? 'high' : change > strong ? 'strong' : change > mild ? 'mild' : 'normal' };
}
async function reference(db, itemId, unit, asOf = new Date(), settings = config()) {
  const from = new Date(asOf.getTime() - settings.lookbackDays * 86400000);
  const rows = await db.$queryRaw`SELECT COUNT(*)::int count, SUM(qty*"unitPrice")/NULLIF(SUM(qty),0) average,
    MIN("unitPrice") minimum, MAX(date) "latestDate"
    FROM "SparepartPurchaseHistory" WHERE "itemId"=${itemId} AND unit=${unit} AND currency='IDR'
    AND "taxBasis"='BEFORE_ORDER_ADJUSTMENTS' AND "unitPrice">0 AND date>=${from} AND date<=${asOf}`;
  const latest = await db.$queryRaw`SELECT "unitPrice", "supplierId", "supplierName", date FROM "SparepartPurchaseHistory"
    WHERE "itemId"=${itemId} AND unit=${unit} AND currency='IDR' AND "taxBasis"='BEFORE_ORDER_ADJUSTMENTS'
    AND "unitPrice">0 AND date>=${from} AND date<=${asOf} ORDER BY date DESC,id DESC LIMIT 1`;
  const minimum = await db.$queryRaw`SELECT MIN("unitPrice") minimum FROM "SparepartPurchaseHistory"
    WHERE "itemId"=${itemId} AND unit=${unit} AND currency='IDR' AND "taxBasis"='BEFORE_ORDER_ADJUSTMENTS' AND "unitPrice">0 AND date<=${asOf}`;
  return { ...rows[0], ...latest[0], minimum: minimum[0].minimum, lookbackDays: settings.lookbackDays, minTransactions: settings.minTransactions, method: 'Harga pembelian terakhir untuk barang dan satuan identik; rata-rata tertimbang sebagai pembanding', sufficient: Number(rows[0].count) >= settings.minTransactions };
}
// Only earlier records from OTHER suppliers in the lookback window qualify as savings evidence.
function savingsCTE(f, settings = config()) {
  return sql`${historyCTE}, opportunities AS (
    SELECT h.*, r."unitPrice" "referencePrice", r."supplierName" "referenceSupplier", r.date "referenceDate",
      (h."unitPrice"-r."unitPrice") difference, (h."unitPrice"-r."unitPrice")*h.qty savings
    FROM changes h JOIN LATERAL (
      SELECT v.* FROM valid v WHERE v."itemId"=h."itemId" AND v.unit=h.unit AND v.currency=h.currency AND v."taxBasis"=h."taxBasis"
      AND v."supplierId"<>h."supplierId" AND (v.date,v.id)<(h.date,h.id)
      AND v.date>=h.date-(${settings.lookbackDays} * INTERVAL '1 day')
      ORDER BY v."unitPrice",v.date DESC,v.id DESC LIMIT 1
    ) r ON TRUE WHERE ${where(f)} AND h."unitPrice">r."unitPrice"*(1+${settings.thresholds[0]}/100.0)
  )`;
}
module.exports = { sql, ROLES, config, parseFilters, historyCTE, where, order, warning, reference, savingsCTE };
