// backend/src/routes/inventory.js
const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function isUniqueError(e) {
  return e && (e.code === "P2002" || String(e.message || "").includes("Unique constraint"));
}

/**
 * Helper: ensures InventoryStock row exists, returns it.
 */
async function ensureStockRow(tx, itemId, locationId) {
  const existing = await tx.inventoryStock.findUnique({
    where: { itemId_locationId: { itemId, locationId } },
  });
  if (existing) return existing;

  return tx.inventoryStock.create({
    data: { itemId, locationId, qty: 0 },
  });
}

/**
 * Helper: sum qty across all locations for an item
 */
async function getItemQtyTotal(tx, itemId) {
  const rows = await tx.inventoryStock.findMany({
    where: { itemId },
    select: { qty: true },
  });
  return rows.reduce((a, r) => a + (r.qty || 0), 0);
}

////////////////////////////////////////////////////
// ITEMS (Master data)
////////////////////////////////////////////////////

/**
 * GET /inventory/items?q=...
 */
router.get(
  "/items",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const q = String(req.query.q || "").trim();
    const where =
      q.length > 0
        ? {
            OR: [
              { sku: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {};

    const items = await prisma.item.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        stocks: { include: { location: true } },
        _count: { select: { movements: true } },
      },
    });

    // add quick total
    const withTotals = items.map((it) => ({
      ...it,
      qtyTotal: (it.stocks || []).reduce((a, s) => a + (s.qty || 0), 0),
    }));

    res.json({ ok: true, items: withTotals });
  }
);

/**
 * POST /inventory/items
 * body: { sku, name, unit?, isSerialized? }
 */
router.post(
  "/items",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const { sku, name, unit, isSerialized } = req.body || {};
      if (!sku || !name) {
        return res.status(400).json({ ok: false, error: "sku and name are required" });
      }

      const item = await prisma.item.create({
        data: {
          sku: String(sku).trim(),
          name: String(name).trim(),
          unit: unit ? String(unit).trim() : undefined,
          isSerialized: Boolean(isSerialized),
        },
      });

      res.json({ ok: true, item });
    } catch (e) {
      if (isUniqueError(e)) {
        return res.status(400).json({ ok: false, error: "SKU already exists" });
      }
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  }
);

/**
 * PATCH /inventory/items/:id
 */
router.patch(
  "/items/:id",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, unit, isSerialized } = req.body || {};
      const item = await prisma.item.update({
        where: { id },
        data: {
          name: name !== undefined ? String(name) : undefined,
          unit: unit !== undefined ? String(unit) : undefined,
          isSerialized: isSerialized !== undefined ? Boolean(isSerialized) : undefined,
        },
      });
      res.json({ ok: true, item });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  }
);

////////////////////////////////////////////////////
// LOCATIONS
////////////////////////////////////////////////////

/**
 * GET /inventory/locations
 */
router.get(
  "/locations",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const locations = await prisma.inventoryLocation.findMany({
      orderBy: { name: "asc" },
    });
    res.json({ ok: true, locations });
  }
);

/**
 * POST /inventory/locations
 * body: { name }
 */
router.post(
  "/locations",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const { name } = req.body || {};
      if (!name) return res.status(400).json({ ok: false, error: "name is required" });

      const location = await prisma.inventoryLocation.create({
        data: { name: String(name).trim() },
      });
      res.json({ ok: true, location });
    } catch (e) {
      if (isUniqueError(e)) {
        return res.status(400).json({ ok: false, error: "Location name already exists" });
      }
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  }
);

////////////////////////////////////////////////////
// STOCK (qty per location) + MOVEMENTS
////////////////////////////////////////////////////

/**
 * GET /inventory/stocks?itemId=&locationId=
 */
