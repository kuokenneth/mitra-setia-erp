// backend/src/routes/trips.js
const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");

const router = express.Router();

function canWrite(user) {
  return ["OWNER", "ADMIN", "STAFF"].includes(user?.role);
}

function isDriver(user) {
  return user?.role === "DRIVER";
}

function str(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

const ACTIVE_TRIP_STATUSES = ["PLANNED", "DISPATCHED", "ARRIVED"];

/**
 * Truck status helpers
 */
function desiredTruckStatusForTripStatus(tripStatus) {
  const s = String(tripStatus || "").toUpperCase();
  if (s === "DISPATCHED" || s === "ARRIVED") return "DISPATCH";
  if (s === "COMPLETED" || s === "CANCELLED") return "READY";
  if (s === "PLANNED") return "READY"; // reserve logic optional
  return null;
}

function sameLocation(a, b) {
  const normalize = (v) => String(v || "").trim().toLocaleLowerCase("id-ID");
  return Boolean(normalize(a) && normalize(a) === normalize(b));
}

async function updateTruckOperationalState(tx, trip, nextStatus, timestamp) {
  if (!trip?.truckId) return;

  const truck = await tx.truck.findUnique({ where: { id: trip.truckId } });
  if (!truck || ["MAINTENANCE", "INACTIVE"].includes(truck.status)) return;

  const origin = str(trip.fromText);
  const destination = str(trip.toText);
  const baseLocation = truck.baseLocation || origin || truck.currentLocation;

  if (nextStatus === "DISPATCHED") {
    await tx.truck.update({
      where: { id: truck.id },
      data: {
        status: "DISPATCH",
        baseLocation: truck.baseLocation || origin || undefined,
        currentLocation: origin || truck.currentLocation,
        locationUpdatedAt: timestamp,
        availableForBackhaul: false,
        idleSince: null,
      },
    });
    return;
  }

  if (nextStatus === "ARRIVED") {
    await tx.truck.update({
      where: { id: truck.id },
      data: {
        status: "DISPATCH",
        baseLocation: truck.baseLocation || origin || undefined,
        currentLocation: destination || truck.currentLocation,
        locationUpdatedAt: timestamp,
      },
    });
    return;
  }

  if (nextStatus === "COMPLETED") {
    const finalLocation = destination || truck.currentLocation;
    const awayFromBase = Boolean(baseLocation && finalLocation && !sameLocation(baseLocation, finalLocation));
    await tx.truck.update({
      where: { id: truck.id },
      data: {
        status: awayFromBase ? "WAITING_BACKHAUL" : "READY",
        baseLocation: truck.baseLocation || origin || undefined,
        currentLocation: finalLocation,
        locationUpdatedAt: timestamp,
        availableForBackhaul: awayFromBase,
        idleSince: awayFromBase ? timestamp : null,
      },
    });
    return;
  }

  if (nextStatus === "CANCELLED") {
    const location = truck.currentLocation || origin;
    const awayFromBase = Boolean(baseLocation && location && !sameLocation(baseLocation, location));
    await tx.truck.update({
      where: { id: truck.id },
      data: {
        status: awayFromBase ? "WAITING_BACKHAUL" : "READY",
        availableForBackhaul: awayFromBase,
        idleSince: awayFromBase ? timestamp : null,
      },
    });
  }
}

async function safeUpdateTruckStatus(tx, truckId, nextTruckStatus) {
  if (!truckId || !nextTruckStatus) return;

  const t = await tx.truck.findUnique({
    where: { id: truckId },
    select: { id: true, status: true },
  });
  if (!t) return;

  // Do NOT override special states
  if (["MAINTENANCE", "INACTIVE"].includes(t.status)) return;

  // Only auto-manage normal operational statuses
  if (!["READY", "DISPATCH", "WAITING_BACKHAUL", "RETURNING_EMPTY"].includes(t.status)) return;

  if (t.status === nextTruckStatus) return;

  await tx.truck.update({
    where: { id: truckId },
    data: { status: nextTruckStatus },
  });
}

/**
 * Helper: recompute order status when a trip changes.
 */
async function recomputeOrderStatus(tx, orderId) {
  if (!orderId) return;
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, qty: true },
  });
  if (!order) return;

  if (order.status === "CANCELLED") return;

  const trips = await tx.trip.findMany({
    where: { orderId },
    select: { status: true, qtyPlanned: true, qtyActual: true },
  });

  if (!trips.length) return;

  const allDone = trips.every((t) => t.status === "COMPLETED" || t.status === "CANCELLED");
  if (allDone) {
    const anyCompleted = trips.some((t) => t.status === "COMPLETED");
    const completedQty = trips
      .filter((t) => t.status === "COMPLETED")
      .reduce((sum, t) => sum + Number(t.qtyActual ?? t.qtyPlanned ?? 0), 0);
    const orderedQty = order.qty == null ? null : Number(order.qty);
    const quantityFulfilled = orderedQty == null || completedQty + 1e-9 >= orderedQty;

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: !anyCompleted
          ? "CANCELLED"
          : quantityFulfilled
            ? "COMPLETED"
            : "IN_PROGRESS",
      },
    });
    return;
  }

  await tx.order.update({
    where: { id: orderId },
    data: { status: "IN_PROGRESS" },
  });
}

