// backend/src/routes/maintenance.js
const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { nextDailyNumber } = require("../utils/documentNumber");
const { SYSTEM_ACCOUNTS, postJournal } = require("../services/accounting");

const router = express.Router();
const OIL_CHANGE_INTERVAL_KM = 8500;
const { notifyOwnerSafely } = require("../services/emailNotifications");

function canWrite(user) {
  return ["OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"].includes(user?.role);
}

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

////////////////////////////////////////////////////
// TRUCKS FOR DROPDOWN (maintenance create)
// ✅ IMPORTANT: put BEFORE "/:id" route, so it won't be eaten by :id
// GET /maintenance/trucks?q=...
////////////////////////////////////////////////////
router.get("/trucks", authRequired, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    const where = {
      status: { in: ["READY", "MAINTENANCE"] },
      ...(q ? { plateNumber: { contains: q } } : {}),
    };

    const trucks = await prisma.truck.findMany({
      where,
      orderBy: { plateNumber: "asc" },
      take: 200,
    });

    const truckIds = trucks.map((truck) => truck.id);
    const [previousOilChanges, previousServices, activeServices] = await Promise.all([
      prisma.truckMaintenance.findMany({
        where: { truckId: { in: truckIds }, isOilChange: true, status: "DONE" },
        orderBy: [{ oilChangedAt: "desc" }, { createdAt: "desc" }],
        select: { id: true, truckId: true, oilChangedAt: true, odometerKm: true, photos: true },
      }),
      prisma.truckMaintenance.findMany({
        where: { truckId: { in: truckIds }, status: "DONE" },
        orderBy: [{ doneAt: "desc" }, { createdAt: "desc" }],
        select: { id: true, truckId: true, title: true, status: true, createdAt: true, doneAt: true, odometerKm: true },
      }),
      prisma.truckMaintenance.findMany({
        where: { truckId: { in: truckIds }, status: "OPEN" },
        orderBy: { createdAt: "desc" },
        select: { id: true, truckId: true, number: true, title: true, createdAt: true },
      }),
    ]);
    const previousByTruck = new Map();
    for (const change of previousOilChanges) {
      if (!previousByTruck.has(change.truckId)) previousByTruck.set(change.truckId, change);
    }
    const previousServiceByTruck = new Map();
    for (const service of previousServices) {
      if (!previousServiceByTruck.has(service.truckId)) previousServiceByTruck.set(service.truckId, service);
    }
    const activeServiceByTruck = new Map();
    for (const service of activeServices) {
      if (!activeServiceByTruck.has(service.truckId)) activeServiceByTruck.set(service.truckId, service);
    }

    res.json({ trucks: trucks.map((truck) => ({ ...truck, lastOilChange: previousByTruck.get(truck.id) || null, lastService: previousServiceByTruck.get(truck.id) || null, activeService: activeServiceByTruck.get(truck.id) || null })) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load trucks" });
  }
});

////////////////////////////////////////////////////
// LIST
// GET /maintenance?status=OPEN&truckId=...&q=...&from=...&to=...&page=1
////////////////////////////////////////////////////
router.get("/", authRequired, async (req, res) => {
  try {
    const { status, truckId, q, from, to } = req.query;
    const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 10;

    const where = {};
    if (status) where.status = status;
    if (truckId) where.truckId = truckId;

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    if (q && String(q).trim()) {
      const qq = String(q).trim();
      where.OR = [{ number: { contains: qq } }, { title: { contains: qq } }, { truck: { plateNumber: { contains: qq } } }];
    }

    const [total, statusCounts] = await prisma.$transaction([
      prisma.truckMaintenance.count({ where }),
      prisma.truckMaintenance.groupBy({ by: ["status"], where, _count: { _all: true } }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, totalPages);
    const jobs = await prisma.truckMaintenance.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, number: true, title: true, status: true, createdAt: true, doneAt: true, truck: { select: { id: true, plateNumber: true, brand: true, model: true } } },
    });

    const summary = { total, open: 0, done: 0, cancelled: 0 };
    for (const row of statusCounts) summary[String(row.status).toLowerCase()] = row._count._all;
    res.json({ jobs, pagination: { page, limit, total, totalPages }, summary });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load maintenance list" });
  }
});

////////////////////////////////////////////////////
// CREATE
// POST /maintenance
// body: { truckId, title, note?, odometerKm? }
// ✅ Also sets truck.status = MAINTENANCE
////////////////////////////////////////////////////
router.post("/", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });

    const { truckId, title, note, odometerKm } = req.body || {};
    if (!truckId) return res.status(400).json({ error: "truckId is required" });
    if (!title || !String(title).trim()) return res.status(400).json({ error: "title is required" });
    const nextOdometer = odometerKm != null && odometerKm !== "" ? num(odometerKm, null) : null;

    const truck = await prisma.truck.findUnique({ where: { id: truckId } });
    if (!truck) return res.status(404).json({ error: "Truck not found" });

    const activeService = await prisma.truckMaintenance.findFirst({ where: { truckId, status: "OPEN" }, select: { number: true, title: true } });
    if (activeService) return res.status(409).json({ error: `Mobil sedang menjalani servis ${activeService.number} · ${activeService.title}. Selesaikan atau batalkan servis tersebut terlebih dahulu.`, code: "TRUCK_ALREADY_IN_MAINTENANCE" });

    if (truck.status === "DISPATCH") {
      return res.status(400).json({ error: "Truck is DISPATCH (on trip). Cannot create maintenance." });
    }

    const job = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.truckMaintenance.findFirst({ where: { truckId, status: "OPEN" }, select: { number: true, title: true } });
      if (duplicate) {
        const error = new Error(`Mobil sedang menjalani servis ${duplicate.number} · ${duplicate.title}. Selesaikan atau batalkan servis tersebut terlebih dahulu.`);
        error.statusCode = 409;
        throw error;
      }
      const created = await tx.truckMaintenance.create({
        data: {
          number: await nextDailyNumber(tx, "truckMaintenance", "SRV"),
          truckId,
          title: String(title).trim(),
          note: note ? String(note) : null,
          odometerKm: nextOdometer,
          status: "OPEN",
        },
        include: { truck: true },
      });

      await tx.truck.update({
        where: { id: truckId },
        data: { status: "MAINTENANCE" },
      });

      return created;
    });

    res.json({ job });
  } catch (e) {
    console.error(e);
    res.status(e.statusCode || 500).json({ error: e.statusCode ? e.message : "Failed to create maintenance job" });
  }
});

