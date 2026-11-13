// Analitik Harga Sparepart — tests. Run: npm test (from backend/).
// Uses in-memory fixtures only; no database connection is opened.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const pa = require("../src/services/priceAnalytics");

const S = { ...pa.DEFAULT_SETTINGS };
let seq = 0;

// Builds a GoodsReceiptItem row shaped like the Prisma select in the service.
function row(o = {}) {
  seq += 1;
  const id = o.id || `gri-${seq}`;
  const price = o.price === undefined ? 100000 : o.price;
  const itemId = o.item || "item-1";
  const supplierId = o.supplier || "sup-1";
  return {
    id,
    qty: o.qty ?? 10,
    condition: o.condition || "GOOD",
    originalUnitPrice: o.legacy ? null : price,
    purchaseUnit: o.legacy ? null : (o.unit || "pcs"),
    priceSource: o.legacy ? null : "RECEIPT_SNAPSHOT",
    currency: o.currency || "IDR",
    taxBasis: o.taxBasis || "BEFORE_ORDER_ADJUSTMENTS",
    receipt: { id: o.receiptId || `gr-${seq}`, number: o.receiptNumber || `GR-${String(seq).padStart(4, "0")}`, receivedAt: new Date(`${o.date || "2026-06-01"}T${o.time || "03:00"}:00Z`) },
    purchaseOrderItem: {
      id: o.poItemId || `poi-${seq}`,
      itemId,
      partRepairId: o.repair ? "rep-1" : null,
      tireRetreadId: null,
      item: { id: itemId, name: o.itemName || "Filter Solar", sku: o.sku || "FS-1", brand: null, partNumber: null, category: "GENERAL_SPAREPART", unit: o.itemUnit || "pcs" },
      purchaseOrder: { id: o.poId || `po-${seq}`, number: o.poNumber || `PO-${seq}`, status: o.poStatus || "FULLY_RECEIVED", cancelledAt: o.cancelledAt || null, supplierId, supplier: { id: supplierId, name: o.supplierName || `Supplier ${supplierId}` } },
    },
    inventoryBatch: o.batchPrice === undefined ? { unitPrice: price } : { unitPrice: o.batchPrice },
    supplierBillItems: (o.bills || []).map((bill, i) => ({
      id: `sbi-${seq}-${i}`, qty: bill.qty, unitPrice: bill.price,
      bill: { id: `bill-${seq}-${i}`, number: `BILL-${seq}-${i}`, invoiceNumber: bill.invoice || `INV-${seq}-${i}`, invoiceDate: new Date("2026-06-05"), status: bill.status || "OPEN" },
    })),
  };
}
const dataset = (rows) => pa.buildDataset(rows);
const seriesOf = (data, itemId = "item-1", unit = "pcs") => data.byKey.get(`${itemId}|${unit}|IDR|BEFORE_ORDER_ADJUSTMENTS`) || [];

