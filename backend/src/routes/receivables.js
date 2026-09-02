const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");
const { SYSTEM_ACCOUNTS, cashCode, postJournal } = require("../services/accounting");

const router = express.Router();
router.use(authRequired, requireRole("OWNER", "ADMIN", "STAFF"));

const invoiceInclude = {
  order: { select: { id: true, orderNo: true, cargoName: true, qty: true, unit: true, fromText: true, toText: true, trips: { where: { status: "COMPLETED" }, select: { qtyPlanned: true, qtyActual: true } } } },
  customer: true,
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
  const trips = order?.trips || [];
  const planned = trips.reduce((sum, trip) => sum + Number(trip.qtyPlanned || 0), 0);
  const delivered = trips.reduce((sum, trip) => sum + Number(trip.qtyActual ?? trip.qtyPlanned ?? 0), 0);
  return { planned, delivered, loss: Math.max(0, planned - delivered), unit: order?.unit || null };
}

router.get("/overview", async (_req, res) => {
  try {
    const [invoices, eligibleOrders] = await Promise.all([
      prisma.invoice.findMany({ include: invoiceInclude, orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }] }),
      prisma.order.findMany({
        where: { status: "COMPLETED", invoice: null },
        include: { customer: true, trips: { where: { status: "COMPLETED" }, select: { qtyPlanned: true, qtyActual: true } } },
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    const rows = invoices.map(summarize);
    const stats = rows.reduce((acc, invoice) => {
      if (invoice.status !== "VOID") acc.invoiced += invoice.total;
      acc.received += invoice.paid;
      if (!['PAID', 'VOID'].includes(invoice.status)) acc.outstanding += invoice.balance;
      if (invoice.displayStatus === "OVERDUE") acc.overdue += invoice.balance;
      return acc;
    }, { invoiced: 0, received: 0, outstanding: 0, overdue: 0 });
    res.json({ ok: true, invoices: rows, eligibleOrders: eligibleOrders.map(order => ({ ...order, shipment: shipmentSummary(order) })), stats });
  } catch (error) {
    res.status(400).json({ error: error.message || "Gagal memuat piutang" });
  }
});

router.post("/invoices", async (req, res) => {
  try {
    const { orderId, customerName, customerPhone, billingAddress, dueAt, notes } = req.body;
    const contractSubtotal = amount(req.body.contractSubtotal ?? req.body.subtotal, "Harga kontrak");
    const tax = amount(req.body.tax || 0, "Pajak");
    const discount = amount(req.body.discount || 0, "Diskon");
    const dueDate = new Date(dueAt);
    if (!orderId || !customerName?.trim()) throw new Error("Pesanan dan nama pelanggan wajib diisi");
    if (Number.isNaN(dueDate.getTime())) throw new Error("Tanggal jatuh tempo tidak valid");
    if (contractSubtotal <= 0) throw new Error("Harga kontrak harus lebih dari nol");

    const invoice = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { invoice: true, trips: { where: { status: "COMPLETED" }, select: { qtyPlanned: true, qtyActual: true } } } });
      if (!order || order.status !== "COMPLETED") throw new Error("Invoice hanya dapat dibuat dari pesanan yang selesai");
      if (order.invoice) throw new Error("Pesanan ini sudah memiliki invoice");
      const shipment = shipmentSummary(order);
      const plannedQuantity = shipment.planned > 0 ? shipment.planned : Number(order.qty || 0);
      const deliveredQuantity = shipment.delivered;
      const billableRatio = plannedQuantity > 0 ? Math.min(1, Math.max(0, deliveredQuantity / plannedQuantity)) : 1;
      const subtotal = Math.round(contractSubtotal * billableRatio);
      const cargoLossAmount = Math.max(0, contractSubtotal - subtotal);
      const total = subtotal + tax - discount;
      if (total <= 0) throw new Error("Total invoice setelah penyesuaian harus lebih dari nol");
      const number = await nextNumber(tx, "invoice", "INV");
      return tx.invoice.create({
        data: {
          number, orderId, customerId: order.customerId, customerName: customerName.trim(),
          customerPhone: customerPhone?.trim() || null, billingAddress: billingAddress?.trim() || null,
          dueAt: dueDate, subtotal, contractSubtotal, plannedQuantity: plannedQuantity || null,
          deliveredQuantity: plannedQuantity > 0 ? deliveredQuantity : null,
          cargoLossQuantity: plannedQuantity > 0 ? shipment.loss : null,
          cargoLossAmount, tax, discount, total, notes: notes?.trim() || null, createdById: req.user.id,
        },
        include: invoiceInclude,
      });
    });
    res.status(201).json({ ok: true, invoice: summarize(invoice) });
  } catch (error) {
    const status = error.code === "P2002" ? 409 : 400;
    res.status(status).json({ error: error.message || "Gagal membuat invoice" });
  }
});

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
      const result = await tx.invoice.update({ where: { id: invoice.id }, data: { status: "VOID" } });
      if (invoice.status !== "DRAFT") await postJournal(tx, { date: new Date(), description: `Pembatalan invoice ${invoice.number}`, sourceType: "CUSTOMER_INVOICE_VOID", sourceId: invoice.id, createdById: req.user.id, lines: [{ code: SYSTEM_ACCOUNTS.REVENUE, debit: invoice.total }, { code: SYSTEM_ACCOUNTS.AR, credit: invoice.total }] });
      return result;
    });
    res.json({ ok: true, invoice: updated });
  } catch (error) { res.status(400).json({ error: error.message || "Gagal membatalkan invoice" }); }
});

module.exports = router;