// Purchase request created from a maintenance job. It remains linked to the
// service, while received goods follow the normal inventory flow.
router.post("/:id/purchase-requests", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const maintenance = await prisma.truckMaintenance.findUnique({ where: { id: req.params.id }, include: { truck: true } });
    if (!maintenance || maintenance.status !== "OPEN") return res.status(400).json({ error: "Permintaan hanya dapat dibuat pada servis yang masih terbuka" });
    const qty = Number(req.body.qty);
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: "Jumlah barang harus lebih dari nol" });
    if (!req.body.damageProofUrl || !String(req.body.damageProofMimeType || "").startsWith("image/")) return res.status(400).json({ error: "Foto bukti barang rusak wajib dilampirkan" });

    let itemId = req.body.itemId;
    if (!itemId && req.body.newItem) {
      const input = req.body.newItem;
      if (!String(input.sku || "").trim() || !String(input.name || "").trim()) return res.status(400).json({ error: "SKU dan nama sparepart baru wajib diisi" });
      const created = await prisma.item.create({ data: { sku: String(input.sku).trim(), name: String(input.name).trim(), unit: String(input.unit || "PCS").trim(), isSerialized: Boolean(input.isSerialized), category: input.category || "GENERAL_SPAREPART" } });
      itemId = created.id;
    }
    const item = itemId ? await prisma.item.findUnique({ where: { id: itemId } }) : null;
    if (!item) return res.status(400).json({ error: "Sparepart wajib dipilih" });
    if (!req.body.acknowledgeAvailableStock) {
      const availableQty = item.isSerialized
        ? await prisma.stockUnit.count({ where: { itemId: item.id, status: "IN_STOCK" } })
        : (await prisma.inventoryStock.aggregate({ where: { itemId: item.id }, _sum: { qty: true } }))._sum.qty || 0;
      if (Number(availableQty) > 0) {
        return res.status(409).json({
          error: `Stok ${item.name} masih tersedia ${Number(availableQty).toLocaleString("id-ID")} ${item.unit}. Periksa Inventory atau konfirmasi untuk tetap membuat permintaan.`,
          code: "STOCK_AVAILABLE",
        });
      }
    }

    const request = await prisma.$transaction(async tx => tx.purchaseRequest.create({
      data: {
        number: await nextDailyNumber(tx, "purchaseRequest", "PR"),
        status: "WAITING_APPROVAL",
        urgency: req.body.urgency || "URGENT",
        purpose: "MAINTENANCE_STOCK_REQUEST",
        truckId: maintenance.truckId,
        maintenanceId: maintenance.id,
        directUse: true,
        reason: String(req.body.reason || `Kebutuhan sparepart servis ${maintenance.title}`).trim(),
        notes: req.body.notes ? String(req.body.notes).trim() : null,
        damageProofUrl: req.body.damageProofUrl,
        damageProofFileName: req.body.damageProofFileName || null,
        damageProofMimeType: req.body.damageProofMimeType,
        damageProofSize: req.body.damageProofSize == null ? null : Number(req.body.damageProofSize),
        createdById: req.user.id,
        items: { create: [{ itemId: item.id, originalQty: qty, notes: req.body.notes ? String(req.body.notes).trim() : null }] },
      },
      include: { items: { include: { item: true } }, maintenance: { include: { truck: true } } },
    }));
    await notifyOwnerSafely({
      event: "Permintaan sparepart servis",
      title: `${request.number} · ${maintenance.truck?.plateNumber || "Armada"}`,
      details: `${item.name} · ${qty.toLocaleString("id-ID")} ${item.unit} · ${request.reason}`,
      path: `/purchasing?approveRequest=${encodeURIComponent(request.id)}`,
      actionLabel: "Setujui Permintaan",
      proof: { url: request.damageProofUrl, fileName: request.damageProofFileName, mimeType: request.damageProofMimeType },
    });
    res.status(201).json({ ok: true, request });
  } catch (e) {
    res.status(e.code === "P2002" ? 409 : 400).json({ error: e.code === "P2002" ? "SKU atau nama sparepart sudah digunakan" : e.message || "Gagal membuat permintaan pembelian servis" });
  }
});

// Last time a specific sparepart was installed or consumed on this truck.
router.get("/:id/part-history/:itemId", authRequired, async (req, res) => {
  try {
    const job = await prisma.truckMaintenance.findUnique({
      where: { id: req.params.id },
      select: { truckId: true },
    });
    if (!job) return res.status(404).json({ error: "Maintenance job not found" });

    const [assignment, movement] = await Promise.all([
      prisma.truckSparePartAssignment.findFirst({
        where: { truckId: job.truckId, stockUnit: { itemId: req.params.itemId } },
        orderBy: { installedAt: "desc" },
        select: {
          installedAt: true,
          maintenance: { select: { id: true, title: true, status: true } },
          stockUnit: { select: { serialNumber: true, barcode: true } },
          createdBy: { select: { name: true } },
        },
      }),
      prisma.stockMovement.findFirst({
        where: {
          itemId: req.params.itemId,
          type: "OUT",
          maintenance: { truckId: job.truckId },
        },
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          qty: true,
          maintenance: { select: { id: true, title: true, status: true } },
          createdBy: { select: { name: true } },
        },
      }),
    ]);

    const installed = assignment ? {
      usedAt: assignment.installedAt,
      qty: 1,
      serialNumber: assignment.stockUnit.serialNumber || assignment.stockUnit.barcode || null,
      maintenance: assignment.maintenance,
      createdBy: assignment.createdBy,
      source: "SERIALIZED",
    } : null;
    const consumed = movement ? {
      usedAt: movement.createdAt,
      qty: movement.qty,
      serialNumber: null,
      maintenance: movement.maintenance,
      createdBy: movement.createdBy,
      source: "STOCK",
    } : null;
    const history = [installed, consumed].filter(Boolean).sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))[0] || null;
    if (history) history.daysAgo = Math.max(0, Math.floor((Date.now() - new Date(history.usedAt).getTime()) / 86400000));
    res.json({ ok: true, history });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Gagal memuat riwayat penggantian sparepart" });
  }
});

////////////////////////////////////////////////////
// DETAIL
// GET /maintenance/:id
////////////////////////////////////////////////////
router.get("/:id", authRequired, async (req, res) => {
  try {
    const id = req.params.id;

    const job = await prisma.truckMaintenance.findUnique({
      where: { id },
      include: {
        truck: true,
        sparePartAssignments: {
          orderBy: { installedAt: "desc" },
          include: {
            stockUnit: { include: { item: true, location: true } },
            createdBy: true,
          },
        },
        movements: {
          orderBy: { createdAt: "desc" },
          include: { item: true, fromLocation: true, toLocation: true, fromTruck: true, toTruck: true, createdBy: true, stockUnit: true },
        },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { createdBy: { select: { id: true, name: true, email: true, role: true } } },
        },
        purchaseRequests: { select: { id: true, number: true, status: true, urgency: true, purpose: true, directUse: true, createdAt: true, damageProofUrl: true, damageProofFileName: true, damageProofMimeType: true, purchaseOrders: { select: { id: true, number: true, status: true, items: { select: { itemId: true, qty: true, receivedQty: true } } }, orderBy: { createdAt: "desc" } }, items: { select: { id: true, itemId: true, originalQty: true, approvedQty: true, item: { select: { id: true, sku: true, name: true, unit: true } } } } }, orderBy: { createdAt: "desc" } },
        partRepairs: { include: { stockUnit: { include: { item: true } }, supplier: true }, orderBy: { createdAt: "desc" } },
      },
    });

    if (!job) return res.status(404).json({ error: "Maintenance job not found" });
    job.previousOilChange = await prisma.truckMaintenance.findFirst({
      where: { truckId: job.truckId, isOilChange: true, status: "DONE", id: { not: job.id } },
      orderBy: [{ oilChangedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, oilChangedAt: true, odometerKm: true, photos: true, movements: { where: { item: { category: "OIL" } }, include: { item: true } } },
    });
    const serializedCost = (job.sparePartAssignments || []).reduce((sum, a) => {
     if (a.removedAt) return sum;
     const v = Number(a.installCost || 0);
     return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    const nonSerializedCost = (job.movements || []).reduce((sum, movement) => {
      if (movement.stockUnitId) return sum;
      const value = Number(movement.totalCost || 0);
      if (!Number.isFinite(value)) return sum;
      if (movement.type === "OUT") return sum + value;
      if (movement.type === "IN" && String(movement.note || "").startsWith("RETURN_OF:")) return sum - value;
      return sum;
    }, 0);
    const totalCost = serializedCost + nonSerializedCost;

    const currency =
      job.sparePartAssignments?.find((a) => a.currency)?.currency || "IDR";
      
    res.json({ job: { ...job, totalCost, currency } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load maintenance job" });
  }
});

////////////////////////////////////////////////////
// UPDATE SERVICE PHOTOS
// PATCH /maintenance/:id/photos
// body: { photos: string[] }
////////////////////////////////////////////////////
router.patch("/:id/photos", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const photos = Array.isArray(req.body?.photos)
      ? req.body.photos.map((photo) => String(photo || "").trim()).filter(Boolean).slice(0, 10)
      : null;
    if (!photos) return res.status(400).json({ error: "photos must be an array" });

    const job = await prisma.truckMaintenance.update({
      where: { id: req.params.id },
      data: { photos },
      select: { id: true, photos: true },
    });
    res.json({ job });
  } catch (e) {
    res.status(e.code === "P2025" ? 404 : 400).json({ error: e.message || "Failed to update photos" });
  }
});

////////////////////////////////////////////////////
// ADD PROGRESS NOTE
// POST /maintenance/:id/notes
// body: { content }
////////////////////////////////////////////////////
router.post("/:id/notes", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const content = String(req.body?.content || "").trim();
    if (!content) return res.status(400).json({ error: "Catatan tidak boleh kosong" });
    if (content.length > 2000) return res.status(400).json({ error: "Catatan maksimal 2.000 karakter" });

    const maintenance = await prisma.truckMaintenance.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true },
    });
    if (!maintenance) return res.status(404).json({ error: "Pekerjaan servis tidak ditemukan" });
    if (maintenance.status !== "OPEN") {
      return res.status(400).json({ error: "Catatan hanya dapat ditambahkan ketika servis masih berjalan" });
    }

    const note = await prisma.maintenanceNote.create({
      data: { maintenanceId: maintenance.id, content, createdById: req.user?.id || null },
      include: { createdBy: { select: { id: true, name: true, email: true, role: true } } },
    });
    res.json({ note });
  } catch (e) {
    res.status(e.code === "P2025" ? 404 : 400).json({ error: e.message || "Gagal menambahkan catatan" });
  }
});

