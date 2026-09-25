const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");
const { SYSTEM_ACCOUNTS, cashCode, postJournal } = require("../services/accounting");
const { esc, num: fmtNum, money, date: fmtDate, documentHtml } = require("../utils/printDocument");
const { notifyOwnerSafely } = require("../services/emailNotifications");
const { nextDailyNumber } = require("../utils/documentNumber");
const router = express.Router();

async function backfillLegacyConsumptionAllocations(tx, batch) {
  const consumedQty = Math.max(0, Number(batch.receivedQty || 0) - Number(batch.remainingQty || 0));
  const existing = await tx.stockMovementBatchAllocation.aggregate({
    where: { batchId: batch.id },
    _sum: { qty: true },
  });
  let qtyToLink = consumedQty - Number(existing._sum.qty || 0);
  if (qtyToLink <= 0.000001 || batch.unitPrice == null) return;

  const candidates = await tx.stockMovement.findMany({
    where: {
      type: "OUT",
      itemId: batch.itemId,
      fromLocationId: batch.locationId,
      stockUnitId: null,
      maintenanceId: { not: null },
      createdAt: { gte: batch.receivedAt },
      unitPrice: batch.unitPrice,
    },
    include: { batchAllocations: { select: { batchId: true, qty: true } } },
    orderBy: { createdAt: "asc" },
  });
  for (const movement of candidates) {
    if (qtyToLink <= 0.000001) break;
    if (movement.batchAllocations.some(allocation => allocation.batchId === batch.id)) continue;
    const alreadyLinked = movement.batchAllocations.reduce((sum, allocation) => sum + Number(allocation.qty), 0);
    const availableQty = Math.max(0, Number(movement.qty) - alreadyLinked);
    const linkedQty = Math.min(availableQty, qtyToLink);
    if (linkedQty <= 0.000001) continue;
    await tx.stockMovementBatchAllocation.create({ data: { movementId: movement.id, batchId: batch.id, qty: linkedQty } });
    qtyToLink -= linkedQty;
  }
}

async function refreshAllocatedMovementCosts(tx, batchId) {
  const allocations = await tx.stockMovementBatchAllocation.findMany({
    where: { batchId },
    select: { movementId: true },
    distinct: ["movementId"],
  });
  for (const { movementId } of allocations) {
    const movement = await tx.stockMovement.findUnique({
      where: { id: movementId },
      include: { batchAllocations: { include: { batch: { select: { unitPrice: true } } } } },
    });
    if (!movement) continue;
    const allocatedQty = movement.batchAllocations.reduce((sum, allocation) => sum + Number(allocation.qty), 0);
    if (allocatedQty + 0.000001 < Number(movement.qty)) continue;
    const fullyPriced = movement.batchAllocations.every(allocation => allocation.batch.unitPrice != null);
    const totalCost = fullyPriced
      ? Math.round(movement.batchAllocations.reduce((sum, allocation) => sum + Number(allocation.qty) * Number(allocation.batch.unitPrice), 0))
      : null;
    const unitPrice = totalCost == null || Number(movement.qty) <= 0 ? null : Math.round(totalCost / Number(movement.qty));
    await tx.stockMovement.update({ where: { id: movement.id }, data: { totalCost, unitPrice } });

    const returns = await tx.stockMovement.findMany({
      where: { type: "IN", note: { startsWith: `RETURN_OF:${movement.id}` } },
      select: { id: true, qty: true },
    });
    for (const returned of returns) {
      await tx.stockMovement.update({
        where: { id: returned.id },
        data: { unitPrice, totalCost: unitPrice == null ? null : Math.round(Number(returned.qty) * unitPrice) },
      });
    }
  }
}

const includePO = { supplier: true, request: { include: { maintenance: { include: { truck: true } } } }, cancelledBy: { select: { id: true, name: true, email: true } }, items: { include: { item: true, tireRetread: { include: { stockUnit: true, fromItem: true, toItem: true } }, partRepair: { include: { stockUnit: true } } } }, receipts: { include: { items: { include: { purchaseOrderItem: { include: { item: true } }, supplierBillItem: { include: { bill: true } } } }, location: true, createdBy: { select: { name: true } }, supplierBillLines: { include: { bill: true } } } }, payments: { include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } } } };

