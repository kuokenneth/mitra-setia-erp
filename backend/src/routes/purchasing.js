const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");
const { SYSTEM_ACCOUNTS, cashCode, postJournal } = require("../services/accounting");
const { esc, num: fmtNum, money, date: fmtDate, documentHtml } = require("../utils/printDocument");
const { notifyOwnerSafely } = require("../services/whatsappNotifications");
const router = express.Router();

const seq = (prefix) => `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
const includePO = { supplier: true, request: { include: { maintenance: { include: { truck: true } } } }, items: { include: { item: true, tireRetread: { include: { stockUnit: true, fromItem: true, toItem: true } }, partRepair: { include: { stockUnit: true } } } }, receipts: { include: { items: { include: { purchaseOrderItem: { include: { item: true } } } }, location: true, createdBy: { select: { name: true } }, supplierBillLine: { include: { bill: true } } } }, payments: { include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } } } };

router.use(authRequired, requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"));
router.get("/overview", async (_req, res) => {
  const [requests, orders, suppliers, locations, items, retreadingUnits, bills] = await Promise.all([
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
        payments: { include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } } },
      },
      orderBy: { invoiceDate: "desc" },
    }),
  ]);
  res.json({ ok: true, requests, orders, suppliers, locations, items, retreadingUnits, bills });
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
    meta: `Status: ${esc(po.status)}<br>Tanggal: ${fmtDate(po.createdAt)}`,
    body: `<div class="summary"><div class="box">Supplier<b>${esc(po.supplier.name)}</b><span>${esc(po.supplier.address || "-")}</span></div><div class="box">Pengiriman<b>${esc(po.deliveryAddress || "-")}</b><span>Estimasi: ${fmtDate(po.estimatedArrival)}</span></div><div class="box">Termin<b>${esc(po.paymentTerms || "-")}</b><span>PR: ${esc(po.request?.number || "-")}</span></div></div><table><thead><tr><th>No</th><th>SKU</th><th>Barang</th><th class="right">Qty</th><th>Satuan</th><th class="right">Harga</th><th class="right">Jumlah</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="6" class="right">Subtotal</td><td class="right">${money(subtotal)}</td></tr><tr><td colspan="6" class="right">Ongkir + Pajak - Diskon</td><td class="right">${money(Number(po.shippingCost) + Number(po.tax) - Number(po.discount))}</td></tr><tr><td colspan="6" class="right"><b>TOTAL</b></td><td class="right"><b>${money(total)}</b></td></tr></tfoot></table><div class="signatures"><div>Dibuat oleh</div><div>Supplier</div><div>Disetujui oleh</div></div>`,
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
router.post("/suppliers", async (req, res) => res.json({ ok: true, supplier: await prisma.supplier.create({ data: req.body }) }));
router.post("/requests", async (req, res) => {
  const { urgency, purpose, truckId, reason, notes, items = [], submit = true, acknowledgeAvailableStock = false } = req.body;
  if (!reason || !items.length) return res.status(400).json({ error: "Alasan dan minimal satu item wajib diisi" });
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
      preparedItems.push({ itemId: row.itemId, originalQty: Number(row.qty), notes: row.notes });
    }
  }
  const request = await prisma.purchaseRequest.create({ data: { number: seq("PR"), urgency, purpose, truckId, reason, notes, status: submit ? "WAITING_APPROVAL" : "DRAFT", createdById: req.user.id, items: { create: preparedItems } }, include: { items: { include: { item: true } } } });
  if (request.status === "WAITING_APPROVAL") {
    await notifyOwnerSafely({
      event: "Permintaan pembelian baru",
      title: request.number,
      details: `${request.items.map(row => `${row.item.name} · ${row.originalQty} ${row.item.unit}`).join(", ")} · ${reason}`,
      path: "/purchasing",
    });
  }
  res.json({ ok: true, request });
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
    if (items.some(i => Number(i.qty) <= 0)) return res.status(400).json({ error: "Jumlah item tidak valid" });
    const request = await prisma.purchaseRequest.findUnique({ where: { id: requestId }, include: { items: { include: { tireRetread: true, partRepair: true } } } });
    if (!request || request.status !== "APPROVED") return res.status(400).json({ error: "Purchase Request belum disetujui" });
    const poItems = items.map(i => {
      const requestItem = request.items.find(row => row.id === i.purchaseRequestItemId) || request.items.find(row => row.itemId === i.itemId);
      if (!requestItem) throw new Error("Item PO tidak sesuai dengan Purchase Request");
      return { itemId: requestItem.itemId, qty: Number(i.qty), unitPrice: 0, tireRetreadId: requestItem.tireRetreadId, partRepairId: requestItem.partRepairId };
    });
    const wrongSupplier = request.items.find(row => row.tireRetread?.supplierId && row.tireRetread.supplierId !== supplierId);
    if (wrongSupplier) throw new Error("Supplier PO harus sama dengan vendor yang dipilih saat Lepas & Masak");
    const po = await prisma.purchaseOrder.create({ data: { number: seq("PO"), requestId, supplierId, tax: Number(tax), shippingCost: Number(shippingCost), discount: Number(discount), paymentTerms, deliveryAddress, estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null, createdById: req.user.id, items: { create: poItems } }, include: includePO });
    await prisma.partRepair.updateMany({ where: { id: { in: request.items.map(row => row.partRepairId).filter(Boolean) } }, data: { supplierId } });
    res.json({ ok: true, order: po });
  } catch (e) { res.status(500).json({ error: e.message || "Gagal membuat Purchase Order" }); }
});
router.patch("/orders/:id/status", requireRole("OWNER", "ADMIN"), async (req, res) => {
  const allowed = ["APPROVED", "SENT_TO_SUPPLIER"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Status PO tidak valid" });
  res.json({ ok: true, order: await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: { status: req.body.status } }) });
});
router.post("/receipts", async (req, res) => {
  const { purchaseOrderId, locationId, deliveryNote, deliveryNoteProofUrl, deliveryNoteFileName, deliveryNoteMimeType, deliveryNoteSize, notes, supplierInvoiceNumber, supplierInvoiceDate, supplierInvoiceAmount, supplierInvoiceProofUrl, supplierInvoiceFileName, supplierInvoiceMimeType, supplierInvoiceSize, items = [] } = req.body;
  try {
  const receipt = await prisma.$transaction(async tx => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { request: { include: { maintenance: true } }, items: { include: { item: true, tireRetread: true, partRepair: true } } } });
    if (!po) throw new Error("Purchase Order tidak ditemukan");
    // The maintenance relation is traceability only. Receipt always enters stock;
    // mechanics install/use the item manually from the linked service afterward.
    const directMaintenance = null;
    if (!locationId || !items.length) throw new Error("Lokasi dan item penerimaan wajib diisi");
    if (!deliveryNoteProofUrl) throw new Error("Foto bukti surat penerimaan wajib dilampirkan");
    const invoiceAmount = supplierInvoiceAmount === "" || supplierInvoiceAmount == null ? null : Number(supplierInvoiceAmount);
    if (invoiceAmount != null && (!Number.isFinite(invoiceAmount) || invoiceAmount < 0)) throw new Error("Nilai invoice supplier tidak valid");
    const invoiceDate = supplierInvoiceDate ? new Date(supplierInvoiceDate) : null;
    if (invoiceDate && Number.isNaN(invoiceDate.getTime())) throw new Error("Tanggal invoice supplier tidak valid");
    const rec = await tx.goodsReceipt.create({ data: { number: seq("GR"), purchaseOrderId, locationId, deliveryNote, deliveryNoteProofUrl, deliveryNoteFileName: deliveryNoteFileName || null, deliveryNoteMimeType: deliveryNoteMimeType || null, deliveryNoteSize: Number.isFinite(Number(deliveryNoteSize)) ? Number(deliveryNoteSize) : null, notes, supplierInvoiceNumber: supplierInvoiceNumber ? String(supplierInvoiceNumber).trim() : null, supplierInvoiceDate: invoiceDate, supplierInvoiceAmount: invoiceAmount == null ? null : Math.round(invoiceAmount), supplierInvoiceProofUrl: supplierInvoiceProofUrl || null, supplierInvoiceFileName: supplierInvoiceFileName || null, supplierInvoiceMimeType: supplierInvoiceMimeType || null, supplierInvoiceSize: Number.isFinite(Number(supplierInvoiceSize)) ? Number(supplierInvoiceSize) : null, createdById: req.user.id } });
    for (const row of items) {
      const poi = po.items.find(i => i.id === row.purchaseOrderItemId); const qty = Number(row.qty);
      if (!poi || qty <= 0 || poi.receivedQty + qty > poi.qty) throw new Error("Jumlah penerimaan melebihi sisa PO");
      const receiptItem = await tx.goodsReceiptItem.create({ data: { receiptId: rec.id, purchaseOrderItemId: poi.id, qty, condition: row.condition || "GOOD" } });
      const batch = directMaintenance ? null : await tx.inventoryBatch.create({ data: { itemId: poi.itemId, locationId, goodsReceiptId: rec.id, goodsReceiptItemId: receiptItem.id, purchaseOrderItemId: poi.id, receivedQty: qty, remainingQty: qty, unitPrice: poi.unitPrice, receivedAt: rec.receivedAt } });
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
          const stockUnit = await tx.stockUnit.create({ data: { itemId: poi.itemId, locationId: directMaintenance ? null : locationId, inventoryBatchId: batch?.id || null, serialNumber, barcode: unit.barcode ? String(unit.barcode).trim() : null, purchasePrice: poi.unitPrice, purchasedAt: rec.receivedAt, currency: "IDR", status: directMaintenance ? "ASSIGNED" : "IN_STOCK" } });
          if (directMaintenance) await tx.truckSparePartAssignment.create({ data: { truckId: directMaintenance.truckId, stockUnitId: stockUnit.id, installedAt: rec.receivedAt, installCost: poi.unitPrice, currency: "IDR", note: `Pembelian langsung ${po.number}`, maintenanceId: directMaintenance.id, createdById: req.user.id } });
        }
      }
      await tx.purchaseOrderItem.update({ where: { id: poi.id }, data: { receivedQty: { increment: qty } } });
      if (directMaintenance) {
        if (!poi.item.isSerialized) await tx.stockMovement.create({ data: { type: "OUT", itemId: poi.itemId, qty, unitPrice: poi.unitPrice, totalCost: Math.round(qty * poi.unitPrice), maintenanceId: directMaintenance.id, createdById: req.user.id, note: `Pembelian langsung & dipakai pada ${directMaintenance.title} · ${po.number}` } });
      } else {
        await tx.inventoryStock.upsert({ where: { itemId_locationId: { itemId: poi.itemId, locationId } }, create: { itemId: poi.itemId, locationId, qty }, update: { qty: { increment: qty } } });
        await tx.stockMovement.create({ data: { type: "IN", itemId: poi.itemId, qty, unitPrice: poi.unitPrice, totalCost: Math.round(qty * poi.unitPrice), toLocationId: locationId, createdById: req.user.id, note: `Penerimaan ${po.number}` } });
      }
    }
    const all = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } });
    const fullyReceived = all.every(i => i.receivedQty >= i.qty);
    const receiptValue = items.reduce((sum, row) => {
      const poi = po.items.find(i => i.id === row.purchaseOrderItemId);
      return sum + Number(row.qty) * Number(poi?.unitPrice || 0);
    }, 0) + (fullyReceived ? Number(po.tax) + Number(po.shippingCost) - Number(po.discount) : 0);
    if (receiptValue > 0) await postJournal(tx, { date: rec.receivedAt, description: `${directMaintenance ? "Pembelian langsung servis" : "Penerimaan barang"} ${rec.number}`, sourceType: "GOODS_RECEIPT", sourceId: rec.id, createdById: req.user.id, lines: [{ code: directMaintenance ? SYSTEM_ACCOUNTS.EXPENSE : SYSTEM_ACCOUNTS.INVENTORY, debit: receiptValue }, { code: SYSTEM_ACCOUNTS.AP, credit: receiptValue }] });
    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: fullyReceived ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED" } }); return rec;
  }); res.json({ ok: true, receipt });
  } catch (e) {
    res.status(400).json({ error: e.message || "Gagal menerima barang" });
  }
});
router.post("/bills", async (req, res) => {
  try {
    const { supplierId, invoiceNumber, invoiceDate, dueDate, notes, proofUrl, proofFileName, proofMimeType, proofSize, receiptIds = [], itemPrices = {} } = req.body;
    if (!supplierId || !String(invoiceNumber || "").trim() || !invoiceDate || !receiptIds.length || !proofUrl) throw new Error("Supplier, nomor invoice, tanggal, penerimaan, dan bukti invoice wajib diisi");
    const ids = [...new Set(receiptIds.map(String))];
    const records = await prisma.goodsReceipt.findMany({ where: { id: { in: ids } }, include: { purchaseOrder: true, supplierBillLine: true, items: { include: { purchaseOrderItem: { include: { item: true } }, inventoryBatch: { include: { stockUnits: true } }, supplierBillItem: true } } } });
    if (records.length !== ids.length) throw new Error("Sebagian penerimaan barang tidak ditemukan");
    if (records.some(row => row.purchaseOrder.supplierId !== supplierId)) throw new Error("Semua penerimaan harus berasal dari supplier yang sama");
    if (records.some(row => row.supplierBillLine)) throw new Error("Ada penerimaan yang sudah masuk tagihan supplier lain");
    const lines = records.flatMap(receipt => receipt.items.map(item => {
      if (item.supplierBillItem) throw new Error(`${item.purchaseOrderItem.item.name} sudah pernah ditagihkan`);
      if (!Object.prototype.hasOwnProperty.call(itemPrices, item.id) || itemPrices[item.id] === "") throw new Error(`Harga ${item.purchaseOrderItem.item.name} wajib diisi`);
      const unitPrice = Math.round(Number(itemPrices[item.id]));
      const isRepair = Boolean(item.purchaseOrderItem.partRepairId);
      if (!Number.isFinite(unitPrice) || unitPrice < 0 || (!isRepair && unitPrice === 0)) throw new Error(isRepair ? `Harga perbaikan ${item.purchaseOrderItem.item.name} tidak valid` : `Harga ${item.purchaseOrderItem.item.name} harus lebih dari Rp0`);
      return { receipt, item, unitPrice, amount: Math.round(Number(item.qty) * unitPrice) };
    }));
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    const allocations = records.map(receipt => ({ receiptId: receipt.id, amount: lines.filter(line => line.receipt.id === receipt.id).reduce((sum, line) => sum + line.amount, 0) }));
    const previousValue = lines.reduce((sum, line) => sum + Number(line.item.qty) * Number(line.item.purchaseOrderItem.unitPrice || 0), 0);
    const bill = await prisma.$transaction(async tx => {
      const created = await tx.supplierBill.create({ data: { number: seq("BILL"), supplierId, invoiceNumber: String(invoiceNumber).trim(), invoiceDate: new Date(invoiceDate), dueDate: dueDate ? new Date(dueDate) : null, amount: total, status: total === 0 ? "PAID" : "OPEN", notes: notes || null, proofUrl, proofFileName: proofFileName || null, proofMimeType: proofMimeType || null, proofSize: Number.isFinite(Number(proofSize)) ? Number(proofSize) : null, createdById: req.user.id, receipts: { create: allocations }, items: { create: lines.map(line => ({ receiptItemId: line.item.id, qty: line.item.qty, unitPrice: line.unitPrice, amount: line.amount })) } } });
      for (const line of lines) {
        await tx.purchaseOrderItem.update({ where: { id: line.item.purchaseOrderItemId }, data: { unitPrice: line.unitPrice } });
        if (line.item.purchaseOrderItem.partRepairId) {
          await tx.partRepair.update({ where: { id: line.item.purchaseOrderItem.partRepairId }, data: { cost: line.unitPrice } });
        }
        if (line.item.inventoryBatch) {
          await tx.inventoryBatch.update({ where: { id: line.item.inventoryBatch.id }, data: { unitPrice: line.unitPrice } });
          await tx.stockUnit.updateMany({ where: { inventoryBatchId: line.item.inventoryBatch.id }, data: { purchasePrice: line.unitPrice } });
        }
        await tx.stockMovement.updateMany({ where: { note: `Penerimaan ${line.receipt.number}`, itemId: line.item.purchaseOrderItem.itemId }, data: { unitPrice: line.unitPrice, totalCost: line.amount } });
      }
      const difference = total - previousValue;
      if (difference !== 0) await postJournal(tx, { date: new Date(invoiceDate), description: `Tagihan supplier ${invoiceNumber}`, sourceType: "SUPPLIER_BILL", sourceId: created.id, createdById: req.user.id, lines: difference > 0 ? [{ code: SYSTEM_ACCOUNTS.INVENTORY, debit: difference }, { code: SYSTEM_ACCOUNTS.AP, credit: difference }] : [{ code: SYSTEM_ACCOUNTS.AP, debit: Math.abs(difference) }, { code: SYSTEM_ACCOUNTS.INVENTORY, credit: Math.abs(difference) }] });
      return tx.supplierBill.findUnique({ where: { id: created.id }, include: { supplier: true, receipts: { include: { receipt: { include: { purchaseOrder: true } } } }, items: true, payments: true } });
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
    const created = await tx.purchasePayment.create({ data: { number: seq("PAY"), supplierBillId: bill.id, amount, method: req.body.method, reference: req.body.reference, proofUrl: req.body.proofUrl, proofFileName: req.body.proofFileName || null, proofMimeType: req.body.proofMimeType || null, proofSize: Number.isFinite(Number(req.body.proofSize)) ? Number(req.body.proofSize) : null, createdById: req.user.id } });
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
