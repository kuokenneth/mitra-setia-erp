// Analitik Harga Sparepart — calculations.
//
// Definitions (also documented in docs/sparepart-price-analytics.md):
//
//  * One purchase transaction = one received goods line (GoodsReceiptItem).
//    A PO line is only an order and is never counted; an invoice line prices
//    goods that were already received, so it never adds a second transaction.
//  * Transaction date = GoodsReceipt.receivedAt (the day the goods arrived).
//  * Unit price = the supplier-invoice price once the received quantity is
//    invoiced (VOID invoices ignored). Before that, the provisional price typed
//    at receipt (GoodsReceiptItem.originalUnitPrice), or for receipts recorded
//    before that column existed, the inventory batch price.
//    Partly invoiced lines blend both, weighted by quantity.
//  * Excluded: cancelled POs, lines returned to supplier, repair / retread
//    services, zero quantities, lines without any price, over-invoiced lines.
//  * Prices are line prices in IDR before PO-level tax, discount and shipping.
//    Two transactions are comparable only for the same item, unit, currency
//    and tax basis. Similar names are never merged.
//
// Money is summed exactly with BigInt: quantities are stored in thousandths
// and amounts in rupiah × thousandths, so no floating point is involved until
// a figure is rounded for display.

const RETURNED = "RETURNED_TO_SUPPLIER";
const DAY = 86400000;
const WIB_OFFSET = 7 * 3600000;
const DEFAULT_TAX_BASIS = "BEFORE_ORDER_ADJUSTMENTS";
const DEFAULT_SETTINGS = Object.freeze({ mildPct: 5, strongPct: 10, highPct: 20, lookbackDays: 180, minTransactions: 2 });
const PRICE_STATUS_LABEL = { INVOICE: "Sesuai invoice", PARTIAL_INVOICE: "Sebagian invoice", RECEIPT: "Harga sementara penerimaan", LEGACY: "Arsip harga stok" };

class AnalyticsInputError extends Error {}

/* ------------------------------------------------------------------ numbers */

const toMilli = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? BigInt(Math.round(n * 1000)) : 0n;
};

// Rounded (half away from zero) BigInt division, returned as a JS number with
// `digits` decimals. Only used for presentation values.
function divide(numerator, denominator, digits = 2) {
  if (!denominator) return null;
  const scale = 10n ** BigInt(digits);
  const negative = (numerator < 0n) !== (denominator < 0n);
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = (n * scale * 2n + d) / (2n * d);
  return Number(negative ? -q : q) / Number(scale);
}

const rupiahFromMilli = (amountMilli) => divide(amountMilli, 1000n, 0);
const percentChange = (price, previous) => (previous > 0 ? Math.round(((price - previous) / previous) * 10000) / 100 : null);

/* -------------------------------------------------------------------- dates */

function parseDay(value, endOfDay = false) {
  if (value == null || value === "") return null;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new AnalyticsInputError("Format tanggal harus YYYY-MM-DD");
  const [y, m, d] = text.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) throw new AnalyticsInputError("Tanggal tidak valid");
  return new Date(utc - WIB_OFFSET + (endOfDay ? DAY - 1 : 0));
}

const wibDay = (date) => new Date(new Date(date).getTime() + WIB_OFFSET).toISOString().slice(0, 10);
const wibMonth = (date) => wibDay(date).slice(0, 7);

function parsePeriod(query = {}) {
  const from = parseDay(query.from, false);
  const to = parseDay(query.to, true);
  if (from && to && from > to) throw new AnalyticsInputError("Tanggal awal harus sebelum tanggal akhir");
  return { from, to };
}

const inPeriod = (line, { from, to }) => (!from || line.date >= from) && (!to || line.date <= to);

function parsePaging(query = {}, fallbackLimit = 20) {
  const page = Math.max(1, Math.min(100000, Math.floor(Number(query.page) || 1)));
  const limit = Math.max(1, Math.min(100, Math.floor(Number(query.limit) || fallbackLimit)));
  return { page, limit };
}

