const express = require("express");
const { prisma } = require("../prisma");
const { nextDailyNumber } = require("../utils/documentNumber");
const { planReturn } = require("../utils/purchaseReturn");
const { SYSTEM_ACCOUNTS, postJournal } = require("../services/accounting");
const router = express.Router();
const includeItems = {
  purchaseOrderItem: { include: { item: true } },
  receipt: { include: { purchaseOrder: true } },
  inventoryBatch: {
    include: {
      stockUnits: { where: { status: "IN_STOCK" } },
      consumptionAllocations: { include: { movement: { select: { maintenanceId: true, note: true } } } },
    },
  },
  supplierBillItems: { include: { bill: { include: { payments: true } } }, orderBy: { id: "asc" } },
};
router.get("/returns", async (_req, res) => {
  const items = await prisma.purchaseReturn.findMany({ include: { items: { include: { receiptItem: { include: { purchaseOrderItem: { include: { item: true } }, receipt: true } } } } }, orderBy: { createdAt: "desc" } });
  res.json({ items });
});
router.get("/returns/candidates", async (req, res) => {
  const ids = String(req.query.receiptIds || "").split(",").filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: "Pilih penerimaan barang" });
  const items = await prisma.goodsReceiptItem.findMany({ where: { receiptId: { in: ids } }, include: includeItems });
  res.json({ items: items.map(item => ({
    id: item.id, receiptNumber: item.receipt.number, name: item.purchaseOrderItem.item.name,
    unit: item.purchaseOrderItem.item.unit, serialized: item.purchaseOrderItem.item.isSerialized,
    qty: item.qty, returnedQty: item.returnedQty,
    unavailableReason: item.purchaseOrderItem.tireRetreadId || item.purchaseOrderItem.partRepairId ? "Retur jasa perbaikan/retread belum tersedia" : Number(item.inventoryBatch?.remainingQty || 0) <= 0 && item.qty > item.returnedQty ? (item.inventoryBatch?.consumptionAllocations.some(line => line.movement.maintenanceId) ? "Barang tercatat dipakai di servis. Kembalikan dari riwayat pemakaian servis ke Inventory terlebih dahulu." : "Stok batch penerimaan tidak tersedia; periksa riwayat pemakaian atau perpindahan barang.") : null,
    availableQty: item.purchaseOrderItem.tireRetreadId || item.purchaseOrderItem.partRepairId ? 0 : Math.max(0, Math.min(item.qty - item.returnedQty, Number(item.inventoryBatch?.remainingQty || 0))),
    units: (item.inventoryBatch?.stockUnits || []).filter(unit => unit.locationId === item.receipt.locationId).map(unit => ({ id: unit.id, serialNumber: unit.serialNumber || unit.barcode || unit.id })),
  })) });
});
router.post("/returns", async (req, res) => {
  try {
    const { returnDate, reason, notes, proof, items } = req.body;
    const date = new Date(returnDate);
    if (!returnDate || Number.isNaN(date.getTime()) || !String(reason || "").trim()) throw new Error("Tanggal dan alasan retur wajib diisi");
    if (proof && (!proof.url || !["image/jpeg", "image/png", "image/webp"].includes(proof.mimeType))) throw new Error("Foto bukti retur harus JPG, PNG, atau WEBP");
    if (!Array.isArray(items) || !items.length || new Set(items.map(row => row.receiptItemId)).size !== items.length) throw new Error("Pilih barang retur tanpa duplikasi");
    const result = await prisma.$transaction(async tx => {
      const records = await tx.goodsReceiptItem.findMany({ where: { id: { in: items.map(row => row.receiptItemId) } }, include: includeItems });
      if (records.length !== items.length) throw new Error("Barang penerimaan tidak ditemukan");
      const suppliers = new Set(records.map(item => item.receipt.purchaseOrder.supplierId));
      if (suppliers.size !== 1) throw new Error("Retur hanya dapat dibuat untuk satu supplier");
      const number = await nextDailyNumber(tx, "purchaseReturn", "RET");
      const lines = [], billChanges = new Map();
      let value = 0;
      for (const input of items) {
        const item = records.find(row => row.id === input.receiptItemId), qty = Number(input.qty);
        const adjustments = planReturn(item, qty);
        const batch = item.inventoryBatch, master = item.purchaseOrderItem.item;
        if (!batch || Number(batch.remainingQty || 0) + 1e-8 < qty) throw new Error(`${master.name}: stok penerimaan sudah dipakai atau dipindahkan; kembalikan ke lokasi penerimaan dahulu`);
        if (item.purchaseOrderItem.tireRetreadId || item.purchaseOrderItem.partRepairId) throw new Error("Retur jasa perbaikan/retread belum tersedia; pilih penerimaan barang pembelian");
        const units = [...new Set(Array.isArray(input.stockUnitIds) ? input.stockUnitIds : [])];
        if (master.isSerialized) {
          if (!Number.isInteger(qty) || units.length !== qty) throw new Error(`${master.name}: pilih nomor seri sesuai jumlah retur`);
          const changed = await tx.stockUnit.updateMany({ where: { id: { in: units }, inventoryBatchId: batch.id, status: "IN_STOCK", locationId: item.receipt.locationId }, data: { status: "RETURNED_TO_SUPPLIER", locationId: null } });
          if (changed.count !== qty) throw new Error("Sebagian unit sudah dipakai, dipindahkan, atau diretur");
        } else if (units.length) throw new Error("Barang non-serial tidak menggunakan nomor seri");
        const stock = await tx.inventoryStock.updateMany({ where: { itemId: master.id, locationId: item.receipt.locationId, qty: { gte: qty } }, data: { qty: { decrement: qty } } });
        if (stock.count !== 1) throw new Error(`${master.name}: stok lokasi tidak mencukupi`);
        await tx.inventoryBatch.update({ where: { id: batch.id }, data: { remainingQty: { decrement: qty } } });
        await tx.goodsReceiptItem.update({ where: { id: item.id }, data: { returnedQty: { increment: qty } } });
        for (const adjustment of adjustments) {
          const bill = item.supplierBillItems.find(line => line.id === adjustment.lineId).bill;
          if (bill.payments.some(payment => payment.status === "WAITING_PAYMENT_APPROVAL")) throw new Error(`Selesaikan pengajuan pembayaran ${bill.number} sebelum retur`);
          await tx.supplierBillItem.update({ where: { id: adjustment.lineId }, data: { returnedQty: { increment: adjustment.qty }, returnedAmount: { increment: adjustment.amount } } });
          const entry = billChanges.get(bill.id) || { bill, amount: 0 }; entry.amount += adjustment.amount; billChanges.set(bill.id, entry);
        }
        const unitPrice = Number(batch.unitPrice || item.originalUnitPrice || 0), amount = Math.round(qty * unitPrice);
        value += amount;
        lines.push({ receiptItemId: item.id, qty, unitPrice, amount, stockUnitIds: units, billAdjustments: adjustments });
        for (const unitId of master.isSerialized ? units : [null]) {
          await tx.stockMovement.create({ data: { type: "OUT", itemId: master.id, qty: unitId ? 1 : qty, unitPrice, totalCost: unitId ? Math.round(unitPrice) : amount, fromLocationId: item.receipt.locationId, stockUnitId: unitId, createdById: req.user.id, batchAllocations: { create: { batchId: batch.id, qty: unitId ? 1 : qty } }, note: `Retur pembelian ${number} · ${item.receipt.number} · ${reason}` } });
        }
      }
      let creditAmount = 0;
      for (const { bill, amount } of billChanges.values()) {
        const paid = bill.payments.filter(payment => payment.status === "PAID").reduce((sum, payment) => sum + payment.amount, 0);
        const next = Math.max(0, bill.amount - amount);
        creditAmount += Math.max(0, paid - next) - Math.max(0, paid - bill.amount);
        await tx.supplierBill.update({ where: { id: bill.id }, data: { amount: next, status: paid >= next ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "OPEN" } });
      }
      const created = await tx.purchaseReturn.create({ data: { number, supplierId: records[0].receipt.purchaseOrder.supplierId, returnDate: date, reason: String(reason).trim(), notes: notes || null, proofUrl: proof?.url || "", proofFileName: proof?.fileName || null, proofMimeType: proof?.mimeType || "", totalAmount: value, creditAmount, createdById: req.user.id, items: { create: lines } }, include: { items: true } });
      if (value > 0) await postJournal(tx, { date, description: `Retur pembelian ${number}`, sourceType: "PURCHASE_RETURN", sourceId: created.id, createdById: req.user.id, lines: [{ code: SYSTEM_ACCOUNTS.AP, debit: value }, { code: SYSTEM_ACCOUNTS.INVENTORY, credit: value }] });
      return created;
    }, { isolationLevel: "Serializable", timeout: 30000 });
    res.json({ ok: true, purchaseReturn: result });
  } catch (error) { res.status(400).json({ error: error.code === "P2034" ? "Data stok/tagihan berubah. Muat ulang lalu coba kembali." : error.message }); }
});
module.exports = router;
