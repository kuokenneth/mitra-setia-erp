const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");
const { SYSTEM_ACCOUNTS, cashCode, postJournal } = require("../services/accounting");
const router = express.Router();

const seq = (prefix) => `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
const includePO = { supplier: true, request: true, items: { include: { item: true } }, receipts: { include: { items: { include: { purchaseOrderItem: { include: { item: true } } } }, location: true, createdBy: { select: { name: true } } } }, payments: { include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } } } };

router.use(authRequired, requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"));
router.get("/overview", async (_req, res) => {
  const [requests, orders, suppliers, locations, items] = await Promise.all([
    prisma.purchaseRequest.findMany({ include: { items: { include: { item: true } }, createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.purchaseOrder.findMany({ include: includePO, orderBy: { createdAt: "desc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }), prisma.inventoryLocation.findMany({ orderBy: { name: "asc" } }), prisma.item.findMany({ orderBy: { name: "asc" } })
  ]);
  res.json({ ok: true, requests, orders, suppliers, locations, items });
});
router.post("/suppliers", async (req, res) => res.json({ ok: true, supplier: await prisma.supplier.create({ data: req.body }) }));
router.post("/requests", async (req, res) => {
  const { urgency, purpose, truckId, reason, notes, items = [], submit = true } = req.body;
  if (!reason || !items.length) return res.status(400).json({ error: "Alasan dan minimal satu item wajib diisi" });
  const request = await prisma.purchaseRequest.create({ data: { number: seq("PR"), urgency, purpose, truckId, reason, notes, status: submit ? "WAITING_APPROVAL" : "DRAFT", createdById: req.user.id, items: { create: items.map(i => ({ itemId: i.itemId, originalQty: Number(i.qty), notes: i.notes })) } }, include: { items: { include: { item: true } } } });
  res.json({ ok: true, request });
});
router.patch("/requests/:id/approval", requireRole("OWNER", "ADMIN"), async (req, res) => {
  const { approved, notes, quantities = {} } = req.body;
  const result = await prisma.$transaction(async tx => {
    for (const [id, qty] of Object.entries(quantities)) await tx.purchaseRequestItem.update({ where: { id }, data: { approvedQty: Number(qty) } });
    return tx.purchaseRequest.update({ where: { id: req.params.id }, data: { status: approved ? "APPROVED" : "REJECTED", approvedById: req.user.id, approvedAt: new Date(), approvalNotes: notes } });
  }); res.json({ ok: true, request: result });
});
router.post("/orders", async (req, res) => {
  try {
    const { requestId, supplierId, tax = 0, shippingCost = 0, discount = 0, paymentTerms, deliveryAddress, estimatedArrival, items = [] } = req.body;
    if (!requestId || !supplierId || !items.length) return res.status(400).json({ error: "Request, supplier, dan item wajib diisi" });
    if (items.some(i => Number(i.qty) <= 0 || Number(i.unitPrice) < 0 || !Number.isFinite(Number(i.unitPrice)))) return res.status(400).json({ error: "Jumlah dan harga item tidak valid" });
    const request = await prisma.purchaseRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== "APPROVED") return res.status(400).json({ error: "Purchase Request belum disetujui" });
    const po = await prisma.purchaseOrder.create({ data: { number: seq("PO"), requestId, supplierId, tax: Number(tax), shippingCost: Number(shippingCost), discount: Number(discount), paymentTerms, deliveryAddress, estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null, createdById: req.user.id, items: { create: items.map(i => ({ itemId: i.itemId, qty: Number(i.qty), unitPrice: Number(i.unitPrice) })) } }, include: includePO });
    res.json({ ok: true, order: po });
  } catch (e) { res.status(500).json({ error: e.message || "Gagal membuat Purchase Order" }); }
});
router.patch("/orders/:id/status", requireRole("OWNER", "ADMIN"), async (req, res) => {
  const allowed = ["APPROVED", "SENT_TO_SUPPLIER"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Status PO tidak valid" });
  res.json({ ok: true, order: await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: { status: req.body.status } }) });
});
router.post("/receipts", async (req, res) => {
  const { purchaseOrderId, locationId, deliveryNote, notes, supplierInvoiceNumber, supplierInvoiceDate, supplierInvoiceAmount, supplierInvoiceProofUrl, supplierInvoiceFileName, supplierInvoiceMimeType, supplierInvoiceSize, items = [] } = req.body;
  try {
  const receipt = await prisma.$transaction(async tx => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { items: { include: { item: true } } } });
    if (!po) throw new Error("Purchase Order tidak ditemukan");
    if (!locationId || !items.length) throw new Error("Lokasi dan item penerimaan wajib diisi");
    const invoiceAmount = supplierInvoiceAmount === "" || supplierInvoiceAmount == null ? null : Number(supplierInvoiceAmount);
    if (invoiceAmount != null && (!Number.isFinite(invoiceAmount) || invoiceAmount < 0)) throw new Error("Nilai invoice supplier tidak valid");
    const invoiceDate = supplierInvoiceDate ? new Date(supplierInvoiceDate) : null;
    if (invoiceDate && Number.isNaN(invoiceDate.getTime())) throw new Error("Tanggal invoice supplier tidak valid");
    const rec = await tx.goodsReceipt.create({ data: { number: seq("GR"), purchaseOrderId, locationId, deliveryNote, notes, supplierInvoiceNumber: supplierInvoiceNumber ? String(supplierInvoiceNumber).trim() : null, supplierInvoiceDate: invoiceDate, supplierInvoiceAmount: invoiceAmount == null ? null : Math.round(invoiceAmount), supplierInvoiceProofUrl: supplierInvoiceProofUrl || null, supplierInvoiceFileName: supplierInvoiceFileName || null, supplierInvoiceMimeType: supplierInvoiceMimeType || null, supplierInvoiceSize: Number.isFinite(Number(supplierInvoiceSize)) ? Number(supplierInvoiceSize) : null, createdById: req.user.id } });
    for (const row of items) {
      const poi = po.items.find(i => i.id === row.purchaseOrderItemId); const qty = Number(row.qty);
      if (!poi || qty <= 0 || poi.receivedQty + qty > poi.qty) throw new Error("Jumlah penerimaan melebihi sisa PO");
      const receiptItem = await tx.goodsReceiptItem.create({ data: { receiptId: rec.id, purchaseOrderItemId: poi.id, qty, condition: row.condition || "GOOD" } });
      const batch = await tx.inventoryBatch.create({ data: { itemId: poi.itemId, locationId, goodsReceiptId: rec.id, goodsReceiptItemId: receiptItem.id, purchaseOrderItemId: poi.id, receivedQty: qty, remainingQty: qty, unitPrice: poi.unitPrice, receivedAt: rec.receivedAt } });
      if (poi.item.isSerialized) {
        const units = Array.isArray(row.units) ? row.units : [];
        if (!Number.isInteger(qty) || units.length !== qty) throw new Error(`${poi.item.name}: jumlah serial number harus sama dengan qty diterima`);
        for (const unit of units) {
          const serialNumber = String(unit.serialNumber || "").trim();
          if (!serialNumber) throw new Error(`${poi.item.name}: serial number wajib diisi`);
          await tx.stockUnit.create({ data: { itemId: poi.itemId, locationId, inventoryBatchId: batch.id, serialNumber, barcode: unit.barcode ? String(unit.barcode).trim() : null, purchasePrice: poi.unitPrice, purchasedAt: rec.receivedAt, currency: "IDR", status: "IN_STOCK" } });
        }
      }
      await tx.purchaseOrderItem.update({ where: { id: poi.id }, data: { receivedQty: { increment: qty } } });
      await tx.inventoryStock.upsert({ where: { itemId_locationId: { itemId: poi.itemId, locationId } }, create: { itemId: poi.itemId, locationId, qty }, update: { qty: { increment: qty } } });
      await tx.stockMovement.create({ data: { type: "IN", itemId: poi.itemId, qty, toLocationId: locationId, createdById: req.user.id, note: `Penerimaan ${po.number}` } });
    }
    const all = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } });
    const fullyReceived = all.every(i => i.receivedQty >= i.qty);
    const receiptValue = items.reduce((sum, row) => {
      const poi = po.items.find(i => i.id === row.purchaseOrderItemId);
      return sum + Number(row.qty) * Number(poi?.unitPrice || 0);
    }, 0) + (fullyReceived ? Number(po.tax) + Number(po.shippingCost) - Number(po.discount) : 0);
    if (receiptValue > 0) await postJournal(tx, { date: rec.receivedAt, description: `Penerimaan barang ${rec.number}`, sourceType: "GOODS_RECEIPT", sourceId: rec.id, createdById: req.user.id, lines: [{ code: SYSTEM_ACCOUNTS.INVENTORY, debit: receiptValue }, { code: SYSTEM_ACCOUNTS.AP, credit: receiptValue }] });
    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: fullyReceived ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED" } }); return rec;
  }); res.json({ ok: true, receipt });
  } catch (e) {
    res.status(400).json({ error: e.message || "Gagal menerima barang" });
  }
});
router.post("/payments", async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: req.body.purchaseOrderId }, include: { items: true, payments: true } });
  if (!po || !["PARTIALLY_RECEIVED", "FULLY_RECEIVED"].includes(po.status)) return res.status(400).json({ error: "Pembayaran hanya dapat diajukan setelah barang diterima" });
  const total = po.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0) + po.tax + po.shippingCost - po.discount;
  const committed = po.payments.filter(p => p.status !== "UNPAID").reduce((sum, p) => sum + p.amount, 0);
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0 || amount > total - committed) return res.status(400).json({ error: "Jumlah pembayaran melebihi sisa tagihan" });
  const payment = await prisma.purchasePayment.create({ data: { number: seq("PAY"), purchaseOrderId: req.body.purchaseOrderId, amount, method: req.body.method, reference: req.body.reference, createdById: req.user.id } }); res.json({ ok: true, payment });
});
router.patch("/payments/:id/approve", requireRole("OWNER", "ADMIN"), async (req, res) => {
  const payment = await prisma.$transaction(async tx => {
    const updated = await tx.purchasePayment.update({ where: { id: req.params.id }, data: { status: "PAID", paidAt: new Date(), approvedAt: new Date(), approvedById: req.user.id } });
    await postJournal(tx, { date: updated.paidAt, description: `Pembayaran supplier ${updated.number}`, sourceType: "SUPPLIER_PAYMENT", sourceId: updated.id, createdById: req.user.id, lines: [{ code: SYSTEM_ACCOUNTS.AP, debit: updated.amount }, { code: cashCode(updated.method), credit: updated.amount }] });
    return updated;
  });
  res.json({ ok: true, payment });
});
module.exports = router;