router.get(
  "/stocks",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const itemId = req.query.itemId ? String(req.query.itemId) : undefined;
    const locationId = req.query.locationId ? String(req.query.locationId) : undefined;

    const where = {
      ...(itemId ? { itemId } : {}),
      ...(locationId ? { locationId } : {}),
    };

    const stocks = await prisma.inventoryStock.findMany({
      where,
      include: { item: true, location: true },
      orderBy: [{ locationId: "asc" }, { itemId: "asc" }],
    });

    res.json({ ok: true, stocks });
  }
);

/**
 * GET /inventory/movements?itemId=&type=&limit=50
 */
router.get(
  "/movements",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const itemId = req.query.itemId ? String(req.query.itemId) : undefined;
    const type = req.query.type ? String(req.query.type) : undefined;
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "50", 10)));

    const movements = await prisma.stockMovement.findMany({
      where: {
        ...(itemId ? { itemId } : {}),
        ...(type ? { type } : {}),
      },
      include: {
          item: true,
          createdBy: true,
          fromLocation: true,
          toLocation: true,
          maintenance: { include: { truck: true } },
          stockUnit: {
            include: {
              assignments: {
                orderBy: { installedAt: "desc" },
                take: 1, // ✅ latest assignment = usage start
              },
            },
          },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json({ ok: true, movements });
  }
);

/**
 * POST /inventory/receive
 * Non-serialized OR serialized (bulk).
 * body:
 * {
 *   itemId,
 *   locationId,
 *   qty,                 // required for non-serialized; optional for serialized if units provided
 *   note,
 *   // for serialized:
 *   units: [{ serialNumber?, barcode?, purchasePrice?, purchasedAt? }]
 * }
 */
router.post(
  "/receive",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const createdById = req.user?.id || null;
    const { itemId, locationId, qty, note, units } = req.body || {};

    if (!itemId || !locationId) {
      return res.status(400).json({ ok: false, error: "itemId and locationId are required" });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const item = await tx.item.findUnique({ where: { id: itemId } });
        if (!item) throw new Error("Item not found");

        const location = await tx.inventoryLocation.findUnique({ where: { id: locationId } });
        if (!location) throw new Error("Location not found");

        // ensure stock row exists
        await ensureStockRow(tx, itemId, locationId);

        let receivedQty = 0;
        let createdUnits = [];

        if (item.isSerialized) {
          const list = Array.isArray(units) ? units : [];
          if (list.length === 0 && !Number.isFinite(Number(qty))) {
            throw new Error("Serialized item requires units[] OR qty");
          }

          // If qty is given but units not, we still allow (creates anonymous units without serial)
          const count = list.length > 0 ? list.length : Math.floor(num(qty, 0));
          if (count <= 0) throw new Error("Nothing to receive");

          // Create units
          const toCreate = list.length > 0 ? list : new Array(count).fill({});

          for (const u of toCreate) {
            const unitRow = await tx.stockUnit.create({
              data: {
                itemId,
                locationId,
                serialNumber: u?.serialNumber ? String(u.serialNumber).trim() : null,
                barcode: u?.barcode ? String(u.barcode).trim() : null,
                purchasePrice: u?.purchasePrice != null ? parseInt(u.purchasePrice, 10) : null,
                purchasedAt: u?.purchasedAt ? new Date(u.purchasedAt) : null,
                status: "IN_STOCK",
              },
            });
            createdUnits.push(unitRow);
          }

          receivedQty = createdUnits.length;
        } else {
          receivedQty = num(qty, 0);
          if (receivedQty <= 0) throw new Error("qty must be > 0 for non-serialized items");
        }

        // update stock qty
        await tx.inventoryStock.update({
          where: { itemId_locationId: { itemId, locationId } },
          data: { qty: { increment: receivedQty } },
        });

        // log movement
        const movement = await tx.stockMovement.create({
          data: {
            type: "IN",
            itemId,
            qty: receivedQty,
            note: note ? String(note) : null,
            createdById,
            toLocationId: locationId,
          },
        });

        return { movement, createdUnits, receivedQty };
      });

      res.json({ ok: true, ...result });
    } catch (e) {
      if (isUniqueError(e)) {
        return res.status(400).json({
          ok: false,
          error: "serialNumber/barcode already exists (must be unique)",
        });
      }
      res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  }
);