////////////////////////////////////////////////////
// UPDATE STATUS
// PATCH /maintenance/:id/status
// body: { status: "OPEN"|"DONE"|"CANCELLED" }
// ✅ Sets doneAt, and returns truck.status to READY when DONE/CANCELLED
////////////////////////////////////////////////////
router.patch("/:id/status", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });

    const id = req.params.id;
    const { status } = req.body || {};
    if (!["OPEN", "DONE", "CANCELLED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const existing = await prisma.truckMaintenance.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Job not found" });
    if (status === "DONE") {
      const serviceRequests = await prisma.purchaseRequest.findMany({
        where: { maintenanceId: id, OR: [{ directUse: true }, { purpose: "MAINTENANCE_STOCK_REQUEST" }], status: { notIn: ["REJECTED", "CANCELLED"] } },
        include: {
          items: { select: { itemId: true, originalQty: true, approvedQty: true } },
          purchaseOrders: { where: { status: { not: "CANCELLED" } }, select: { items: { select: { itemId: true, receivedQty: true } } } },
        },
      });
      const unfinished = serviceRequests.filter(request => {
        if (request.status !== "APPROVED" || !request.purchaseOrders.length) return true;
        return request.items.some(item => {
          const requiredQty = Number(item.approvedQty ?? item.originalQty ?? 0);
          const receivedQty = request.purchaseOrders.reduce((sum, order) => sum + order.items.filter(row => row.itemId === item.itemId).reduce((itemSum, row) => itemSum + Number(row.receivedQty || 0), 0), 0);
          return receivedQty + 0.000001 < requiredQty;
        });
      });
      if (unfinished.length) return res.status(400).json({ error: `Servis belum dapat diselesaikan. Sparepart dari ${unfinished.map(request => request.number).join(", ")} belum diterima dan dipasang seluruhnya.`, code: "MAINTENANCE_PARTS_PENDING" });
    }
    if (status === "DONE" && existing.isOilChange) {
      const oilUsage = await prisma.stockMovement.count({
        where: { maintenanceId: id, type: "OUT", item: { category: "OIL" } },
      });
      if (!oilUsage) return res.status(400).json({ error: "Pilih dan gunakan stok kategori Oli sebelum pekerjaan diselesaikan" });
    }

    const job = await prisma.$transaction(async (tx) => {
      const updated = await tx.truckMaintenance.update({
        where: { id },
        data: {
          status,
          doneAt: status === "DONE" || status === "CANCELLED" ? new Date() : null,
        },
        include: { truck: true },
      });

      if (status === "DONE" || status === "CANCELLED") {
        await tx.truck.update({
          where: { id: updated.truckId },
          data: { status: "READY" },
        });
      }

      if (status === "OPEN") {
        await tx.truck.update({
          where: { id: updated.truckId },
          data: { status: "MAINTENANCE" },
        });
      }

      return updated;
    });

    res.json({ job });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update status" });
  }
});

////////////////////////////////////////////////////
// AVAILABLE SERIALIZED UNITS for assigning
// GET /maintenance/:id/available-units?itemId=...
////////////////////////////////////////////////////
router.get("/:id/available-units", authRequired, async (req, res) => {
  try {
    const { itemId } = req.query;
    const units = await prisma.stockUnit.findMany({
      where: {
        itemId: String(itemId),
        status: "IN_STOCK",
      },
      orderBy: [{ purchasedAt: "asc" }, { createdAt: "asc" }],
      include: { item: true, location: true },
      take: 200,
    });

    res.json({ units });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load available units" });
  }
});

////////////////////////////////////////////////////
// RETURN AN UNUSED SERIALIZED UNIT TO INVENTORY
////////////////////////////////////////////////////
router.post("/:id/return-unit", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const maintenanceId = req.params.id;
    const assignmentId = String(req.body.assignmentId || "");
    if (!assignmentId) return res.status(400).json({ error: "assignmentId is required" });

    const returned = await prisma.$transaction(async (tx) => {
      const job = await tx.truckMaintenance.findUnique({ where: { id: maintenanceId }, select: { id: true, status: true, truckId: true, truck: { select: { plateNumber: true } } } });
      if (!job || job.status !== "OPEN") throw new Error("Pengembalian hanya dapat dilakukan saat servis masih berjalan");
      const assignment = await tx.truckSparePartAssignment.findFirst({
        where: { id: assignmentId, maintenanceId, truckId: job.truckId, removedAt: null },
        include: { stockUnit: { include: { item: true, inventoryBatch: true } } },
      });
      if (!assignment || assignment.stockUnit.status !== "ASSIGNED") throw new Error("Unit tidak lagi terpasang pada servis ini");
      const outMovement = await tx.stockMovement.findFirst({ where: { maintenanceId, stockUnitId: assignment.stockUnitId, type: "OUT", fromLocationId: { not: null } }, orderBy: { createdAt: "desc" } });
      const locationId = outMovement?.fromLocationId || assignment.stockUnit.inventoryBatch?.locationId;
      if (!locationId) throw new Error("Lokasi asal unit tidak ditemukan");
      const now = new Date();

      await tx.truckSparePartAssignment.update({ where: { id: assignment.id }, data: { removedAt: now, note: [assignment.note, "Pemasangan dibatalkan; kembali ke Inventory"].filter(Boolean).join(" · ") } });
      await tx.stockUnit.update({ where: { id: assignment.stockUnitId }, data: { status: "IN_STOCK", locationId, scrappedAt: null } });
      await tx.inventoryStock.upsert({ where: { itemId_locationId: { itemId: assignment.stockUnit.itemId, locationId } }, create: { itemId: assignment.stockUnit.itemId, locationId, qty: 1 }, update: { qty: { increment: 1 } } });
      if (assignment.stockUnit.inventoryBatchId) await tx.inventoryBatch.update({ where: { id: assignment.stockUnit.inventoryBatchId }, data: { remainingQty: { increment: 1 } } });
      const returnMovement = await tx.stockMovement.create({ data: { type: "IN", itemId: assignment.stockUnit.itemId, qty: 1, unitPrice: assignment.installCost, totalCost: assignment.installCost, note: `RETURN_ASSIGNMENT:${assignment.id} · Pemasangan dibatalkan dari ${job.truck.plateNumber}`, createdById: req.user.id, toLocationId: locationId, maintenanceId, stockUnitId: assignment.stockUnitId } });
      if (Number(assignment.installCost || 0) > 0) await postJournal(tx, { date: returnMovement.createdAt, description: `Pengembalian ${assignment.stockUnit.item.name} dari ${job.truck.plateNumber}`, sourceType: "INVENTORY_RETURN", sourceId: returnMovement.id, createdById: req.user.id, lines: [{ code: SYSTEM_ACCOUNTS.INVENTORY, debit: Number(assignment.installCost) }, { code: SYSTEM_ACCOUNTS.EXPENSE, credit: Number(assignment.installCost) }] });
      return assignment;
    });
    res.json({ returned });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Gagal mengembalikan unit" });
  }
});