router.use(authRequired, requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"));
router.get("/overview", async (_req, res) => {
  const [requests, orders, suppliers, locations, items, retreadingUnits, bills, trucks] = await Promise.all([
    prisma.purchaseRequest.findMany({ include: { maintenance: { include: { truck: true } }, items: { include: { item: true, tireRetread: { include: { stockUnit: true, fromItem: true, toItem: true } }, partRepair: { include: { stockUnit: true } } } }, createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.purchaseOrder.findMany({ include: includePO, orderBy: { createdAt: "desc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }), prisma.inventoryLocation.findMany({ orderBy: { name: "asc" } }), prisma.item.findMany({ orderBy: { name: "asc" } }),
    prisma.stockUnit.findMany({
      where: { status: "RETREADING", tireRetreads: { some: { status: "SENT" } } },
      include: {
        item: true,
        tireRetreads: {
          where: { status: "SENT" },
          include: { toItem: true, supplier: true },
          orderBy: { sentAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.supplierBill.findMany({
      include: {
        supplier: true,
        receipts: { include: { receipt: { include: { purchaseOrder: true } } } },
        items: { include: { receiptItem: { include: { purchaseOrderItem: { include: { item: true } }, receipt: true } } } },
        attachments: true,
        payments: { include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } } },
      },
      orderBy: { invoiceDate: "desc" },
    }),
    prisma.truck.findMany({ orderBy: { plateNumber: "asc" }, select: { id: true, plateNumber: true, brand: true, model: true } }),
  ]);
  res.json({ ok: true, requests, orders, suppliers, locations, items, retreadingUnits, bills, trucks });
});
router.get("/orders/:id/print", async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include: includePO });
  if (!po) return res.status(404).json({ error: "Purchase Order tidak ditemukan" });
  const subtotal = po.items.reduce((sum, item) => sum + Number(item.qty) * Number(item.unitPrice), 0);
  const total = subtotal + Number(po.tax) + Number(po.shippingCost) - Number(po.discount);
  const rows = po.items.map((item, index) => `<tr><td class="center">${index + 1}</td><td>${esc(item.item.sku)}</td><td>${esc(item.item.name)}</td><td class="right">${fmtNum(item.qty)}</td><td>${esc(item.item.unit)}</td><td class="right">${money(item.unitPrice)}</td><td class="right">${money(Number(item.qty) * Number(item.unitPrice))}</td></tr>`).join("");
  res.type("html").send(documentHtml({
    title: "PURCHASE ORDER",
    subtitle: po.number,
    meta: `Status: ${esc(po.status)}<br>Tanggal: ${fmtDate(po.createdAt)}${po.status === "CANCELLED" ? `<br>Dibatalkan: ${fmtDate(po.cancelledAt, true)}<br>Alasan: ${esc(po.cancellationReason || "-")}` : ""}`,
    body: `<div class="summary"><div class="box">Supplier<b>${esc(po.supplier.name)}</b><span>${esc(po.supplier.address || "-")}</span></div><div class="box">Pengiriman<b>${esc(po.deliveryAddress || "-")}</b><span>Estimasi: ${fmtDate(po.estimatedArrival)}</span></div><div class="box">Termin<b>${esc(po.paymentTerms || "-")}</b><span>PR: ${esc(po.request?.number || "-")}</span></div></div><table><thead><tr><th>No</th><th>SKU</th><th>Barang</th><th class="right">Qty</th><th>Satuan</th><th class="right">Harga</th><th class="right">Jumlah</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="6" class="right">Subtotal</td><td class="right">${money(subtotal)}</td></tr><tr><td colspan="6" class="right">Ongkir + Pajak - Diskon</td><td class="right">${money(Number(po.shippingCost) + Number(po.tax) - Number(po.discount))}</td></tr><tr><td colspan="6" class="right"><b>TOTAL</b></td><td class="right"><b>${money(total)}</b></td></tr></tfoot></table><div class="signatures"><div>Dibuat oleh</div><div>Supplier</div><div>Disetujui oleh</div></div>`,
  }));
});
router.get("/receipts/group/print", async (req, res) => {
  const ids = [...new Set(String(req.query.ids || "").split(",").map(id => id.trim()).filter(Boolean))];
  if (!ids.length) return res.status(400).json({ error: "Penerimaan barang wajib dipilih" });
  const receipts = await prisma.goodsReceipt.findMany({
    where: { id: { in: ids } },
    include: { purchaseOrder: { include: { supplier: true } }, location: true, createdBy: { select: { name: true } }, items: { include: { purchaseOrderItem: { include: { item: true } } } } },
    orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
  });
  if (receipts.length !== ids.length) return res.status(404).json({ error: "Sebagian penerimaan barang tidak ditemukan" });
  if (new Set(receipts.map(receipt => receipt.purchaseOrder.supplierId)).size !== 1) return res.status(400).json({ error: "Penerimaan gabungan harus berasal dari supplier yang sama" });
  const first = receipts[0];
  const rows = receipts.flatMap(receipt => receipt.items.map(item => ({ receipt, item }))).map((row, index) => `<tr><td class="center">${index + 1}</td><td>${esc(row.receipt.number)}<br><span class="muted">${esc(row.receipt.purchaseOrder.number)}</span></td><td>${esc(row.item.purchaseOrderItem.item.sku)}</td><td>${esc(row.item.purchaseOrderItem.item.name)}</td><td class="right">${fmtNum(row.item.qty)}</td><td>${esc(row.item.purchaseOrderItem.item.unit)}</td><td>${esc(row.item.condition)}</td></tr>`).join("");
  const receiptDetails = receipts.map(receipt => `<tr><td>${esc(receipt.number)}</td><td>${fmtDate(receipt.receivedAt, true)}</td><td>${esc(receipt.purchaseOrder.number)}</td><td>${esc(receipt.location.name)}</td><td>${esc(receipt.createdBy?.name || "-")}</td></tr>`).join("");
  res.type("html").send(documentHtml({
    title: "BUKTI PENERIMAAN BARANG",
    subtitle: `Surat jalan ${esc(first.deliveryNote || "-")}`,
    meta: `Tanggal terima: ${fmtDate(first.receivedAt, true)}<br>${receipts.length} penerimaan · ${new Set(receipts.map(receipt => receipt.purchaseOrderId)).size} PO`,
    body: `<div class="summary"><div class="box">Supplier<b>${esc(first.purchaseOrder.supplier.name)}</b></div><div class="box">Surat jalan<b>${esc(first.deliveryNote || "-")}</b></div><div class="box">Bukti penerimaan<b>${esc(first.deliveryNoteFileName || "Foto tersimpan")}</b></div></div><table><thead><tr><th>No</th><th>GR / PO</th><th>SKU</th><th>Barang</th><th class="right">Diterima</th><th>Satuan</th><th>Kondisi</th></tr></thead><tbody>${rows}</tbody></table><h3>Rincian penerimaan</h3><table><thead><tr><th>Nomor GR</th><th>Tanggal</th><th>PO</th><th>Lokasi</th><th>Penerima</th></tr></thead><tbody>${receiptDetails}</tbody></table><table><tbody><tr><th style="width:28%">Catatan</th><td>${esc(receipts.map(receipt => receipt.notes).filter(Boolean).join(" · ") || "-")}</td></tr></tbody></table><div class="signatures"><div>Pengirim / Supplier</div><div>Penerima</div><div>Diperiksa oleh</div></div>`,
  }));
});
router.get("/receipts/:id/print", async (req, res) => {
  const receipt = await prisma.goodsReceipt.findUnique({
    where: { id: req.params.id },
    include: { purchaseOrder: { include: { supplier: true } }, location: true, createdBy: { select: { name: true } }, items: { include: { purchaseOrderItem: { include: { item: true } } } } },
  });
  if (!receipt) return res.status(404).json({ error: "Penerimaan barang tidak ditemukan" });
  const rows = receipt.items.map((row, index) => `<tr><td class="center">${index + 1}</td><td>${esc(row.purchaseOrderItem.item.sku)}</td><td>${esc(row.purchaseOrderItem.item.name)}</td><td class="right">${fmtNum(row.qty)}</td><td>${esc(row.purchaseOrderItem.item.unit)}</td><td>${esc(row.condition)}</td></tr>`).join("");
  res.type("html").send(documentHtml({
    title: "BUKTI PENERIMAAN BARANG",
    subtitle: receipt.number,
    meta: `Tanggal terima: ${fmtDate(receipt.receivedAt, true)}<br>PO: ${esc(receipt.purchaseOrder.number)}`,
    body: `<div class="summary"><div class="box">Supplier<b>${esc(receipt.purchaseOrder.supplier.name)}</b></div><div class="box">Lokasi penerimaan<b>${esc(receipt.location.name)}</b></div><div class="box">Penerima<b>${esc(receipt.createdBy?.name || "-")}</b></div></div><table><thead><tr><th>No</th><th>SKU</th><th>Barang</th><th class="right">Diterima</th><th>Satuan</th><th>Kondisi</th></tr></thead><tbody>${rows}</tbody></table><table><tbody><tr><th style="width:28%">Surat jalan supplier</th><td>${esc(receipt.deliveryNote || "-")}</td></tr><tr><th>Bukti surat penerimaan</th><td>${receipt.deliveryNoteProofUrl ? esc(receipt.deliveryNoteFileName || "Foto bukti tersimpan") : "-"}</td></tr><tr><th>Catatan</th><td>${esc(receipt.notes || "-")}</td></tr></tbody></table><div class="signatures"><div>Pengirim / Supplier</div><div>Penerima</div><div>Diperiksa oleh</div></div>`,
  }));
});
router.get("/bills/:id/receipt-print", async (req, res) => {
  const bill = await prisma.supplierBill.findUnique({
    where: { id: req.params.id },
    include: {
      supplier: true,
      createdBy: { select: { name: true } },
      items: {
        include: {
          receiptItem: {
            include: {
              purchaseOrderItem: { include: { item: true, purchaseOrder: true } },
              receipt: { include: { location: true, createdBy: { select: { name: true } }, purchaseOrder: true } },
            },
          },
        },
      },
    },
  });
  if (!bill) return res.status(404).json({ error: "Tagihan supplier tidak ditemukan" });
  const selectedRows = bill.items.map(line => ({ line, receiptItem: line.receiptItem, receipt: line.receiptItem.receipt, poItem: line.receiptItem.purchaseOrderItem }));
  const receipts = [...new Map(selectedRows.map(row => [row.receipt.id, row.receipt])).values()];
  const poNumbers = [...new Set(selectedRows.map(row => row.poItem.purchaseOrder.number))];
  const locations = [...new Set(receipts.map(receipt => receipt.location?.name).filter(Boolean))];
  const receivers = [...new Set(receipts.map(receipt => receipt.createdBy?.name).filter(Boolean))];
  const rows = selectedRows.map((row, index) => `<tr><td class="center">${index + 1}</td><td>${esc(row.receipt.number)}<br><span class="muted">${esc(row.poItem.purchaseOrder.number)}</span></td><td>${esc(row.poItem.item.sku)}</td><td>${esc(row.poItem.item.name)}</td><td class="right">${fmtNum(row.line.qty)}</td><td>${esc(row.poItem.item.unit)}</td><td>${esc(row.receiptItem.condition)}</td></tr>`).join("");
  const receiptDetails = receipts.map(receipt => `<tr><td>${esc(receipt.number)}</td><td>${fmtDate(receipt.receivedAt, true)}</td><td>${esc(receipt.purchaseOrder.number)}</td><td>${esc(receipt.deliveryNote || "-")}</td><td>${esc(receipt.location?.name || "-")}</td><td>${esc(receipt.notes || "-")}</td></tr>`).join("");
  res.type("html").send(documentHtml({
    title: "BUKTI PENERIMAAN BARANG",
    subtitle: `${bill.number} · Invoice ${bill.invoiceNumber}`,
    meta: `Tanggal invoice: ${fmtDate(bill.invoiceDate)}<br>PO: ${esc(poNumbers.join(", ") || "-")}<br>${selectedRows.length} barang dari ${receipts.length} penerimaan`,
    body: `<div class="summary"><div class="box">Supplier<b>${esc(bill.supplier.name)}</b></div><div class="box">Lokasi penerimaan<b>${esc(locations.join(", ") || "-")}</b></div><div class="box">Penerima<b>${esc(receivers.join(", ") || bill.createdBy?.name || "-")}</b></div></div><table><thead><tr><th>No</th><th>GR / PO</th><th>SKU</th><th>Barang</th><th class="right">Diterima</th><th>Satuan</th><th>Kondisi</th></tr></thead><tbody>${rows}</tbody></table><h3>Rincian penerimaan</h3><table><thead><tr><th>Nomor GR</th><th>Tanggal terima</th><th>PO</th><th>Surat jalan</th><th>Lokasi</th><th>Catatan</th></tr></thead><tbody>${receiptDetails}</tbody></table><div class="signatures"><div>Pengirim / Supplier</div><div>Penerima</div><div>Diperiksa oleh</div></div>`,
  }));
});
router.post("/suppliers", async (req, res) => res.json({ ok: true, supplier: await prisma.supplier.create({ data: req.body }) }));
router.post("/requests", async (req, res) => {
  const { urgency, purpose, truckId, reason, notes, items = [], submit = true, acknowledgeAvailableStock = false, damageProofUrl, damageProofFileName, damageProofMimeType, damageProofSize } = req.body;
  if (!reason || !items.length) return res.status(400).json({ error: "Alasan dan minimal satu item wajib diisi" });
  if (!['STOCK', 'TRUCK'].includes(purpose)) return res.status(400).json({ error: "Tujuan permintaan tidak valid" });
  if (purpose === "TRUCK" && !truckId) return res.status(400).json({ error: "Pilih truk tujuan permintaan" });
  if (purpose === "TRUCK" && !(await prisma.truck.findUnique({ where: { id: String(truckId) }, select: { id: true } }))) {
    return res.status(400).json({ error: "Truk tujuan tidak ditemukan" });
  }
  if (!damageProofUrl || !String(damageProofMimeType || "").startsWith("image/")) return res.status(400).json({ error: "Foto bukti barang rusak wajib dilampirkan" });
  const regularItemIds = items.filter(row => row.itemId && !row.retreadUnitId).map(row => String(row.itemId));
  if (regularItemIds.length && !acknowledgeAvailableStock) {
    const catalogItems = await prisma.item.findMany({
      where: { id: { in: regularItemIds } },
      include: { stocks: true },
    });
    const serializedCounts = await prisma.stockUnit.groupBy({
      by: ["itemId"],
      where: { itemId: { in: regularItemIds }, status: "IN_STOCK" },
      _count: { _all: true },
    });
    const serializedByItem = new Map(serializedCounts.map(row => [row.itemId, row._count._all]));
    const available = catalogItems
      .map(item => ({
        item,
        qty: item.isSerialized
          ? Number(serializedByItem.get(item.id) || 0)
          : item.stocks.reduce((sum, stock) => sum + Number(stock.qty || 0), 0),
      }))
      .filter(row => row.qty > 0);
    if (available.length) {
      return res.status(409).json({
        error: `Stok masih tersedia: ${available.map(row => `${row.item.name} (${row.qty.toLocaleString("id-ID")} ${row.item.unit})`).join(", ")}. Periksa Inventory atau konfirmasi untuk tetap membuat permintaan.`,
        code: "STOCK_AVAILABLE",
      });
    }
  }
  const preparedItems = [];
  for (const row of items) {
    if (row.retreadUnitId) {
      const unit = await prisma.stockUnit.findUnique({
        where: { id: String(row.retreadUnitId) },
        include: { tireRetreads: { where: { status: "SENT" }, orderBy: { sentAt: "desc" }, take: 1 } },
      });
      const retread = unit?.tireRetreads?.[0];
      if (!unit || unit.status !== "RETREADING" || !retread) throw new Error("Ban tidak lagi berstatus retreading");
      const existingRequest = await prisma.purchaseRequestItem.findFirst({
        where: { tireRetreadId: retread.id, request: { status: { not: "REJECTED" } } },
      });
      if (existingRequest) throw new Error(`${unit.serialNumber || unit.id} sudah memiliki Permintaan Pembelian retreading`);
      preparedItems.push({ itemId: retread.toItemId, originalQty: 1, notes: row.notes, tireRetreadId: retread.id });
    } else {
      const requestedQty = purpose === "STOCK" ? 0 : Number(row.qty);
      if (purpose !== "STOCK" && (!Number.isFinite(requestedQty) || requestedQty <= 0)) {
        return res.status(400).json({ error: "Jumlah kebutuhan untuk truk wajib lebih dari 0" });
      }
      preparedItems.push({ itemId: row.itemId, originalQty: requestedQty, notes: row.notes });
    }
  }
  const request = await prisma.$transaction(async tx => tx.purchaseRequest.create({ data: { number: await nextDailyNumber(tx, "purchaseRequest", "PR"), urgency, purpose, truckId, reason, notes, damageProofUrl, damageProofFileName: damageProofFileName || null, damageProofMimeType, damageProofSize: damageProofSize == null ? null : Number(damageProofSize), status: submit ? "WAITING_APPROVAL" : "DRAFT", createdById: req.user.id, items: { create: preparedItems } }, include: { items: { include: { item: true } } } }));
  if (request.status === "WAITING_APPROVAL") {
    await notifyOwnerSafely({
      event: "Permintaan pembelian baru",
      title: request.number,
      details: `${request.items.map(row => `${row.item.name} · ${purpose === "STOCK" && !row.tireRetreadId ? "jumlah ditentukan saat PO" : `${row.originalQty} ${row.item.unit}`}`).join(", ")} · ${reason}`,
      path: `/purchasing?approveRequest=${encodeURIComponent(request.id)}`,
      actionLabel: "Setujui Permintaan",
      proof: { url: request.damageProofUrl, fileName: request.damageProofFileName, mimeType: request.damageProofMimeType },
    });
  }
  res.json({ ok: true, request });
});
router.post("/orders/direct", requireRole("OWNER"), async (req, res) => {
  try {
    const {
      itemId,
      supplierId,
      qty,
      reason,
      notes,
      paymentTerms = "Ditagihkan kemudian",
      deliveryAddress,
      estimatedArrival,
    } = req.body || {};
    const quantity = Number(qty);
    if (!itemId || !supplierId) return res.status(400).json({ error: "Barang dan supplier wajib dipilih" });
    if (!Number.isFinite(quantity) || quantity <= 0) return res.status(400).json({ error: "Jumlah pesanan wajib lebih dari 0" });

    const [item, supplier] = await Promise.all([
      prisma.item.findUnique({ where: { id: String(itemId) } }),
      prisma.supplier.findUnique({ where: { id: String(supplierId) } }),
    ]);
    if (!item) return res.status(404).json({ error: "Barang tidak ditemukan" });
    if (!supplier) return res.status(404).json({ error: "Supplier tidak ditemukan" });

    const result = await prisma.$transaction(async tx => {
      const request = await tx.purchaseRequest.create({
        data: {
          number: await nextDailyNumber(tx, "purchaseRequest", "PR"),
          status: "APPROVED",
          urgency: "NORMAL",
          purpose: "STOCK",
          reason: String(reason || `Pembelian langsung ${item.name}`).trim(),
          notes: notes ? String(notes).trim() : null,
          createdById: req.user.id,
          approvedById: req.user.id,
          approvedAt: new Date(),
          approvalNotes: "Pembelian langsung oleh owner; persetujuan dilewati.",
          items: { create: [{ itemId: item.id, originalQty: quantity, approvedQty: quantity }] },
        },
      });
      const order = await tx.purchaseOrder.create({
        data: {
          number: await nextDailyNumber(tx, "purchaseOrder", "PO"),
          requestId: request.id,
          supplierId: supplier.id,
          status: "SENT_TO_SUPPLIER",
          paymentTerms: String(paymentTerms || "Ditagihkan kemudian").trim(),
          deliveryAddress: deliveryAddress ? String(deliveryAddress).trim() : null,
          estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null,
          createdById: req.user.id,
          items: { create: [{ itemId: item.id, qty: quantity, unitPrice: 0 }] },
        },
        include: includePO,
      });
      return { request, order };
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message || "Gagal membuat PO langsung" });
  }
});
router.patch("/requests/:id/approval", requireRole("OWNER", "ADMIN"), async (req, res) => {
  const { approved, notes, quantities = {}, acknowledgeAvailableStock = false } = req.body;
  if (approved && !acknowledgeAvailableStock) {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { item: { include: { stocks: true } } } } },
    });
    if (!request) return res.status(404).json({ error: "Purchase Request tidak ditemukan" });
    const regularRows = request.items.filter(row => !row.tireRetreadId && !row.partRepairId);
    const serializedIds = regularRows.filter(row => row.item.isSerialized).map(row => row.itemId);
    const serializedCounts = serializedIds.length
      ? await prisma.stockUnit.groupBy({
          by: ["itemId"],
          where: { itemId: { in: serializedIds }, status: "IN_STOCK" },
          _count: { _all: true },
        })
      : [];
    const serializedByItem = new Map(serializedCounts.map(row => [row.itemId, row._count._all]));
    const available = regularRows
      .map(row => ({
        item: row.item,
        qty: row.item.isSerialized
          ? Number(serializedByItem.get(row.itemId) || 0)
          : row.item.stocks.reduce((sum, stock) => sum + Number(stock.qty || 0), 0),
      }))
      .filter(row => row.qty > 0);
    if (available.length) {
      return res.status(409).json({
        error: `Stok masih tersedia: ${available.map(row => `${row.item.name} (${row.qty.toLocaleString("id-ID")} ${row.item.unit})`).join(", ")}. Konfirmasi untuk tetap menyetujui permintaan.`,
        code: "STOCK_AVAILABLE",
      });
    }
  }
  const result = await prisma.$transaction(async tx => {
    for (const [id, qty] of Object.entries(quantities)) {
      const item = await tx.purchaseRequestItem.findUnique({ where: { id } });
      await tx.purchaseRequestItem.update({ where: { id }, data: { approvedQty: item?.tireRetreadId || item?.partRepairId ? 1 : Number(qty) } });
    }
    return tx.purchaseRequest.update({ where: { id: req.params.id }, data: { status: approved ? "APPROVED" : "REJECTED", approvedById: req.user.id, approvedAt: new Date(), approvalNotes: notes } });
  }); res.json({ ok: true, request: result });
});
router.post("/orders", async (req, res) => {
  try {
    const { requestId, supplierId, tax = 0, shippingCost = 0, discount = 0, paymentTerms, deliveryAddress, estimatedArrival, items = [] } = req.body;
    if (!requestId || !supplierId || !items.length) return res.status(400).json({ error: "Request, supplier, dan item wajib diisi" });
    const request = await prisma.purchaseRequest.findUnique({ where: { id: requestId }, include: { items: { include: { tireRetread: true, partRepair: true } } } });
    if (!request || request.status !== "APPROVED") return res.status(400).json({ error: "Purchase Request belum disetujui" });
    const poItems = items.map(i => {
      const requestItem = request.items.find(row => row.id === i.purchaseRequestItemId) || request.items.find(row => row.itemId === i.itemId);
      if (!requestItem) throw new Error("Item PO tidak sesuai dengan Purchase Request");
      const qty = requestItem.tireRetreadId || requestItem.partRepairId
        ? 1
        : request.purpose === "STOCK"
          ? Number(i.qty)
          : Number(requestItem.approvedQty ?? requestItem.originalQty);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error(request.purpose === "STOCK" ? "Jumlah PO persediaan umum wajib lebih dari 0" : "Jumlah item tidak valid");
      return { itemId: requestItem.itemId, qty, unitPrice: 0, tireRetreadId: requestItem.tireRetreadId, partRepairId: requestItem.partRepairId };
    });
    const wrongSupplier = request.items.find(row => row.tireRetread?.supplierId && row.tireRetread.supplierId !== supplierId);
    if (wrongSupplier) throw new Error("Supplier PO harus sama dengan vendor yang dipilih saat Lepas & Masak");
    const po = await prisma.$transaction(async tx => tx.purchaseOrder.create({ data: { number: await nextDailyNumber(tx, "purchaseOrder", "PO"), requestId, supplierId, tax: Number(tax), shippingCost: Number(shippingCost), discount: Number(discount), paymentTerms, deliveryAddress, estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null, createdById: req.user.id, items: { create: poItems } }, include: includePO }));
    await prisma.partRepair.updateMany({ where: { id: { in: request.items.map(row => row.partRepairId).filter(Boolean) } }, data: { supplierId } });
    res.json({ ok: true, order: po });
  } catch (e) { res.status(500).json({ error: e.message || "Gagal membuat Purchase Order" }); }
});
router.patch("/orders/:id/status", requireRole("OWNER", "ADMIN"), async (req, res) => {
  const allowed = ["APPROVED", "SENT_TO_SUPPLIER"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Status PO tidak valid" });
  res.json({ ok: true, order: await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: { status: req.body.status } }) });
});
router.patch("/orders/:id/cancel", requireRole("OWNER", "ADMIN"), async (req, res) => {
  try {
    const reason = String(req.body.reason || "").trim();
    if (reason.length < 3) throw new Error("Alasan pembatalan wajib diisi");
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: { receipts: { select: { id: true } }, payments: { select: { id: true } }, items: { select: { receivedQty: true } } },
    });
    if (!order) return res.status(404).json({ error: "Purchase Order tidak ditemukan" });
    if (order.status === "CANCELLED") throw new Error("Purchase Order sudah dibatalkan");
    if (!["DRAFT", "APPROVED", "SENT_TO_SUPPLIER"].includes(order.status)) throw new Error("PO dengan status ini tidak dapat dibatalkan");
    if (order.receipts.length || order.items.some(item => Number(item.receivedQty || 0) > 0)) throw new Error("PO yang sudah menerima barang tidak dapat dibatalkan");
    if (order.payments.length) throw new Error("PO yang sudah memiliki pembayaran tidak dapat dibatalkan");
    const updated = await prisma.$transaction(async tx => {
      const cancelledAt = new Date();
      await tx.purchaseRequest.update({
        where: { id: order.requestId },
        data: { status: "CANCELLED", approvalNotes: reason, approvedById: req.user.id, approvedAt: cancelledAt },
      });
      return tx.purchaseOrder.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledAt, cancellationReason: reason, cancelledById: req.user.id }, include: includePO });
    });
    res.json({ ok: true, order: updated });
  } catch (error) {
    res.status(400).json({ error: error.message || "Gagal membatalkan Purchase Order" });
  }
});
async function createGoodsReceipt(tx, payload, userId) {
    const { purchaseOrderId, locationId, deliveryNote, deliveryNoteProofUrl, deliveryNoteFileName, deliveryNoteMimeType, deliveryNoteSize, notes, supplierInvoiceNumber, supplierInvoiceDate, supplierInvoiceAmount, supplierInvoiceProofUrl, supplierInvoiceFileName, supplierInvoiceMimeType, supplierInvoiceSize, items = [] } = payload;
    const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { request: { include: { maintenance: true } }, items: { include: { item: true, tireRetread: true, partRepair: true } } } });
    if (!po) throw new Error("Purchase Order tidak ditemukan");
    if (!["SENT_TO_SUPPLIER", "PARTIALLY_RECEIVED"].includes(po.status)) throw new Error(po.status === "CANCELLED" ? "Purchase Order sudah dibatalkan" : "Purchase Order belum siap menerima barang");
    // Service requests marked for direct use still enter the receiving location
    // first, then leave it immediately for the linked truck. This preserves the
    // auditable IN -> OUT stock trail without leaving artificial warehouse stock.
    const isDirectServiceRequest = Boolean(po.request?.directUse || po.request?.purpose === "MAINTENANCE_STOCK_REQUEST");
    if (isDirectServiceRequest && po.request?.maintenance?.status !== "OPEN") throw new Error("Servis tujuan sudah tidak terbuka; barang tidak dapat langsung dipakai ke mobil");
    const directMaintenance = isDirectServiceRequest ? po.request.maintenance : null;
    if (!locationId || !items.length) throw new Error("Lokasi dan item penerimaan wajib diisi");
    if (!deliveryNoteProofUrl) throw new Error("Foto bukti surat penerimaan wajib dilampirkan");
    const invoiceAmount = supplierInvoiceAmount === "" || supplierInvoiceAmount == null ? null : Number(supplierInvoiceAmount);
    if (invoiceAmount != null && (!Number.isFinite(invoiceAmount) || invoiceAmount < 0)) throw new Error("Nilai invoice supplier tidak valid");
    const invoiceDate = supplierInvoiceDate ? new Date(supplierInvoiceDate) : null;
    if (invoiceDate && Number.isNaN(invoiceDate.getTime())) throw new Error("Tanggal invoice supplier tidak valid");
    const rec = await tx.goodsReceipt.create({ data: { number: await nextDailyNumber(tx, "goodsReceipt", "GR"), purchaseOrderId, locationId, deliveryNote, deliveryNoteProofUrl, deliveryNoteFileName: deliveryNoteFileName || null, deliveryNoteMimeType: deliveryNoteMimeType || null, deliveryNoteSize: Number.isFinite(Number(deliveryNoteSize)) ? Number(deliveryNoteSize) : null, notes, supplierInvoiceNumber: supplierInvoiceNumber ? String(supplierInvoiceNumber).trim() : null, supplierInvoiceDate: invoiceDate, supplierInvoiceAmount: invoiceAmount == null ? null : Math.round(invoiceAmount), supplierInvoiceProofUrl: supplierInvoiceProofUrl || null, supplierInvoiceFileName: supplierInvoiceFileName || null, supplierInvoiceMimeType: supplierInvoiceMimeType || null, supplierInvoiceSize: Number.isFinite(Number(supplierInvoiceSize)) ? Number(supplierInvoiceSize) : null, createdById: userId } });
    for (const row of items) {
      const poi = po.items.find(i => i.id === row.purchaseOrderItemId); const qty = Number(row.qty); const unitPrice = Math.round(Number(row.unitPrice));
      if (!poi || qty <= 0 || poi.receivedQty + qty > poi.qty) throw new Error("Jumlah penerimaan melebihi sisa PO");
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error(`${poi.item.name}: harga satuan sementara wajib lebih dari Rp0`);
      poi.unitPrice = unitPrice;
      const receiptItem = await tx.goodsReceiptItem.create({ data: { receiptId: rec.id, purchaseOrderItemId: poi.id, qty, condition: row.condition || "GOOD" } });
      const batch = await tx.inventoryBatch.create({ data: { itemId: poi.itemId, locationId, goodsReceiptId: rec.id, goodsReceiptItemId: receiptItem.id, purchaseOrderItemId: poi.id, receivedQty: qty, remainingQty: qty, unitPrice: poi.unitPrice, receivedAt: rec.receivedAt } });
      await tx.inventoryStock.upsert({ where: { itemId_locationId: { itemId: poi.itemId, locationId } }, create: { itemId: poi.itemId, locationId, qty }, update: { qty: { increment: qty } } });
      await tx.stockMovement.create({ data: { type: "IN", itemId: poi.itemId, qty, unitPrice: poi.unitPrice, totalCost: Math.round(qty * poi.unitPrice), toLocationId: locationId, maintenanceId: directMaintenance?.id || null, createdById: userId, note: `${directMaintenance ? `Penerimaan untuk servis ${directMaintenance.title}` : "Penerimaan"} · ${po.number}` } });
      if (poi.item.isSerialized) {
        const units = poi.tireRetreadId
          ? [{ retreadUnitId: poi.tireRetread.stockUnitId }]
          : poi.partRepairId
            ? [{ repairUnitId: poi.partRepair.stockUnitId }]
          : (Array.isArray(row.units) ? row.units : []);
        if (!Number.isInteger(qty) || units.length !== qty) throw new Error(`${poi.item.name}: jumlah serial number harus sama dengan qty diterima`);
        for (const unit of units) {
          if (unit.retreadUnitId) {
            if (poi.item.category !== "TIRE") throw new Error(`${poi.item.name}: hasil retreading hanya dapat diterima sebagai item kategori Ban`);
            const existingUnit = await tx.stockUnit.findUnique({
              where: { id: String(unit.retreadUnitId) },
              include: {
                tireRetreads: {
                  where: { status: "SENT" },
                  orderBy: { sentAt: "desc" },
                  take: 1,
                },
              },
            });
            if (!existingUnit || existingUnit.status !== "RETREADING") throw new Error("Unit retreading tidak ditemukan atau sudah diterima");
            const retread = existingUnit.tireRetreads[0];
            if (!retread) throw new Error(`Proses retreading aktif untuk ${existingUnit.serialNumber || existingUnit.id} tidak ditemukan`);
            if (retread.toItemId !== poi.itemId) throw new Error(`${existingUnit.serialNumber || existingUnit.id}: item Ban Masak tidak sesuai dengan item PO`);
            if (retread.supplierId && retread.supplierId !== po.supplierId) throw new Error(`${existingUnit.serialNumber || existingUnit.id}: vendor retreading tidak sama dengan supplier PO`);

            await tx.stockUnit.update({
              where: { id: existingUnit.id },
              data: {
                itemId: poi.itemId,
                locationId,
                inventoryBatchId: batch.id,
                purchasePrice: poi.unitPrice,
                status: "IN_STOCK",
                retreadCount: { increment: 1 },
                lastRetreadAt: rec.receivedAt,
                totalRetreadCost: { increment: poi.unitPrice },
              },
            });
            await tx.tireRetread.update({
              where: { id: retread.id },
              data: {
                status: "COMPLETED",
                completedAt: rec.receivedAt,
                cost: poi.unitPrice,
                supplierId: retread.supplierId || po.supplierId,
              },
            });
            continue;
          }
          if (unit.repairUnitId) {
            const existingUnit = await tx.stockUnit.findUnique({ where: { id: String(unit.repairUnitId) }, include: { partRepairs: { where: { status: "SENT" }, orderBy: { sentAt: "desc" }, take: 1 } } });
            if (!existingUnit || existingUnit.status !== "REPAIRING") throw new Error("Unit perbaikan tidak ditemukan atau sudah diterima");
            const repair = existingUnit.partRepairs[0];
            if (!repair || repair.id !== poi.partRepairId) throw new Error("Proses perbaikan unit tidak sesuai dengan PO");
            await tx.stockUnit.update({ where: { id: existingUnit.id }, data: { locationId, inventoryBatchId: batch.id, purchasePrice: poi.unitPrice, status: "IN_STOCK" } });
            await tx.partRepair.update({ where: { id: repair.id }, data: { status: "COMPLETED", completedAt: rec.receivedAt, cost: poi.unitPrice, supplierId: repair.supplierId || po.supplierId } });
            continue;
          }
          const serialNumber = String(unit.serialNumber || "").trim();
          if (!serialNumber) throw new Error(`${poi.item.name}: serial number wajib diisi`);
          const stockUnit = await tx.stockUnit.create({ data: { itemId: poi.itemId, locationId, inventoryBatchId: batch.id, serialNumber, barcode: unit.barcode ? String(unit.barcode).trim() : null, purchasePrice: poi.unitPrice, purchasedAt: rec.receivedAt, currency: "IDR", status: "IN_STOCK" } });
          if (directMaintenance) {
            await tx.truckSparePartAssignment.create({ data: { truckId: directMaintenance.truckId, stockUnitId: stockUnit.id, installedAt: rec.receivedAt, installCost: poi.unitPrice, currency: "IDR", note: `Pembelian langsung ${po.number}`, maintenanceId: directMaintenance.id, createdById: userId } });
            await tx.stockUnit.update({ where: { id: stockUnit.id }, data: { status: "ASSIGNED", locationId: null } });
            await tx.stockMovement.create({ data: { type: "OUT", itemId: poi.itemId, qty: 1, unitPrice: poi.unitPrice, totalCost: poi.unitPrice, fromLocationId: locationId, toTruckId: directMaintenance.truckId, maintenanceId: directMaintenance.id, stockUnitId: stockUnit.id, createdById: userId, note: `Langsung dipasang pada ${directMaintenance.title} · ${po.number}` } });
          }
        }
      }
      await tx.purchaseOrderItem.update({ where: { id: poi.id }, data: { receivedQty: { increment: qty }, unitPrice } });
      if (directMaintenance) {
        await tx.inventoryStock.update({ where: { itemId_locationId: { itemId: poi.itemId, locationId } }, data: { qty: { decrement: qty } } });
        await tx.inventoryBatch.update({ where: { id: batch.id }, data: { remainingQty: { decrement: qty } } });
        if (!poi.item.isSerialized) {
          const existingTruckStock = await tx.truckPartStock.findUnique({ where: { truckId_itemId: { truckId: directMaintenance.truckId, itemId: poi.itemId } } });
          const oldQty = Number(existingTruckStock?.qty || 0);
          const oldValue = existingTruckStock?.unitPrice == null ? 0 : oldQty * Number(existingTruckStock.unitPrice);
          const nextUnitPrice = oldQty > 0 && existingTruckStock?.unitPrice == null ? null : Math.round((oldValue + qty * poi.unitPrice) / (oldQty + qty));
          await tx.truckPartStock.upsert({ where: { truckId_itemId: { truckId: directMaintenance.truckId, itemId: poi.itemId } }, create: { truckId: directMaintenance.truckId, itemId: poi.itemId, qty, unitPrice: poi.unitPrice }, update: { qty: { increment: qty }, unitPrice: nextUnitPrice } });
          const outMovement = await tx.stockMovement.create({ data: { type: "OUT", itemId: poi.itemId, qty, unitPrice: poi.unitPrice, totalCost: Math.round(qty * poi.unitPrice), fromLocationId: locationId, toTruckId: directMaintenance.truckId, maintenanceId: directMaintenance.id, createdById: userId, note: `Pembelian langsung & dipakai pada ${directMaintenance.title} · ${po.number}` } });
          await tx.stockMovementBatchAllocation.create({ data: { movementId: outMovement.id, batchId: batch.id, qty } });
        }
      }
    }
    const all = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } });
    const fullyReceived = all.every(i => i.receivedQty >= i.qty);
    const receiptValue = items.reduce((sum, row) => {
      const poi = po.items.find(i => i.id === row.purchaseOrderItemId);
      return sum + Number(row.qty) * Number(poi?.unitPrice || 0);
    }, 0) + (fullyReceived ? Number(po.tax) + Number(po.shippingCost) - Number(po.discount) : 0);
    if (receiptValue > 0) await postJournal(tx, { date: rec.receivedAt, description: `${directMaintenance ? "Pembelian langsung servis" : "Penerimaan barang"} ${rec.number}`, sourceType: "GOODS_RECEIPT", sourceId: rec.id, createdById: userId, lines: [{ code: directMaintenance ? SYSTEM_ACCOUNTS.EXPENSE : SYSTEM_ACCOUNTS.INVENTORY, debit: receiptValue }, { code: SYSTEM_ACCOUNTS.AP, credit: receiptValue }] });
    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: fullyReceived ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED" } }); return rec;
}