/**
 * Normalize trip object for frontend
 * - add driver, driverName, truckPlate (so UI doesn't depend on driverUser naming)
 */
function normalizeTrip(t) {
  const driver = t.driverUser || null;
  const driverName = driver?.name || t.driverNameSnap || null;
  const truckPlate = t.truck?.plateNumber || t.plateNumberSnap || null;

  return {
    ...t,
    driver, // ✅ alias
    driverName, // ✅ convenience
    truckPlate, // ✅ convenience
  };
}

/**
 * GET /trips
 * Supports:
 * - status=...
 * - q=...
 * - dateFrom/dateTo=...
 * - ALSO supports from/to=... (aliases)
 * - ALSO supports today=1
 */
router.get("/", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });

    const status = str(req.query.status);
    const q = str(req.query.q);
    const page = Math.max(1, parseInt(req.query.page || "1", 10) || 1);
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : null;

    // ✅ aliases: from/to -> dateFrom/dateTo
    let dateFrom = toDate(req.query.dateFrom || req.query.from);
    let dateTo = toDate(req.query.dateTo || req.query.to);

    // ✅ today=1 shortcut
    const today = str(req.query.today);
    if (today === "1" || today === "true") {
      dateFrom = startOfToday();
      dateTo = endOfToday();
    }

    const where = {};
    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.OR = [
        { plannedDepartAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } },
        { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } },
      ];
    }

    if (q) {
      const qFilter = {
        OR: [
          { plateNumberSnap: { contains: q, mode: "insensitive" } },
          { driverNameSnap: { contains: q, mode: "insensitive" } },
          { toText: { contains: q, mode: "insensitive" } },
          { fromText: { contains: q, mode: "insensitive" } },
          { truck: { is: { plateNumber: { contains: q, mode: "insensitive" } } } },
          { driverUser: { is: { name: { contains: q, mode: "insensitive" } } } },
          { order: { is: { orderNo: { contains: q, mode: "insensitive" } } } },
          { order: { is: { toText: { contains: q, mode: "insensitive" } } } },
        ],
      };

      if (where.AND) where.AND.push(qFilter);
      else where.AND = [qFilter];
    }

    const [total, trips] = await prisma.$transaction([
      prisma.trip.count({ where }),
      prisma.trip.findMany({
        where,
        orderBy: [{ plannedDepartAt: "desc" }, { createdAt: "desc" }],
        ...(limit ? { skip: (page - 1) * limit, take: limit } : {}),
        include: {
          truck: true,
          driverUser: true,
          order: { select: { id: true, orderNo: true, customerName: true, fromText: true, toText: true, status: true } },
          dispatchLetter: true,
          _count: { select: { arrivalProofs: true, expenses: true } },
        },
      }),
    ]);

    res.json({ items: trips.map(normalizeTrip), pagination: { page, limit: limit || total || 1, total, totalPages: limit ? Math.max(1, Math.ceil(total / limit)) : 1 } });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to load trips" });
  }
});

/**
 * GET /trips/my
 */
router.get("/my", authRequired, async (req, res) => {
  try {
    if (!isDriver(req.user)) return res.status(403).json({ error: "Drivers only" });

    const status = str(req.query.status);

    const where = { driverUserId: req.user.id };
    if (status) where.status = status;

    const trips = await prisma.trip.findMany({
      where,
      orderBy: [{ plannedDepartAt: "desc" }, { createdAt: "desc" }],
      include: {
        truck: true,
        driverUser: true, // ✅ include so normalizeTrip works here too
        order: {
          select: { id: true, orderNo: true, customerName: true, cargoName: true, qty: true, unit: true, fromText: true, toText: true },
        },
        dispatchLetter: true,
      },
    });

    res.json({ items: trips.map(normalizeTrip) });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to load trips" });
  }
});