////////////////////////////////////////////////////
// RETURN UNUSED NON-SERIALIZED STOCK TO ITS SOURCE LOCATION
////////////////////////////////////////////////////
router.post("/:id/return-stock", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const maintenanceId = req.params.id;
    const movementId = String(req.body.movementId || "");
    const requestedQty = num(req.body.qty, 0);
    const reason = String(req.body.reason || "").trim();
    if (!movementId || requestedQty <= 0) return res.status(400).json({ error: "Movement dan jumlah pengembalian wajib diisi" });
    if (!reason) return res.status(400).json({ error: "Alasan pengembalian wajib diisi" });
    if (reason.length > 500) return res.status(400).json({ error: "Alasan pengembalian maksimal 500 karakter" });

    const returned = await prisma.$transaction(async (tx) => {
      const job = await tx.truckMaintenance.findUnique({ where: { id: maintenanceId }, select: { id: true, status: true, truckId: true, truck: { select: { plateNumber: true } } } });
      if (!job || job.status !== "OPEN") throw new Error("Pengembalian hanya dapat dilakukan saat servis masih berjalan");
      const movement = await tx.stockMovement.findFirst({ where: { id: movementId, maintenanceId, type: "OUT", stockUnitId: null }, include: { item: true } });
      if (!movement || !movement.fromLocationId) throw new Error("Pemakaian stok dari Inventory tidak ditemukan");
      if (movement.item.category === "OIL") throw new Error("Oli yang sudah digunakan tidak dapat dikembalikan ke Inventory");
      const priorReturns = await tx.stockMovement.findMany({ where: { maintenanceId, type: "IN", note: { startsWith: `RETURN_OF:${movement.id}` } }, select: { qty: true } });
      const alreadyReturned = priorReturns.reduce((sum, row) => sum + Number(row.qty || 0), 0);
      const availableToReturn = Number(movement.qty) - alreadyReturned;
      if (requestedQty > availableToReturn + 0.000001) throw new Error(`Maksimal yang dapat dikembalikan ${availableToReturn} ${movement.item.unit}`);
      const truckStock = await tx.truckPartStock.findUnique({ where: { truckId_itemId: { truckId: job.truckId, itemId: movement.itemId } } });
      if (Number(truckStock?.qty || 0) < requestedQty) throw new Error("Jumlah stok yang tercatat di mobil tidak mencukupi");
      const returnCost = movement.unitPrice == null ? null : Math.round(Number(movement.unitPrice) * requestedQty);

      await tx.truckPartStock.update({ where: { truckId_itemId: { truckId: job.truckId, itemId: movement.itemId } }, data: { qty: { decrement: requestedQty } } });
      await tx.inventoryStock.upsert({ where: { itemId_locationId: { itemId: movement.itemId, locationId: movement.fromLocationId } }, create: { itemId: movement.itemId, locationId: movement.fromLocationId, qty: requestedQty }, update: { qty: { increment: requestedQty } } });
      await tx.inventoryBatch.create({ data: { itemId: movement.itemId, locationId: movement.fromLocationId, receivedQty: requestedQty, remainingQty: requestedQty, unitPrice: movement.unitPrice, receivedAt: new Date() } });
      const returnMovement = await tx.stockMovement.create({ data: { type: "IN", itemId: movement.itemId, qty: requestedQty, unitPrice: movement.unitPrice, totalCost: returnCost, note: `RETURN_OF:${movement.id} · Pemakaian dibatalkan dari ${job.truck.plateNumber} · Alasan: ${reason}`, createdById: req.user.id, toLocationId: movement.fromLocationId, maintenanceId } });
      if (Number(returnCost || 0) > 0) await postJournal(tx, { date: returnMovement.createdAt, description: `Pengembalian ${movement.item.name} dari ${job.truck.plateNumber}`, sourceType: "INVENTORY_RETURN", sourceId: returnMovement.id, createdById: req.user.id, lines: [{ code: SYSTEM_ACCOUNTS.INVENTORY, debit: returnCost }, { code: SYSTEM_ACCOUNTS.EXPENSE, credit: returnCost }] });
      return returnMovement;
    });
    res.json({ returned });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Gagal mengembalikan stok" });
  }
});

