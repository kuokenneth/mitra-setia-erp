const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

function isUniqueError(e) {
  // Prisma unique constraint error code is usually P2002
  return e && (e.code === "P2002" || String(e.message || "").includes("Unique constraint"));
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    try {
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
              { plateNumber: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
              { model: { contains: q, mode: "insensitive" } },
              { currentLocation: { contains: q, mode: "insensitive" } },
              { baseLocation: { contains: q, mode: "insensitive" } },
            ],
          }
        : {};

      const items = await prisma.truck.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          driverUser: { select: { id: true, name: true, email: true } },
          trips: {
            where: { purpose: "EMPTY_RETURN", status: { in: ["PLANNED", "DISPATCHED", "ARRIVED"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true, fromText: true, toText: true, plannedDepartAt: true, operationalReason: true },
          },
        },
      });

      const [gpsLocations, activeTripRows] = await Promise.all([
        prisma.operationalLocation.findMany({ where: { isActive: true } }),
        prisma.trip.findMany({
          where: { status: { in: ["PLANNED", "DISPATCHED", "ARRIVED"] } },
          select: { truckId: true, status: true, phase: true, serviceStops: { where: { endedAt: null }, select: { startedAt: true, location: { select: { id: true, name: true, type: true } } }, take: 1 } },
        }),
      ]);
      const activeTripTruckIds = new Set(activeTripRows.map((trip) => trip.truckId));
      const plannedTripTruckIds = new Set(activeTripRows.filter((trip) => trip.status === "PLANNED").map((trip) => trip.truckId));
      const serviceTripByTruckId = new Map(activeTripRows.filter((trip) => trip.phase === "SERVICE_AT_BASE").map((trip) => [trip.truckId, trip]));
      const stopWarningMinutes = Math.max(1, Number(process.env.GPS_STOP_WARNING_MINUTES || 30));
      const movingSpeedKph = Math.max(1, Number(process.env.GPS_MOVING_SPEED_KPH || 5));

      res.json({ items: items.map(({ trips, ...truck }) => {
        let nearest = null;
        if (Number.isFinite(truck.lastGpsLatitude) && Number.isFinite(truck.lastGpsLongitude)) {
          for (const location of gpsLocations) {
            const distance = distanceMeters(truck.lastGpsLatitude, truck.lastGpsLongitude, location.latitude, location.longitude);
            const isHigherPriority = location.type === "WARNING" && nearest?.location.type !== "WARNING";
            const isCloserAtSamePriority = nearest !== null
              && (location.type === "WARNING") === (nearest.location.type === "WARNING")
              && distance < nearest.distanceM;
            if (distance <= location.radiusM && (!nearest || isHigherPriority || isCloserAtSamePriority)) nearest = { location, distanceM: distance };
          }
        }
        const stoppedMinutes = truck.gpsStoppedSince
          ? Math.max(0, Math.floor((now.getTime() - truck.gpsStoppedSince.getTime()) / 60000))
          : 0;
        const hasGpsPosition = Number.isFinite(truck.lastGpsLatitude) && Number.isFinite(truck.lastGpsLongitude);
        const specialStatus = ["MAINTENANCE", "INACTIVE"].includes(truck.status);
        const hasActiveTrip = activeTripTruckIds.has(truck.id);
        const hasPlannedTrip = plannedTripTruckIds.has(truck.id);
        const isMoving = truck.lastGpsSpeed !== null && truck.lastGpsSpeed > movingSpeedKph;
        const isSafeLocation = nearest && nearest.location.type !== "WARNING";
        const serviceTrip = serviceTripByTruckId.get(truck.id);
        const serviceStop = serviceTrip?.serviceStops?.[0] || null;
        const effectiveStatus = specialStatus
          ? truck.status
          : hasActiveTrip
            ? (hasPlannedTrip ? "PLANNED" : "DISPATCH")
            : hasGpsPosition
              ? (!isMoving && isSafeLocation ? "READY" : "DISPATCH")
              : truck.status;
        const returnWarning = serviceTrip ? {
          since: serviceStop?.startedAt || null,
          location: serviceStop?.location?.name || nearest?.location.name || "Base",
          durationMinutes: serviceStop?.startedAt ? Math.max(0, Math.floor((now.getTime() - new Date(serviceStop.startedAt).getTime()) / 60000)) : 0,
          requiresAction: true,
        } : null;
        return {
          ...truck,
          currentLocation: nearest?.location.name || truck.currentLocation,
          status: effectiveStatus,
          activeEmptyReturnTrip: trips[0] || null,
          gpsLocation: nearest ? {
            id: nearest.location.id,
            name: nearest.location.name,
            type: nearest.location.type,
            distanceM: Math.round(nearest.distanceM),
          } : null,
          gpsStopWarning: stoppedMinutes >= stopWarningMinutes ? {
            since: truck.gpsStoppedSince,
            durationMinutes: stoppedMinutes,
            severity: nearest?.location.type === "WARNING" ? "CRITICAL" : "WARNING",
          } : null,
          tripReturnWarning: returnWarning,
          // Compatibility for frontend versions that may still be cached during deploy.
          tripServiceWarning: returnWarning,
        };
      }) });
    } catch (e) {
      console.error("GET /trucks failed", e);
      const migrationMissing = e?.code === "P2022" || String(e?.message || "").includes("does not exist");
      res.status(500).json({
        error: migrationMissing
          ? "Database belum memiliki kolom lokasi armada. Jalankan: npx prisma migrate deploy"
          : e?.message || "Gagal memuat armada",
      });
    }
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
      const { plateNumber, brand, model, year, vin, status, driverUserId, stnkExpiry, baseLocation, currentLocation } = req.body;

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
          baseLocation: baseLocation ? String(baseLocation).trim() : "Medan",
          currentLocation: currentLocation
            ? String(currentLocation).trim()
              : baseLocation
                ? String(baseLocation).trim()
                : "Medan",
          locationUpdatedAt: new Date(),
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
 * PUT /trucks/:id/location
 * Manual correction for a truck position and backhaul availability.
 */
