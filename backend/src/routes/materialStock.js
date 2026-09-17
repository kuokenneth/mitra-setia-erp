const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");
const { nextDailyNumber } = require("../utils/documentNumber");
const router = express.Router();
router.use(authRequired, requireRole("OWNER", "ADMIN", "STAFF"));
const clean = value => String(value || "").trim();

router.get("/overview", async (_req, res) => {
  const [customers, storageLocations, destinations, receipts, trips] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.inventoryLocation.findMany({ orderBy: { name: "asc" } }),
    prisma.operationalLocation.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.materialStockReceipt.findMany({ include: { customer: true, location: true, allocations: { include: { materialInvoiceLine: { include: { materialInvoice: { include: { trip: { include: { truck: true } } } } } } } } }, orderBy: { receivedAt: "desc" } }),
    prisma.trip.findMany({ where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, purpose: { not: "EMPTY_RETURN" } }, include: { truck: true, order: true, dispatchLetter: true }, orderBy: { createdAt: "desc" } }),
  ]);
  res.json({ customers, locations: storageLocations, storageLocations, destinations, receipts, trips });
});

router.post("/receipts", async (req, res) => {
  try {
    const body = req.body || {};
    const lines = Array.isArray(body.lines) ? body.lines.map(line => ({ itemName: clean(line.itemName), qty: Number(line.qty), unit: clean(line.unit).toUpperCase() })) : [];
    if (!body.customerId || !lines.length || lines.some(line => !line.itemName || !(line.qty > 0) || !line.unit) || !clean(body.proof && body.proof.url)) throw new Error("Customer, minimal satu barang, jumlah, satuan, dan foto bukti wajib diisi");
    const [customer, storageLocation] = await Promise.all([prisma.customer.findUnique({ where: { id: body.customerId } }), body.locationId ? prisma.inventoryLocation.findUnique({ where: { id: body.locationId } }) : null]);
    if (!customer) throw new Error("Customer wajib berasal dari Master Customer");
    if (!storageLocation) throw new Error("Lokasi penyimpanan wajib berasal dari Lokasi Inventory");
    const receipts = await prisma.$transaction(async tx => {
      const created = [];
      for (const line of lines) {
        const documentNumber = await nextDailyNumber(tx, "materialStockReceipt", "MB");
        created.push(await tx.materialStockReceipt.create({ data: {
          number: documentNumber, customerId: body.customerId,
          itemName: line.itemName, qtyReceived: line.qty, qtyRemaining: line.qty, unit: line.unit,
          sourceName: clean(body.sourceName) || null, deliveryNote: clean(body.deliveryNote) || documentNumber,
          receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(), locationId: body.locationId,
          proofUrl: body.proof.url, proofFileName: body.proof.fileName || null, proofMimeType: body.proof.mimeType || null,
          proofSize: Number(body.proof.size) || null, notes: clean(body.notes) || null, createdById: req.user.id,
        }, include: { customer: true, location: true } }));
      }
      return created;
    });
    const batchRef = receipts[0]?.number || null;
    res.status(201).json({ batchRef, receipts });
  } catch (e) { res.status(400).json({ error: e.message || "Gagal mencatat material masuk" }); }
});

router.get("/available/:customerId", async (req, res) => {
  const rows = await prisma.materialStockReceipt.findMany({ where: { customerId: req.params.customerId, qtyRemaining: { gt: 0 } }, include: { location: true }, orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }] });
  const map = {};
  for (const row of rows) {
    const key = row.itemName.toLowerCase() + "|" + row.unit + "|" + (row.locationId || "");
    if (!map[key]) map[key] = { key, itemName: row.itemName, unit: row.unit, locationId: row.locationId, location: row.location, availableQty: 0 };
    map[key].availableQty += row.qtyRemaining;
  }
  res.json({ groups: Object.values(map) });
});

