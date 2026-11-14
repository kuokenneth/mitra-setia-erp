// Analitik Harga Sparepart — API. Calculations live in ../services/priceAnalytics.
const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");
const pa = require("../services/priceAnalytics");

const ACCESS_ROLES = ["OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"];
const SETTINGS_ROLES = ["OWNER", "ADMIN"];
const EXPORT_LIMIT = 20000;
const DAY = 86400000;

function createPriceAnalyticsRouter(db = prisma) {
  const router = express.Router();
  router.use(authRequired, requireRole(...ACCESS_ROLES));

  const handle = (fn) => async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };

  const dataset = (options) => pa.loadDataset(db, options);

  /* ------------------------------------------------------------ meta + settings */

  router.get("/meta", handle(async (req, res) => {
    const [data, settings] = await Promise.all([dataset(), pa.loadSettings(db)]);
    const suppliers = new Map();
    for (const line of data.lines) suppliers.set(line.supplierId, line.supplierName);
    res.json({
      suppliers: [...suppliers.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "id")),
      settings,
      canEditSettings: SETTINGS_ROLES.includes(req.user.role),
      firstDate: data.lines[0]?.date || null,
      lastDate: data.lines[data.lines.length - 1]?.date || null,
      transactionCount: data.lines.length,
    });
  }));

  router.get("/settings", handle(async (req, res) => {
    res.json({ settings: await pa.loadSettings(db), canEditSettings: SETTINGS_ROLES.includes(req.user.role) });
  }));

  router.put("/settings", requireRole(...SETTINGS_ROLES), handle(async (req, res) => {
    if (!db.priceAnalyticsSetting) {
      return res.status(503).json({ error: "Tabel pengaturan belum tersedia. Jalankan migrasi database terlebih dahulu." });
    }
    const current = await pa.loadSettings(db);
    const next = pa.cleanSettings(req.body || {}, current);
    const data = { ...next, updatedById: req.user.id, updatedByName: req.user.name || req.user.email || null };
    await db.priceAnalyticsSetting.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
    res.json({ settings: await pa.loadSettings(db) });
  }));

  /* -------------------------------------------------------------------- search */

  router.get("/search", handle(async (req, res) => {
    const q = String(req.query.q || "").trim().slice(0, 120);
    if (!q) return res.json({ items: [] });
    const [items, data] = await Promise.all([
      db.item.findMany({ select: { id: true, name: true, sku: true, brand: true, partNumber: true, aliases: true, category: true, unit: true } }),
      dataset(),
    ]);
    for (const item of items) {
      const series = data.byKey.get(pa.primaryKeyFor(item)) || [];
      const latest = series[series.length - 1];
      item.historyCount = (data.byItem.get(item.id) || []).length;
      item.latestPrice = latest ? latest.unitPrice : null;
      item.latestDate = latest ? latest.date : null;
      item.latestSupplierName = latest ? latest.supplierName : null;
    }
    const matches = pa.searchItems(items, q, Math.min(20, Number(req.query.limit) || 10));
    res.json({
      items: matches.map(({ item, matchedOn, alias }) => ({
        id: item.id, name: item.name, sku: item.sku, brand: item.brand, partNumber: item.partNumber, category: item.category, unit: item.unit,
        historyCount: item.historyCount, latestPrice: item.latestPrice, latestDate: item.latestDate, latestSupplierName: item.latestSupplierName,
        matchedOn, alias,
      })),
    });
  }));

  /* ------------------------------------------------------------------ overview */

  function filterLines(data, query) {
    const period = pa.parsePeriod(query);
    const category = String(query.category || "");
    const supplierId = String(query.supplierId || "");
    return {
      period,
      lines: data.lines.filter((line) => pa.inPeriod(line, period) && (!category || line.category === category) && (!supplierId || line.supplierId === supplierId)),
    };
  }

  function itemRows(lines) {
    const groups = new Map();
    for (const line of lines) {
      if (!groups.has(line.key)) groups.set(line.key, []);
      groups.get(line.key).push(line);
    }
    return [...groups.entries()].map(([key, group]) => {
      const s = pa.summarize(group);
      return {
        key,
        itemId: s.latest.itemId,
        itemName: s.latest.itemName,
        sku: s.latest.sku,
        brand: s.latest.brand,
        partNumber: s.latest.partNumber,
        category: s.latest.category,
        unit: s.latest.unit,
        transactionCount: s.count,
        qty: s.qty,
        amount: s.amount,
        amountMilli: s.amountMilli,
        averagePrice: s.averagePrice,
        lowestPrice: s.lowest.unitPrice,
        latestPrice: s.latest.unitPrice,
        latestDate: s.latest.date,
        latestSupplierName: s.latest.supplierName,
        previousPrice: s.latest.previousPrice,
        change: s.latest.change,
        supplierCount: s.supplierCount,
        lines: group,
      };
    });
  }

  const sorters = {
    value: (a, b) => (b.amountMilli > a.amountMilli ? 1 : b.amountMilli < a.amountMilli ? -1 : 0),
    increase: (a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity),
    decrease: (a, b) => (a.change ?? Infinity) - (b.change ?? Infinity),
    recent: (a, b) => b.latestDate - a.latestDate,
    frequency: (a, b) => b.transactionCount - a.transactionCount,
    name: (a, b) => a.itemName.localeCompare(b.itemName, "id"),
  };

  const stripLines = ({ lines, amountMilli, ...row }) => row;

  function monthlySeries(lines, period) {
    const totals = new Map();
    for (const line of lines) {
      const month = pa.wibMonth(line.date);
      totals.set(month, (totals.get(month) || 0n) + line.amountMilli);
    }
    if (!lines.length) return [];
    const first = pa.wibMonth(period.from || lines[0].date);
    const last = pa.wibMonth(period.to && period.to < new Date() ? period.to : lines.reduce((max, l) => (l.date > max ? l.date : max), lines[0].date));
    const months = [];
    let [y, m] = first.split("-").map(Number);
    const [ly, lm] = last.split("-").map(Number);
    while ((y < ly || (y === ly && m <= lm)) && months.length < 60) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      months.push({ month: key, amount: pa.divide(totals.get(key) || 0n, 1000n, 0) });
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return months.slice(-24);
  }

  router.get("/overview", handle(async (req, res) => {
    const [data, settings] = await Promise.all([dataset(), pa.loadSettings(db)]);
    const { period, lines } = filterLines(data, req.query);
    let rows = itemRows(lines);
    if (req.query.direction === "up") rows = rows.filter((row) => row.change > 0);
    if (req.query.direction === "down") rows = rows.filter((row) => row.change < 0);
    const selected = new Set(rows.flatMap((row) => row.lines.map((line) => line.id)));
    const selectedLines = lines.filter((line) => selected.has(line.id));
    const savings = pa.overpaidPurchases(data, settings, (line) => selected.has(line.id));

    let totalMilli = 0n;
    const supplierTotals = new Map();
    for (const line of selectedLines) {
      totalMilli += line.amountMilli;
      const current = supplierTotals.get(line.supplierId) || { supplierId: line.supplierId, supplierName: line.supplierName, amountMilli: 0n, count: 0 };
      current.amountMilli += line.amountMilli;
      current.count += 1;
      supplierTotals.set(line.supplierId, current);
    }
    const topSuppliers = [...supplierTotals.values()]
      .sort((a, b) => (b.amountMilli > a.amountMilli ? 1 : -1))
      .slice(0, 6)
      .map((row) => ({ supplierId: row.supplierId, supplierName: row.supplierName, transactionCount: row.count, amount: pa.divide(row.amountMilli, 1000n, 0), share: totalMilli ? pa.divide(row.amountMilli * 100n, totalMilli, 1) : 0 }));

    rows.sort(sorters[req.query.sort] || sorters.value);
    const page = pa.paginate(rows, pa.parsePaging(req.query, 12));
    const notInvoiced = selectedLines.filter((line) => line.priceStatus !== "INVOICE").length;
    res.json({
      kpis: {
        itemCount: new Set(rows.map((row) => row.itemId)).size,
        totalValue: pa.divide(totalMilli, 1000n, 0),
        transactionCount: selectedLines.length,
        increasedCount: new Set(rows.filter((row) => row.change > 0).map((row) => row.itemId)).size,
        decreasedCount: new Set(rows.filter((row) => row.change < 0).map((row) => row.itemId)).size,
        potentialSavings: pa.divide(savings.reduce((sum, row) => sum + row.savingsMilli, 0n), 1000n, 0),
        savingsCount: savings.length,
        supplierCount: supplierTotals.size,
      },
      items: page.items.map(stripLines),
      pagination: page.pagination,
      monthly: monthlySeries(selectedLines, period),
      topSuppliers,
      quality: { notInvoiced, excluded: data.excluded },
      settings: { lookbackDays: settings.lookbackDays, mildPct: settings.mildPct },
    });
  }));

  /* -------------------------------------------------------------- opportunities */

  router.get("/opportunities", handle(async (req, res) => {
    const [data, settings] = await Promise.all([dataset(), pa.loadSettings(db)]);
    const { period, lines } = filterLines(data, req.query);
    const ids = new Set(lines.map((line) => line.id));
    const rows = itemRows(lines);
    const strip = (row) => stripLines(row);

    const overpaid = pa.overpaidPurchases(data, settings, (line) => ids.has(line.id)).map(({ savingsMilli, ...row }) => row);

    const increases = rows
      .filter((row) => row.change != null && row.change > settings.mildPct)
      .sort(sorters.increase)
      .map((row) => {
        const latest = row.lines.reduce((a, b) => (b.date > a.date ? b : a));
        return { ...strip(row), previousSupplierName: latest.previousSupplierName, level: pa.warningLevel(row.change, settings) };
      });

    const spreads = [];
    for (const row of rows) {
      if (row.supplierCount < 2) continue;
      const comparison = pa.supplierComparison(row.lines, settings, period.to && period.to < new Date() ? period.to : new Date());
      const prices = comparison.rows.map((r) => r.latestPrice);
      const low = Math.min(...prices);
      const high = Math.max(...prices);
      const spreadPct = pa.percentChange(high, low);
      if (spreadPct == null || spreadPct <= settings.mildPct) continue;
      const best = comparison.lowest;
      let potential = 0n;
      for (const line of row.lines) {
        if (line.supplierId === best.supplierId) continue;
        const bestAmount = line.qtyMilli * BigInt(Math.round(best.latestPrice * 100)) / 100n;
        if (line.amountMilli > bestAmount) potential += line.amountMilli - bestAmount;
      }
      const highest = comparison.rows[comparison.rows.length - 1];
      spreads.push({
        ...strip(row), lowestSupplierName: best.supplierName, lowestSupplierPrice: best.latestPrice,
        highestSupplierName: highest.supplierName, highestSupplierPrice: highest.latestPrice, spreadPct,
        potentialSavings: pa.divide(potential, 1000n, 0), potentialMilli: potential,
      });
    }
    spreads.sort((a, b) => (b.potentialMilli > a.potentialMilli ? 1 : b.potentialMilli < a.potentialMilli ? -1 : b.spreadPct - a.spreadPct));

    // High annual spend: the 12 months up to the end of the period.
    const yearEnd = period.to && period.to < new Date() ? period.to : new Date();
    const yearLines = data.lines.filter((line) => line.date <= yearEnd && line.date.getTime() > yearEnd.getTime() - 365 * DAY
      && (!req.query.category || line.category === req.query.category) && (!req.query.supplierId || line.supplierId === req.query.supplierId));
    const spend = itemRows(yearLines).filter((row) => row.transactionCount >= 2).sort(sorters.value).slice(0, 50);
    const competition = rows.filter((row) => row.supplierCount === 1 && row.transactionCount >= 2).sort(sorters.value);

    const lists = {
      overpaid,
      increases,
      spread: spreads.map(({ potentialMilli, ...row }) => row),
      spend: spend.map(strip),
      competition: competition.map(strip),
    };
    const type = lists[req.query.type] ? req.query.type : "overpaid";
    const page = pa.paginate(lists[type], pa.parsePaging(req.query, 10));
    res.json({
      type,
      counts: Object.fromEntries(Object.entries(lists).map(([key, list]) => [key, list.length])),
      totalSavings: overpaid.reduce((sum, row) => sum + row.savings, 0),
      items: page.items,
      pagination: page.pagination,
      settings: { lookbackDays: settings.lookbackDays, mildPct: settings.mildPct },
    });
  }));

  /* ------------------------------------------------------------- item detail */

  async function findItem(id) {
    const item = await db.item.findUnique({
      where: { id },
      select: {
        id: true, name: true, sku: true, brand: true, partNumber: true, aliases: true, category: true, unit: true, isSerialized: true,
        stocks: { select: { qty: true } },
        stockUnits: { where: { status: "IN_STOCK" }, select: { id: true } },
      },
    });
    if (!item) return null;
    const stock = item.isSerialized ? item.stockUnits.length : item.stocks.reduce((sum, row) => sum + Number(row.qty || 0), 0);
    const { stocks, stockUnits, ...rest } = item;
    return { ...rest, stock };
  }

  router.get("/items/:id", handle(async (req, res) => {
    const item = await findItem(req.params.id);
    if (!item) return res.status(404).json({ error: "Sparepart tidak ditemukan" });
    const [data, settings] = await Promise.all([dataset({ itemId: item.id }), pa.loadSettings(db)]);
    const period = pa.parsePeriod(req.query);
    const key = pa.primaryKeyFor(item);
    const series = data.byKey.get(key) || [];
    const all = data.byItem.get(item.id) || [];
    const periodLines = series.filter((line) => pa.inPeriod(line, period));
    const allTime = pa.summarize(series);
    const inPeriod = pa.summarize(periodLines);
    const asOf = period.to && period.to < new Date() ? period.to : new Date();

    const supplierOrder = [];
    for (const line of series) if (!supplierOrder.some((s) => s.id === line.supplierId)) supplierOrder.push({ id: line.supplierId, name: line.supplierName });
    const latest = inPeriod.latest;

    res.json({
      item: {
        ...item,
        totalQtyPurchased: pa.summarize(all).qty,
        transactionCount: all.length,
        supplierCount: new Set(all.map((line) => line.supplierId)).size,
        firstPurchaseDate: all[0]?.date || null,
      },
      period: { from: period.from, to: period.to },
      summary: {
        count: inPeriod.count,
        qty: inPeriod.qty,
        amount: inPeriod.amount,
        supplierCount: inPeriod.supplierCount,
        averagePrice: inPeriod.averagePrice,
        latest: pa.slimLine(latest),
        lowest: pa.slimLine(inPeriod.lowest),
        highest: pa.slimLine(inPeriod.highest),
        change: latest ? { pct: latest.change, previousPrice: latest.previousPrice, previousSupplierName: latest.previousSupplierName } : null,
        allTimeLowest: pa.slimLine(allTime.lowest),
        allTimeCount: allTime.count,
      },
      reference: pa.referencePrice(series, settings, { asOf }),
      suppliers: pa.supplierComparison(periodLines.length ? periodLines : [], settings, asOf),
      supplierOrder,
      points: periodLines.slice(-2000).map((line) => ({
        id: line.id, date: line.date, supplierId: line.supplierId, supplierName: line.supplierName, qty: line.qty, unit: line.unit,
        unitPrice: line.unitPrice, amount: line.amount, priceStatus: line.priceStatus, poNumber: line.poNumber,
      })),
      truncated: periodLines.length > 2000,
      quality: {
        notInvoiced: periodLines.filter((line) => line.priceStatus !== "INVOICE").length,
        otherUnitCount: all.length - series.length,
        excluded: data.excluded,
      },
      settings,
    });
  }));

  function historyLines(data, item, query) {
    const period = pa.parsePeriod(query);
    const supplierId = String(query.supplierId || "");
    const q = String(query.q || "").trim().toLocaleLowerCase("id-ID");
    const key = pa.primaryKeyFor(item);
    let rows = (data.byItem.get(item.id) || []).filter((line) => pa.inPeriod(line, period) && (!supplierId || line.supplierId === supplierId));
    if (query.comparable === "1") rows = rows.filter((line) => line.key === key);
    if (q) {
      rows = rows.filter((line) => [line.supplierName, line.poNumber, line.receiptNumber, line.deliveryNote, ...(line.invoices || []).map((i) => i.invoiceNumber)]
        .some((value) => String(value || "").toLocaleLowerCase("id-ID").includes(q)));
    }
    const sortKey = { date: (l) => l.date.getTime(), price: (l) => l.unitPrice, qty: (l) => l.qty, supplier: (l) => l.supplierName, total: (l) => l.amount, change: (l) => l.change ?? -Infinity }[query.sort] || ((l) => l.date.getTime());
    const direction = query.order === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const x = sortKey(a);
      const y = sortKey(b);
      const diff = typeof x === "string" ? x.localeCompare(y, "id") : x - y;
      return direction * diff || direction * (a.date - b.date) || String(a.id).localeCompare(String(b.id));
    });
    return { rows, key };
  }

  router.get("/items/:id/history", handle(async (req, res) => {
    const item = await db.item.findUnique({ where: { id: req.params.id }, select: { id: true, unit: true } });
    if (!item) return res.status(404).json({ error: "Sparepart tidak ditemukan" });
    const data = await dataset({ itemId: item.id });
    const { rows, key } = historyLines(data, item, req.query);
    const page = pa.paginate(rows, pa.parsePaging(req.query, 10));
    res.json({ items: page.items.map((line) => pa.publicLine(line, { comparableKey: key })), pagination: page.pagination });
  }));

  router.get("/items/:id/export", handle(async (req, res) => {
    const item = await db.item.findUnique({ where: { id: req.params.id }, select: { id: true, unit: true, sku: true, name: true } });
    if (!item) return res.status(404).json({ error: "Sparepart tidak ditemukan" });
    const data = await dataset({ itemId: item.id });
    const { rows } = historyLines(data, item, req.query);
    if (rows.length > EXPORT_LIMIT) return res.status(400).json({ error: `Ekspor maksimal ${EXPORT_LIMIT.toLocaleString("id-ID")} baris. Persempit rentang tanggal.` });
    const base = `riwayat-harga-${String(item.sku || item.id).replace(/[^A-Za-z0-9_-]+/g, "-")}`;
    if (req.query.format === "xlsx") {
      const ExcelJS = require("exceljs");
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Riwayat harga");
      sheet.addRow([`Riwayat Harga Pembelian — ${item.name} (${item.sku})`]);
      sheet.getRow(1).font = { bold: true, size: 13 };
      sheet.addRow(["Harga = harga satuan per baris sebelum pajak, diskon, dan ongkos PO. Tanggal = tanggal barang diterima."]);
      sheet.addRow([]);
      sheet.addRow(pa.EXPORT_HEADINGS);
      sheet.getRow(4).font = { bold: true };
      for (const row of pa.exportRows(rows)) sheet.addRow(row);
      sheet.views = [{ state: "frozen", ySplit: 4 }];
      const widths = [14, 26, 30, 16, 18, 18, 22, 10, 9, 18, 18, 14, 24];
      widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
      [10, 11].forEach((col) => { sheet.getColumn(col).numFmt = '"Rp"#,##0'; });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${base}.xlsx"`);
      await workbook.xlsx.write(res);
      return res.end();
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${base}.csv"`);
    res.send(pa.toCsv(rows));
  }));

  /* ---------------------------------------------------------------- suppliers */

  router.get("/suppliers/:id", handle(async (req, res) => {
    const supplier = await db.supplier.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, phone: true, email: true, address: true } });
    if (!supplier) return res.status(404).json({ error: "Supplier tidak ditemukan" });
    const [data, settings] = await Promise.all([dataset(), pa.loadSettings(db)]);
    const period = pa.parsePeriod(req.query);
    const asOf = period.to && period.to < new Date() ? period.to : new Date();
    const lines = data.lines.filter((line) => line.supplierId === supplier.id && pa.inPeriod(line, period));
    const total = pa.summarize(lines);
    const poCount = new Set(lines.map((line) => line.poId)).size;

    const rows = itemRows(lines).map((row) => {
      const others = new Map();
      for (const line of data.byKey.get(row.key) || []) {
        if (line.supplierId === supplier.id || line.date > asOf) continue;
        const current = others.get(line.supplierId);
        if (!current || line.date > current.date) others.set(line.supplierId, line);
      }
      const bestOther = [...others.values()].reduce((min, line) => (!min || line.unitPrice < min.unitPrice ? line : min), null);
      return {
        ...stripLines(row),
        otherSupplierCount: others.size,
        bestOtherPrice: bestOther ? bestOther.unitPrice : null,
        bestOtherSupplierName: bestOther ? bestOther.supplierName : null,
        bestOtherDate: bestOther ? bestOther.date : null,
        differenceToBestOtherPct: bestOther ? pa.percentChange(row.latestPrice, bestOther.unitPrice) : null,
      };
    });

    // Price changes between this supplier's own consecutive purchases.
    const ownChanges = [];
    const ownByKey = new Map();
    for (const line of lines) {
      if (!ownByKey.has(line.key)) ownByKey.set(line.key, []);
      ownByKey.get(line.key).push(line);
    }
    for (const group of ownByKey.values()) {
      group.sort((a, b) => a.date - b.date);
      for (let i = 1; i < group.length; i += 1) {
        const pct = pa.percentChange(group[i].unitPrice, group[i - 1].unitPrice);
        if (pct) ownChanges.push({ ...pa.slimLine(group[i]), itemId: group[i].itemId, itemName: group[i].itemName, sku: group[i].sku, previousOwnPrice: group[i - 1].unitPrice, previousOwnDate: group[i - 1].date, ownChange: pct });
      }
    }
    ownChanges.sort((a, b) => new Date(b.date) - new Date(a.date));

    rows.sort(sorters[req.query.sort] || sorters.value);
    const page = pa.paginate(rows, pa.parsePaging(req.query, 10));
    res.json({
      supplier,
      kpis: {
        itemCount: new Set(lines.map((line) => line.itemId)).size,
        totalValue: total.amount,
        purchaseCount: poCount,
        receiptCount: total.receiptCount,
        lineCount: total.count,
        averageTransactionValue: poCount ? pa.divide(total.amountMilli, BigInt(poCount) * 1000n, 0) : null,
        cheapestCount: rows.filter((row) => row.bestOtherPrice != null && row.latestPrice <= row.bestOtherPrice).length,
        comparedCount: rows.filter((row) => row.bestOtherPrice != null).length,
      },
      items: page.items,
      pagination: page.pagination,
      frequent: [...rows].sort(sorters.frequency).slice(0, 5),
      latest: [...lines].reverse().slice(0, 8).map((line) => ({ ...pa.slimLine(line), itemId: line.itemId, itemName: line.itemName, sku: line.sku })),
      priceChanges: ownChanges.slice(0, 8),
      monthly: monthlySeries(lines, period),
      settings: { lookbackDays: settings.lookbackDays },
    });
  }));

  /* -------------------------------------------------------------- price check */

  // Used while typing a price in Pembelian (receipt and supplier invoice) and
  // to show the reference in Buat PO. Never blocks anything by itself.
  router.post("/check-price", handle(async (req, res) => {
    const body = req.body || {};
    const itemId = String(body.itemId || "");
    if (!itemId) return res.status(400).json({ error: "Sparepart wajib dipilih" });
    const item = await db.item.findUnique({ where: { id: itemId }, select: { id: true, name: true, unit: true } });
    if (!item) return res.status(404).json({ error: "Sparepart tidak ditemukan" });
    const settings = await pa.loadSettings(db);
    if (body.unit && String(body.unit).trim() !== String(item.unit).trim()) {
      return res.json({ level: "incomparable", reason: `Satuan ${body.unit} berbeda dari satuan barang (${item.unit}); harga tidak dibandingkan.`, item, thresholds: { mild: settings.mildPct, strong: settings.strongPct, high: settings.highPct } });
    }
    if (body.currency && String(body.currency).toUpperCase() !== "IDR") {
      return res.json({ level: "incomparable", reason: "Mata uang selain IDR tidak dibandingkan.", item });
    }
    const data = await dataset({ itemId: item.id, useCache: body.fresh ? false : true });
    const series = data.byKey.get(pa.primaryKeyFor(item)) || [];
    const excludeIds = Array.isArray(body.excludeReceiptItemIds) ? body.excludeReceiptItemIds.slice(0, 200) : [];
    const result = pa.checkPrice(series, body.unitPrice, settings, { excludeIds });
    let supplierLatest = null;
    if (body.supplierId) {
      const own = series.filter((line) => line.supplierId === String(body.supplierId) && !excludeIds.includes(line.id));
      supplierLatest = own.length ? pa.slimLine(own[own.length - 1]) : null;
    }
    let market = null;
    try {
      market = await require("../services/marketPrices/store").marketReference(db, item.id, body.unitPrice, { excludeIds });
    } catch (error) {
      // An unavailable market source must never interrupt purchasing or internal analytics.
      console.warn("[market-price reference]", error.code || error.name);
    }
    res.json({ ...result, item, supplierLatest, market });
  }));

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof pa.AnalyticsInputError) return res.status(400).json({ error: error.message });
    console.error("[price-analytics]", error);
    res.status(500).json({ error: "Analitik harga belum dapat dimuat. Coba lagi beberapa saat lagi." });
  });

  return router;
}

module.exports = createPriceAnalyticsRouter();
module.exports.createPriceAnalyticsRouter = createPriceAnalyticsRouter;