/**
 * POST /trips/empty-return
 * Create a non-revenue trip for a truck returning to its base without cargo.
 * The planned trip can be selected by Expenses before departure.
 */
router.post("/empty-return", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const { truckId, driverUserId, plannedDepartAt, reason } = req.body || {};
    if (!truckId) return res.status(400).json({ error: "Truk wajib dipilih" });

    const created = await prisma.$transaction(async (tx) => {
      const truck = await tx.truck.findUnique({ where: { id: truckId }, include: { driverUser: true } });
      if (!truck) throw new Error("Truk tidak ditemukan");
      if (truck.status !== "WAITING_BACKHAUL") throw new Error("Hanya truk yang menunggu backhaul yang dapat dibuatkan perjalanan kembali kosong");
      if (!truck.currentLocation) throw new Error("Lokasi truk saat ini belum diisi");
      if (!truck.baseLocation) throw new Error("Base / pool utama truk belum diisi");
      if (sameLocation(truck.currentLocation, truck.baseLocation)) throw new Error("Truk sudah berada di base / pool utama");

      const selectedDriverId = driverUserId || truck.driverUserId;
      if (!selectedDriverId) throw new Error("Pengemudi wajib dipilih");
      const driver = await tx.user.findUnique({ where: { id: selectedDriverId } });
      if (!driver || driver.role !== "DRIVER" || driver.status !== "ACTIVE") throw new Error("Pengemudi tidak aktif atau tidak valid");

      const busy = await tx.trip.findFirst({
        where: { OR: [{ truckId }, { driverUserId: selectedDriverId }], status: { in: ACTIVE_TRIP_STATUSES } },
        select: { id: true },
      });
      if (busy) throw new Error("Truk atau pengemudi masih memiliki perjalanan aktif");

      const trip = await tx.trip.create({
        data: {
          orderId: null,
          truckId,
          driverUserId: selectedDriverId,
          status: "PLANNED",
          purpose: "EMPTY_RETURN",
          operationalReason: str(reason) || "Kembali ke base tanpa muatan",
          plannedDepartAt: toDate(plannedDepartAt),
          plateNumberSnap: truck.plateNumber,
          driverNameSnap: driver.name,
          fromText: truck.currentLocation,
          toText: truck.baseLocation,
        },
      });
      await tx.truck.update({
        where: { id: truckId },
        data: { status: "RETURNING_EMPTY", availableForBackhaul: false, idleSince: null },
      });
      return trip;
    });

    const full = await prisma.trip.findUnique({ where: { id: created.id }, include: { truck: true, driverUser: true, order: true } });
    res.status(201).json(normalizeTrip(full));
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Gagal membuat perjalanan kembali kosong" });
  }
});

/**
 * GET /trips/:id
 */
router.get("/:id", authRequired, async (req, res) => {
  try {
    const id = req.params.id;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        truck: true,
        driverUser: true,
        order: {
          include: {
            customer: true,
          },
        },
        arrivalProofs: { orderBy: { createdAt: "desc" } },
        dispatchLetter: true,
      },
    });

    if (!trip) return res.status(404).json({ error: "Trip not found" });

    if (isDriver(req.user) && trip.driverUserId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json(normalizeTrip(trip));
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to load trip" });
  }
});

router.post("/:id/arrival-proofs", authRequired, async (req, res) => {
  try {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id }, select: { id: true, driverUserId: true, status: true } });
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    if (!canWrite(req.user) && !(isDriver(req.user) && trip.driverUserId === req.user.id)) return res.status(403).json({ error: "Forbidden" });
    if (!["DISPATCHED", "ARRIVED", "COMPLETED"].includes(trip.status)) return res.status(400).json({ error: "Bukti timbangan dapat diunggah setelah kendaraan berangkat" });
    const proofs = Array.isArray(req.body?.proofs) ? req.body.proofs : [];
    const valid = proofs.filter((proof) => str(proof?.url)).slice(0, 10);
    if (!valid.length) return res.status(400).json({ error: "Pilih minimal satu bukti timbangan" });
    await prisma.tripArrivalProof.createMany({ data: valid.map((proof) => ({ tripId: trip.id, url: str(proof.url), fileName: str(proof.fileName), mimeType: str(proof.mimeType), size: Number.isFinite(Number(proof.size)) ? Number(proof.size) : null })) });
    const arrivalProofs = await prisma.tripArrivalProof.findMany({ where: { tripId: trip.id }, orderBy: { createdAt: "desc" } });
    res.status(201).json({ arrivalProofs });
  } catch (e) {
    res.status(400).json({ error: e.message || "Gagal menyimpan bukti timbangan" });
  }
});