router.post("/allocate", async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.customerId || !body.tripId || !body.destinationLocationId || !Array.isArray(body.lines) || !body.lines.length) throw new Error("Customer, trip, tujuan, dan material wajib dipilih");
    const [customer, trip, destination] = await Promise.all([
      prisma.customer.findUnique({ where: { id: body.customerId } }),
      prisma.trip.findUnique({
        where: { id: body.tripId },
        include: {
          dispatchLetter: true,
          order: { select: { id: true, cargoCategory: true } },
          orderAllocations: { include: { order: { select: { id: true, cargoCategory: true } } } },
        },
      }),
      prisma.operationalLocation.findFirst({ where: { id: body.destinationLocationId, isActive: true } }),
    ]);
    if (!customer || !trip || !destination) throw new Error("Customer, trip, atau tujuan tidak ditemukan");
    if (["COMPLETED", "CANCELLED"].includes(trip.status)) throw new Error("Trip yang sudah ditutup tidak dapat menerima alokasi material");
    const relatedOrderIds = [...new Set([
      trip.order?.id || null,
      ...trip.orderAllocations.map(row => row.orderId),
    ].filter(Boolean))];
    const materialOrderIds = [...new Set([
      trip.order?.cargoCategory === "MATERIAL" ? trip.order.id : null,
      ...trip.orderAllocations.filter(row => row.order?.cargoCategory === "MATERIAL").map(row => row.orderId),
    ].filter(Boolean))];
    if (trip.purpose === "EMPTY_RETURN") throw new Error("Material tidak dapat dialokasikan ke Trip Kembali Kosong");
    const requestedOrderId = clean(body.orderId) || null;
    if (requestedOrderId && !relatedOrderIds.includes(requestedOrderId)) throw new Error("Order tidak terhubung dengan trip yang dipilih");
    if (!requestedOrderId && materialOrderIds.length > 1) throw new Error("Pilih order material tujuan karena trip memuat lebih dari satu order material");
    const resolvedOrderId = requestedOrderId || (materialOrderIds.length === 1 ? materialOrderIds[0] : null);
    const result = await prisma.$transaction(async tx => {
      const sequence = Math.max(1, Math.round(Number(body.stopSequence) || 1));
      await tx.materialInvoice.updateMany({ where: { tripId: trip.id, stopSequence: { gte: sequence } }, data: { stopSequence: { increment: 1 } } });
      const invoice = await tx.materialInvoice.create({ data: {
        orderId: resolvedOrderId, tripId: trip.id, number: trip.dispatchLetter ? trip.dispatchLetter.number : await nextDailyNumber(tx, "materialInvoice", "FM"),
        materialName: body.lines.length === 1 ? clean(body.lines[0].itemName) : "Multiple materials",
        qty: body.lines.reduce((sum, row) => sum + Number(row.qty || 0), 0), unit: body.lines.length === 1 ? clean(body.lines[0].unit).toUpperCase() : "LINES",
        billingCustomerName: customer.name, destinationLocationId: destination.id, stopSequence: sequence, notes: clean(body.notes) || null,
      } });
      for (const input of body.lines) {
        let remaining = Number(input.qty);
        const unit = clean(input.unit).toUpperCase();
        if (!(remaining > 0)) throw new Error("Jumlah material harus lebih dari nol");
        const stocks = await tx.materialStockReceipt.findMany({ where: { customerId: customer.id, itemName: { equals: clean(input.itemName), mode: "insensitive" }, unit, qtyRemaining: { gt: 0 }, ...(input.locationId ? { locationId: input.locationId } : {}) }, orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }] });
        const available = stocks.reduce((sum, row) => sum + row.qtyRemaining, 0);
        if (available + 1e-9 < remaining) throw new Error(clean(input.itemName) + ": stok hanya " + available + " " + unit);
        const line = await tx.materialInvoiceLine.create({ data: { materialInvoiceId: invoice.id, itemName: clean(input.itemName), qty: remaining, unit, totalKg: input.totalKg === "" || input.totalKg == null ? null : Number(input.totalKg), totalAmount: null } });
        for (const stock of stocks) {
          if (remaining <= 1e-9) break;
          const take = Math.min(remaining, stock.qtyRemaining);
          const reduced = await tx.materialStockReceipt.updateMany({
            where: { id: stock.id, qtyRemaining: { gte: take } },
            data: { qtyRemaining: { decrement: take } },
          });
          if (reduced.count !== 1) throw new Error(clean(input.itemName) + ": stok berubah saat dialokasikan, silakan ulangi");
          await tx.materialStockAllocation.create({ data: { receiptId: stock.id, materialInvoiceLineId: line.id, qty: take } });
          remaining -= take;
        }
      }
      return tx.materialInvoice.findUnique({ where: { id: invoice.id }, include: { lines: { include: { stockAllocations: { include: { receipt: true } } } } } });
    });
    res.status(201).json({ invoice: result });
  } catch (e) { res.status(400).json({ error: e.message || "Gagal mengalokasikan material" }); }
});

module.exports = router;