/**
 * POST /inventory/adjust
 * body: { itemId, locationId, qtyDelta, note }
 * qtyDelta can be + or -
 */
router.post(
  "/adjust",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const createdById = req.user?.id || null;
    const { itemId, locationId, qtyDelta, note } = req.body || {};

    if (!itemId || !locationId) {
      return res.status(400).json({ ok: false, error: "itemId and locationId are required" });
    }

    const delta = num(qtyDelta, 0);
    if (delta === 0) return res.status(400).json({ ok: false, error: "qtyDelta cannot be 0" });

    try {
      const result = await prisma.$transaction(async (tx) => {
        await ensureStockRow(tx, itemId, locationId);

        // prevent negative stock
        const current = await tx.inventoryStock.findUnique({
          where: { itemId_locationId: { itemId, locationId } },
        });
        const newQty = (current?.qty || 0) + delta;
        if (newQty < 0) throw new Error("Insufficient stock for this adjustment");

        await tx.inventoryStock.update({
          where: { itemId_locationId: { itemId, locationId } },
          data: { qty: newQty },
        });

        const movement = await tx.stockMovement.create({
          data: {
            type: "ADJUST",
            itemId,
            qty: delta,
            note: note ? String(note) : null,
            createdById,
            fromLocationId: delta < 0 ? locationId : null,
            toLocationId: delta > 0 ? locationId : null,
          },
        });

        return { movement, newQty };
      });

      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  }
);

/**
 * POST /inventory/transfer
 * body: { itemId, fromLocationId, toLocationId, qty, note }
 * For serialized items: you should transfer by unitId (below endpoint).
 */
router.post(
  "/transfer",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const createdById = req.user?.id || null;
    const { itemId, fromLocationId, toLocationId, qty, note } = req.body || {};
    const moveQty = num(qty, 0);

    if (!itemId || !fromLocationId || !toLocationId) {
      return res
        .status(400)
        .json({ ok: false, error: "itemId, fromLocationId, toLocationId are required" });
    }
    if (fromLocationId === toLocationId) {
      return res.status(400).json({ ok: false, error: "from and to locations must differ" });
    }
    if (moveQty <= 0) return res.status(400).json({ ok: false, error: "qty must be > 0" });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const item = await tx.item.findUnique({ where: { id: itemId } });
        if (!item) throw new Error("Item not found");
        if (item.isSerialized) {
          throw new Error("Serialized items must transfer by unitId (use /units/:unitId/transfer)");
        }

        await ensureStockRow(tx, itemId, fromLocationId);
        await ensureStockRow(tx, itemId, toLocationId);

        const from = await tx.inventoryStock.findUnique({
          where: { itemId_locationId: { itemId, locationId: fromLocationId } },
        });
        if ((from?.qty || 0) < moveQty) throw new Error("Insufficient stock at from location");

        await tx.inventoryStock.update({
          where: { itemId_locationId: { itemId, locationId: fromLocationId } },
          data: { qty: { decrement: moveQty } },
        });
        await tx.inventoryStock.update({
          where: { itemId_locationId: { itemId, locationId: toLocationId } },
          data: { qty: { increment: moveQty } },
        });

        const movement = await tx.stockMovement.create({
          data: {
            type: "TRANSFER",
            itemId,
            qty: moveQty,
            note: note ? String(note) : null,
            createdById,
            fromLocationId,
            toLocationId,
          },
        });

        return { movement };
      });

      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  }
);

////////////////////////////////////////////////////
// SERIALIZED UNITS (only if you added StockUnit + Assignment models)
////////////////////////////////////////////////////

/**
 * GET /inventory/units?status=IN_STOCK&itemId=&locationId=&q=
 */