describe("transaksi yang dihitung", () => {
  test("harga invoice menggantikan harga sementara penerimaan", () => {
    const line = pa.normalizeLine(row({ price: 100000, bills: [{ qty: 10, price: 95000 }] }));
    assert.equal(line.unitPrice, 95000);
    assert.equal(line.priceStatus, "INVOICE");
    assert.equal(line.amount, 950000);
  });

  test("invoice sebagian: harga ditimbang menurut jumlah", () => {
    const line = pa.normalizeLine(row({ qty: 10, price: 100000, bills: [{ qty: 4, price: 90000 }] }));
    assert.equal(line.priceStatus, "PARTIAL_INVOICE");
    assert.equal(line.amount, 4 * 90000 + 6 * 100000);
    assert.equal(line.unitPrice, 96000);
  });

  test("invoice VOID diabaikan", () => {
    const line = pa.normalizeLine(row({ price: 100000, bills: [{ qty: 10, price: 50000, status: "VOID" }] }));
    assert.equal(line.unitPrice, 100000);
    assert.equal(line.priceStatus, "RECEIPT");
  });

  test("PO dibatalkan, retur ke supplier, dan jasa perbaikan tidak dihitung", () => {
    assert.equal(pa.normalizeLine(row({ poStatus: "CANCELLED" })).excluded, "CANCELLED");
    assert.equal(pa.normalizeLine(row({ cancelledAt: new Date() })).excluded, "CANCELLED");
    assert.equal(pa.normalizeLine(row({ condition: "RETURNED_TO_SUPPLIER" })).excluded, "RETURNED");
    assert.equal(pa.normalizeLine(row({ repair: true })).excluded, "SERVICE");
  });

  test("harga, jumlah, atau tanggal kosong ditangani tanpa error", () => {
    assert.equal(pa.normalizeLine(row({ legacy: true, batchPrice: null })).excluded, "NO_PRICE");
    assert.equal(pa.normalizeLine(row({ qty: 0 })).excluded, "NO_QTY");
    const noDate = row();
    noDate.receipt.receivedAt = null;
    assert.equal(pa.normalizeLine(noDate).excluded, "NO_DATE");
    const noSupplier = row();
    noSupplier.purchaseOrderItem.purchaseOrder.supplierId = null;
    assert.equal(pa.normalizeLine(noSupplier).excluded, "NO_SUPPLIER");
  });

  test("arsip lama memakai harga batch stok", () => {
    const line = pa.normalizeLine(row({ legacy: true, batchPrice: 87000 }));
    assert.equal(line.unitPrice, 87000);
    assert.equal(line.priceStatus, "LEGACY");
    assert.equal(line.unit, "pcs");
  });

  test("tagihan melebihi jumlah diterima dianggap data tidak valid", () => {
    assert.equal(pa.normalizeLine(row({ qty: 5, bills: [{ qty: 6, price: 90000 }] })).excluded, "OVER_INVOICED");
  });

  test("tidak ada transaksi ganda: dua invoice untuk satu penerimaan tetap satu transaksi", () => {
    const data = dataset([row({ qty: 10, bills: [{ qty: 6, price: 90000 }, { qty: 4, price: 95000 }] })]);
    assert.equal(data.lines.length, 1);
    assert.equal(data.lines[0].amount, 6 * 90000 + 4 * 95000);
  });

  test("penerimaan sebagian: setiap penerimaan menjadi transaksi dengan jumlahnya sendiri", () => {
    const data = dataset([
      row({ poItemId: "poi-x", poId: "po-x", qty: 4, date: "2026-06-01", price: 100000 }),
      row({ poItemId: "poi-x", poId: "po-x", qty: 3, date: "2026-06-10", price: 100000 }),
    ]);
    const s = pa.summarize(data.lines);
    assert.equal(s.count, 2);
    assert.equal(s.qty, 7); // the 3 still on order are not counted
  });
});

describe("perhitungan harga", () => {
  test("rata-rata tertimbang memakai jumlah dan tetap tepat untuk desimal", () => {
    const data = dataset([
      row({ qty: 0.1, price: 3 }), row({ qty: 0.2, price: 3 }),
      row({ qty: 10, price: 100 }), row({ qty: 30, price: 200 }),
    ]);
    const s = pa.summarize(data.lines);
    assert.equal(s.qty, 40.3);
    // (0.3×3 + 10×100 + 30×200) / 40.3 = 7000.9 / 40.3
    assert.equal(s.amount, 7001);
    assert.equal(s.averagePrice, 173.72);
  });

  test("perubahan dihitung terhadap pembelian sebelumnya secara kronologis", () => {
    const data = dataset([
      row({ date: "2026-03-01", price: 180000, supplier: "A" }),
      row({ date: "2026-01-01", price: 175000, supplier: "B" }),
      row({ date: "2026-05-01", price: 185000, supplier: "A" }),
    ]);
    const [a, b, c] = seriesOf(data);
    assert.equal(a.change, null);
    assert.equal(b.change, 2.86);
    assert.equal(c.change, 2.78);
    assert.equal(c.previousSupplierName, "Supplier A");
  });

  test("pembelian di hari yang sama tetap dua titik terpisah", () => {
    const data = dataset([row({ date: "2026-04-01", price: 100, receiptNumber: "GR-1" }), row({ date: "2026-04-01", price: 110, receiptNumber: "GR-2" })]);
    const series = seriesOf(data);
    assert.equal(series.length, 2);
    assert.equal(series[1].change, 10);
  });

  test("satuan, mata uang, dan basis pajak berbeda tidak dibandingkan", () => {
    const data = dataset([
      row({ price: 100000 }),
      row({ price: 1200000, unit: "box" }),
      row({ price: 90000, currency: "USD" }),
      row({ price: 110000, taxBasis: "INCLUDING_TAX" }),
      row({ price: 105000 }),
    ]);
    const series = seriesOf(data);
    assert.equal(series.length, 2);
    assert.equal(series[1].change, 5);
    assert.equal(data.byKey.size, 4);
  });

  test("barang dengan nama mirip tetap terpisah", () => {
    const data = dataset([row({ item: "fs-sakura", itemName: "Filter Solar Hino" }), row({ item: "fs-genuine", itemName: "Filter Solar Hino" })]);
    assert.equal(data.byItem.size, 2);
  });
});

