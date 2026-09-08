const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");
const { SYSTEM_ACCOUNTS, cashCode, postJournal } = require("../services/accounting");
const { esc, num, money, date, documentHtml } = require("../utils/printDocument");

const router = express.Router();
// Keep the running server aligned with the generated Prisma relations.
router.use(authRequired, requireRole("OWNER", "ADMIN", "STAFF"));

const invoiceInclude = {
  order: { select: { id: true, orderNo: true, cargoName: true, customerName: true, customer: { select: { name: true } }, qty: true, unit: true, fromText: true, toText: true, trips: { where: { status: "COMPLETED" }, select: { qtyPlanned: true, qtyActual: true } }, tripAllocations: { where: { trip: { status: "COMPLETED" } }, select: { qtyPlanned: true, qtyActual: true } }, materialInvoices: { select: { billingCustomerName: true, lines: { select: { totalAmount: true } } } } } },
  customer: true,
  singleTrip: { include: { truck: true } },
  singleTripLines: { include: { trip: { include: { truck: true } } }, orderBy: { trip: { completedAt: "asc" } } },
  materialInvoices: { include: { trip: { include: { truck: true } }, destinationLocation: true, lines: true } },
  createdBy: { select: { name: true } },
  payments: { include: { createdBy: { select: { name: true } } }, orderBy: { receivedAt: "desc" } },
};