router.get(
  "/units",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const itemId = req.query.itemId ? String(req.query.itemId) : undefined;
    const locationId = req.query.locationId ? String(req.query.locationId) : undefined;
    const q = String(req.query.q || "").trim();

    const where = {
      ...(status ? { status } : {}),
      ...(itemId ? { itemId } : {}),
      ...(locationId ? { locationId } : {}),
      ...(q
        ? {
            OR: [
              { serialNumber: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const units = await prisma.stockUnit.findMany({
      where,
      include: {
        item: true,
        location: true,
        assignments: {
          where: { removedAt: null },
          include: { truck: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ok: true, units });
  }
);

/**
 * POST /inventory/units/:unitId/transfer
 * body: { toLocationId, note }
 */
router.post(
  "/units/:unitId/transfer",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const createdById = req.user?.id || null;
    const { unitId } = req.params;
    const { toLocationId, note } = req.body || {};

    if (!toLocationId) return res.status(400).json({ ok: false, error: "toLocationId required" });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const unit = await tx.stockUnit.findUnique({
          where: { id: unitId },
          include: { item: true },
        });
        if (!unit) throw new Error("Unit not found");
        if (unit.status !== "IN_STOCK") throw new Error("Only IN_STOCK units can be transferred");

        const fromLocationId = unit.locationId;
        if (!fromLocationId) throw new Error("Unit has no fromLocationId");
        if (fromLocationId === toLocationId) throw new Error("Same location");

        await ensureStockRow(tx, unit.itemId, fromLocationId);
        await ensureStockRow(tx, unit.itemId, toLocationId);

        // move qty counters
        await tx.inventoryStock.update({
          where: { itemId_locationId: { itemId: unit.itemId, locationId: fromLocationId } },
          data: { qty: { decrement: 1 } },
        });
        await tx.inventoryStock.update({
          where: { itemId_locationId: { itemId: unit.itemId, locationId: toLocationId } },
          data: { qty: { increment: 1 } },
        });

        // update unit location
        const updatedUnit = await tx.stockUnit.update({
          where: { id: unitId },
          data: { locationId: toLocationId },
        });

        // movement log
        const movement = await tx.stockMovement.create({
          data: {
            type: "TRANSFER",
            itemId: unit.itemId,
            qty: 1,
            note: note ? String(note) : null,
            createdById,
            fromLocationId,
            toLocationId,
            stockUnitId: unitId,
          },
        });

        return { unit: updatedUnit, movement };
      });

      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  }
);

/**
 * POST /inventory/units/:unitId/assign
 * Assign serialized unit to a truck (disappears from inventory).
 * body: { truckId, installedAt?, note?, maintenanceId?, fromLocationId? }
 *
 * fromLocationId optional; if not provided we'll use unit.locationId
 */
router.post(
  "/units/:unitId/assign",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const createdById = req.user?.id || null;
    const { unitId } = req.params;
    const { truckId, installedAt, note, maintenanceId, fromLocationId } = req.body || {};

    if (!truckId) return res.status(400).json({ ok: false, error: "truckId is required" });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const unit = await tx.stockUnit.findUnique({
          where: { id: unitId },
          include: { item: true },
        });
        if (!unit) throw new Error("Unit not found");
        if (unit.status !== "IN_STOCK") throw new Error("Unit is not available (must be IN_STOCK)");

        const truck = await tx.truck.findUnique({ where: { id: truckId } });
        if (!truck) throw new Error("Truck not found");

        // prevent double-assign
        const open = await tx.truckSparePartAssignment.findFirst({
          where: { stockUnitId: unitId, removedAt: null },
        });
        if (open) throw new Error("This unit is already assigned");

        const fromLoc = fromLocationId || unit.locationId;
        if (!fromLoc) throw new Error("Unit has no location (cannot decrement stock)");

        await ensureStockRow(tx, unit.itemId, fromLoc);

        const stock = await tx.inventoryStock.findUnique({
          where: { itemId_locationId: { itemId: unit.itemId, locationId: fromLoc } },
        });
        if ((stock?.qty || 0) < 1) throw new Error("Stock qty is insufficient at this location");

        // decrement qty in warehouse
        await tx.inventoryStock.update({
          where: { itemId_locationId: { itemId: unit.itemId, locationId: fromLoc } },
          data: { qty: { decrement: 1 } },
        });

        // create assignment
        const assignment = await tx.truckSparePartAssignment.create({
          data: {
            truckId,
            stockUnitId: unitId,
            installedAt: installedAt ? new Date(installedAt) : new Date(),
            removedAt: null,
            note: note ? String(note) : null,
            createdById,
            maintenanceId: maintenanceId || null,
          },
          include: {
            truck: true,
            stockUnit: { include: { item: true } },
          },
        });

        // update unit status + remove location
        const updatedUnit = await tx.stockUnit.update({
          where: { id: unitId },
          data: { status: "ASSIGNED", locationId: null },
        });

        // OUT movement
        const movement = await tx.stockMovement.create({
          data: {
            type: "OUT",
            itemId: unit.itemId,
            qty: 1,
            note: note ? String(note) : "Assigned to truck",
            createdById,
            fromLocationId: fromLoc,
            toLocationId: null,
            maintenanceId: maintenanceId || null,
            stockUnitId: unitId,
          },
        });

        return { assignment, unit: updatedUnit, movement };
      });

      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  }
);

/**
 * POST /inventory/units/:unitId/remove
 * Remove from truck (close assignment) and optionally return to stock or scrap.
 * body: { removedAt?, statusAfter: "IN_STOCK"|"SCRAPPED"|"LOST", toLocationId?, note?, maintenanceId? }
 *
 * If statusAfter = IN_STOCK, toLocationId is required (where it goes back).
 */
router.post(
  "/units/:unitId/remove",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const createdById = req.user?.id || null;
    const { unitId } = req.params;
    const { removedAt, statusAfter, toLocationId, note, maintenanceId } = req.body || {};

    const after = statusAfter || "IN_STOCK";
    if (after === "IN_STOCK" && !toLocationId) {
      return res
        .status(400)
        .json({ ok: false, error: "toLocationId is required when returning to stock" });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const unit = await tx.stockUnit.findUnique({
          where: { id: unitId },
          include: { item: true },
        });
        if (!unit) throw new Error("Unit not found");

        // find open assignment
        const open = await tx.truckSparePartAssignment.findFirst({
          where: { stockUnitId: unitId, removedAt: null },
        });
        if (!open) throw new Error("No open assignment found for this unit");

        // close assignment
        const closed = await tx.truckSparePartAssignment.update({
          where: { id: open.id },
          data: {
            removedAt: removedAt ? new Date(removedAt) : new Date(),
            note: note ? String(note) : open.note,
            maintenanceId: maintenanceId || open.maintenanceId,
          },
          include: { truck: true },
        });

        let updatedUnit;

        if (after === "IN_STOCK") {
          await ensureStockRow(tx, unit.itemId, toLocationId);

          // increment qty back to warehouse
          await tx.inventoryStock.update({
            where: { itemId_locationId: { itemId: unit.itemId, locationId: toLocationId } },
            data: { qty: { increment: 1 } },
          });

          updatedUnit = await tx.stockUnit.update({
            where: { id: unitId },
            data: { status: "IN_STOCK", locationId: toLocationId },
          });

          // movement log (ADJUST or IN — choose IN because it returns)
          await tx.stockMovement.create({
            data: {
              type: "IN",
              itemId: unit.itemId,
              qty: 1,
              note: note ? String(note) : "Returned from truck",
              createdById,
              toLocationId,
              maintenanceId: maintenanceId || null,
              stockUnitId: unitId,
            },
          });
        } else {
          // SCRAPPED/LOST
          updatedUnit = await tx.stockUnit.update({
            where: { id: unitId },
            data: { status: after, locationId: null },
          });

          await tx.stockMovement.create({
            data: {
              type: "ADJUST",
              itemId: unit.itemId,
              qty: 0,
              note: note ? String(note) : `Unit marked ${after}`,
              createdById,
              stockUnitId: unitId,
              maintenanceId: maintenanceId || null,
            },
          });
        }

        return { assignment: closed, unit: updatedUnit };
      });

      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  }
);