/**
 * PATCH /trips/:id/status
 */
router.patch("/:id/status", authRequired, async (req, res) => {
  try {
    const id = req.params.id;
    const nextStatus = str(req.body?.status);
    const ts = toDate(req.body?.timestamp) || new Date();
    const submittedQtyActual = req.body?.qtyActual === "" || req.body?.qtyActual == null ? null : Number(req.body.qtyActual);

    if (!nextStatus) return res.status(400).json({ error: "status is required" });

    const allowedStatuses = ["PLANNED", "DISPATCHED", "ARRIVED", "COMPLETED", "CANCELLED"];
    if (!allowedStatuses.includes(nextStatus)) return res.status(400).json({ error: "Invalid status" });

    const updated = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id },
        include: {
          order: { select: { id: true } },
          truck: { select: { id: true, plateNumber: true, currentLocation: true } },
          driverUser: { select: { id: true, name: true } },
        },
      });
      if (!trip) throw new Error("Trip not found");

      const writer = canWrite(req.user);
      const driver = isDriver(req.user);

      if (!writer && !driver) throw new Error("Forbidden");

      const needsArrivalWeight = trip.purpose === "DELIVERY" && ["ARRIVED", "COMPLETED"].includes(nextStatus);
      const resolvedQtyActual = submittedQtyActual ?? trip.qtyActual;
      if (needsArrivalWeight && (!Number.isFinite(resolvedQtyActual) || resolvedQtyActual <= 0)) {
        throw new Error("Berat tiba wajib diisi sebelum trip tiba atau selesai");
      }

      if (driver) {
        if (trip.driverUserId !== req.user.id) throw new Error("Forbidden");

        const legal = {
          PLANNED: ["DISPATCHED"],
          DISPATCHED: ["ARRIVED"],
          ARRIVED: ["COMPLETED"],
          COMPLETED: [],
          CANCELLED: [],
        };

        if (!legal[trip.status]?.includes(nextStatus)) {
          throw new Error(`Driver cannot change status from ${trip.status} to ${nextStatus}`);
        }
      }

      // ✅ NEW: Require truck + driver before making it active
      const isBecomingActive = ACTIVE_TRIP_STATUSES.includes(nextStatus);
      if (isBecomingActive) {
        if (!trip.truckId) throw new Error("Trip must have a truck before becoming active");
        if (!trip.driverUserId) throw new Error("Trip must have a driver before becoming active");
      }


      if (nextStatus === "DISPATCHED" && !sameLocation(trip.truck?.currentLocation, trip.fromText)) {
        throw new Error(
          `Truk berada di ${trip.truck?.currentLocation || "lokasi yang belum diatur"}, bukan di lokasi asal ${trip.fromText || "yang belum diatur"}`
        );
      }

      // double-book guard for becoming active
      if (isBecomingActive) {
        const driverBusy = await tx.trip.findFirst({
          where: {
            id: { not: trip.id },
            driverUserId: trip.driverUserId,
            status: { in: ACTIVE_TRIP_STATUSES },
          },
          select: { id: true },
        });
        if (driverBusy) throw new Error("Driver already has another active trip");

        const truckBusy = await tx.trip.findFirst({
          where: {
            id: { not: trip.id },
            truckId: trip.truckId,
            status: { in: ACTIVE_TRIP_STATUSES },
          },
          select: { id: true },
        });
        if (truckBusy) throw new Error("Truck already has another active trip");
      }

      // timestamps + snapshots
      const data = { status: nextStatus };
      if (submittedQtyActual !== null) {
        if (!Number.isFinite(submittedQtyActual) || submittedQtyActual <= 0) throw new Error("Berat tiba harus lebih dari nol");
        data.qtyActual = submittedQtyActual;
      }

      if (nextStatus === "DISPATCHED") data.dispatchedAt = ts;
      if (nextStatus === "ARRIVED") data.arrivedAt = ts;
      if (nextStatus === "COMPLETED") data.completedAt = ts;

      // ✅ ensure snapshots exist (helps search + display)
      if (!trip.plateNumberSnap && trip.truck?.plateNumber) data.plateNumberSnap = trip.truck.plateNumber;
      if (!trip.driverNameSnap && trip.driverUser?.name) data.driverNameSnap = trip.driverUser.name;

      const saved = await tx.trip.update({
        where: { id },
        data,
      });

      // Keep the physical location and backhaul availability in sync with the trip.
      await updateTruckOperationalState(tx, trip, nextStatus, ts);

      await recomputeOrderStatus(tx, trip.orderId);

      return saved;
    });

    const full = await prisma.trip.findUnique({
      where: { id: updated.id },
      include: {
        truck: true,
        driverUser: true,
        order: { select: { id: true, orderNo: true, status: true, customerName: true, fromText: true, toText: true } },
        dispatchLetter: true,
      },
    });

    res.json(normalizeTrip(full));
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to update trip status" });
  }
});