function amount(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} harus berupa nominal rupiah yang valid`);
  return parsed;
}

async function nextNumber(tx, model, prefix) {
  const year = new Date().getFullYear();
  const start = `${prefix}-${year}-`;
  const last = await tx[model].findFirst({ where: { number: { startsWith: start } }, orderBy: { number: "desc" }, select: { number: true } });
  const sequence = last ? Number(last.number.slice(start.length)) + 1 : 1;
  return `${start}${String(sequence).padStart(5, "0")}`;
}

function summarize(invoice) {
  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = Math.max(0, invoice.total - paid);
  const overdue = ["SENT", "PARTIALLY_PAID"].includes(invoice.status) && new Date(invoice.dueAt) < new Date();
  return { ...invoice, order: invoice.order ? { ...invoice.order, shipment: shipmentSummary(invoice.order) } : null, paid, balance, displayStatus: overdue ? "OVERDUE" : invoice.status };
}

function shipmentSummary(order) {
  const trips = order?.tripAllocations?.length ? order.tripAllocations : (order?.trips || []);
  const planned = trips.reduce((sum, trip) => sum + Number(trip.qtyPlanned || 0), 0);
  const delivered = trips.reduce((sum, trip) => sum + Number(trip.qtyActual ?? trip.qtyPlanned ?? 0), 0);
  return { planned, delivered, loss: Math.max(0, planned - delivered), unit: order?.unit || null };
}

function eligibleOrderMaterials(order) {
  const owner = String(order?.customer?.name || order?.customerName || "").trim().toLocaleLowerCase("id-ID");
  return (order?.materialInvoices || []).filter((invoice) =>
    !invoice.billedInvoiceId && invoice.destinationCompletedAt &&
    (!invoice.billingCustomerName || String(invoice.billingCustomerName).trim().toLocaleLowerCase("id-ID") === owner)
  );
}

function materialSubtotal(order) {
  return eligibleOrderMaterials(order)
    .flatMap((invoice) => invoice.lines || [])
    .reduce((sum, line) => sum + Number(line.totalAmount || 0), 0);
}

function weightKg(trip) {
  const qty = Number(trip?.qtyActual);
  const unit = String(trip?.unitSnap || "").toUpperCase();
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (unit === "TON") return qty * 1000;
  if (unit === "KG") return qty;
  return 0;
}

router.get("/overview", async (_req, res) => {
  try {
    const [invoices, eligibleOrders, materialRows, singleTrips] = await Promise.all([
      prisma.invoice.findMany({ include: invoiceInclude, orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }] }),
      prisma.order.findMany({
        where: { status: "COMPLETED", invoices: { none: { sourceType: "ORDER", status: { not: "VOID" } } } },
        include: { customer: true, trips: { where: { status: "COMPLETED" }, select: { qtyPlanned: true, qtyActual: true } }, tripAllocations: { where: { trip: { status: "COMPLETED" } }, select: { qtyPlanned: true, qtyActual: true } }, materialInvoices: { select: { id: true, billingCustomerName: true, billedInvoiceId: true, destinationCompletedAt: true, lines: { select: { totalAmount: true } } } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.materialInvoice.findMany({ where: { billedInvoiceId: null, destinationCompletedAt: { not: null } }, include: { lines: true, trip: { include: { truck: true } }, destinationLocation: true }, orderBy: { issuedAt: "asc" } }),
      prisma.trip.findMany({ where: { purpose: "SINGLE_TRIP", status: "COMPLETED", cargoCategorySnap: { in: ["FERTILIZER", "CANGKANG"] }, billingCustomerName: { not: null }, invoiceLines: { none: {} }, singleInvoice: null }, include: { truck: true, billingCustomer: true }, orderBy: { completedAt: "asc" } }),
    ]);
    const rows = invoices.map(summarize);
    const stats = rows.reduce((acc, invoice) => {
      if (invoice.status !== "VOID") acc.invoiced += invoice.total;
      acc.received += invoice.paid;
      if (!['PAID', 'VOID'].includes(invoice.status)) acc.outstanding += invoice.balance;
      if (invoice.displayStatus === "OVERDUE") acc.overdue += invoice.balance;
      return acc;
    }, { invoiced: 0, received: 0, outstanding: 0, overdue: 0 });
    const groups = new Map();
    for (const item of materialRows) {
      const key = String(item.billingCustomerName || "Tanpa customer").trim().toLocaleLowerCase("id-ID");
      const group = groups.get(key) || { key, customerName: item.billingCustomerName || "Tanpa customer", total: 0, invoiceIds: [], invoices: [] };
      group.total += item.lines.reduce((sum, line) => sum + Number(line.totalAmount || 0), 0);
      group.invoiceIds.push(item.id); group.invoices.push(item); groups.set(key, group);
    }
    const orderSources = eligibleOrders.map(order => ({ type: "ORDER", id: order.id, customerId: order.customerId || null, label: `${order.orderNo} — ${order.customer?.name || order.customerName || "Tanpa nama"}`, customerName: order.customer?.name || order.customerName || "", customerPhone: order.customer?.phone || "", billingAddress: order.customer?.address || "", order: { ...order, shipment: shipmentSummary(order), materialSubtotal: materialSubtotal(order) } }));
    const materialSources = [...groups.values()].map(group => ({ type: "MATERIAL", id: group.key, label: `Faktur Muatan — ${group.customerName} (${group.invoiceIds.length} faktur)`, customerName: group.customerName, materialInvoiceIds: group.invoiceIds, materialSubtotal: group.total, invoices: group.invoices }));
    const singleGroups = new Map();
    for (const trip of singleTrips) {
      const customerName = String(trip.billingCustomerName || "").trim();
      const category = String(trip.cargoCategorySnap || "").toUpperCase();
      const key = `${trip.billingCustomerId || customerName.toLocaleLowerCase("id-ID")}:${category}`;
      const group = singleGroups.get(key) || { key, customerId: trip.billingCustomerId || null, customerName, customerPhone: trip.billingCustomer?.phone || "", billingAddress: trip.billingCustomer?.address || "", cargoCategory: category, trips: [], totalWeightKg: 0 };
      group.trips.push(trip); group.totalWeightKg += weightKg(trip); singleGroups.set(key, group);
    }
    const cargoLabel = value => value === "FERTILIZER" ? "Pupuk" : value === "CANGKANG" ? "Cangkang" : value;
    const singleSources = [...singleGroups.values()].map(group => ({ type: "SINGLE_TRIP_GROUP", id: group.key, customerId: group.customerId, label: `Trip Tunggal — ${group.customerName} · ${cargoLabel(group.cargoCategory)} (${group.trips.length} trip)`, customerName: group.customerName, customerPhone: group.customerPhone, billingAddress: group.billingAddress, cargoCategory: group.cargoCategory, singleTripIds: group.trips.map(trip => trip.id), totalWeightKg: group.totalWeightKg, trips: group.trips }));
    res.json({ ok: true, invoices: rows, eligibleOrders: orderSources.map(source => source.order), eligibleMaterialGroups: [...groups.values()], eligibleSingleTrips: singleTrips, eligibleSources: [...orderSources, ...materialSources, ...singleSources], stats });
  } catch (error) {
    res.status(400).json({ error: error.message || "Gagal memuat piutang" });
  }
});

router.post("/invoices", async (req, res) => {
  try {
    const { orderId, customerName, customerPhone, billingAddress, dueAt, notes, sourceType = "ORDER", materialInvoiceIds = [], singleTripId, singleTripIds = [] } = req.body;
    const contractSubtotal = amount(req.body.contractSubtotal ?? req.body.subtotal, "Harga kontrak");
    const tax = amount(req.body.tax || 0, "Pajak");
    const discount = amount(req.body.discount || 0, "Diskon");
    const dueDate = new Date(dueAt);
    if (!customerName?.trim()) throw new Error("Nama pelanggan wajib diisi");
    if (Number.isNaN(dueDate.getTime())) throw new Error("Tanggal jatuh tempo tidak valid");

    const invoice = await prisma.$transaction(async (tx) => {
      if (sourceType === "MATERIAL") {
        const items = await tx.materialInvoice.findMany({ where: { id: { in: materialInvoiceIds }, billedInvoiceId: null, destinationCompletedAt: { not: null } }, include: { lines: true } });
        if (!items.length || items.length !== materialInvoiceIds.length) throw new Error("Faktur Muatan tidak tersedia atau sudah ditagih");
        const customerKey = customerName.trim().toLocaleLowerCase("id-ID");
        if (items.some((item) => String(item.billingCustomerName || "").trim().toLocaleLowerCase("id-ID") !== customerKey)) throw new Error("Semua Faktur Muatan harus untuk customer yang sama");
        const subtotal = items.flatMap((item) => item.lines).reduce((sum, line) => sum + Number(line.totalAmount || 0), 0);
        if (subtotal <= 0) throw new Error("Total Rupiah Faktur Muatan belum diisi");
        const total = subtotal + tax - discount; if (total <= 0) throw new Error("Total invoice harus lebih dari nol");
        const number = await nextNumber(tx, "invoice", "INV");
        const sourceKey = [...materialInvoiceIds].sort().join(",");
        const created = await tx.invoice.create({ data: { number, billingKey: `MATERIAL:${sourceKey}`, sourceType, customerName: customerName.trim(), customerPhone: customerPhone?.trim() || null, billingAddress: billingAddress?.trim() || null, dueAt: dueDate, subtotal, contractSubtotal: 0, materialSubtotal: subtotal, tax, discount, total, notes: notes?.trim() || null, createdById: req.user.id }, include: invoiceInclude });
        await tx.materialInvoice.updateMany({ where: { id: { in: materialInvoiceIds } }, data: { billedInvoiceId: created.id } }); return created;
      }
      if (sourceType === "SINGLE_TRIP") {
        const trip = await tx.trip.findFirst({ where: { id: singleTripId, purpose: "SINGLE_TRIP", status: "COMPLETED", singleInvoice: null } });
        if (!trip) throw new Error("Trip Tunggal tidak tersedia atau sudah ditagih");
        if (contractSubtotal <= 0) throw new Error("Nilai tagihan Trip Tunggal harus lebih dari nol");
        const total = contractSubtotal + tax - discount;
        if (total <= 0) throw new Error("Total invoice harus lebih dari nol");
        const number = await nextNumber(tx, "invoice", "INV");
        return tx.invoice.create({ data: { number, billingKey: `SINGLE_TRIP:${trip.id}`, sourceType, singleTripId: trip.id, customerName: customerName.trim(), customerPhone: customerPhone?.trim() || null, billingAddress: billingAddress?.trim() || null, dueAt: dueDate, subtotal: contractSubtotal, contractSubtotal, tax, discount, total, notes: notes?.trim() || null, createdById: req.user.id }, include: invoiceInclude });
      }
      if (sourceType === "SINGLE_TRIP_GROUP") {
        const ids = [...new Set(singleTripIds)].filter(Boolean);
        const ratePerKg = amount(req.body.ratePerKg, "Harga per kg");
        if (!ids.length) throw new Error("Pilih minimal satu Trip Tunggal");
        if (ratePerKg <= 0) throw new Error("Harga per kg harus lebih dari nol");
        const trips = await tx.trip.findMany({ where: { id: { in: ids }, purpose: "SINGLE_TRIP", status: "COMPLETED", cargoCategorySnap: { in: ["FERTILIZER", "CANGKANG"] }, invoiceLines: { none: {} }, singleInvoice: null } });
        if (trips.length !== ids.length) throw new Error("Sebagian trip tidak tersedia atau sudah ditagih");
        const customerKey = customerName.trim().toLocaleLowerCase("id-ID");
        const category = String(trips[0].cargoCategorySnap || "");
        if (trips.some(trip => String(trip.billingCustomerName || "").trim().toLocaleLowerCase("id-ID") !== customerKey || trip.cargoCategorySnap !== category)) throw new Error("Semua trip harus memiliki customer dan jenis muatan yang sama");
        const lines = trips.map(trip => { const actualWeightKg = weightKg(trip); if (actualWeightKg <= 0) throw new Error(`${trip.tripNo || "Trip"} belum memiliki berat aktual dalam TON/KG`); return { tripId: trip.id, actualWeightKg, ratePerKg, amount: Math.round(actualWeightKg * ratePerKg) }; });
        const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
        const total = subtotal + tax - discount;
        if (total <= 0) throw new Error("Total invoice harus lebih dari nol");
        const number = await nextNumber(tx, "invoice", "INV");
        const billingIds = ids.slice().sort();
        return tx.invoice.create({ data: { number, billingKey: `SINGLE_TRIP_GROUP:${billingIds.join(",")}`, sourceType, customerId: trips[0].billingCustomerId || null, customerName: customerName.trim(), customerPhone: customerPhone?.trim() || null, billingAddress: billingAddress?.trim() || null, dueAt: dueDate, subtotal, contractSubtotal: subtotal, deliveredQuantity: lines.reduce((sum, line) => sum + line.actualWeightKg, 0), tax, discount, total, notes: notes?.trim() || null, createdById: req.user.id, singleTripLines: { create: lines } }, include: invoiceInclude });
      }
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { customer: true, invoices: true, trips: { where: { status: "COMPLETED" }, select: { qtyPlanned: true, qtyActual: true } }, tripAllocations: { where: { trip: { status: "COMPLETED" } }, select: { qtyPlanned: true, qtyActual: true } }, materialInvoices: { select: { id: true, billingCustomerName: true, billedInvoiceId: true, destinationCompletedAt: true, lines: { select: { totalAmount: true } } } } } });
      if (!order || order.status !== "COMPLETED") throw new Error("Invoice hanya dapat dibuat dari pesanan yang selesai");
      if (order.invoices.some((item) => item.sourceType === "ORDER" && item.status !== "VOID")) throw new Error("Pesanan ini sudah memiliki invoice");
      const shipment = shipmentSummary(order);
      const plannedQuantity = shipment.planned > 0 ? shipment.planned : Number(order.qty || 0);
      const deliveredQuantity = shipment.delivered;
      const billableRatio = plannedQuantity > 0 ? Math.min(1, Math.max(0, deliveredQuantity / plannedQuantity)) : 1;
      const extraMaterialSubtotal = materialSubtotal(order);
      if (contractSubtotal <= 0 && extraMaterialSubtotal <= 0) throw new Error("Harga kontrak atau nilai Faktur Muatan harus lebih dari nol");
      const baseSubtotal = Math.round(contractSubtotal * billableRatio);
      const subtotal = baseSubtotal + extraMaterialSubtotal;
      const cargoLossAmount = Math.max(0, contractSubtotal - baseSubtotal);
      const total = subtotal + tax - discount;
      if (total <= 0) throw new Error("Total invoice setelah penyesuaian harus lebih dari nol");
      const number = await nextNumber(tx, "invoice", "INV");
      const created = await tx.invoice.create({
        data: {
          number, orderId, billingKey: `ORDER:${orderId}`, sourceType: "ORDER", customerId: order.customerId, customerName: customerName.trim(),
          customerPhone: customerPhone?.trim() || null, billingAddress: billingAddress?.trim() || null,
          dueAt: dueDate, subtotal, contractSubtotal, plannedQuantity: plannedQuantity || null,
          deliveredQuantity: plannedQuantity > 0 ? deliveredQuantity : null,
          cargoLossQuantity: plannedQuantity > 0 ? shipment.loss : null,
          cargoLossAmount, materialSubtotal: extraMaterialSubtotal, tax, discount, total, notes: notes?.trim() || null, createdById: req.user.id,
        },
        include: invoiceInclude,
      });
      const includedMaterialIds = eligibleOrderMaterials(order).map((item) => item.id);
      if (includedMaterialIds.length) {
        await tx.materialInvoice.updateMany({ where: { id: { in: includedMaterialIds }, billedInvoiceId: null }, data: { billedInvoiceId: created.id } });
      }
      return tx.invoice.findUnique({ where: { id: created.id }, include: invoiceInclude });
    });
    res.status(201).json({ ok: true, invoice: summarize(invoice) });
  } catch (error) {
    const status = error.code === "P2002" ? 409 : 400;
    res.status(status).json({ error: error.message || "Gagal membuat invoice" });
  }
});

router.get("/invoices/:id/print", async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: invoiceInclude });
    if (!invoice) return res.status(404).send("Invoice tidak ditemukan");

    let rowNumber = 0;
    const singleTripRows = (invoice.singleTripLines || []).map(line => {
      rowNumber += 1;
      const trip = line.trip;
      const cargo = trip.cargoCategorySnap === "FERTILIZER" ? "Pupuk" : trip.cargoCategorySnap === "CANGKANG" ? "Cangkang" : trip.cargoNameSnap || "Muatan";
      return `<tr><td class="center">${rowNumber}</td><td>${esc(date(trip.completedAt))}</td><td>${esc(trip.truck?.plateNumber || trip.plateNumberSnap || "-")}</td><td>${esc(trip.tripNo || "-")}</td><td>${esc(cargo)}<div class="muted">${esc(trip.fromText || "-")} → ${esc(trip.toText || "-")}</div></td><td class="right">${esc(num(line.actualWeightKg))}</td><td>KG</td><td class="right">${money(line.ratePerKg)}</td><td class="right"><b>${money(line.amount)}</b></td></tr>`;
    }).join("");
    const materialRows = (invoice.materialInvoices || []).flatMap((materialInvoice) => {
      rowNumber += 1;
      const lines = materialInvoice.lines?.length ? materialInvoice.lines : [{ itemName: "Ambang / Material", qty: 0, unit: "-", totalAmount: 0 }];
      return lines.map((line, lineIndex) => {
        const qty = Number(line.qty || 0);
        const lineTotal = Number(line.totalAmount || 0);
        const unitPrice = qty > 0 ? lineTotal / qty : 0;
        const destination = materialInvoice.destinationLocation?.name || materialInvoice.destinationText || "-";
        return `<tr>
          <td class="center">${lineIndex === 0 ? rowNumber : ""}</td>
          <td>${lineIndex === 0 ? esc(date(materialInvoice.issuedAt)) : ""}</td>
          <td>${lineIndex === 0 ? esc(materialInvoice.trip?.truck?.plateNumber || "-") : ""}</td>
          <td>${lineIndex === 0 ? esc(materialInvoice.number) : ""}</td>
          <td>${esc(line.itemName || "Ambang / Material")}<div class="muted">${lineIndex === 0 ? `Tujuan: ${esc(destination)}` : ""}</div></td>
          <td class="right">${esc(num(qty))}</td><td>${esc(line.unit || "-")}</td>
          <td class="right">${money(unitPrice)}</td><td class="right"><b>${money(lineTotal)}</b></td>
        </tr>`;
      });
    }).join("");

    const sourceDescription = invoice.order
      ? `${invoice.order.orderNo} · ${invoice.order.fromText || "-"} → ${invoice.order.toText || "-"}`
      : invoice.singleTripLines?.length
        ? `${invoice.singleTripLines.length} Trip Tunggal · ${invoice.singleTripLines[0]?.trip?.cargoCategorySnap === "FERTILIZER" ? "Pupuk" : "Cangkang"}`
      : invoice.singleTrip
        ? `${invoice.singleTrip.tripNo || "Trip"} · ${invoice.singleTrip.truck?.plateNumber || "-"}`
        : `${invoice.materialInvoices.length} Faktur Muatan`;
    const fallbackRows = singleTripRows || materialRows || `<tr><td class="center">1</td><td>${esc(date(invoice.issuedAt))}</td><td>${esc(invoice.singleTrip?.truck?.plateNumber || "-")}</td><td>${esc(invoice.order?.orderNo || invoice.singleTrip?.tripNo || "-")}</td><td>${esc(invoice.order?.cargoName || invoice.singleTrip?.cargoNameSnap || "Ongkos angkut")}</td><td class="right">1</td><td>Trip</td><td class="right">${money(invoice.contractSubtotal || invoice.subtotal)}</td><td class="right"><b>${money(invoice.contractSubtotal || invoice.subtotal)}</b></td></tr>`;
    const status = statusLabelForPrint(invoice.status);
    const body = `
      <div class="summary"><div class="box">Ditagihkan kepada<b>${esc(invoice.customerName)}</b><span class="muted">${esc(invoice.billingAddress || "Alamat belum dicatat")}</span></div><div class="box">Sumber tagihan<b>${esc(sourceDescription)}</b><span class="muted">${esc(invoice.customerPhone || "Nomor telepon belum dicatat")}</span></div><div class="box">Jatuh tempo<b>${esc(date(invoice.dueAt))}</b><span class="muted">Status: ${esc(status)}</span></div></div>
      <table><thead><tr><th>No.</th><th>Tanggal</th><th>No. Pol.</th><th>Surat Jalan / Faktur</th><th>Jenis Barang & Tujuan</th><th class="right">Banyak</th><th>Satuan</th><th class="right">Harga</th><th class="right">Jumlah</th></tr></thead><tbody>${fallbackRows}</tbody></table>
      <table style="width:42%;margin-left:auto"><tbody><tr><td>Subtotal</td><td class="right"><b>${money(invoice.subtotal)}</b></td></tr>${invoice.tax ? `<tr><td>Pajak</td><td class="right">${money(invoice.tax)}</td></tr>` : ""}${invoice.discount ? `<tr><td>Diskon</td><td class="right">-${money(invoice.discount)}</td></tr>` : ""}<tr><td><b>TOTAL TAGIHAN</b></td><td class="right"><b>${money(invoice.total)}</b></td></tr></tbody></table>
      ${invoice.notes ? `<div class="box" style="margin-top:14px"><span class="muted">Catatan</span><br>${esc(invoice.notes)}</div>` : ""}
      <div class="signatures"><div>Pelanggan</div><div>Dibuat oleh<br>${esc(invoice.createdBy?.name || "-")}</div><div>CV. Mitra Setia</div></div>`;
    res.type("html").send(documentHtml({ title: "TAGIHAN ONGKOS ANGKUT", subtitle: invoice.number, meta: `Tanggal invoice: ${esc(date(invoice.issuedAt))}<br>Customer: ${esc(invoice.customerName)}`, body, landscape: true }));
  } catch (error) {
    res.status(400).send(error.message || "Gagal membuat dokumen invoice");
  }
});

function statusLabelForPrint(status) {
  return ({ DRAFT: "Draft", SENT: "Terkirim", PARTIALLY_PAID: "Dibayar sebagian", PAID: "Lunas", VOID: "Dibatalkan" })[status] || status;
}

router.patch("/invoices/:id/send", async (req, res) => {
  try {
    const current = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!current || current.status !== "DRAFT") return res.status(400).json({ error: "Hanya invoice draft yang dapat dikirim" });
    const invoice = await prisma.$transaction(async tx => {
      const updated = await tx.invoice.update({ where: { id: req.params.id }, data: { status: "SENT", sentAt: new Date() }, include: invoiceInclude });
      await postJournal(tx, { date: updated.sentAt, description: `Invoice ${updated.number}`, sourceType: "CUSTOMER_INVOICE", sourceId: updated.id, createdById: req.user.id, lines: [{ code: SYSTEM_ACCOUNTS.AR, debit: updated.total }, { code: SYSTEM_ACCOUNTS.REVENUE, credit: updated.total }] });
      return updated;
    });
    res.json({ ok: true, invoice: summarize(invoice) });
  } catch (error) { res.status(400).json({ error: error.message || "Gagal mengirim invoice" }); }
});

router.post("/invoices/:id/payments", async (req, res) => {
  try {
    const paymentAmount = amount(req.body.amount, "Pembayaran");
    if (paymentAmount <= 0) throw new Error("Pembayaran harus lebih dari nol");
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: req.params.id }, include: { payments: true } });
      if (!invoice || !["SENT", "PARTIALLY_PAID"].includes(invoice.status)) throw new Error("Invoice belum dikirim atau sudah ditutup");
      const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const balance = invoice.total - paid;
      if (paymentAmount > balance) throw new Error("Pembayaran melebihi sisa piutang");
      const number = await nextNumber(tx, "receivablePayment", "RCV");
      const payment = await tx.receivablePayment.create({ data: {
        number, invoiceId: invoice.id, amount: paymentAmount, method: req.body.method || "BANK_TRANSFER",
        reference: req.body.reference?.trim() || null, notes: req.body.notes?.trim() || null,
        receivedAt: req.body.receivedAt ? new Date(req.body.receivedAt) : new Date(), createdById: req.user.id,
      } });
      await postJournal(tx, { date: payment.receivedAt, description: `Penerimaan ${payment.number}`, sourceType: "CUSTOMER_PAYMENT", sourceId: payment.id, createdById: req.user.id, lines: [{ code: cashCode(payment.method), debit: payment.amount }, { code: SYSTEM_ACCOUNTS.AR, credit: payment.amount }] });
      const fullyPaid = paymentAmount === balance;
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: fullyPaid ? "PAID" : "PARTIALLY_PAID", paidAt: fullyPaid ? new Date() : null } });
      return payment;
    });
    res.status(201).json({ ok: true, payment: result });
  } catch (error) { res.status(400).json({ error: error.message || "Gagal mencatat pembayaran" }); }
});

router.patch("/invoices/:id/void", requireRole("OWNER", "ADMIN"), async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { payments: true } });
    if (!invoice || invoice.payments.length) return res.status(400).json({ error: "Invoice dengan pembayaran tidak dapat dibatalkan" });
    const updated = await prisma.$transaction(async tx => {
      const result = await tx.invoice.update({ where: { id: invoice.id }, data: { status: "VOID", billingKey: `VOID:${invoice.id}:${invoice.billingKey}`, singleTripId: null } });
      await tx.materialInvoice.updateMany({ where: { billedInvoiceId: invoice.id }, data: { billedInvoiceId: null } });
      if (invoice.status !== "DRAFT") await postJournal(tx, { date: new Date(), description: `Pembatalan invoice ${invoice.number}`, sourceType: "CUSTOMER_INVOICE_VOID", sourceId: invoice.id, createdById: req.user.id, lines: [{ code: SYSTEM_ACCOUNTS.REVENUE, debit: invoice.total }, { code: SYSTEM_ACCOUNTS.AR, credit: invoice.total }] });
      return result;
    });
    res.json({ ok: true, invoice: updated });
  } catch (error) { res.status(400).json({ error: error.message || "Gagal membatalkan invoice" }); }
});

module.exports = router;