function paginate(rows, { page, limit }) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const current = Math.min(page, totalPages);
  return { items: rows.slice((current - 1) * limit, current * limit), pagination: { page: current, limit, total, totalPages } };
}

/* ----------------------------------------------------------------- settings */

function cleanSettings(input = {}, base = DEFAULT_SETTINGS) {
  const pick = (key, min, max, integer = false) => {
    const raw = input[key];
    if (raw === undefined || raw === null || raw === "") return base[key];
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max) throw new AnalyticsInputError(`Nilai ${key} harus antara ${min} dan ${max}`);
    return integer ? Math.round(n) : Math.round(n * 100) / 100;
  };
  const settings = {
    mildPct: pick("mildPct", 0.1, 500),
    strongPct: pick("strongPct", 0.1, 500),
    highPct: pick("highPct", 0.1, 500),
    lookbackDays: pick("lookbackDays", 7, 1095, true),
    minTransactions: pick("minTransactions", 1, 20, true),
  };
  if (!(settings.mildPct < settings.strongPct && settings.strongPct < settings.highPct)) {
    throw new AnalyticsInputError("Ambang harus berurutan: ringan < kuat < tinggi");
  }
  return settings;
}

async function loadSettings(db) {
  try {
    if (!db.priceAnalyticsSetting) return { ...DEFAULT_SETTINGS, stored: false };
    const row = await db.priceAnalyticsSetting.findUnique({ where: { id: "default" } });
    if (!row) return { ...DEFAULT_SETTINGS, stored: false };
    return { ...cleanSettings(row), stored: true, updatedAt: row.updatedAt, updatedByName: row.updatedByName || null };
  } catch (error) {
    // Table not migrated yet: analytics still works with the defaults.
    return { ...DEFAULT_SETTINGS, stored: false };
  }
}

function warningLevel(changePct, settings) {
  if (changePct == null) return "unknown";
  if (changePct > settings.highPct) return "high";
  if (changePct > settings.strongPct) return "strong";
  if (changePct > settings.mildPct) return "mild";
  if (changePct < -settings.mildPct) return "lower";
  return "normal";
}

/* -------------------------------------------------------- loading + cleaning */

const LINE_SELECT = {
  id: true,
  qty: true,
  condition: true,
  originalUnitPrice: true,
  purchaseUnit: true,
  priceSource: true,
  currency: true,
  taxBasis: true,
  receipt: {
    select: {
      id: true, number: true, receivedAt: true, deliveryNote: true,
      deliveryNoteProofUrl: true, deliveryNoteFileName: true, deliveryNoteMimeType: true,
    },
  },
  purchaseOrderItem: {
    select: {
      id: true, itemId: true, partRepairId: true, tireRetreadId: true,
      item: { select: { id: true, name: true, sku: true, brand: true, partNumber: true, category: true, unit: true } },
      purchaseOrder: {
        select: { id: true, number: true, status: true, cancelledAt: true, supplierId: true, createdAt: true, supplier: { select: { id: true, name: true } } },
      },
    },
  },
  inventoryBatch: { select: { unitPrice: true } },
  supplierBillItems: {
    select: {
      id: true, qty: true, unitPrice: true,
      bill: { select: { id: true, number: true, invoiceNumber: true, invoiceDate: true, status: true, proofUrl: true, proofFileName: true, proofMimeType: true } },
    },
  },
};