describe("referensi dan peringatan", () => {
  const recent = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

  test("harga referensi = pembelian sebanding terakhir dalam periode pembanding", () => {
    const data = dataset([
      row({ date: recent(400), price: 150000 }),
      row({ date: recent(60), price: 175000, supplier: "B", supplierName: "Supplier B" }),
      row({ date: recent(20), price: 180000, supplier: "A", supplierName: "Supplier A" }),
    ]);
    const ref = pa.referencePrice(seriesOf(data), S);
    assert.equal(ref.sufficient, true);
    assert.equal(ref.price, 180000);
    assert.equal(ref.supplierName, "Supplier A");
    assert.equal(ref.transactionCount, 2);
    assert.equal(ref.historicalMinimum.unitPrice, 150000);
  });

  test("data kurang: tidak ada harga referensi yang dibuat-buat", () => {
    const one = dataset([row({ date: recent(10), price: 100000 })]);
    const ref = pa.referencePrice(seriesOf(one), S);
    assert.equal(ref.sufficient, false);
    assert.equal(ref.price, null);
    const none = pa.referencePrice([], S);
    assert.equal(none.sufficient, false);
    assert.equal(pa.checkPrice([], 100000, S).level, "insufficient");
  });

  test("peringatan PO: 16,7% di atas referensi Rp180.000 = kuat", () => {
    const data = dataset([row({ date: recent(40), price: 175000 }), row({ date: recent(10), price: 180000 })]);
    const result = pa.checkPrice(seriesOf(data), 210000, S);
    assert.equal(result.changePct, 16.67);
    assert.equal(result.level, "strong");
    assert.equal(result.reference.price, 180000);
  });

  test("ambang dapat diatur dan memakai batas 'lebih dari'", () => {
    const custom = pa.cleanSettings({ mildPct: 4, strongPct: 8, highPct: 15 });
    assert.equal(pa.warningLevel(4, custom), "normal");
    assert.equal(pa.warningLevel(4.01, custom), "mild");
    assert.equal(pa.warningLevel(9, custom), "strong");
    assert.equal(pa.warningLevel(15.5, custom), "high");
    assert.equal(pa.warningLevel(-6, custom), "lower");
    assert.throws(() => pa.cleanSettings({ mildPct: 10, strongPct: 5 }), /berurutan/);
    assert.throws(() => pa.cleanSettings({ lookbackDays: 2 }));
  });

  test("baris yang sedang ditagih bisa dikecualikan dari pembanding", () => {
    const data = dataset([row({ id: "old", date: recent(40), price: 175000 }), row({ id: "old2", date: recent(30), price: 176000 }), row({ id: "self", date: recent(5), price: 250000 })]);
    const result = pa.checkPrice(seriesOf(data), 250000, S, { excludeIds: ["self"] });
    assert.equal(result.reference.price, 176000);
    assert.equal(result.level, "high");
  });
});

