// backend/src/routes/maintenance.js
const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");

const router = express.Router();
const OIL_CHANGE_INTERVAL_KM = 8500;
const { notifyOwnerSafely } = require("../services/whatsappNotifications");

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

    const previousOilChanges = await prisma.truckMaintenance.findMany({
      where: { truckId: { in: trucks.map((truck) => truck.id) }, isOilChange: true, status: "DONE" },
      orderBy: [{ oilChangedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, truckId: true, oilChangedAt: true, odometerKm: true, photos: true },
    });
    const previousByTruck = new Map();
    for (const change of previousOilChanges) {
      if (!previousByTruck.has(change.truckId)) previousByTruck.set(change.truckId, change);
    }

    res.json({ trucks: trucks.map((truck) => ({ ...truck, lastOilChange: previousByTruck.get(truck.id) || null })) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load trucks" });
  }
});

////////////////////////////////////////////////////
// LIST
// GET /maintenance?status=OPEN&truckId=...&q=...&from=...&to=...
////////////////////////////////////////////////////
router.get("/", authRequired, async (req, res) => {
  try {
    const { status, truckId, q, from, to } = req.query;

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
      where.OR = [{ title: { contains: qq } }, { truck: { plateNumber: { contains: qq } } }];
    }

    const jobs = await prisma.truckMaintenance.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, createdAt: true, doneAt: true, truck: { select: { id: true, plateNumber: true, brand: true, model: true } } },
    });

    res.json({ jobs });
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

    if (truck.status === "DISPATCH") {
      return res.status(400).json({ error: "Truck is DISPATCH (on trip). Cannot create maintenance." });
    }

    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.truckMaintenance.create({
        data: {
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
    res.status(500).json({ error: "Failed to create maintenance job" });
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

    const request = await prisma.purchaseRequest.create({
      data: {
        number: `PR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
        status: "WAITING_APPROVAL",
        urgency: req.body.urgency || "URGENT",
        purpose: "MAINTENANCE_STOCK_REQUEST",
        truckId: maintenance.truckId,
        maintenanceId: maintenance.id,
        directUse: false,
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
    });
    await notifyOwnerSafely({
      event: "Permintaan sparepart servis",
      title: `${request.number} · ${maintenance.truck?.plateNumber || "Armada"}`,
      details: `${item.name} · ${qty.toLocaleString("id-ID")} ${item.unit} · ${request.reason}`,
      path: "/purchasing",
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
          include: { item: true, fromLocation: true, toLocation: true, createdBy: true, stockUnit: true },
        },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { createdBy: { select: { id: true, name: true, email: true, role: true } } },
        },
        purchaseRequests: { select: { id: true, number: true, status: true, urgency: true, createdAt: true, damageProofUrl: true, damageProofFileName: true, damageProofMimeType: true, items: { select: { id: true, originalQty: true, approvedQty: true, item: { select: { id: true, sku: true, name: true, unit: true } } } } }, orderBy: { createdAt: "desc" } },
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
     const v = Number(a.installCost || 0);
     return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    const nonSerializedCost = (job.movements || []).reduce((sum, movement) => {
      if (movement.type !== "OUT" || movement.stockUnitId) return sum;
      const value = Number(movement.totalCost || 0);
      return sum + (Number.isFinite(value) ? value : 0);
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
      const request = await tx.purchaseRequest.create({ data: { number: `PR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`, status: "WAITING_APPROVAL", urgency: req.body.urgency || "NORMAL", purpose: "REPAIR", truckId: job.truckId, maintenanceId: job.id, reason: String(req.body.reason || `Perbaikan ${assignment.stockUnit.item.name} dari ${job.truck.plateNumber}`), notes: req.body.notes || null, createdById: req.user.id, items: { create: { itemId: assignment.stockUnit.itemId, originalQty: 1, partRepairId: repair.id } } } });
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
            const request = await tx.purchaseRequest.create({ data: { number: `PR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`, status: "WAITING_APPROVAL", urgency: "URGENT", purpose: "REPAIR", truckId: job.truckId, maintenanceId, reason: `Perbaikan unit lama ${oldUnit.serialNumber || oldUnit.barcode || oldUnit.id.slice(0, 8)} dari ${job.truck.plateNumber}`, createdById: req.user.id, items: { create: { itemId: oldUnit.itemId, originalQty: 1, partRepairId: repair.id } } } });
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
        await tx.stockMovement.create({
          data: {
            type: "OUT",
            itemId: unit.itemId,
            qty: 1,
            note: `Assigned to maintenance: ${job.title}`,
            createdById: req.user?.id || null,
            fromLocationId,
            toLocationId: null,
            maintenanceId,
            stockUnitId: unit.id,
          },
        });

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
      for (const batch of batches) {
        if (qtyToAllocate <= 0) break;
        const taken = Math.min(Number(batch.remainingQty || 0), qtyToAllocate);
        if (taken <= 0) continue;
        if (batch.unitPrice == null) fullyPriced = false;
        else allocatedCost += taken * Number(batch.unitPrice);
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

      return tx.stockMovement.create({
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
    });

    res.json({ movement });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to use stock" });
  }
});


module.exports = router;