// Turns one database row into a purchase transaction, or explains why it is
// not one. Pure function so every rule can be unit-tested.
function normalizeLine(row) {
  const poi = row.purchaseOrderItem || {};
  const po = poi.purchaseOrder || {};
  const item = poi.item || {};
  const receipt = row.receipt || {};
  const skip = (reason) => ({ excluded: reason, id: row.id, itemId: poi.itemId || item.id || null });

  if (!(poi.itemId || item.id)) return skip("NO_ITEM");
  if (po.status === "CANCELLED" || po.cancelledAt) return skip("CANCELLED");
  if (row.condition === RETURNED) return skip("RETURNED");
  if (poi.partRepairId || poi.tireRetreadId) return skip("SERVICE");
  const qtyMilli = toMilli(row.qty);
  if (qtyMilli <= 0n) return skip("NO_QTY");
  const date = receipt.receivedAt ? new Date(receipt.receivedAt) : null;
  if (!date || Number.isNaN(date.getTime())) return skip("NO_DATE");
  if (!po.supplierId) return skip("NO_SUPPLIER");

  const invoices = (row.supplierBillItems || [])
    .filter((line) => line.bill && line.bill.status !== "VOID" && Number(line.qty) > 0 && Number(line.unitPrice) > 0)
    .map((line) => ({
      id: line.bill.id, number: line.bill.number, invoiceNumber: line.bill.invoiceNumber, invoiceDate: line.bill.invoiceDate,
      qty: Number(line.qty), unitPrice: Number(line.unitPrice),
      proofUrl: line.bill.proofUrl || null, proofFileName: line.bill.proofFileName || null, proofMimeType: line.bill.proofMimeType || null,
    }));
  let billedMilli = 0n;
  let billedAmount = 0n;
  for (const invoice of invoices) {
    const q = toMilli(invoice.qty);
    billedMilli += q;
    billedAmount += q * BigInt(Math.round(invoice.unitPrice * 100)) / 100n;
  }
  if (billedMilli > qtyMilli) return skip("OVER_INVOICED");

  const receiptPrice = Number(row.originalUnitPrice) > 0 ? Number(row.originalUnitPrice) : null;
  const batchPrice = Number(row.inventoryBatch?.unitPrice) > 0 ? Number(row.inventoryBatch.unitPrice) : null;
  const provisional = receiptPrice ?? batchPrice;
  const remaining = qtyMilli - billedMilli;

  let amountMilli;
  let priceStatus;
  if (remaining === 0n) {
    amountMilli = billedAmount;
    priceStatus = "INVOICE";
  } else if (provisional != null) {
    amountMilli = billedAmount + remaining * BigInt(Math.round(provisional * 100)) / 100n;
    priceStatus = billedMilli > 0n ? "PARTIAL_INVOICE" : receiptPrice != null ? "RECEIPT" : "LEGACY";
  } else if (billedMilli > 0n) {
    // Remainder has no price: use the invoiced price for the whole line.
    amountMilli = (billedAmount * qtyMilli) / billedMilli;
    priceStatus = "PARTIAL_INVOICE";
  } else {
    return skip("NO_PRICE");
  }
  if (amountMilli <= 0n) return skip("NO_PRICE");

  const unit = String(row.purchaseUnit || item.unit || "PCS").trim();
  const currency = String(row.currency || "IDR").toUpperCase();
  const taxBasis = String(row.taxBasis || DEFAULT_TAX_BASIS);
  return {
    id: row.id,
    itemId: poi.itemId || item.id,
    itemName: item.name || "Barang tanpa nama",
    sku: item.sku || null,
    brand: item.brand || null,
    partNumber: item.partNumber || null,
    category: item.category || null,
    itemUnit: item.unit || unit,
    unit,
    currency,
    taxBasis,
    key: `${poi.itemId || item.id}|${unit}|${currency}|${taxBasis}`,
    date,
    supplierId: po.supplierId,
    supplierName: po.supplier?.name || "Supplier tanpa nama",
    poId: po.id || null,
    poNumber: po.number || null,
    poItemId: poi.id || null,
    receiptId: receipt.id || null,
    receiptNumber: receipt.number || null,
    deliveryNote: receipt.deliveryNote || null,
    deliveryNoteProofUrl: receipt.deliveryNoteProofUrl || null,
    deliveryNoteFileName: receipt.deliveryNoteFileName || null,
    deliveryNoteMimeType: receipt.deliveryNoteMimeType || null,
    qtyMilli,
    amountMilli,
    qty: Number(qtyMilli) / 1000,
    unitPrice: divide(amountMilli, qtyMilli, 2),
    amount: rupiahFromMilli(amountMilli),
    priceStatus,
    provisionalPrice: provisional,
    invoices,
    billedQty: Number(billedMilli) / 1000,
  };
}