router.post("/receipts", async (req, res) => {
  try {
    const receipt = await prisma.$transaction(tx => createGoodsReceipt(tx, req.body, req.user.id), { timeout: 30000 });
    res.json({ ok: true, receipt });
  } catch (e) {
    res.status(400).json({ error: e.message || "Gagal menerima barang" });
  }
});

router.post("/receipts/batch", async (req, res) => {
  try {
    const entries = Array.isArray(req.body.receipts) ? req.body.receipts : [];
    if (!entries.length) throw new Error("Pilih minimal satu Purchase Order untuk diterima");
    const ids = [...new Set(entries.map(entry => String(entry.purchaseOrderId || "")).filter(Boolean))];
    if (ids.length !== entries.length) throw new Error("Daftar Purchase Order penerimaan tidak valid");
    const receipts = await prisma.$transaction(async tx => {
      const orders = await tx.purchaseOrder.findMany({ where: { id: { in: ids } }, select: { id: true, supplierId: true } });
      if (orders.length !== ids.length) throw new Error("Salah satu Purchase Order tidak ditemukan");
      if (new Set(orders.map(order => order.supplierId)).size !== 1) throw new Error("Penerimaan gabungan hanya dapat dibuat untuk supplier yang sama");
      const created = [];
      for (const entry of entries) {
        created.push(await createGoodsReceipt(tx, { ...req.body, purchaseOrderId: entry.purchaseOrderId, items: entry.items, receipts: undefined }, req.user.id));
      }
      return created;
    }, { timeout: 30000 });
    res.json({ ok: true, receipts });
  } catch (e) {
    res.status(400).json({ error: e.message || "Gagal menerima beberapa Purchase Order" });
  }
});
router.post("/bills", async (req, res) => {
  try {
    const { supplierId, invoiceNumber, invoiceDate, dueDate, notes, proofUrl, proofFileName, proofMimeType, proofSize, proofs = [], receiptIds = [], itemIds = [], itemPrices = {} } = req.body;
    const attachments = (Array.isArray(proofs) && proofs.length ? proofs : proofUrl ? [{ url: proofUrl, fileName: proofFileName, mimeType: proofMimeType, size: proofSize }] : []).filter(file => file?.url);
    if (!supplierId || !String(invoiceNumber || "").trim() || !invoiceDate || !receiptIds.length || !itemIds.length || !attachments.length) throw new Error("Supplier, nomor invoice, tanggal, barang penerimaan, dan minimal satu lampiran invoice wajib diisi");
    const ids = [...new Set(receiptIds.map(String))];
    const selectedItemIds = new Set(itemIds.map(String));
    const records = await prisma.goodsReceipt.findMany({ where: { id: { in: ids } }, include: { purchaseOrder: true, items: { include: { purchaseOrderItem: { include: { item: true } }, inventoryBatch: { include: { stockUnits: true } }, supplierBillItem: true } } } });
    if (records.length !== ids.length) throw new Error("Sebagian penerimaan barang tidak ditemukan");
    if (records.some(row => row.purchaseOrder.supplierId !== supplierId)) throw new Error("Semua penerimaan harus berasal dari supplier yang sama");
    const lines = records.flatMap(receipt => receipt.items.filter(item => selectedItemIds.has(item.id)).map(item => {
      if (item.supplierBillItem) throw new Error(`${item.purchaseOrderItem.item.name} sudah pernah ditagihkan`);
      if (!Object.prototype.hasOwnProperty.call(itemPrices, item.id) || itemPrices[item.id] === "") throw new Error(`Harga ${item.purchaseOrderItem.item.name} wajib diisi`);
      const unitPrice = Math.round(Number(itemPrices[item.id]));
      const isRepair = Boolean(item.purchaseOrderItem.partRepairId);
      if (!Number.isFinite(unitPrice) || unitPrice < 0 || (!isRepair && unitPrice === 0)) throw new Error(isRepair ? `Harga perbaikan ${item.purchaseOrderItem.item.name} tidak valid` : `Harga ${item.purchaseOrderItem.item.name} harus lebih dari Rp0`);
      return { receipt, item, unitPrice, amount: Math.round(Number(item.qty) * unitPrice) };
    }));
    if (lines.length !== selectedItemIds.size) throw new Error("Sebagian barang penerimaan tidak ditemukan atau tidak sesuai supplier");
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    const allocations = records.map(receipt => ({ receiptId: receipt.id, amount: lines.filter(line => line.receipt.id === receipt.id).reduce((sum, line) => sum + line.amount, 0) }));
    const previousValue = lines.reduce((sum, line) => sum + Number(line.item.qty) * Number(line.item.purchaseOrderItem.unitPrice || 0), 0);
    const bill = await prisma.$transaction(async tx => {
      const primaryProof = attachments[0];
      const created = await tx.supplierBill.create({ data: { number: await nextDailyNumber(tx, "supplierBill", "BILL"), supplierId, invoiceNumber: String(invoiceNumber).trim(), invoiceDate: new Date(invoiceDate), dueDate: dueDate ? new Date(dueDate) : null, amount: total, status: total === 0 ? "PAID" : "OPEN", notes: notes || null, proofUrl: primaryProof.url, proofFileName: primaryProof.fileName || null, proofMimeType: primaryProof.mimeType || null, proofSize: Number.isFinite(Number(primaryProof.size)) ? Number(primaryProof.size) : null, createdById: req.user.id, receipts: { create: allocations }, items: { create: lines.map(line => ({ receiptItemId: line.item.id, qty: line.item.qty, unitPrice: line.unitPrice, amount: line.amount })) }, attachments: { create: attachments.map(file => ({ url: file.url, fileName: file.fileName || null, mimeType: file.mimeType || null, size: Number.isFinite(Number(file.size)) ? Number(file.size) : null })) } } });
      for (const line of lines) {
        await tx.purchaseOrderItem.update({ where: { id: line.item.purchaseOrderItemId }, data: { unitPrice: line.unitPrice } });
        if (line.item.purchaseOrderItem.partRepairId) {
          await tx.partRepair.update({ where: { id: line.item.purchaseOrderItem.partRepairId }, data: { cost: line.unitPrice } });
        }
        if (line.item.inventoryBatch) {
          await backfillLegacyConsumptionAllocations(tx, line.item.inventoryBatch);
          await tx.inventoryBatch.update({ where: { id: line.item.inventoryBatch.id }, data: { unitPrice: line.unitPrice } });
          await tx.stockUnit.updateMany({ where: { inventoryBatchId: line.item.inventoryBatch.id }, data: { purchasePrice: line.unitPrice } });
          await tx.truckSparePartAssignment.updateMany({ where: { stockUnit: { inventoryBatchId: line.item.inventoryBatch.id } }, data: { installCost: line.unitPrice } });
          await refreshAllocatedMovementCosts(tx, line.item.inventoryBatch.id);
        }
        await tx.stockMovement.updateMany({ where: { note: `Penerimaan ${line.receipt.number}`, itemId: line.item.purchaseOrderItem.itemId }, data: { unitPrice: line.unitPrice, totalCost: line.amount } });
      }
      const difference = total - previousValue;
      if (difference !== 0) await postJournal(tx, { date: new Date(invoiceDate), description: `Tagihan supplier ${invoiceNumber}`, sourceType: "SUPPLIER_BILL", sourceId: created.id, createdById: req.user.id, lines: difference > 0 ? [{ code: SYSTEM_ACCOUNTS.INVENTORY, debit: difference }, { code: SYSTEM_ACCOUNTS.AP, credit: difference }] : [{ code: SYSTEM_ACCOUNTS.AP, debit: Math.abs(difference) }, { code: SYSTEM_ACCOUNTS.INVENTORY, credit: Math.abs(difference) }] });
      return tx.supplierBill.findUnique({ where: { id: created.id }, include: { supplier: true, receipts: { include: { receipt: { include: { purchaseOrder: true } } } }, items: true, attachments: true, payments: true } });
    });
    res.status(201).json({ ok: true, bill });
  } catch (e) { res.status(e.code === "P2002" ? 409 : 400).json({ error: e.code === "P2002" ? "Nomor invoice supplier sudah pernah dicatat" : e.message || "Gagal mencatat tagihan supplier" }); }
});