describe("supplier dan penghematan", () => {
  test("perbandingan supplier menandai harga terakhir terendah", () => {
    const today = new Date().toISOString().slice(0, 10);
    const data = dataset([
      row({ supplier: "A", supplierName: "Supplier A", price: 180000, date: today }),
      row({ supplier: "A", supplierName: "Supplier A", price: 185000, date: today, time: "05:00" }),
      row({ supplier: "B", supplierName: "Supplier B", price: 175000, date: today }),
      row({ supplier: "C", supplierName: "Supplier C", price: 192000, date: today }),
    ]);
    const { rows, lowest } = pa.supplierComparison(seriesOf(data), S);
    assert.equal(lowest.supplierName, "Supplier B");
    assert.deepEqual(rows.map((r) => r.supplierName), ["Supplier B", "Supplier A", "Supplier C"]);
    const a = rows.find((r) => r.supplierName === "Supplier A");
    assert.equal(a.latestPrice, 185000);
    assert.equal(a.averagePrice, 182500);
    assert.equal(a.transactionCount, 2);
    assert.equal(a.differenceToLowest, 10000);
  });

  test("estimasi hemat = selisih × jumlah aktual, hanya terhadap pembelian sebelumnya", () => {
    const data = dataset([
      row({ date: "2026-01-10", price: 175000, supplier: "B" }),
      row({ date: "2026-02-10", price: 210000, qty: 10, supplier: "A" }),
      row({ date: "2026-03-10", price: 150000, supplier: "C" }), // later: must not count for February
    ]);
    const result = pa.overpaidPurchases(data, S);
    assert.equal(result.length, 1);
    assert.equal(result[0].referencePrice, 175000);
    assert.equal(result[0].difference, 35000);
    assert.equal(result[0].savings, 350000);
  });

  test("pembanding di luar periode pembanding tidak dipakai", () => {
    const data = dataset([row({ date: "2025-01-01", price: 100000 }), row({ date: "2026-06-01", price: 150000 })]);
    assert.equal(pa.overpaidPurchases(data, S).length, 0);
  });

  test("selisih kecil di bawah ambang ringan tidak dianggap peluang", () => {
    const data = dataset([row({ date: "2026-01-10", price: 100000 }), row({ date: "2026-01-20", price: 104000 })]);
    assert.equal(pa.overpaidPurchases(data, S).length, 0);
  });
});

describe("pencarian, tanggal, ekspor", () => {
  const items = [
    { id: "1", name: "Filter Solar Hino 500", sku: "SP-FS-1503", brand: "Sakura", partNumber: "FC-1503", aliases: ["Saringan solar"] },
    { id: "2", name: "Filter Solar Hino 500 Genuine", sku: "SP-FS-1440", brand: "Hino", partNumber: "23401-1440", aliases: [] },
    { id: "3", name: "Kampas Rem", sku: "KR-1", brand: "Indopart", partNumber: null, aliases: [] },
  ];
  test("sebagian kata, huruf besar/kecil, SKU, nomor part, merek, dan alias", () => {
    assert.deepEqual(pa.searchItems(items, "filter solar").map((r) => r.item.id), ["1", "2"]);
    assert.equal(pa.searchItems(items, "FC1503")[0].item.id, "1");
    assert.equal(pa.searchItems(items, "23401-1440")[0].matchedOn, "partNumber");
    assert.equal(pa.searchItems(items, "sp-fs-1440")[0].matchedOn, "sku");
    assert.equal(pa.searchItems(items, "saringan")[0].matchedOn, "alias");
    assert.equal(pa.searchItems(items, "INDOPART")[0].item.id, "3");
    assert.equal(pa.searchItems(items, "solar kampas").length, 0);
  });

  test("tanggal memakai hari WIB dan tanggal tidak valid ditolak", () => {
    assert.equal(pa.parseDay("2026-11-01").toISOString(), "2026-10-31T17:00:00.000Z");
    assert.equal(pa.parseDay("2026-11-01", true).toISOString(), "2026-11-01T16:59:59.999Z");
    assert.throws(() => pa.parseDay("2026-02-30"));
    assert.throws(() => pa.parsePeriod({ from: "2026-11-10", to: "2026-11-01" }));
    assert.deepEqual(pa.parsePaging({ page: -3, limit: 9999 }), { page: 1, limit: 100 });
  });

  test("ekspor CSV mencegah formula tetapi angka negatif tetap angka", () => {
    const data = dataset([row({ date: "2026-01-01", price: 100, supplierName: "=HYPERLINK(1)" }), row({ date: "2026-02-01", price: 90, supplierName: "=HYPERLINK(1)" })]);
    const csv = pa.toCsv(data.lines);
    assert.match(csv, /"'=HYPERLINK\(1\)"/);
    assert.match(csv, /"-10"/);
  });
});

/* ------------------------------------------------- API: roles + responses */