////////////////////////////////////////////////////
// REPORTS: WHERE IS THIS SPAREPART USED? (history)
////////////////////////////////////////////////////

/**
 * GET /inventory/units/:unitId/history
 */
router.get(
  "/units/:unitId/history",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const { unitId } = req.params;

    const history = await prisma.truckSparePartAssignment.findMany({
      where: { stockUnitId: unitId },
      include: {
        truck: true,
        maintenance: { include: { truck: true } },
        createdBy: true,
        stockUnit: { include: { item: true } },
      },
      orderBy: { installedAt: "desc" },
    });

    res.json({ ok: true, history });
  }
);

/**
 * GET /inventory/trucks/:truckId/spareparts?currentOnly=1
 */
router.get(
  "/trucks/:truckId/spareparts",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const { truckId } = req.params;
    const currentOnly = String(req.query.currentOnly || "") === "1";

    const rows = await prisma.truckSparePartAssignment.findMany({
      where: {
        truckId,
        ...(currentOnly ? { removedAt: null } : {}),
      },
      include: {
        stockUnit: { include: { item: true } },
        createdBy: true,
        maintenance: true,
      },
      orderBy: { installedAt: "desc" },
    });

    res.json({ ok: true, rows });
  }
);

// ✅ ADD THIS ENDPOINT inside backend/src/routes/inventory.js
// Place it near /receive, /adjust, /transfer (Stock + Movements section)