////////////////////////////////////////////////////
// ✅ UNITS CURRENTLY ASSIGNED TO THIS TRUCK (for "Replace/Scrap" dropdown)
// GET /maintenance/:id/assigned-units?itemId=...
//
// Definition used (based on your schema):
// - unit.itemId matches
// - unit.status === "ASSIGNED"  (this is your "installed" state)
// - there exists an assignment row for this truck + that unit
////////////////////////////////////////////////////
router.get("/:id/assigned-units", authRequired, async (req, res) => {
  try {
    const maintenanceId = req.params.id;
    const itemId = String(req.query.itemId || "");
    if (!itemId) return res.status(400).json({ error: "itemId is required" });

    const job = await prisma.truckMaintenance.findUnique({
      where: { id: maintenanceId },
      select: { id: true, truckId: true, status: true },
    });
    if (!job) return res.status(404).json({ error: "Maintenance job not found" });

    // Find assignments for this truck where the unit is currently ASSIGNED
    const rows = await prisma.truckSparePartAssignment.findMany({
      where: {
        truckId: job.truckId,
        removedAt: null,
        stockUnit: {
          ...(itemId ? { itemId } : {}),
          status: "ASSIGNED",
          item: { isSerialized: true },
        },
      },
      orderBy: { installedAt: "desc" },
      take: 50,
      include: {
        stockUnit: { include: { item: true, location: true } },
      },
    });

    res.json({
      units: rows.map((a) => ({
        assignmentId: a.id,
        stockUnitId: a.stockUnitId,
        installedAt: a.installedAt,
        note: a.note || null,
        stockUnit: a.stockUnit,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load assigned units" });
  }
});

// Serialized spareparts currently installed on another truck, available as donor units.
router.get("/:id/donor-units", authRequired, async (req, res) => {
  try {
    const itemId = String(req.query.itemId || "");
    const job = await prisma.truckMaintenance.findUnique({ where: { id: req.params.id }, select: { truckId: true, status: true } });
    if (!job || job.status !== "OPEN") return res.status(400).json({ error: "Servis aktif tidak ditemukan" });
    if (!itemId) return res.status(400).json({ error: "Pilih jenis sparepart" });
    const assignments = await prisma.truckSparePartAssignment.findMany({
      where: { removedAt: null, truckId: { not: job.truckId }, stockUnit: { itemId, status: "ASSIGNED" } },
      include: { truck: true, stockUnit: { include: { item: true } } },
      orderBy: { installedAt: "asc" }, take: 100,
    });
    res.json({ units: assignments });
  } catch (e) { res.status(400).json({ error: e.message || "Gagal memuat unit donor" }); }
});

// Non-serialized spareparts currently recorded on another truck.
router.get("/:id/donor-stock", authRequired, async (req, res) => {
  try {
    const itemId = String(req.query.itemId || "");
    const job = await prisma.truckMaintenance.findUnique({ where: { id: req.params.id }, select: { truckId: true, status: true } });
    if (!job || job.status !== "OPEN") return res.status(400).json({ error: "Servis aktif tidak ditemukan" });
    if (!itemId) return res.status(400).json({ error: "Pilih jenis sparepart" });
    const item = await prisma.item.findUnique({ where: { id: itemId }, select: { isSerialized: true, category: true } });
    if (!item || item.isSerialized) return res.status(400).json({ error: "Sparepart donor harus berupa barang non-serial" });
    if (item.category === "OIL") return res.status(400).json({ error: "Oli tidak dapat dipindahkan dari mobil donor" });
    const stocks = await prisma.truckPartStock.findMany({
      where: { itemId, truckId: { not: job.truckId }, qty: { gt: 0 } },
      include: { truck: { select: { id: true, plateNumber: true, brand: true, model: true } }, item: true },
      orderBy: { truck: { plateNumber: "asc" } },
    });
    res.json({ stocks });
  } catch (e) { res.status(400).json({ error: e.message || "Gagal memuat stok mobil donor" }); }
});

router.post("/:id/transfer-donor-stock", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const donorTruckId = String(req.body.donorTruckId || "");
    const itemId = String(req.body.itemId || "");
    const q = num(req.body.qty, 0);
    if (!donorTruckId || !itemId || q <= 0) return res.status(400).json({ error: "Mobil donor, sparepart, dan jumlah wajib diisi" });
    const movement = await prisma.$transaction(async (tx) => {
      const job = await tx.truckMaintenance.findUnique({ where: { id: req.params.id }, include: { truck: true } });
      if (!job || job.status !== "OPEN") throw new Error("Servis aktif tidak ditemukan");
      if (job.truckId === donorTruckId) throw new Error("Mobil donor harus berbeda dari mobil servis");
      const [item, donor] = await Promise.all([
        tx.item.findUnique({ where: { id: itemId } }),
        tx.truckPartStock.findUnique({ where: { truckId_itemId: { truckId: donorTruckId, itemId } }, include: { truck: true } }),
      ]);
      if (!item || item.isSerialized) throw new Error("Sparepart donor harus berupa barang non-serial");
      if (item.category === "OIL") throw new Error("Oli tidak dapat dipindahkan dari mobil donor");
      if (!donor || Number(donor.qty) < q) throw new Error(`Stok pada mobil donor tidak cukup. Tersedia: ${Number(donor?.qty || 0)}`);
      const changed = await tx.truckPartStock.updateMany({ where: { id: donor.id, qty: { gte: q } }, data: { qty: { decrement: q } } });
      if (!changed.count) throw new Error("Stok mobil donor berubah. Muat ulang lalu coba lagi");
      const target = await tx.truckPartStock.findUnique({ where: { truckId_itemId: { truckId: job.truckId, itemId } } });
      const targetQty = Number(target?.qty || 0);
      const combinedUnitPrice = donor.unitPrice == null || (targetQty > 0 && target?.unitPrice == null)
        ? null
        : Math.round(((targetQty * Number(target?.unitPrice || 0)) + (q * donor.unitPrice)) / (targetQty + q));
      await tx.truckPartStock.upsert({
        where: { truckId_itemId: { truckId: job.truckId, itemId } },
        create: { truckId: job.truckId, itemId, qty: q, unitPrice: donor.unitPrice },
        update: { qty: { increment: q }, unitPrice: combinedUnitPrice },
      });
      return tx.stockMovement.create({
        data: { type: "ADJUST", itemId, qty: q, unitPrice: donor.unitPrice, totalCost: donor.unitPrice == null ? null : Math.round(donor.unitPrice * q), fromTruckId: donorTruckId, toTruckId: job.truckId, maintenanceId: job.id, createdById: req.user.id, note: String(req.body.note || `Dipindahkan dari ${donor.truck.plateNumber} ke ${job.truck.plateNumber}`) },
        include: { item: true, fromTruck: true, toTruck: true, createdBy: true },
      });
    });
    res.json({ ok: true, movement });
  } catch (e) { res.status(400).json({ error: e.message || "Gagal memindahkan sparepart donor" }); }
});

// Move the same serialized unit from another truck directly to the truck under service.
router.post("/:id/transfer-donor-unit", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const assignmentId = String(req.body.assignmentId || "");
    const returnStockUnitId = String(req.body.returnStockUnitId || "");
    const result = await prisma.$transaction(async tx => {
      const job = await tx.truckMaintenance.findUnique({ where: { id: req.params.id }, include: { truck: true } });
      if (!job || job.status !== "OPEN") throw new Error("Servis aktif tidak ditemukan");
      const donor = await tx.truckSparePartAssignment.findUnique({ where: { id: assignmentId }, include: { truck: true, stockUnit: true } });
      if (!donor || donor.removedAt || donor.stockUnit.status !== "ASSIGNED") throw new Error("Sparepart donor sudah tidak tersedia");
      if (donor.truckId === job.truckId) throw new Error("Unit sudah terpasang pada mobil servis ini");
      const returned = returnStockUnitId ? await tx.truckSparePartAssignment.findFirst({
        where: { truckId: job.truckId, stockUnitId: returnStockUnitId, removedAt: null },
        include: { stockUnit: true },
      }) : null;
      if (returnStockUnitId && (!returned || returned.stockUnit.status !== "ASSIGNED")) throw new Error("Unit lama yang akan dikembalikan tidak ditemukan");
      if (returned && returned.stockUnit.itemId !== donor.stockUnit.itemId) throw new Error("Unit pengganti dan unit donor harus memiliki jenis barang yang sama");
      const now = new Date();
      await tx.truckSparePartAssignment.update({ where: { id: donor.id }, data: { removedAt: now, note: [donor.note, `Dipindahkan ke ${job.truck.plateNumber}`].filter(Boolean).join(" · ") } });
      if (returned) await tx.truckSparePartAssignment.update({ where: { id: returned.id }, data: { removedAt: now, maintenanceId: job.id, note: [returned.note, `Dikembalikan ke ${donor.truck.plateNumber}`].filter(Boolean).join(" · ") } });
      const installed = await tx.truckSparePartAssignment.create({ data: { truckId: job.truckId, stockUnitId: donor.stockUnitId, installedAt: now, installCost: donor.installCost, currency: donor.currency || "IDR", note: String(req.body.note || `Donor dari ${donor.truck.plateNumber}`), maintenanceId: job.id, createdById: req.user.id } });
      const returnedInstallation = returned ? await tx.truckSparePartAssignment.create({ data: { truckId: donor.truckId, stockUnitId: returned.stockUnitId, installedAt: now, installCost: returned.installCost, currency: returned.currency || "IDR", note: `Pertukaran dari ${job.truck.plateNumber}`, maintenanceId: job.id, createdById: req.user.id } }) : null;
      await tx.stockMovement.create({ data: { type: "ADJUST", itemId: donor.stockUnit.itemId, qty: 0, stockUnitId: donor.stockUnitId, maintenanceId: job.id, createdById: req.user.id, note: `Transfer unit dari ${donor.truck.plateNumber} ke ${job.truck.plateNumber}` } });
      if (returned) await tx.stockMovement.create({ data: { type: "ADJUST", itemId: returned.stockUnit.itemId, qty: 0, stockUnitId: returned.stockUnitId, maintenanceId: job.id, createdById: req.user.id, note: `Unit lama dikembalikan dari ${job.truck.plateNumber} ke ${donor.truck.plateNumber}` } });
      return { installed, returnedInstallation };
    });
    res.json({ ok: true, ...result });
  } catch (e) { res.status(400).json({ error: e.message || "Gagal memindahkan sparepart" }); }
});

// Remove a unit from the serviced truck and create a traceable purchasing request for repair service.
router.post("/:id/repair-unit", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const stockUnitId = String(req.body.stockUnitId || "");
    const result = await prisma.$transaction(async tx => {
      const job = await tx.truckMaintenance.findUnique({ where: { id: req.params.id }, include: { truck: true } });
      if (!job || job.status !== "OPEN") throw new Error("Servis aktif tidak ditemukan");
      const assignment = await tx.truckSparePartAssignment.findFirst({ where: { truckId: job.truckId, stockUnitId, removedAt: null }, include: { stockUnit: { include: { item: true } } } });
      if (!assignment || assignment.stockUnit.status !== "ASSIGNED") throw new Error("Sparepart tidak sedang terpasang pada mobil ini");
      const now = new Date();
      await tx.truckSparePartAssignment.update({ where: { id: assignment.id }, data: { removedAt: now, maintenanceId: job.id, note: [assignment.note, "Dilepas untuk perbaikan"].filter(Boolean).join(" · ") } });
      await tx.stockUnit.update({ where: { id: stockUnitId }, data: { status: "REPAIRING", locationId: null } });
      const repair = await tx.partRepair.create({ data: { stockUnitId, maintenanceId: job.id, sentAt: now, notes: String(req.body.notes || "").trim() || null, createdById: req.user.id } });
      const request = await tx.purchaseRequest.create({ data: { number: await nextDailyNumber(tx, "purchaseRequest", "PR"), status: "WAITING_APPROVAL", urgency: req.body.urgency || "NORMAL", purpose: "REPAIR", truckId: job.truckId, maintenanceId: job.id, reason: String(req.body.reason || `Perbaikan ${assignment.stockUnit.item.name} dari ${job.truck.plateNumber}`), notes: req.body.notes || null, createdById: req.user.id, items: { create: { itemId: assignment.stockUnit.itemId, originalQty: 1, partRepairId: repair.id } } } });
      await tx.stockMovement.create({ data: { type: "OUT", itemId: assignment.stockUnit.itemId, qty: 1, stockUnitId, maintenanceId: job.id, createdById: req.user.id, note: `Dilepas dari ${job.truck.plateNumber} untuk perbaikan · ${request.number}` } });
      return { repair, request };
    });
    res.json({ ok: true, ...result });
  } catch (e) { res.status(400).json({ error: e.message || "Gagal mengirim sparepart untuk perbaikan" }); }
});

