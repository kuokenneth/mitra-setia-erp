const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

function isUniqueError(e) {
  // Prisma unique constraint error code is usually P2002
  return e && (e.code === "P2002" || String(e.message || "").includes("Unique constraint"));
}

/**
 * GET /trucks
 * List trucks + assigned driver (if any)
 */
router.get(
  "/",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const now = new Date();

    // 🔥 auto mark expired STNK as INACTIVE
    await prisma.truck.updateMany({
      where: {
        stnkExpiry: { lte: now },
        status: { not: "INACTIVE" },
      },
      data: { status: "INACTIVE" },
    });

    const q = String(req.query.q || "").trim();

    const where = q
      ? {
          OR: [
            { plateNumber: { contains: q } },
            { brand: { contains: q } },
            { model: { contains: q } },
          ],
        }
      : {};

    const items = await prisma.truck.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        driverUser: { select: { id: true, name: true, email: true } },
      },
    });

    res.json({ items });
  }
);


/**
 * POST /trucks
 * Create truck (driver optional at creation)
 */
router.post(
  "/",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const { plateNumber, brand, model, year, vin, status, driverUserId, stnkExpiry } = req.body;

      const expiryDate = stnkExpiry ? new Date(stnkExpiry) : null;
      const now = new Date();

      const finalStatus =
        expiryDate && expiryDate <= now ? "INACTIVE" : status || "READY";

      if (!plateNumber || String(plateNumber).trim().length < 3) {
        return res.status(400).json({ error: "plateNumber is required" });
      }

      // if driverUserId provided, validate it is DRIVER
      if (driverUserId) {
        const u = await prisma.user.findUnique({
          where: { id: driverUserId },
          select: { id: true, role: true, isActive: true },
        });

        if (!u || u.role !== "DRIVER" || !u.isActive) {
          return res.status(400).json({ error: "Invalid driverUserId" });
        }
      }

      const created = await prisma.truck.create({
        data: {
          plateNumber: String(plateNumber).trim().toUpperCase(),
          brand: brand ? String(brand).trim() : null,
          model: model ? String(model).trim() : null,
          year: year ? Number(year) : null,
          vin: vin ? String(vin).trim() : null,
          stnkExpiry: expiryDate,
          status: finalStatus,
          driverUserId: driverUserId || null,
        },
        include: {
          driverUser: { select: { id: true, name: true, email: true } },
        },
      });

      res.status(201).json(created);
    } catch (e) {
      console.error(e);

      if (isUniqueError(e)) {
        return res.status(409).json({ error: "Plate number or VIN already exists" });
      }

      res.status(500).json({ error: "Failed to create truck" });
    }
  }
);

/**
 * PUT /trucks/:id/assign
 * Assign / Unassign driver by USER.id
 */
router.put(
  "/:id/assign",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const { driverUserId } = req.body; // user.id or null

      if (driverUserId) {
        const u = await prisma.user.findUnique({
          where: { id: driverUserId },
          select: { id: true, role: true, isActive: true },
        });

        if (!u || u.role !== "DRIVER" || !u.isActive) {
          return res.status(400).json({ error: "Invalid driverUserId" });
        }
      }

      const updated = await prisma.truck.update({
        where: { id: req.params.id },
        data: { driverUserId: driverUserId || null },
        include: {
          driverUser: { select: { id: true, name: true, email: true } },
        },
      });

      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to assign driver" });
    }
  }
);

/**
 * PUT /trucks/:id/stnk
 * Update STNK expiry date (auto-adjust status)
 */
router.put(
  "/:id/stnk",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const { stnkExpiry } = req.body;

      const expiryDate = stnkExpiry ? new Date(stnkExpiry) : null;
      const now = new Date();

      const status =
        expiryDate && expiryDate <= now ? "INACTIVE" : "READY";

      const updated = await prisma.truck.update({
        where: { id: req.params.id },
        data: {
          stnkExpiry: expiryDate,
          status,
        },
        include: {
          driverUser: { select: { id: true, name: true, email: true } },
        },
      });

      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to update STNK expiry" });
    }
  }
);

router.get(
  "/:id/spareparts",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    const { id } = req.params;

    const q = String(req.query.q || "").trim();
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    // inclusive end date
    if (to) to.setHours(23, 59, 59, 999);

    const where = {
      truckId: id,
      ...(from || to
        ? {
            installedAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { note: { contains: q } },
              { stockUnit: { serialNumber: { contains: q } } },
              { stockUnit: { barcode: { contains: q } } },
              { stockUnit: { item: { name: { contains: q } } } },
              { stockUnit: { item: { sku: { contains: q } } } },
              { maintenance: { title: { contains: q } } },
            ],
          }
        : {}),
    };

    const rows = await prisma.truckSparePartAssignment.findMany({
      where,
      orderBy: { installedAt: "desc" },
      include: {
        stockUnit: { include: { item: true, location: true } },
        maintenance: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
      take: 500,
    });

    res.json({ rows });
  }
);

/**
 * PUT /trucks/:id/status
 * Manually update truck status (e.g. SOLD → INACTIVE)
 */
router.put(
  "/:id/status",
  authRequired,
  requireRole("OWNER", "ADMIN"),
  async (req, res) => {
    try {
      const { status } = req.body;

      const ALLOWED = new Set(["READY", "INACTIVE", "MAINTENANCE"]);

      if (!status || !ALLOWED.has(String(status).toUpperCase())) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updated = await prisma.truck.update({
        where: { id: req.params.id },
        data: {
          status: String(status).toUpperCase(),
          // optional: auto-unassign driver if inactive
          driverUserId:
            String(status).toUpperCase() === "INACTIVE" ? null : undefined,
        },
        include: {
          driverUser: { select: { id: true, name: true, email: true } },
        },
      });

      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to update truck status" });
    }
  }
);



module.exports = router;