// POST /inventory/consume
// body: { itemId, locationId, qty, note }
// For NON-SERIALIZED items only. Reduces qty at a specific location and logs movement.
router.post(
  "/consume",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const createdById = req.user?.id || null;
    const { itemId, locationId, qty, note } = req.body || {};

    if (!itemId || !locationId) {
      return res.status(400).json({ ok: false, error: "itemId and locationId are required" });
    }

    const useQty = num(qty, 0);
    if (useQty <= 0) {
      return res.status(400).json({ ok: false, error: "qty must be > 0" });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const item = await tx.item.findUnique({ where: { id: itemId } });
        if (!item) throw new Error("Item not found");
        if (item.isSerialized) throw new Error("consume is only for NON-serialized items");

        const location = await tx.inventoryLocation.findUnique({ where: { id: locationId } });
        if (!location) throw new Error("Location not found");

        await ensureStockRow(tx, itemId, locationId);

        const stock = await tx.inventoryStock.findUnique({
          where: { itemId_locationId: { itemId, locationId } },
        });

        const available = stock?.qty || 0;
        if (available < useQty) {
          throw new Error(`Insufficient stock at this location. Available: ${available}`);
        }

        // decrement qty
        const updated = await tx.inventoryStock.update({
          where: { itemId_locationId: { itemId, locationId } },
          data: { qty: { decrement: useQty } },
        });

        // movement log (use CONSUME or OUT; pick one and keep consistent)
        const movement = await tx.stockMovement.create({
          data: {
            type: "OUT", // ✅ if your enum doesn't have this, change to "OUT" instead
            itemId,
            qty: useQty,
            note: note ? String(note) : "Consumed",
            createdById,
            fromLocationId: locationId,
            toLocationId: null,
          },
        });

        return {
          movement,
          newQtyAtLocation: updated.qty,
          usedQty: useQty,
        };
      });

      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  }
);