////////////////////////////////////////////////////
// ASSIGN SERIALIZED STOCK UNIT to maintenance
// POST /maintenance/:id/assign-unit
// body: { stockUnitId, note?, replaceStockUnitId? }
//
// ✅ If replaceStockUnitId provided:
// - verify old unit is ASSIGNED to this truck + same item
// - scrap old unit (same concept as Inventory scrap)
// - create SCRAP movement for old unit
//
// ✅ Always:
// - decrement InventoryStock.qty by 1 at new unit's location
// - create assignment
// - mark new unit as ASSIGNED and remove from location
// - create OUT movement (qty=1)
////////////////////////////////////////////////////
// ASSIGN SERIALIZED STOCK UNIT to maintenance
// POST /maintenance/:id/assign-unit
// body: { stockUnitId, note?, replaceStockUnitId? }
// POST /maintenance/:id/assign-unit
router.post("/:id/assign-unit", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });

    const maintenanceId = req.params.id;
    const { stockUnitId, note, replaceStockUnitId, replaceDisposition = "IN_STOCK" } = req.body || {};
    if (!stockUnitId) return res.status(400).json({ error: "stockUnitId is required" });

    // ✅ Read-only fetches OUTSIDE transaction (faster + safer)
    const job = await prisma.truckMaintenance.findUnique({
      where: { id: maintenanceId },
      include: { truck: true },
    });
    if (!job) return res.status(404).json({ error: "Maintenance job not found" });
    if (job.status !== "OPEN") return res.status(400).json({ error: "Job is not OPEN" });

    const unit = await prisma.stockUnit.findUnique({
      where: { id: stockUnitId },
      include: { item: true, location: true },
    });
    if (!unit) return res.status(404).json({ error: "Stock unit not found" });
    if (unit.status !== "IN_STOCK") return res.status(400).json({ error: "Stock unit not available" });

    // ✅ SAFETY: serialized units MUST have purchasePrice
    if (unit.item?.isSerialized && (unit.purchasePrice == null || Number(unit.purchasePrice) <= 0)) {
      return res.status(400).json({ error: "This unit has no purchase price and cannot be assigned" });
    }

    const now = new Date();
    const fromLocationId = unit.locationId || null;

    // ✅ Make transaction shorter + allow more time on hosted DB
    const created = await prisma.$transaction(
      async (tx) => {
        // ----------------------------
        // (0) OPTIONAL: REPLACE / REMOVE OLD UNIT
        // ----------------------------
        if (replaceStockUnitId) {
          const oldUnitId = String(replaceStockUnitId);

          // use select (lighter than include)
          const oldUnit = await tx.stockUnit.findUnique({
            where: { id: oldUnitId },
            select: { id: true, itemId: true, serialNumber: true, barcode: true, inventoryBatchId: true },
          });
          if (!oldUnit) throw new Error("Replace unit not found");

          const activeAssign = await tx.truckSparePartAssignment.findFirst({
            where: { truckId: job.truckId, stockUnitId: oldUnitId, removedAt: null },
            orderBy: { installedAt: "desc" },
            select: { id: true },
          });
          if (!activeAssign) throw new Error("Replace unit is not currently installed on this truck");

          await tx.truckSparePartAssignment.update({
            where: { id: activeAssign.id },
            data: { removedAt: now },
          });

          if (replaceDisposition === "REPAIRING") {
            await tx.stockUnit.update({ where: { id: oldUnitId }, data: { status: "REPAIRING", locationId: null } });
            const repair = await tx.partRepair.create({ data: { stockUnitId: oldUnitId, maintenanceId, sentAt: now, notes: note ? String(note) : null, createdById: req.user.id } });
            const request = await tx.purchaseRequest.create({ data: { number: await nextDailyNumber(tx, "purchaseRequest", "PR"), status: "WAITING_APPROVAL", urgency: "URGENT", purpose: "REPAIR", truckId: job.truckId, maintenanceId, reason: `Perbaikan unit lama ${oldUnit.serialNumber || oldUnit.barcode || oldUnit.id.slice(0, 8)} dari ${job.truck.plateNumber}`, createdById: req.user.id, items: { create: { itemId: oldUnit.itemId, originalQty: 1, partRepairId: repair.id } } } });
            await tx.stockMovement.create({ data: { type: "OUT", itemId: oldUnit.itemId, qty: 1, note: `Unit lama dilepas untuk perbaikan · ${request.number}`, createdById: req.user.id, maintenanceId, stockUnitId: oldUnitId } });
          } else if (replaceDisposition === "SCRAPPED") {
            await tx.stockUnit.update({ where: { id: oldUnitId }, data: { status: "SCRAPPED", scrappedAt: now, locationId: null } });
            await tx.stockMovement.create({ data: { type: "ADJUST", itemId: oldUnit.itemId, qty: 1, note: `Unit lama dilepas dan di-scrap pada ${job.title}`, createdById: req.user.id, maintenanceId, stockUnitId: oldUnitId } });
          } else {
            if (!fromLocationId) throw new Error("Lokasi pengembalian unit lama tidak tersedia");
            await tx.inventoryStock.upsert({ where: { itemId_locationId: { itemId: oldUnit.itemId, locationId: fromLocationId } }, create: { itemId: oldUnit.itemId, locationId: fromLocationId, qty: 1 }, update: { qty: { increment: 1 } } });
            if (oldUnit.inventoryBatchId) await tx.inventoryBatch.update({ where: { id: oldUnit.inventoryBatchId }, data: { remainingQty: { increment: 1 } } });
            await tx.stockUnit.update({ where: { id: oldUnitId }, data: { status: "IN_STOCK", scrappedAt: null, locationId: fromLocationId } });
            await tx.stockMovement.create({ data: { type: "IN", itemId: oldUnit.itemId, qty: 1, note: `Unit lama kembali ke Inventory dari ${job.truck.plateNumber}`, createdById: req.user.id, toLocationId: fromLocationId, maintenanceId, stockUnitId: oldUnitId } });
          }
        }

        // ----------------------------
        // (1) decrement InventoryStock at unit's location (fast + safe)
        // ----------------------------
        if (fromLocationId) {
          // ensure row exists
          await tx.inventoryStock.upsert({
            where: { itemId_locationId: { itemId: unit.itemId, locationId: fromLocationId } },
            create: { itemId: unit.itemId, locationId: fromLocationId, qty: 0 },
            update: {},
          });

          // decrement only if qty >= 1 (prevents going negative)
          const dec = await tx.inventoryStock.updateMany({
            where: {
              itemId: unit.itemId,
              locationId: fromLocationId,
              qty: { gte: 1 },
            },
            data: { qty: { decrement: 1 } },
          });

          if (dec.count === 0) {
            throw new Error("Not enough stock at this location (qty is 0)");
          }
        }

        // ----------------------------
        // (2) create assignment (NO include here)
        // ----------------------------
        const assignment = await tx.truckSparePartAssignment.create({
          data: {
            truckId: job.truckId,
            stockUnitId: unit.id,
            installedAt: now,
            note: note ? String(note) : null,
            createdById: req.user?.id || null,
            maintenanceId,
            installCost: unit.purchasePrice,
            currency: unit.currency || "IDR",
          },
        });

        // ----------------------------
        // (3) mark new unit as ASSIGNED and remove from location
        // ----------------------------
        await tx.stockUnit.update({
          where: { id: unit.id },
          data: { status: "ASSIGNED", locationId: null },
        });

        // ----------------------------
        // (4) create OUT movement
        // ----------------------------
        const outMovement = await tx.stockMovement.create({
          data: {
            type: "OUT",
            itemId: unit.itemId,
            qty: 1,
            unitPrice: unit.purchasePrice,
            totalCost: unit.purchasePrice,
            note: `Assigned to maintenance: ${job.title}`,
            createdById: req.user?.id || null,
            fromLocationId,
            toLocationId: null,
            maintenanceId,
            stockUnitId: unit.id,
          },
        });
        await postJournal(tx, { date: outMovement.createdAt, description: `Pemakaian ${unit.item.name} untuk ${job.title}`, sourceType: "INVENTORY_USAGE", sourceId: outMovement.id, createdById: req.user.id, lines: [{ code: SYSTEM_ACCOUNTS.EXPENSE, debit: Number(unit.purchasePrice) }, { code: SYSTEM_ACCOUNTS.INVENTORY, credit: Number(unit.purchasePrice) }] });

        return assignment;
      },
      { maxWait: 10000, timeout: 20000 } // ✅ important on hosted DB
    );

    // ✅ Fetch full include OUTSIDE transaction (fast + avoids tx timeout)
    const assignmentFull = await prisma.truckSparePartAssignment.findUnique({
      where: { id: created.id },
      include: {
        stockUnit: { include: { item: true, location: true } },
        createdBy: true,
      },
    });

    res.json({ assignment: assignmentFull });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to assign stock unit" });
  }
});