router.put(
  "/:id/location",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const currentLocation = String(req.body?.currentLocation || "").trim();
      const baseLocation = req.body?.baseLocation !== undefined
        ? String(req.body.baseLocation || "").trim()
        : undefined;
      const availableForBackhaul = Boolean(req.body?.availableForBackhaul);

      if (!currentLocation) return res.status(400).json({ error: "Lokasi truk wajib diisi" });

      const truck = await prisma.truck.findUnique({ where: { id: req.params.id } });
      if (!truck) return res.status(404).json({ error: "Truck not found" });
      if (truck.status === "DISPATCH") {
        return res.status(400).json({ error: "Lokasi truk yang sedang dalam perjalanan diperbarui dari status trip" });
      }

      const nextBase = baseLocation === undefined ? truck.baseLocation : baseLocation || null;
      const atBase = nextBase && nextBase.toLocaleLowerCase("id-ID") === currentLocation.toLocaleLowerCase("id-ID");
      const waiting = availableForBackhaul && !atBase;

      const updated = await prisma.truck.update({
        where: { id: req.params.id },
        data: {
          baseLocation: nextBase,
          currentLocation,
          locationUpdatedAt: new Date(),
          availableForBackhaul: waiting,
          idleSince: waiting ? truck.idleSince || new Date() : null,
          status: ["INACTIVE", "MAINTENANCE"].includes(truck.status)
            ? truck.status
            : waiting
              ? "WAITING_BACKHAUL"
              : "READY",
        },
        include: { driverUser: { select: { id: true, name: true, email: true } } },
      });

      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Gagal memperbarui lokasi truk" });
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
 * POST /trucks/:id/stnk-renewal
 * Renew STNK and create a vehicle-linked expense in one transaction.
 */
router.post(
  "/:id/stnk-renewal",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const amount = Number(req.body.amount || 0);
      const expiryDate = req.body.stnkExpiry ? new Date(req.body.stnkExpiry) : null;
      const paymentMethod = String(req.body.paymentMethod || "BANK_TRANSFER").trim();
      if (!expiryDate || Number.isNaN(expiryDate.getTime())) return res.status(400).json({ error: "Tanggal berlaku STNK wajib diisi" });
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Biaya perpanjangan harus lebih dari 0" });
      if (!["BANK_TRANSFER", "CASH", "OTHER"].includes(paymentMethod)) return res.status(400).json({ error: "Metode pembayaran tidak valid" });

      const truck = await prisma.truck.findUnique({ where: { id: req.params.id }, select: { id: true, plateNumber: true } });
      if (!truck) return res.status(404).json({ error: "Kendaraan tidak ditemukan" });

      const result = await prisma.$transaction(async (tx) => {
        const expense = await tx.expense.create({
          data: {
            status: "SUBMITTED",
            paymentMethod,
            bankName: String(req.body.bankName || "").trim() || null,
            accountName: String(req.body.accountName || "").trim() || null,
            accountNumber: String(req.body.accountNumber || "").trim() || null,
            amount: Math.round(amount),
            currency: "IDR",
            reason: `Perpanjangan STNK ${truck.plateNumber}`,
            notes: String(req.body.notes || "").trim() || null,
            truckId: truck.id,
            createdById: req.user?.id,
          },
        });
        const updatedTruck = await tx.truck.update({
          where: { id: truck.id },
          data: { stnkExpiry: expiryDate, status: expiryDate <= new Date() ? "INACTIVE" : "READY" },
        });
        return { expense, truck: updatedTruck };
      });
      res.status(201).json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || "Gagal mencatat perpanjangan STNK" });
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

    // ✅ THIS MONTH TOTAL COST (based on installCost snapshot)
    const now = new Date();
    const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTo = new Date(now.getFullYear(), now.getMonth() + 1, 1); // exclusive

    const agg = await prisma.truckSparePartAssignment.aggregate({
      where: {
        truckId: id,
        installedAt: { gte: monthFrom, lt: monthTo },
        installCost: { not: null },
      },
      _sum: { installCost: true },
    });

    const anyCurrency = await prisma.truckSparePartAssignment.findFirst({
      where: {
        truckId: id,
        installedAt: { gte: monthFrom, lt: monthTo },
        currency: { not: null },
      },
      select: { currency: true },
      orderBy: { installedAt: "desc" },
    });


    res.json({
      rows,
      monthTotalCost: agg._sum.installCost || 0,
      monthCurrency: anyCurrency?.currency || "IDR",
      monthFrom,
      monthTo,
    });

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

      const ALLOWED = new Set(["READY", "INACTIVE", "MAINTENANCE", "WAITING_BACKHAUL", "RETURNING_EMPTY"]);

      if (!status || !ALLOWED.has(String(status).toUpperCase())) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updated = await prisma.truck.update({
        where: { id: req.params.id },
        data: {
          status: String(status).toUpperCase(),
          availableForBackhaul: String(status).toUpperCase() === "WAITING_BACKHAUL",
          idleSince: String(status).toUpperCase() === "WAITING_BACKHAUL" ? new Date() : null,
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