// Adds the previous comparable purchase to every transaction. Runs over the
// whole history so a filtered view still compares with the true predecessor.
function attachHistory(lines) {
  const byKey = new Map();
  for (const line of lines) {
    if (!byKey.has(line.key)) byKey.set(line.key, []);
    byKey.get(line.key).push(line);
  }
  for (const group of byKey.values()) {
    group.sort(compareChronological);
    group.forEach((line, index) => {
      const previous = index > 0 ? group[index - 1] : null;
      line.sequence = index + 1;
      line.previousPrice = previous ? previous.unitPrice : null;
      line.previousId = previous ? previous.id : null;
      line.previousSupplierName = previous ? previous.supplierName : null;
      line.change = previous ? percentChange(line.unitPrice, previous.unitPrice) : null;
    });
  }
  return byKey;
}

function compareChronological(a, b) {
  return a.date - b.date || String(a.receiptNumber || "").localeCompare(String(b.receiptNumber || "")) || String(a.id).localeCompare(String(b.id));
}

function buildDataset(rows) {
  const lines = [];
  const excluded = {};
  for (const row of rows) {
    const line = normalizeLine(row);
    if (line.excluded) excluded[line.excluded] = (excluded[line.excluded] || 0) + 1;
    else lines.push(line);
  }
  const byKey = attachHistory(lines);
  const byItem = new Map();
  for (const line of lines) {
    if (!byItem.has(line.itemId)) byItem.set(line.itemId, []);
    byItem.get(line.itemId).push(line);
  }
  for (const group of byItem.values()) group.sort(compareChronological);
  return { lines: lines.sort(compareChronological), byKey, byItem, excluded };
}

const CACHE_MS = 10000;
const cache = new Map();

