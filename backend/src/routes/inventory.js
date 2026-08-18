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

function itemUniqueErrorMessage(e) {
  const target = Array.isArray(e?.meta?.target) ? e.meta.target : [e?.meta?.target];
  if (target.some((field) => String(field).toLowerCase() === "name")) {
    return "Nama barang sudah digunakan";
  }
  return "SKU sudah digunakan";
}

async function getDuplicateItemField({ sku, name, excludeId }) {
  const excludeCurrent = excludeId ? { id: { not: excludeId } } : {};
  if (sku) {
    const itemWithSku = await prisma.item.findFirst({
      where: { ...excludeCurrent, sku: { equals: sku, mode: "insensitive" } },
      select: { id: true },
    });
    if (itemWithSku) return "SKU";
  }
  if (name) {
    const itemWithName = await prisma.item.findFirst({
      where: { ...excludeCurrent, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (itemWithName) return "Nama barang";
  }
  return null;
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

async function consumeBatchesFifo(tx, itemId, locationId, qty) {
  let remaining = qty;
  const batches = await tx.inventoryBatch.findMany({
    where: { itemId, locationId, remainingQty: { gt: 0 } },
    orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
  });
  for (const batch of batches) {
    if (remaining <= 0) break;
    const used = Math.min(remaining, batch.remainingQty);
    await tx.inventoryBatch.update({ where: { id: batch.id }, data: { remainingQty: { decrement: used } } });
    remaining -= used;
  }
  return remaining;
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
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
  async (req, res) => {
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, parseInt(req.query.page || "1", 10) || 1);
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : undefined;
    const where =
      q.length > 0
        ? {
            OR: [
              { sku: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {};

    const [total, items] = await prisma.$transaction([
      prisma.item.count({ where }),
      prisma.item.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...(limit ? { skip: (page - 1) * limit, take: limit } : {}),
        include: {
          stocks: { include: { location: true } },
          _count: { select: { movements: true } },
        },
      }),
    ]);

    // add quick total
    const withTotals = items.map((it) => ({
      ...it,
      qtyTotal: (it.stocks || []).reduce((a, s) => a + (s.qty || 0), 0),
    }));

    res.json({ ok: true, items: withTotals, pagination: { page, limit: limit || total || 1, total, totalPages: limit ? Math.max(1, Math.ceil(total / limit)) : 1 } });
  }
);

/**
 * POST /inventory/items
 * body: { sku, name, unit?, isSerialized? }
 */
router.post(
  "/items",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
  async (req, res) => {
    try {
      const { sku, name, unit, isSerialized } = req.body || {};
      if (!sku || !name) {
        return res.status(400).json({ ok: false, error: "sku and name are required" });
      }
      const cleanSku = String(sku).trim();
      const cleanName = String(name).trim();
      const duplicateField = await getDuplicateItemField({ sku: cleanSku, name: cleanName });
      if (duplicateField) {
        return res.status(400).json({ ok: false, error: `${duplicateField} sudah digunakan` });
      }

      const item = await prisma.item.create({
        data: {
          sku: cleanSku,
          name: cleanName,
          unit: unit ? String(unit).trim() : undefined,
          isSerialized: Boolean(isSerialized),
        },
      });

      res.json({ ok: true, item });
    } catch (e) {
      if (isUniqueError(e)) {
        return res.status(400).json({ ok: false, error: itemUniqueErrorMessage(e) });
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
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { sku, name, unit, isSerialized } = req.body || {};
      const existing = await prisma.item.findUnique({
        where: { id },
        include: { stocks: { select: { qty: true } }, _count: { select: { stockUnits: true, movements: true } } },
      });
      if (!existing) return res.status(404).json({ ok: false, error: "Barang tidak ditemukan" });
      const nextSerialized = isSerialized !== undefined ? Boolean(isSerialized) : existing.isSerialized;
      const hasStockHistory = existing._count.stockUnits > 0 || existing._count.movements > 0 || existing.stocks.some((stock) => Number(stock.qty) !== 0);
      if (nextSerialized !== existing.isSerialized && hasStockHistory) {
        return res.status(400).json({ ok: false, error: "Tipe serialized tidak dapat diubah karena barang sudah memiliki stok atau riwayat pergerakan" });
      }
      const cleanSku = sku !== undefined ? String(sku).trim() : undefined;
      const cleanName = name !== undefined ? String(name).trim() : undefined;
      const cleanUnit = unit !== undefined ? String(unit).trim() : undefined;
      if (req.user?.role === "SPAREPART_ADMIN" && cleanName !== undefined && cleanName !== existing.name) {
        return res.status(403).json({ ok: false, error: "Admin Sparepart tidak dapat mengubah nama barang" });
      }
      if (cleanSku !== undefined && !cleanSku) return res.status(400).json({ ok: false, error: "SKU wajib diisi" });
      if (cleanName !== undefined && !cleanName) return res.status(400).json({ ok: false, error: "Nama barang wajib diisi" });
      if (cleanUnit !== undefined && !cleanUnit) return res.status(400).json({ ok: false, error: "Satuan wajib diisi" });
      const duplicateField = await getDuplicateItemField({
        sku: cleanSku ?? existing.sku,
        name: cleanName ?? existing.name,
        excludeId: id,
      });
      if (duplicateField) return res.status(400).json({ ok: false, error: `${duplicateField} sudah digunakan barang lain` });
      const item = await prisma.item.update({
        where: { id },
        data: {
          sku: cleanSku,
          name: cleanName,
          unit: cleanUnit,
          isSerialized: nextSerialized,
        },
      });
      res.json({ ok: true, item });
    } catch (e) {
      if (isUniqueError(e)) return res.status(400).json({ ok: false, error: `${itemUniqueErrorMessage(e)} untuk barang lain` });
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
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
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
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
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
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
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
 * GET /inventory/movements?itemId=&type=&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=50
 */
router.get(
  "/movements",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
  async (req, res) => {
    const itemId = req.query.itemId ? String(req.query.itemId) : undefined;
    const type = req.query.type ? String(req.query.type) : undefined;
    const from = req.query.from ? new Date(`${String(req.query.from)}T00:00:00.000`) : undefined;
    const to = req.query.to ? new Date(`${String(req.query.to)}T23:59:59.999`) : undefined;
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "50", 10)));
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      return res.status(400).json({ ok: false, error: "Format tanggal tidak valid" });
    }

    const movements = await prisma.stockMovement.findMany({
      where: {
        ...(itemId ? { itemId } : {}),
        ...(type ? { type } : {}),
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
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

router.get(
  "/batches",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
  async (req, res) => {
    const itemId = req.query.itemId ? String(req.query.itemId) : undefined;
    const locationId = req.query.locationId ? String(req.query.locationId) : undefined;
    const q = String(req.query.q || "").trim();
    const batches = await prisma.inventoryBatch.findMany({
      where: {
        ...(itemId ? { itemId } : {}),
        ...(locationId ? { locationId } : {}),
        ...(q ? { OR: [
          { item: { sku: { contains: q, mode: "insensitive" } } },
          { item: { name: { contains: q, mode: "insensitive" } } },
          { purchaseOrderItem: { purchaseOrder: { number: { contains: q, mode: "insensitive" } } } },
          { purchaseOrderItem: { purchaseOrder: { supplier: { name: { contains: q, mode: "insensitive" } } } } },
        ] } : {}),
      },
      include: {
        item: true,
        location: true,
        goodsReceipt: true,
        purchaseOrderItem: { include: { purchaseOrder: { include: { supplier: true } } } },
      },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      take: 300,
    });
    res.json({ ok: true, batches });
  }
);


/**
 * POST /inventory/receive
 * Non-serialized OR serialized (bulk).
 * body:
 * {
 *   itemId,
 *   locationId,
 *   qty,                 // required for non-serialized
 *   note,
 *   // for serialized:
 *   units: [{ serialNumber, barcode?, purchasePrice, purchasedAt? }]
 * }
 */
// POST /inventory/receive
router.post(
  "/receive",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
  async (req, res) => {
    const createdById = req.user?.id || null;
    const { itemId, locationId, qty, note, units } = req.body || {};

    if (!itemId || !locationId) {
      return res.status(400).json({ ok: false, error: "itemId and locationId are required" });
    }

    try {
      const item = await prisma.item.findUnique({ where: { id: itemId } });
      if (!item) throw new Error("Item not found");

      const location = await prisma.inventoryLocation.findUnique({ where: { id: locationId } });
      if (!location) throw new Error("Location not found");

      // ============================
      // SERIALIZED
      // ============================
      if (item.isSerialized) {
        const list = Array.isArray(units) ? units : [];
        const totalRaw = req.body?.totalPurchasePrice;

        if (list.length === 0) throw new Error("Serialized item requires units[]");

        const hasUnitPrices = list.some((u) => u?.purchasePrice != null);
        const hasTotalPrice =
          totalRaw != null && Number.isFinite(parseInt(totalRaw, 10)) && parseInt(totalRaw, 10) > 0;

        if (!hasUnitPrices && !hasTotalPrice) {
          throw new Error("Provide purchasePrice per unit OR totalPurchasePrice");
        }
        if (hasUnitPrices && hasTotalPrice) {
          throw new Error("Use either per-unit price OR totalPurchasePrice, not both");
        }

        const unitCount = list.length;
        const dividedPrice = hasTotalPrice ? Math.floor(parseInt(totalRaw, 10) / unitCount) : null;

        const data = list.map((u) => {
          const serial = u?.serialNumber ? String(u.serialNumber).trim() : "";
          if (!serial) throw new Error("Each serialized unit must have serialNumber");

          const price = hasUnitPrices ? parseInt(u.purchasePrice, 10) : dividedPrice;
          if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid purchase price calculation");

          return {
            itemId,
            locationId,
            serialNumber: serial,
            barcode: u?.barcode ? String(u.barcode).trim() : null,
            purchasePrice: price,
            purchasedAt: u?.purchasedAt ? new Date(u.purchasedAt) : null,
            currency: "IDR",
            status: "IN_STOCK",
          };
        });

        const receivedQty = data.length;

        await prisma.$transaction(async (tx) => {
          await tx.inventoryStock.upsert({ where: { itemId_locationId: { itemId, locationId } }, update: {}, create: { itemId, locationId, qty: 0 } });
          const averageUnitPrice = Math.round(data.reduce((sum, unit) => sum + unit.purchasePrice, 0) / receivedQty);
          const batch = await tx.inventoryBatch.create({ data: { itemId, locationId, receivedQty, remainingQty: receivedQty, receivedAt: new Date(), unitPrice: averageUnitPrice } });
          await tx.stockUnit.createMany({ data: data.map((unit) => ({ ...unit, inventoryBatchId: batch.id })) });
          await tx.inventoryStock.update({
            where: { itemId_locationId: { itemId, locationId } },
            data: { qty: { increment: receivedQty } },
          });
          await tx.stockMovement.create({
            data: {
              type: "IN",
              itemId,
              qty: receivedQty,
              note: note ? String(note) : null,
              createdById,
              toLocationId: locationId,
            },
          });
        });

        // fetch created units back (optional, but matches your old response)
        const serials = data.map((d) => d.serialNumber);
        const createdUnits = await prisma.stockUnit.findMany({
          where: { itemId, serialNumber: { in: serials } },
          orderBy: { createdAt: "desc" },
        });

        return res.json({ ok: true, createdUnits, receivedQty });
      }

      // ============================
      // NON-SERIALIZED
      // ============================
      const receivedQty = Number(qty || 0);
      if (!Number.isFinite(receivedQty) || receivedQty <= 0) {
        throw new Error("qty must be > 0 for non-serialized items");
      }

      const movement = await prisma.$transaction(async (tx) => {
        await tx.inventoryStock.upsert({ where: { itemId_locationId: { itemId, locationId } }, update: {}, create: { itemId, locationId, qty: 0 } });
        await tx.inventoryBatch.create({ data: { itemId, locationId, receivedQty, remainingQty: receivedQty, receivedAt: new Date() } });
        await tx.inventoryStock.update({
          where: { itemId_locationId: { itemId, locationId } },
          data: { qty: { increment: receivedQty } },
        });
        return tx.stockMovement.create({
          data: {
            type: "IN",
            itemId,
            qty: receivedQty,
            note: note ? String(note) : null,
            createdById,
            toLocationId: locationId,
          },
        });
      });

      res.json({ ok: true, movement, receivedQty });
    } catch (e) {
      // unique violations: serialNumber/barcode
      if (isUniqueError(e)) {
        return res.status(400).json({ ok: false, error: "serialNumber/barcode already exists (must be unique)" });
      }
      res.status(400).json({ ok: false, error: String(e?.message || e) });
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
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
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
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
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
 * GET /inventory/units?status=&itemId=&locationId=&q=
 */
router.get(
  "/units",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
  async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const itemId = req.query.itemId ? String(req.query.itemId) : undefined;
    const locationId = req.query.locationId ? String(req.query.locationId) : undefined;
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, parseInt(req.query.page || "1", 10) || 1);
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : undefined;

    const where = {
      ...(status ? { status } : {}),
      ...(itemId ? { itemId } : {}),
      ...(locationId ? { locationId } : {}),
      ...(q
        ? {
            OR: [
              { serialNumber: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q, mode: "insensitive" } },
              { item: { sku: { contains: q, mode: "insensitive" } } },
              { item: { name: { contains: q, mode: "insensitive" } } },
              {
                assignments: {
                  some: {
                    removedAt: null,
                    truck: { plateNumber: { contains: q, mode: "insensitive" } },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, units] = await prisma.$transaction([
      prisma.stockUnit.count({ where }),
      prisma.stockUnit.findMany({
        where,
        include: {
          item: true,
          location: true,
          inventoryBatch: {
            include: {
              goodsReceipt: true,
              purchaseOrderItem: { include: { purchaseOrder: { include: { supplier: true } } } },
            },
          },
          assignments: {
            where: { removedAt: null },
            include: { truck: true },
          },
          tireRetreads: {
            include: { supplier: true, fromItem: true, toItem: true },
            orderBy: { sentAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        ...(limit ? { skip: (page - 1) * limit, take: limit } : {}),
      }),
    ]);

    res.json({ ok: true, units, pagination: { page, limit: limit || total || 1, total, totalPages: limit ? Math.max(1, Math.ceil(total / limit)) : 1 } });
  }
);

/** Options used by the tire-retread forms (not limited by inventory pagination). */
router.get(
  "/retread-options",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
  async (_req, res) => {
    const [items, suppliers, locations] = await prisma.$transaction([
      prisma.item.findMany({ where: { isSerialized: true }, orderBy: { name: "asc" } }),
      prisma.supplier.findMany({ orderBy: { name: "asc" } }),
      prisma.inventoryLocation.findMany({ orderBy: { name: "asc" } }),
    ]);
    res.json({ ok: true, items, suppliers, locations });
  }
);

/** Remove an assigned tire (or take one from stock) and send it to a retread vendor. */
router.post(
  "/units/:unitId/retread",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
  async (req, res) => {
    const createdById = req.user?.id || null;
    const { unitId } = req.params;
    const { toItemId, supplierId, cost, sentAt, notes, maintenanceId } = req.body || {};
    const retreadCost = Number(cost);

    if (!toItemId) return res.status(400).json({ ok: false, error: "Item Ban Masak wajib dipilih" });
    if (!Number.isInteger(retreadCost) || retreadCost < 0) {
      return res.status(400).json({ ok: false, error: "Biaya masak harus berupa angka bulat dan tidak boleh negatif" });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const dispatchedAt = sentAt ? new Date(sentAt) : new Date();
        if (Number.isNaN(dispatchedAt.getTime())) throw new Error("Tanggal kirim tidak valid");
        const unit = await tx.stockUnit.findUnique({
          where: { id: unitId },
          include: {
            item: true,
            assignments: { where: { removedAt: null }, take: 1, include: { truck: true } },
          },
        });
        if (!unit) throw new Error("Unit tidak ditemukan");
        if (!unit.item.isSerialized) throw new Error("Hanya barang berserial yang dapat diproses");
        if (!['IN_STOCK', 'ASSIGNED'].includes(unit.status)) {
          throw new Error("Unit harus sedang terpasang di truk atau berada di stok");
        }
        if (unit.status === "IN_STOCK" && !unit.locationId) throw new Error("Lokasi unit tidak tercatat");
        if (unit.itemId === toItemId) throw new Error("Pilih item Ban Masak yang berbeda dari item asal");

        const targetItem = await tx.item.findUnique({ where: { id: toItemId } });
        if (!targetItem?.isSerialized) throw new Error("Item tujuan harus merupakan barang berserial");
        if (supplierId) {
          const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
          if (!supplier) throw new Error("Vendor tidak ditemukan");
        }
        const openRetread = await tx.tireRetread.findFirst({ where: { stockUnitId: unitId, status: "SENT" } });
        if (openRetread) throw new Error("Unit ini masih dalam proses masak");

        const activeAssignment = unit.assignments[0] || null;
        if (unit.status === "ASSIGNED") {
          if (!activeAssignment) throw new Error("Data pemasangan aktif pada truk tidak ditemukan");
          if (maintenanceId) {
            const maintenance = await tx.truckMaintenance.findUnique({ where: { id: maintenanceId } });
            if (!maintenance || maintenance.status !== "OPEN") throw new Error("Pekerjaan servis aktif tidak ditemukan");
            if (maintenance.truckId !== activeAssignment.truckId) throw new Error("Ban tidak terpasang pada truk servis ini");
          }
          await tx.truckSparePartAssignment.update({
            where: { id: activeAssignment.id },
            data: {
              removedAt: dispatchedAt,
              note: notes ? `Dilepas untuk masak ban: ${String(notes)}` : "Dilepas untuk masak ban",
            },
          });
        } else {
          const stock = await tx.inventoryStock.findUnique({
            where: { itemId_locationId: { itemId: unit.itemId, locationId: unit.locationId } },
          });
          if ((stock?.qty || 0) < 1) throw new Error("Stok unit pada lokasi asal tidak mencukupi");
          await tx.inventoryStock.update({
            where: { itemId_locationId: { itemId: unit.itemId, locationId: unit.locationId } },
            data: { qty: { decrement: 1 } },
          });
          if (unit.inventoryBatchId) {
            await tx.inventoryBatch.updateMany({
              where: { id: unit.inventoryBatchId, remainingQty: { gte: 1 } },
              data: { remainingQty: { decrement: 1 } },
            });
          }
        }

        const retread = await tx.tireRetread.create({
          data: {
            stockUnitId: unit.id,
            fromItemId: unit.itemId,
            toItemId,
            supplierId: supplierId || null,
            cost: retreadCost,
            sentAt: dispatchedAt,
            notes: notes ? String(notes) : null,
            createdById,
          },
          include: { supplier: true, fromItem: true, toItem: true },
        });
        await tx.stockUnit.update({ where: { id: unit.id }, data: { status: "RETREADING", locationId: null } });
        await tx.stockMovement.create({
          data: {
            type: "OUT",
            itemId: unit.itemId,
            qty: 1,
            note: `${activeAssignment?.truck?.plateNumber ? `Dilepas dari ${activeAssignment.truck.plateNumber} dan d` : "D"}ikirim untuk masak ban${retread.supplier?.name ? ` ke ${retread.supplier.name}` : ""}`,
            createdById,
            fromLocationId: unit.locationId,
            maintenanceId: maintenanceId || null,
            stockUnitId: unit.id,
          },
        });
        return retread;
      });
      res.json({ ok: true, retread: result });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  }
);

/** Complete a retread and return the same serial-numbered unit as the target item. */
router.post(
  "/units/:unitId/retread/complete",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
  async (req, res) => {
    const createdById = req.user?.id || null;
    const { unitId } = req.params;
    const { locationId, completedAt } = req.body || {};
    if (!locationId) return res.status(400).json({ ok: false, error: "Lokasi penerimaan wajib dipilih" });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const unit = await tx.stockUnit.findUnique({ where: { id: unitId } });
        if (!unit) throw new Error("Unit tidak ditemukan");
        if (unit.status !== "RETREADING") throw new Error("Unit tidak sedang dalam proses masak");
        const retread = await tx.tireRetread.findFirst({
          where: { stockUnitId: unitId, status: "SENT" },
          orderBy: { sentAt: "desc" },
          include: { supplier: true, toItem: true },
        });
        if (!retread) throw new Error("Data proses masak aktif tidak ditemukan");
        const location = await tx.inventoryLocation.findUnique({ where: { id: locationId } });
        if (!location) throw new Error("Lokasi penerimaan tidak ditemukan");
        const finishedAt = completedAt ? new Date(completedAt) : new Date();
        if (Number.isNaN(finishedAt.getTime())) throw new Error("Tanggal selesai tidak valid");

        await ensureStockRow(tx, retread.toItemId, locationId);
        await tx.inventoryStock.update({
          where: { itemId_locationId: { itemId: retread.toItemId, locationId } },
          data: { qty: { increment: 1 } },
        });
        const updatedUnit = await tx.stockUnit.update({
          where: { id: unitId },
          data: {
            itemId: retread.toItemId,
            locationId,
            status: "IN_STOCK",
            purchasePrice: retread.cost,
            retreadCount: { increment: 1 },
            lastRetreadAt: finishedAt,
            totalRetreadCost: { increment: retread.cost },
          },
          include: { item: true, location: true },
        });
        await tx.tireRetread.update({
          where: { id: retread.id },
          data: { status: "COMPLETED", completedAt: finishedAt },
        });
        await tx.stockMovement.create({
          data: {
            type: "IN",
            itemId: retread.toItemId,
            qty: 1,
            note: `Ban selesai dimasak${retread.supplier?.name ? ` oleh ${retread.supplier.name}` : ""}`,
            createdById,
            toLocationId: locationId,
            stockUnitId: unitId,
          },
        });
        return updatedUnit;
      });
      res.json({ ok: true, unit: result });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  }
);

/**
 * POST /inventory/units/:unitId/transfer
 * body: { toLocationId, note }
 */
router.post(
  "/units/:unitId/transfer",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
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
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
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
        if (unit.inventoryBatchId) {
          await tx.inventoryBatch.updateMany({
            where: { id: unit.inventoryBatchId, remainingQty: { gte: 1 } },
            data: { remainingQty: { decrement: 1 } },
          });
        }

        // create assignment
        // ✅ if serialized, require purchasePrice (so we can compute cost)
        if (unit.item?.isSerialized && (unit.purchasePrice == null || unit.purchasePrice <= 0)) {
          throw new Error("This unit must have purchasePrice before assigning to truck");
        }

        const assignment = await tx.truckSparePartAssignment.create({
          data: {
            truckId,
            stockUnitId: unitId,
            installedAt: installedAt ? new Date(installedAt) : new Date(),
            removedAt: null,
            note: note ? String(note) : null,
            createdById,
            maintenanceId: maintenanceId || null,

            // ✅ NEW: snapshot cost at install time
            installCost: unit.purchasePrice ?? null,
            currency: unit.currency ?? "IDR",
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
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
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
          if (unit.inventoryBatchId) {
            await tx.inventoryBatch.update({
              where: { id: unit.inventoryBatchId },
              data: { remainingQty: { increment: 1 } },
            });
          }

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
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
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
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
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
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
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

        await consumeBatchesFifo(tx, itemId, locationId, useQty);

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
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
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
  requireRole("OWNER", "ADMIN", "STAFF", "SPAREPART_ADMIN"),
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



module.exports = router;
