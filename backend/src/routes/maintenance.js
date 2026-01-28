// backend/src/routes/maintenance.js
const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");

const router = express.Router();

function canWrite(user) {
  return ["OWNER", "ADMIN", "STAFF"].includes(user?.role);
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

    res.json({ trucks });
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
          include: {
            item: true,
            fromLocation: true,
            toLocation: true,
            createdBy: true,
            stockUnit: true,
          },
        },
      },
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
          odometerKm: odometerKm != null ? num(odometerKm, null) : null,
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
      },
    });

    if (!job) return res.status(404).json({ error: "Maintenance job not found" });
    res.json({ job });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load maintenance job" });
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

    const job = await prisma.$transaction(async (tx) => {
      const updated = await tx.truckMaintenance.update({
        where: { id },
        data: {
          status,
          doneAt: status === "DONE" ? new Date() : null,
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
    if (!itemId) return res.status(400).json({ error: "itemId is required" });

    const units = await prisma.stockUnit.findMany({
      where: {
        itemId: String(itemId),
        status: "IN_STOCK",
      },
      orderBy: { createdAt: "desc" },
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
        stockUnit: {
          itemId,
          status: "ASSIGNED",
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
router.post("/:id/assign-unit", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });

    const maintenanceId = req.params.id;
    const { stockUnitId, note, replaceStockUnitId } = req.body || {};
    if (!stockUnitId) return res.status(400).json({ error: "stockUnitId is required" });

    const job = await prisma.truckMaintenance.findUnique({
      where: { id: maintenanceId },
      include: { truck: true },
    });
    if (!job) return res.status(404).json({ error: "Maintenance job not found" });

    const unit = await prisma.stockUnit.findUnique({
      where: { id: stockUnitId },
      include: { item: true, location: true },
    });
    if (!unit) return res.status(404).json({ error: "Stock unit not found" });
    if (unit.status !== "IN_STOCK") return res.status(400).json({ error: "Stock unit not available" });

    const now = new Date();
    const fromLocationId = unit.locationId || null;

    const assignment = await prisma.$transaction(async (tx) => {
      // ----------------------------
      // (0) OPTIONAL: REPLACE / REMOVE OLD UNIT
      // ----------------------------
      if (replaceStockUnitId) {
        const oldUnitId = String(replaceStockUnitId);

        // must exist
        const oldUnit = await tx.stockUnit.findUnique({
          where: { id: oldUnitId },
          include: { item: true },
        });
        if (!oldUnit) throw new Error("Replace unit not found");

        // must be same item (wheel -> wheel)
        if (oldUnit.itemId !== unit.itemId) {
          throw new Error("Replace unit must be the same item type");
        }

        // must be currently installed on this truck
        const activeAssign = await tx.truckSparePartAssignment.findFirst({
          where: { truckId: job.truckId, stockUnitId: oldUnitId, removedAt: null },
          orderBy: { installedAt: "desc" },
        });
        if (!activeAssign) {
          throw new Error("Replace unit is not currently installed on this truck");
        }

        // mark as removed
        await tx.truckSparePartAssignment.update({
          where: { id: activeAssign.id },
          data: { removedAt: now },
        });

        // scrap it like inventory scrap
        await tx.stockUnit.update({
          where: { id: oldUnitId },
          data: { status: "SCRAPPED", scrappedAt: now, locationId: null },
        });

        // log movement (schema has no SCRAP type -> use ADJUST with note)
        await tx.stockMovement.create({
          data: {
            type: "ADJUST",
            itemId: oldUnit.itemId,
            qty: 1,
            note: `SCRAP (replacement) - Removed ${oldUnit.serialNumber || oldUnit.barcode || oldUnit.id.slice(0, 8)} in maintenance: ${job.title}`,
            createdById: req.user?.id || null,
            fromLocationId: null,
            toLocationId: null,
            maintenanceId,
            stockUnitId: oldUnitId,
          },
        });
      }

      // ----------------------------
      // (1) decrement InventoryStock at unit's location
      // ----------------------------
      if (fromLocationId) {
        await tx.inventoryStock.upsert({
          where: { itemId_locationId: { itemId: unit.itemId, locationId: fromLocationId } },
          create: { itemId: unit.itemId, locationId: fromLocationId, qty: 0 },
          update: {},
        });

        const row = await tx.inventoryStock.findUnique({
          where: { itemId_locationId: { itemId: unit.itemId, locationId: fromLocationId } },
        });

        const current = row?.qty || 0;
        const next = Math.max(0, current - 1);

        await tx.inventoryStock.update({
          where: { itemId_locationId: { itemId: unit.itemId, locationId: fromLocationId } },
          data: { qty: next },
        });
      }

      // ----------------------------
      // (2) create new assignment (Wheel2 installed)
      // ----------------------------
      const created = await tx.truckSparePartAssignment.create({
        data: {
          truckId: job.truckId,
          stockUnitId: unit.id,
          installedAt: now,
          note: note ? String(note) : null,
          createdById: req.user?.id || null,
          maintenanceId,
        },
        include: {
          stockUnit: { include: { item: true, location: true } },
          createdBy: true,
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
      // (4) create OUT movement (Wheel2 going out of inventory)
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

      return created;
    });

    res.json({ assignment });
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
    const { itemId, locationId, qty, note } = req.body || {};

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

      await tx.inventoryStock.update({
        where: { itemId_locationId: { itemId: item.id, locationId: String(locationId) } },
        data: { qty: current - q },
      });

      return tx.stockMovement.create({
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
    });

    res.json({ movement });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to use stock" });
  }
});


module.exports = router;