async function loadDataset(db, { itemId = null, useCache = true } = {}) {
  const cacheKey = itemId || "*";
  const hit = cache.get(cacheKey);
  if (useCache && hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const promise = db.goodsReceiptItem
    .findMany({
      where: {
        qty: { gt: 0 },
        condition: { not: RETURNED },
        purchaseOrderItem: {
          partRepairId: null,
          tireRetreadId: null,
          ...(itemId ? { itemId } : {}),
          purchaseOrder: { cancelledAt: null, status: { not: "CANCELLED" } },
        },
      },
      select: LINE_SELECT,
    })
    .then(buildDataset);
  cache.set(cacheKey, { at: Date.now(), promise });
  promise.catch(() => cache.delete(cacheKey));
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return promise;
}

function clearDatasetCache() {
  cache.clear();
}

/* -------------------------------------------------------------- aggregation */

function summarize(lines) {
  let qtyMilli = 0n;
  let amountMilli = 0n;
  let latest = null;
  let lowest = null;
  let highest = null;
  const suppliers = new Set();
  const receipts = new Set();
  for (const line of lines) {
    qtyMilli += line.qtyMilli;
    amountMilli += line.amountMilli;
    suppliers.add(line.supplierId);
    if (line.receiptId) receipts.add(line.receiptId);
    if (!latest || compareChronological(line, latest) > 0) latest = line;
    if (!lowest || line.unitPrice < lowest.unitPrice || (line.unitPrice === lowest.unitPrice && line.date > lowest.date)) lowest = line;
    if (!highest || line.unitPrice > highest.unitPrice) highest = line;
  }
  return {
    count: lines.length,
    qty: Number(qtyMilli) / 1000,
    amount: rupiahFromMilli(amountMilli),
    amountMilli,
    qtyMilli,
    averagePrice: qtyMilli > 0n ? divide(amountMilli, qtyMilli, 2) : null,
    supplierCount: suppliers.size,
    receiptCount: receipts.size,
    latest,
    lowest,
    highest,
  };
}

// The comparable series for an item = its current unit, IDR, default tax basis.
function primaryKeyFor(item) {
  return `${item.id}|${String(item.unit || "PCS").trim()}|IDR|${DEFAULT_TAX_BASIS}`;
}

// Harga Referensi Pembelian: the most recent comparable purchase inside the
// look-back window, only when the window holds enough transactions.
function referencePrice(series, settings, { asOf = new Date(), excludeIds = [] } = {}) {
  const exclude = new Set(excludeIds.map(String));
  const until = asOf.getTime();
  const since = until - settings.lookbackDays * DAY;
  const usable = series.filter((line) => !exclude.has(String(line.id)) && line.date.getTime() <= until);
  const window = usable.filter((line) => line.date.getTime() >= since);
  const base = {
    method: `Harga pembelian terakhir untuk barang, satuan, mata uang, dan basis pajak yang sama, dalam ${settings.lookbackDays} hari terakhir. Minimal ${settings.minTransactions} transaksi.`,
    lookbackDays: settings.lookbackDays,
    minTransactions: settings.minTransactions,
    transactionCount: window.length,
    totalHistoryCount: usable.length,
  };
  const allTime = summarize(usable);
  const recent = summarize(window);
  const historicalMinimum = allTime.lowest ? slimLine(allTime.lowest) : null;
  if (window.length < settings.minTransactions || !recent.latest) {
    return { ...base, sufficient: false, price: null, historicalMinimum, recentAverage: recent.averagePrice, latestAnyDate: allTime.latest ? allTime.latest.date : null };
  }
  return {
    ...base,
    sufficient: true,
    price: recent.latest.unitPrice,
    supplierId: recent.latest.supplierId,
    supplierName: recent.latest.supplierName,
    date: recent.latest.date,
    priceStatus: recent.latest.priceStatus,
    poNumber: recent.latest.poNumber,
    recentAverage: recent.averagePrice,
    recentMinimum: recent.lowest ? recent.lowest.unitPrice : null,
    historicalMinimum,
  };
}

function checkPrice(series, unitPrice, settings, options = {}) {
  const reference = referencePrice(series, settings, options);
  const price = Number(unitPrice);
  if (!(price > 0) || !reference.sufficient) {
    return { level: reference.sufficient ? "none" : "insufficient", changePct: null, reference, thresholds: thresholdsOf(settings) };
  }
  const changePct = percentChange(price, reference.price);
  const level = warningLevel(changePct, settings);
  const vsAverage = reference.recentAverage ? percentChange(price, reference.recentAverage) : null;
  const vsMinimum = reference.historicalMinimum ? percentChange(price, reference.historicalMinimum.unitPrice) : null;
  return { level, changePct, vsAverage, vsMinimum, reference, thresholds: thresholdsOf(settings) };
}

const thresholdsOf = (settings) => ({ mild: settings.mildPct, strong: settings.strongPct, high: settings.highPct });

function slimLine(line) {
  if (!line) return null;
  return {
    id: line.id, date: line.date, supplierId: line.supplierId, supplierName: line.supplierName,
    unitPrice: line.unitPrice, qty: line.qty, unit: line.unit, amount: line.amount,
    poId: line.poId, poNumber: line.poNumber, receiptId: line.receiptId, receiptNumber: line.receiptNumber,
    priceStatus: line.priceStatus, change: line.change ?? null, previousPrice: line.previousPrice ?? null,
  };
}

function publicLine(line, { comparableKey } = {}) {
  return {
    ...slimLine(line),
    itemId: line.itemId,
    itemName: line.itemName,
    sku: line.sku,
    currency: line.currency,
    taxBasis: line.taxBasis,
    comparable: comparableKey ? line.key === comparableKey : true,
    priceStatusLabel: PRICE_STATUS_LABEL[line.priceStatus],
    provisionalPrice: line.provisionalPrice,
    billedQty: line.billedQty,
    invoices: line.invoices,
    deliveryNote: line.deliveryNote,
    deliveryNoteProofUrl: line.deliveryNoteProofUrl,
    deliveryNoteFileName: line.deliveryNoteFileName,
    deliveryNoteMimeType: line.deliveryNoteMimeType,
    previousSupplierName: line.previousSupplierName ?? null,
  };
}

// Per supplier figures for one comparable series inside the period.
function supplierComparison(lines, settings, asOf = new Date()) {
  const bySupplier = new Map();
  for (const line of lines) {
    if (!bySupplier.has(line.supplierId)) bySupplier.set(line.supplierId, []);
    bySupplier.get(line.supplierId).push(line);
  }
  const recentSince = asOf.getTime() - settings.lookbackDays * DAY;
  const rows = [...bySupplier.entries()].map(([supplierId, group]) => {
    const s = summarize(group);
    return {
      supplierId,
      supplierName: s.latest.supplierName,
      latestPrice: s.latest.unitPrice,
      latestDate: s.latest.date,
      latestStatus: s.latest.priceStatus,
      lowestPrice: s.lowest.unitPrice,
      lowestDate: s.lowest.date,
      averagePrice: s.averagePrice,
      transactionCount: s.count,
      qty: s.qty,
      amount: s.amount,
      recent: s.latest.date.getTime() >= recentSince,
    };
  });
  const recentRows = rows.filter((row) => row.recent);
  const pool = recentRows.length ? recentRows : rows;
  const best = pool.reduce((min, row) => (!min || row.latestPrice < min.latestPrice ? row : min), null);
  for (const row of rows) {
    row.isLowest = Boolean(best && row.supplierId === best.supplierId);
    row.differenceToLowest = best ? Math.round((row.latestPrice - best.latestPrice) * 100) / 100 : null;
    row.differenceToLowestPct = best ? percentChange(row.latestPrice, best.latestPrice) : null;
  }
  rows.sort((a, b) => a.latestPrice - b.latestPrice || a.supplierName.localeCompare(b.supplierName));
  return { rows, lowest: best, basis: recentRows.length ? "recent" : "all" };
}

// Each purchase compared with the cheapest comparable purchase recorded
// earlier inside the look-back window. Never uses later purchases.
function overpaidPurchases(dataset, settings, filter = () => true) {
  const results = [];
  for (const series of dataset.byKey.values()) {
    for (let i = 0; i < series.length; i += 1) {
      const line = series[i];
      if (!filter(line)) continue;
      const since = line.date.getTime() - settings.lookbackDays * DAY;
      let reference = null;
      for (let j = i - 1; j >= 0; j -= 1) {
        const earlier = series[j];
        if (earlier.date.getTime() < since) break;
        if (!reference || earlier.unitPrice < reference.unitPrice) reference = earlier;
      }
      if (!reference) continue;
      const differencePct = percentChange(line.unitPrice, reference.unitPrice);
      if (differencePct == null || differencePct <= settings.mildPct) continue;
      // (price − reference) × qty, exact: amount − reference × qty.
      const referenceAmountMilli = line.qtyMilli * BigInt(Math.round(reference.unitPrice * 100)) / 100n;
      const savingsMilli = line.amountMilli - referenceAmountMilli;
      if (savingsMilli <= 0n) continue;
      results.push({
        ...slimLine(line),
        itemId: line.itemId, itemName: line.itemName, sku: line.sku, category: line.category,
        referencePrice: reference.unitPrice,
        referenceSupplierId: reference.supplierId,
        referenceSupplierName: reference.supplierName,
        referenceDate: reference.date,
        referencePoNumber: reference.poNumber,
        difference: Math.round((line.unitPrice - reference.unitPrice) * 100) / 100,
        differencePct,
        savings: rupiahFromMilli(savingsMilli),
        savingsMilli,
        level: warningLevel(differencePct, settings),
      });
    }
  }
  return results.sort((a, b) => (b.savingsMilli > a.savingsMilli ? 1 : b.savingsMilli < a.savingsMilli ? -1 : 0));
}

/* ------------------------------------------------------------------- search */

const fold = (value) => String(value || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("id-ID");
const compact = (value) => fold(value).replace(/[^a-z0-9]/g, "");

function searchItems(items, query, limit = 10) {
  const tokens = fold(query).split(/[\s,]+/).filter(Boolean).slice(0, 8);
  if (!tokens.length) return [];
  const whole = fold(query).trim();
  const wholeCompact = compact(query);
  const results = [];
  for (const item of items) {
    const fields = {
      name: fold(item.name), sku: fold(item.sku), brand: fold(item.brand), partNumber: fold(item.partNumber),
      aliases: (item.aliases || []).map(fold),
    };
    const haystack = [fields.name, fields.sku, fields.brand, fields.partNumber, ...fields.aliases].join(" \u0001 ");
    const compactHay = [item.name, item.sku, item.brand, item.partNumber, ...(item.aliases || [])].map(compact).join("\u0001");
    const allMatch = tokens.every((token) => haystack.includes(token) || (token.length > 2 && compactHay.includes(compact(token))));
    if (!allMatch) continue;
    let score = 0;
    let matchedOn = "name";
    const codeHit = (value) => value && (value === whole || compact(value) === wholeCompact);
    if (codeHit(fields.sku)) { score += 100; matchedOn = "sku"; }
    else if (codeHit(fields.partNumber)) { score += 95; matchedOn = "partNumber"; }
    if (fields.name === whole) score += 80;
    else if (fields.name.startsWith(whole)) score += 60;
    else if (fields.name.includes(whole)) score += 40;
    else if (tokens.every((token) => fields.name.includes(token))) score += 30;
    else if (fields.aliases.some((alias) => alias.includes(whole))) { score += 25; matchedOn = "alias"; }
    else if (fields.partNumber.includes(whole) || compact(fields.partNumber).includes(wholeCompact)) { score += 22; if (matchedOn === "name") matchedOn = "partNumber"; }
    else if (fields.sku.includes(whole) || compact(fields.sku).includes(wholeCompact)) { score += 20; if (matchedOn === "name") matchedOn = "sku"; }
    else if (fields.brand.includes(whole)) { score += 15; matchedOn = "brand"; }
    const alias = matchedOn === "alias" ? (item.aliases || []).find((value) => fold(value).includes(whole)) : null;
    results.push({ item, score, matchedOn, alias });
  }
  results.sort((a, b) => b.score - a.score || (b.item.historyCount || 0) - (a.item.historyCount || 0) || String(a.item.name).localeCompare(String(b.item.name)));
  return results.slice(0, limit);
}

/* ------------------------------------------------------------------- export */

function csvCell(value) {
  let text = value == null ? "" : String(value);
  // Block spreadsheet formulas in text cells; plain numbers stay numbers.
  if (typeof value !== "number" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const EXPORT_HEADINGS = ["Tanggal terima", "Supplier", "Barang", "SKU", "No. PO", "No. Penerimaan", "Invoice", "Jumlah", "Satuan", "Harga satuan (Rp)", "Total (Rp)", "Perubahan (%)", "Status harga"];

function exportRows(lines) {
  return lines.map((line) => [
    wibDay(line.date), line.supplierName, line.itemName, line.sku || "", line.poNumber || "", line.receiptNumber || "",
    (line.invoices || []).map((invoice) => invoice.invoiceNumber).join("; "),
    line.qty, line.unit, line.unitPrice, line.amount, line.change == null ? "" : line.change, PRICE_STATUS_LABEL[line.priceStatus] || line.priceStatus,
  ]);
}

function toCsv(lines) {
  return `﻿${[EXPORT_HEADINGS, ...exportRows(lines)].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

module.exports = {
  DEFAULT_SETTINGS,
  PRICE_STATUS_LABEL,
  AnalyticsInputError,
  EXPORT_HEADINGS,
  toMilli,
  divide,
  percentChange,
  parseDay,
  parsePeriod,
  parsePaging,
  paginate,
  inPeriod,
  wibDay,
  wibMonth,
  cleanSettings,
  loadSettings,
  warningLevel,
  normalizeLine,
  attachHistory,
  buildDataset,
  loadDataset,
  clearDatasetCache,
  summarize,
  primaryKeyFor,
  referencePrice,
  checkPrice,
  supplierComparison,
  overpaidPurchases,
  slimLine,
  publicLine,
  searchItems,
  exportRows,
  toCsv,
};