describe("API dan hak akses", () => {
  let server;
  let base;
  const jwt = require("jsonwebtoken");
  const users = {
    owner: { id: "u-owner", name: "Owner", email: "o@x", role: "OWNER", isActive: true, status: "ACTIVE" },
    staff: { id: "u-staff", name: "Staff", email: "s@x", role: "STAFF", isActive: true, status: "ACTIVE" },
    gudang: { id: "u-gudang", name: "Gudang", email: "g@x", role: "SPAREPART_ADMIN", isActive: true, status: "ACTIVE" },
    driver: { id: "u-driver", name: "Driver", email: "d@x", role: "DRIVER", isActive: true, status: "ACTIVE" },
  };
  const recent = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
  const rows = [
    row({ item: "fs", date: recent(60), price: 175000, supplier: "B", supplierName: "Supplier B" }),
    row({ item: "fs", date: recent(30), price: 180000, supplier: "A", supplierName: "Supplier A" }),
    row({ item: "fs", date: recent(5), price: 182000, supplier: "A", supplierName: "Supplier A", poStatus: "CANCELLED" }),
  ];
  let savedSettings = null;
  const db = {
    user: { findUnique: async ({ where }) => Object.values(users).find((u) => u.id === where.id) || null },
    goodsReceiptItem: { findMany: async () => rows },
    item: {
      findUnique: async ({ where }) => (where.id === "fs" ? { id: "fs", name: "Filter Solar", sku: "FS-1", unit: "pcs", isSerialized: false, category: "GENERAL_SPAREPART", aliases: [], stocks: [{ qty: 7 }], stockUnits: [] } : null),
      findMany: async () => [{ id: "fs", name: "Filter Solar", sku: "FS-1", brand: null, partNumber: null, aliases: [], category: "GENERAL_SPAREPART", unit: "pcs" }],
    },
    supplier: { findUnique: async () => null },
    priceAnalyticsSetting: {
      findUnique: async () => savedSettings,
      upsert: async ({ create }) => { savedSettings = { ...create, updatedAt: new Date() }; return savedSettings; },
    },
  };

  before(async () => {
    process.env.JWT_SECRET = "price-analytics-test";
    // authRequired loads ../src/prisma; give it the in-memory db instead.
    const prismaPath = path.join(__dirname, "../src/prisma.js");
    require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma: db } };
    const express = require("express");
    const { createPriceAnalyticsRouter } = require("../src/routes/priceAnalytics");
    pa.clearDatasetCache();
    const app = express();
    app.use(express.json());
    app.use("/price-analytics", createPriceAnalyticsRouter(db));
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    base = `http://127.0.0.1:${server.address().port}/price-analytics`;
  });
  after(() => server && server.close());

  const call = (who, urlPath, options = {}) => fetch(base + urlPath, {
    ...options,
    headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${jwt.sign({ id: users[who].id }, process.env.JWT_SECRET)}` } : {}) },
  });

  test("tanpa login 401, driver 403, staf pembelian boleh melihat", async () => {
    assert.equal((await call(null, "/overview")).status, 401);
    assert.equal((await call("driver", "/overview")).status, 403);
    assert.equal((await call("staff", "/overview")).status, 200);
    assert.equal((await call("gudang", "/overview")).status, 200);
  });

  test("hanya Owner/Admin yang dapat mengubah ambang", async () => {
    const body = JSON.stringify({ mildPct: 6, strongPct: 12, highPct: 22 });
    assert.equal((await call("staff", "/settings", { method: "PUT", body })).status, 403);
    assert.equal((await call("gudang", "/settings", { method: "PUT", body })).status, 403);
    const ok = await call("owner", "/settings", { method: "PUT", body });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).settings.mildPct, 6);
    const bad = await call("owner", "/settings", { method: "PUT", body: JSON.stringify({ mildPct: 30, strongPct: 12, highPct: 22 }) });
    assert.equal(bad.status, 400);
    savedSettings = null;
  });

  test("cek harga PO memberi peringatan dan mengabaikan PO batal", async () => {
    const res = await call("staff", "/check-price", { method: "POST", body: JSON.stringify({ itemId: "fs", unitPrice: 210000 }) });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.reference.price, 180000); // cancelled 182.000 ignored
    assert.equal(data.changePct, 16.67);
    assert.equal(data.level, "strong");
    const unit = await (await call("staff", "/check-price", { method: "POST", body: JSON.stringify({ itemId: "fs", unitPrice: 210000, unit: "box" }) })).json();
    assert.equal(unit.level, "incomparable");
  });

  test("ringkasan sparepart dan validasi input", async () => {
    const detail = await (await call("staff", "/items/fs")).json();
    assert.equal(detail.item.stock, 7);
    assert.equal(detail.summary.count, 2);
    assert.equal(detail.summary.averagePrice, 177500);
    assert.equal((await call("staff", "/items/none")).status, 404);
    assert.equal((await call("staff", "/overview?from=2026-02-31")).status, 400);
  });
});