// POST /inventory/units/:id/scrap
// POST /inventory/units/:id/scrap
router.post(
  "/units/:id/scrap",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const unitId = req.params.id;
    const { note } = req.body || {};
    const userId = req.user?.id; // from auth middleware

    try {
      const result = await prisma.$transaction(async (tx) => {
        const unit = await tx.stockUnit.findUnique({
          where: { id: unitId },
          include: {
            assignments: {
              where: { removedAt: null },
              orderBy: { installedAt: "desc" },
              take: 1,
              include: { truck: true },
            },
          },
        });

        if (!unit) throw new Error("Unit not found");
        if (unit.status === "SCRAPPED") throw new Error("Unit already scrapped");

        const activeAssign = unit.assignments?.[0] || null;

        // ✅ 1) If currently installed on a truck, mark it removed
        if (activeAssign) {
          await tx.truckSparePartAssignment.update({
            where: { id: activeAssign.id },
            data: { removedAt: new Date() },
          });
        }

        const oldLocationId = unit.locationId;

        // ✅ 2) If unit was still IN_STOCK at a location, decrease InventoryStock qty by 1
        // (only makes sense if you keep InventoryStock for serialized items)
        if (unit.status === "IN_STOCK" && oldLocationId) {
          await tx.inventoryStock.update({
            where: {
              itemId_locationId: { itemId: unit.itemId, locationId: oldLocationId },
            },
            data: { qty: { decrement: 1 } },
          });
        }

        // ✅ 3) Mark unit SCRAPPED (retired)
        const updatedUnit = await tx.stockUnit.update({
          where: { id: unitId },
          data: {
            status: "SCRAPPED",
            locationId: null, // scrapped units are not in a warehouse location
            scrappedAt: new Date(), // ✅ ADD THIS
          },
        });

        // ✅ 4) Create movement (your enum has no SCRAP, so use OUT + note)
        await tx.stockMovement.create({
          data: {
            type: "OUT",
            itemId: unit.itemId,
            qty: 1,
            note: `SCRAP: ${note || "Unit retired / unusable"}`,
            createdById: userId || null,
            fromLocationId: oldLocationId || null,
            toLocationId: null,
            stockUnitId: unit.id,
          },
        });

        return { unit: updatedUnit, wasAssignedToTruck: !!activeAssign, truck: activeAssign?.truck || null };
      });

      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e?.message || e) });
    }
  }
);

// PATCH /inventory/units/:id  (update barcode)
router.patch(
  "/units/:id",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const unitId = req.params.id;
      const barcodeRaw = req.body?.barcode;

      const barcode = String(barcodeRaw || "").trim();
      if (!barcode) return res.status(400).json({ error: "Barcode is required" });

      // (optional) limit length to avoid weird scans
      if (barcode.length > 64) return res.status(400).json({ error: "Barcode too long" });

      const updated = await prisma.stockUnit.update({
        where: { id: unitId },
        data: { barcode },
      });

      res.json({ ok: true, unit: updated });
    } catch (e) {
      // Prisma unique barcode constraint -> show nicer error
      if (e?.code === "P2002") {
        return res.status(400).json({ error: "Barcode already used by another unit" });
      }
      res.status(400).json({ error: String(e?.message || e) });
    }
  }
);

// GET /inventory/movements?truckId=...&from=...&to=...&q=...
router.get("/movements", authRequired, requireRole(["OWNER", "ADMIN", "STAFF"]), async (req, res) => {
  try {
    const { truckId, from, to, q } = req.query;

    const where = {};

    // ✅ only movements used by a truck
    if (truckId) where.truckId = truckId;

    // optional: date filter
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    // optional: free text (note / item name)
    // If you already have search logic, keep yours.
    // This is safe and simple:
    if (q) {
      where.OR = [
        { note: { contains: String(q), mode: "insensitive" } },
        { item: { name: { contains: String(q), mode: "insensitive" } } },
      ];
    }

    const rows = await prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        item: { select: { id: true, name: true, sku: true, uom: true } },
        location: { select: { id: true, name: true } },
        truck: { select: { id: true, plateNumber: true } }, // if relation exists
      },
      take: 500,
    });

    res.json({ rows });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to load movements" });
  }
});



module.exports = router;