////////////////////////////////////////////////////
// ASSIGN / CONSUME UN-SERIALIZED ITEM to maintenance
// POST /maintenance/:id/assign-item
// body: { itemId, locationId, qty, note? }
//
// - item must be isSerialized === false
// - checks InventoryStock has enough qty at location
// - decreases stock
// - creates OUT movement (qty = qty)
// - returns movement
////////////////////////////////////////////////////
router.post("/:id/assign-item", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });

    const maintenanceId = req.params.id;
    const { itemId, locationId, qty, note } = req.body || {};

    if (!itemId) return res.status(400).json({ error: "itemId is required" });
    if (!locationId) return res.status(400).json({ error: "locationId is required" });

    const q = num(qty, 0);
    if (q <= 0) return res.status(400).json({ error: "qty must be > 0" });

    const job = await prisma.truckMaintenance.findUnique({
      where: { id: maintenanceId },
      include: { truck: true },
    });
    if (!job) return res.status(404).json({ error: "Maintenance job not found" });

    const item = await prisma.item.findUnique({ where: { id: String(itemId) } });
    if (!item) return res.status(404).json({ error: "Item not found" });

    if (item.isSerialized) {
      return res.status(400).json({ error: "This item is serialized. Use assign-unit instead." });
    }

    const movement = await prisma.$transaction(async (tx) => {
      // Ensure stock row exists
      await tx.inventoryStock.upsert({
        where: { itemId_locationId: { itemId: item.id, locationId: String(locationId) } },
        create: { itemId: item.id, locationId: String(locationId), qty: 0 },
        update: {},
      });

      const row = await tx.inventoryStock.findUnique({
        where: { itemId_locationId: { itemId: item.id, locationId: String(locationId) } },
      });

      const current = row?.qty || 0;
      if (current < q) {
        throw new Error(`Not enough stock. Available: ${current}, requested: ${q}`);
      }

      await tx.inventoryStock.update({
        where: { itemId_locationId: { itemId: item.id, locationId: String(locationId) } },
        data: { qty: current - q },
      });

      // Create OUT movement (no stockUnitId)
      const mv = await tx.stockMovement.create({
        data: {
          type: "OUT",
          itemId: item.id,
          qty: q,
          note: note ? String(note) : `Used in maintenance: ${job.title}`,
          createdById: req.user?.id || null,
          fromLocationId: String(locationId),
          toLocationId: null,
          maintenanceId,
          stockUnitId: null,
        },
        include: {
          item: true,
          fromLocation: true,
          toLocation: true,
          createdBy: true,
          stockUnit: true,
        },
      });

      return mv;
    });

    res.json({ movement });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to assign item" });
  }
});