router.post("/payments", async (req, res) => {
  const bill = await prisma.supplierBill.findUnique({ where: { id: req.body.supplierBillId }, include: { payments: true } });
  if (!bill || ["PAID", "VOID"].includes(bill.status)) return res.status(400).json({ error: "Tagihan supplier tidak tersedia untuk dibayar" });
  const committed = bill.payments.filter(p => p.status !== "UNPAID").reduce((sum, p) => sum + p.amount, 0);
  const amount = Math.round(Number(req.body.amount));
  if (!amount || amount <= 0 || amount > bill.amount - committed) return res.status(400).json({ error: "Jumlah pembayaran melebihi sisa tagihan supplier" });
  if (!req.body.proofUrl) return res.status(400).json({ error: "Bukti pembayaran wajib dilampirkan" });
  const payment = await prisma.$transaction(async tx => {
    const created = await tx.purchasePayment.create({ data: { number: await nextDailyNumber(tx, "purchasePayment", "PAY"), supplierBillId: bill.id, amount, method: req.body.method, reference: req.body.reference, proofUrl: req.body.proofUrl, proofFileName: req.body.proofFileName || null, proofMimeType: req.body.proofMimeType || null, proofSize: Number.isFinite(Number(req.body.proofSize)) ? Number(req.body.proofSize) : null, createdById: req.user.id } });
    await tx.supplierBill.update({ where: { id: bill.id }, data: { status: "WAITING_PAYMENT_APPROVAL" } });
    return created;
  });
  res.json({ ok: true, payment });
});
router.patch("/payments/:id/approve", requireRole("OWNER", "ADMIN"), async (req, res) => {
  const payment = await prisma.$transaction(async tx => {
    const updated = await tx.purchasePayment.update({ where: { id: req.params.id }, data: { status: "PAID", paidAt: new Date(), approvedAt: new Date(), approvedById: req.user.id } });
    await postJournal(tx, { date: updated.paidAt, description: `Pembayaran supplier ${updated.number}`, sourceType: "SUPPLIER_PAYMENT", sourceId: updated.id, createdById: req.user.id, lines: [{ code: SYSTEM_ACCOUNTS.AP, debit: updated.amount }, { code: cashCode(updated.method), credit: updated.amount }] });
    if (updated.supplierBillId) {
      const bill = await tx.supplierBill.findUnique({ where: { id: updated.supplierBillId }, include: { payments: true } });
      const paid = bill.payments.filter(row => row.status === "PAID").reduce((sum, row) => sum + row.amount, 0);
      await tx.supplierBill.update({ where: { id: bill.id }, data: { status: paid >= bill.amount ? "PAID" : "PARTIALLY_PAID" } });
    }
    return updated;
  });
  res.json({ ok: true, payment });
});
module.exports = router;