/**
 * PATCH /trips/:id
 * Admin/Staff edit trip metadata with guards
 */
router.patch("/:id", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });

    const id = req.params.id;
    const body = req.body || {};

    const updated = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id },
        include: {
          truck: true,
          driverUser: true,
          order: true,
        },
      });
      if (!trip) throw new Error("Trip not found");

      if (["COMPLETED", "CANCELLED"].includes(trip.status)) {
        throw new Error("Cannot edit a completed/cancelled trip");
      }

      const nextTruckId = body.truckId ?? trip.truckId;
      const nextDriverId = body.driverUserId ?? trip.driverUserId;

      // truck READY check if changing truck
      if (body.truckId && body.truckId !== trip.truckId) {
        const t = await tx.truck.findUnique({ where: { id: body.truckId } });
        if (!t) throw new Error("Truck not found");
        if (!["READY", "WAITING_BACKHAUL"].includes(t.status)) {
          throw new Error("Truck must be READY or WAITING_BACKHAUL");
        }
        if (!sameLocation(t.currentLocation, trip.fromText || trip.order?.fromText)) {
          throw new Error(
            `Truk berada di ${t.currentLocation || "lokasi yang belum diatur"}, bukan di lokasi asal ${trip.fromText || trip.order?.fromText || "yang belum diatur"}`
          );
        }
      }

      // driver ACTIVE+DRIVER check if changing driver
      if (body.driverUserId && body.driverUserId !== trip.driverUserId) {
        const d = await tx.user.findUnique({ where: { id: body.driverUserId } });
        if (!d) throw new Error("Driver not found");
        if (d.role !== "DRIVER") throw new Error("Selected user is not a DRIVER");
        if (d.status !== "ACTIVE") throw new Error("Driver must be ACTIVE");
      }

      // active guard
      const isActive = ACTIVE_TRIP_STATUSES.includes(trip.status);

      if (isActive) {
        if (nextDriverId) {
          const driverBusy = await tx.trip.findFirst({
            where: {
              id: { not: id },
              driverUserId: nextDriverId,
              status: { in: ACTIVE_TRIP_STATUSES },
            },
            select: { id: true },
          });
          if (driverBusy) throw new Error("Driver already has another active trip");
        }

        const truckBusy = await tx.trip.findFirst({
          where: {
            id: { not: id },
            truckId: nextTruckId,
            status: { in: ACTIVE_TRIP_STATUSES },
          },
          select: { id: true },
        });
        if (truckBusy) throw new Error("Truck already has another active trip");
      }

      // Update snapshots if you changed driver/truck
      let plateNumberSnap = trip.plateNumberSnap;
      let driverNameSnap = trip.driverNameSnap;

      if (body.truckId && body.truckId !== trip.truckId) {
        const t = await tx.truck.findUnique({ where: { id: body.truckId } });
        plateNumberSnap = t?.plateNumber || plateNumberSnap;
      }
      if (body.driverUserId && body.driverUserId !== trip.driverUserId) {
        const d = await tx.user.findUnique({ where: { id: body.driverUserId } });
        driverNameSnap = d?.name || driverNameSnap;
      }

      const saved = await tx.trip.update({
        where: { id },
        data: {
          truckId: body.truckId ?? undefined,
          driverUserId: body.driverUserId ?? undefined,
          plannedDepartAt:
            body.plannedDepartAt !== undefined ? (body.plannedDepartAt ? new Date(body.plannedDepartAt) : null) : undefined,
          plateNumberSnap,
          driverNameSnap,
        },
      });

      // if trip is active and truck changed, keep truck statuses consistent
      if (isActive && body.truckId && body.truckId !== trip.truckId) {
        await safeUpdateTruckStatus(tx, trip.truckId, "READY");
        await safeUpdateTruckStatus(tx, body.truckId, "DISPATCH");
      }

      return saved;
    });

    const full = await prisma.trip.findUnique({
      where: { id: updated.id },
      include: { truck: true, driverUser: true, order: true, dispatchLetter: true },
    });

    res.json(normalizeTrip(full));
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to update trip" });
  }
});

module.exports = router;