////////////////////////////////////////////////////
// USE NON-SERIALIZED STOCK (qty)
// POST /maintenance/:id/use-stock
// body: { itemId, locationId, qty, note? }
////////////////////////////////////////////////////
router.post("/:id/use-stock", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });

    const maintenanceId = req.params.id;
    const { itemId, locationId, qty, note, oilChangedAt, odometerKm } = req.body || {};

    if (!itemId) return res.status(400).json({ error: "itemId is required" });
    if (!locationId) return res.status(400).json({ error: "locationId is required" });

    const q = num(qty, 0);
    if (q <= 0) return res.status(400).json({ error: "qty must be > 0" });

    const job = await prisma.truckMaintenance.findUnique({
      where: { id: maintenanceId },
      select: { id: true, title: true, truckId: true, status: true },
    });
    if (!job) return res.status(404).json({ error: "Maintenance job not found" });
    if (job.status !== "OPEN") return res.status(400).json({ error: "Job is not OPEN" });

    const item = await prisma.item.findUnique({ where: { id: String(itemId) } });
    if (!item) return res.status(404).json({ error: "Item not found" });
    if (item.isSerialized) return res.status(400).json({ error: "Item is serialized. Use Assign Unit instead." });
    let oilDate = null;
    let oilOdometer = null;
    if (item.category === "OIL") {
      oilDate = oilChangedAt ? new Date(oilChangedAt) : null;
      oilOdometer = odometerKm != null && odometerKm !== "" ? num(odometerKm, null) : null;
      if (!oilDate || Number.isNaN(oilDate.getTime())) return res.status(400).json({ error: "Tanggal ganti oli wajib diisi" });
      if (!Number.isInteger(oilOdometer) || oilOdometer < 0) return res.status(400).json({ error: "Odometer saat ganti oli wajib diisi dengan angka yang valid" });
      const previous = await prisma.truckMaintenance.findFirst({
        where: { truckId: job.truckId, isOilChange: true, status: "DONE", id: { not: job.id } },
        orderBy: [{ oilChangedAt: "desc" }, { createdAt: "desc" }],
      });
      if (previous?.odometerKm != null && oilOdometer < previous.odometerKm) {
        return res.status(400).json({ error: `Odometer baru tidak boleh lebih rendah dari riwayat terakhir (${previous.odometerKm} km)` });
      }
      const previousOdometer = Number(previous?.odometerKm || 0);
      const distanceSinceLastChange = oilOdometer - previousOdometer;
      if (previous?.odometerKm != null && distanceSinceLastChange < OIL_CHANGE_INTERVAL_KM) {
        const minimumOdometer = previousOdometer + OIL_CHANGE_INTERVAL_KM;
        const remainingKm = OIL_CHANGE_INTERVAL_KM - distanceSinceLastChange;
        return res.status(400).json({
          error: `Ganti oli hanya dapat dilakukan setelah kendaraan berjalan minimal ${OIL_CHANGE_INTERVAL_KM.toLocaleString("id-ID")} km. Odometer minimal ${minimumOdometer.toLocaleString("id-ID")} km (kurang ${remainingKm.toLocaleString("id-ID")} km).`,
        });
      }
      if (previous?.oilChangedAt && oilDate < previous.oilChangedAt) {
        return res.status(400).json({ error: "Tanggal ganti oli baru tidak boleh lebih awal dari riwayat terakhir" });
      }
    }

    const movement = await prisma.$transaction(async (tx) => {
      // ensure stock row exists
      await tx.inventoryStock.upsert({
        where: { itemId_locationId: { itemId: item.id, locationId: String(locationId) } },
        create: { itemId: item.id, locationId: String(locationId), qty: 0 },
        update: {},
      });

      const row = await tx.inventoryStock.findUnique({
        where: { itemId_locationId: { itemId: item.id, locationId: String(locationId) } },
      });

      const current = row?.qty || 0;
      if (current < q) throw new Error(`Not enough stock. Available: ${current}, requested: ${q}`);

      const batches = await tx.inventoryBatch.findMany({
        where: { itemId: item.id, locationId: String(locationId), remainingQty: { gt: 0 } },
        orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
      });
      let qtyToAllocate = q;
      let allocatedCost = 0;
      let fullyPriced = true;
      const allocatedBatches = [];
      for (const batch of batches) {
        if (qtyToAllocate <= 0) break;
        const taken = Math.min(Number(batch.remainingQty || 0), qtyToAllocate);
        if (taken <= 0) continue;
        if (batch.unitPrice == null) fullyPriced = false;
        else allocatedCost += taken * Number(batch.unitPrice);
        allocatedBatches.push({ batchId: batch.id, qty: taken });
        await tx.inventoryBatch.update({ where: { id: batch.id }, data: { remainingQty: { decrement: taken } } });
        qtyToAllocate -= taken;
      }
      if (qtyToAllocate > 0.000001) fullyPriced = false;
      const movementTotalCost = fullyPriced ? Math.round(allocatedCost) : null;
      const movementUnitPrice = movementTotalCost == null ? null : Math.round(movementTotalCost / q);

      await tx.inventoryStock.update({
        where: { itemId_locationId: { itemId: item.id, locationId: String(locationId) } },
        data: { qty: current - q },
      });

      if (item.category === "OIL") {
        await tx.truckMaintenance.update({
          where: { id: maintenanceId },
          data: { isOilChange: true, oilChangedAt: oilDate, odometerKm: oilOdometer },
        });
      }

      if (item.category !== "OIL") {
        const existingTruckStock = await tx.truckPartStock.findUnique({ where: { truckId_itemId: { truckId: job.truckId, itemId: item.id } } });
        const oldQty = Number(existingTruckStock?.qty || 0);
        const oldValue = existingTruckStock?.unitPrice == null ? 0 : oldQty * Number(existingTruckStock.unitPrice);
        const addedValue = movementTotalCost == null ? 0 : movementTotalCost;
        const nextUnitPrice = movementTotalCost == null || (oldQty > 0 && existingTruckStock?.unitPrice == null)
          ? null
          : Math.round((oldValue + addedValue) / (oldQty + q));
        await tx.truckPartStock.upsert({
          where: { truckId_itemId: { truckId: job.truckId, itemId: item.id } },
          create: { truckId: job.truckId, itemId: item.id, qty: q, unitPrice: movementUnitPrice },
          update: { qty: { increment: q }, unitPrice: nextUnitPrice },
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          type: "OUT",
          itemId: item.id,
          qty: q,
          unitPrice: movementUnitPrice,
          totalCost: movementTotalCost,
          note: note ? String(note) : `Used in maintenance: ${job.title}`,
          createdById: req.user?.id || null,
          fromLocationId: String(locationId),
          toLocationId: null,
          maintenanceId,
          stockUnitId: null,
        },
        include: {
          item: true,
          fromLocation: true,
          toLocation: true,
          createdBy: true,
          stockUnit: true,
        },
      });
      if (allocatedBatches.length) {
        await tx.stockMovementBatchAllocation.createMany({
          data: allocatedBatches.map(allocation => ({ ...allocation, movementId: movement.id })),
        });
      }
      if (Number(movementTotalCost || 0) > 0) await postJournal(tx, { date: movement.createdAt, description: `Pemakaian ${item.name} untuk ${job.title}`, sourceType: "INVENTORY_USAGE", sourceId: movement.id, createdById: req.user.id, lines: [{ code: SYSTEM_ACCOUNTS.EXPENSE, debit: movementTotalCost }, { code: SYSTEM_ACCOUNTS.INVENTORY, credit: movementTotalCost }] });
      return movement;
    });

    res.json({ movement });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to use stock" });
  }
});


module.exports = router;
