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

function distanceMeters(lat1, lng1, lat2, lng2) {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function updateTruckOperationalState(tx, trip, nextStatus, timestamp) {
  if (!trip?.truckId) return;

  const truck = await tx.truck.findUnique({ where: { id: trip.truckId } });
  if (!truck || ["MAINTENANCE", "INACTIVE"].includes(truck.status)) return;

  const origin = str(trip.fromText);
  const baseLocation = truck.baseLocation || origin || truck.currentLocation;

  if (nextStatus === "DISPATCHED") {
    await tx.truck.update({
      where: { id: truck.id },
      data: {
        status: "DISPATCH",
        baseLocation: truck.baseLocation || origin || undefined,
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
      },
    });
    return;
  }

  if (nextStatus === "COMPLETED") {
    const gpsLocation = truck.currentLocation;
    const awayFromBase = Boolean(baseLocation && gpsLocation && !sameLocation(baseLocation, gpsLocation));
    await tx.truck.update({
      where: { id: truck.id },
      data: {
        status: "READY",
        baseLocation: truck.baseLocation || origin || undefined,
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

  const allocations = await tx.tripOrderAllocation.findMany({
    where: { orderId },
    select: { qtyPlanned: true, qtyActual: true, trip: { select: { status: true } } },
  });
  const trips = allocations.length
    ? allocations.map((item) => ({ status: item.trip.status, qtyPlanned: item.qtyPlanned, qtyActual: item.qtyActual }))
    : await tx.trip.findMany({ where: { orderId }, select: { status: true, qtyPlanned: true, qtyActual: true } });

  if (!trips.length) return;

  const allDone = trips.every((t) => t.status === "COMPLETED" || t.status === "CANCELLED");
  if (allDone) {
    const anyCompleted = trips.some((t) => t.status === "COMPLETED");
    // Kewajiban order dipenuhi dari qty yang ditugaskan pada trip selesai.
    // qtyActual adalah realisasi tiba dan selisihnya tetap dicatat sebagai
    // kehilangan muatan, bukan dikembalikan menjadi sisa order.
    const fulfilledQty = trips
      .filter((t) => t.status === "COMPLETED")
      .reduce((sum, t) => sum + Number(t.qtyPlanned ?? 0), 0);
    const orderedQty = order.qty == null ? null : Number(order.qty);
    const quantityFulfilled = orderedQty == null || fulfilledQty + 1e-9 >= orderedQty;

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
    truck: t.truck ? {
      ...t.truck,
      latitude: t.truck.lastGpsLatitude,
      longitude: t.truck.lastGpsLongitude,
    } : null,
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
 * POST /trips/single
 * Create an ad-hoc cargo trip without an Order. Weight is intentionally left
 * empty and will be recorded later by the billing workflow.
 */
router.post("/single", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const { truckId, driverUserId, pickupLocationId, destinationLocationId, plannedDepartAt, cargoName, reason } = req.body || {};
    if (!truckId) return res.status(400).json({ error: "Truk wajib dipilih" });
    if (!pickupLocationId || !destinationLocationId) return res.status(400).json({ error: "Lokasi muat dan tujuan wajib dipilih" });
    if (pickupLocationId === destinationLocationId) return res.status(400).json({ error: "Lokasi muat dan tujuan harus berbeda" });

    const created = await prisma.$transaction(async (tx) => {
      const [truck, pickup, destination] = await Promise.all([
        tx.truck.findUnique({ where: { id: truckId }, include: { driverUser: true } }),
        tx.operationalLocation.findFirst({ where: { id: pickupLocationId, isActive: true } }),
        tx.operationalLocation.findFirst({ where: { id: destinationLocationId, isActive: true } }),
      ]);
      if (!truck) throw new Error("Truk tidak ditemukan");
      if (["MAINTENANCE", "INACTIVE"].includes(truck.status)) throw new Error("Truk sedang tidak tersedia untuk perjalanan");
      if (!pickup || !destination) throw new Error("Master lokasi muat atau tujuan tidak ditemukan");

      const selectedDriverId = driverUserId || truck.driverUserId;
      if (!selectedDriverId) throw new Error("Pengemudi wajib dipilih");
      const driver = await tx.user.findUnique({ where: { id: selectedDriverId } });
      if (!driver || driver.role !== "DRIVER" || driver.status !== "ACTIVE") throw new Error("Pengemudi tidak aktif atau tidak valid");
      const busy = await tx.trip.findFirst({
        where: { OR: [{ truckId }, { driverUserId: selectedDriverId }], status: { in: ACTIVE_TRIP_STATUSES } },
        select: { id: true },
      });
      if (busy) throw new Error("Truk atau pengemudi masih memiliki perjalanan aktif");

      return tx.trip.create({
        data: {
          orderId: null,
          truckId,
          driverUserId: selectedDriverId,
          status: "PLANNED",
          phase: "PLANNED",
          purpose: "SINGLE_TRIP",
          operationalReason: str(reason) || str(cargoName) || "Trip tunggal tanpa pesanan",
          plannedDepartAt: toDate(plannedDepartAt),
          plateNumberSnap: truck.plateNumber,
          driverNameSnap: driver.name,
          fromText: pickup.name,
          toText: destination.name,
          pickupLat: pickup.latitude,
          pickupLng: pickup.longitude,
          pickupRadiusM: pickup.radiusM,
          destinationLat: destination.latitude,
          destinationLng: destination.longitude,
          arrivalRadiusM: destination.radiusM,
          qtyPlanned: null,
          qtyActual: null,
          unitSnap: null,
        },
      });
    });

    const full = await prisma.trip.findUnique({ where: { id: created.id }, include: { truck: true, driverUser: true, order: true } });
    res.status(201).json(normalizeTrip(full));
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Gagal membuat trip tunggal" });
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
    const { truckId, driverUserId, destinationLocationId, plannedDepartAt, reason } = req.body || {};
    if (!truckId) return res.status(400).json({ error: "Truk wajib dipilih" });

    const created = await prisma.$transaction(async (tx) => {
      const truck = await tx.truck.findUnique({ where: { id: truckId }, include: { driverUser: true } });
      if (!truck) throw new Error("Truk tidak ditemukan");
      if (["MAINTENANCE", "INACTIVE"].includes(truck.status)) throw new Error("Truk sedang tidak tersedia untuk perjalanan");
      if (!Number.isFinite(truck.lastGpsLatitude) || !Number.isFinite(truck.lastGpsLongitude)) throw new Error("Posisi GPS truk belum tersedia");
      const activeBases = await tx.operationalLocation.findMany({ where: { type: "BASE", isActive: true }, orderBy: { name: "asc" } });
      const destination = destinationLocationId
        ? activeBases.find(location => location.id === destinationLocationId)
        : activeBases.find(location => sameLocation(location.name, truck.baseLocation)) || activeBases[0];
      if (!destination) throw new Error("Master lokasi base tujuan tidak ditemukan atau tidak aktif");
      const distanceToBase = distanceMeters(truck.lastGpsLatitude, truck.lastGpsLongitude, destination.latitude, destination.longitude);
      if (distanceToBase <= destination.radiusM) throw new Error("Truk sudah berada di dalam radius base tujuan");

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
          fromText: truck.currentLocation || "Posisi GPS armada",
          toText: destination.name,
          destinationLat: destination.latitude,
          destinationLng: destination.longitude,
          arrivalRadiusM: destination.radiusM,
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
 * GET /trips/control-center
 * Unpaginated active trips for the dispatcher stage board.
 */
router.get("/control-center", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const trips = await prisma.trip.findMany({
      where: { status: { in: ACTIVE_TRIP_STATUSES } },
      orderBy: [{ plannedDepartAt: "asc" }, { createdAt: "asc" }],
      include: {
        truck: true,
        driverUser: true,
        order: { select: { id: true, orderNo: true, customerName: true, fromText: true, toText: true, status: true } },
        serviceStops: { where: { endedAt: null }, include: { location: true }, take: 1 },
        operationalActions: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            assignedTo: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    });
    res.json({ items: trips.map(normalizeTrip), generatedAt: new Date() });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Gagal memuat pusat kontrol trip" });
  }
});

router.get("/control-center/pics", authRequired, async (req, res) => {
  if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
  const items = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["OWNER", "ADMIN", "STAFF"] } },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true, role: true },
  });
  res.json({ items });
});

router.get("/:id/actions", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const items = await prisma.tripOperationalAction.findMany({
      where: { tripId: req.params.id },
      orderBy: { createdAt: "desc" },
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Gagal memuat tindak lanjut" });
  }
});

router.post("/:id/actions", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const actionType = str(req.body.actionType);
    const warningCode = str(req.body.warningCode) || "OPERATIONAL_WARNING";
    const note = str(req.body.note);
    const assignedToId = str(req.body.assignedToId);
    const expenseCategory = str(req.body.expenseCategory) || "TRIP_ALLOWANCE";
    const amount = req.body.amount == null || req.body.amount === "" ? null : Math.round(Number(req.body.amount));
    const allowedActions = ["HANDLE", "SEND_FUNDS", "REPORT_ISSUE", "CONTACT_DRIVER", "RESOLVE"];
    const allowedExpenseCategories = ["TRIP_ALLOWANCE", "REMAINING_TRIP_ALLOWANCE", "UNLOADING_FEE", "FUEL_LOAN", "DRIVER_SALARY", "FUEL", "TOLL_PARKING", "LOADING_UNLOADING", "REPAIR_MAINTENANCE", "SPAREPART", "OTHER"];
    if (!allowedActions.includes(actionType)) return res.status(400).json({ error: "Tindakan tidak valid" });
    if (!note) return res.status(400).json({ error: "Catatan tindakan wajib diisi" });
    if (actionType === "SEND_FUNDS" && (!Number.isFinite(amount) || amount <= 0)) return res.status(400).json({ error: "Nominal dana wajib lebih besar dari 0" });
    if (actionType === "SEND_FUNDS" && !allowedExpenseCategories.includes(expenseCategory)) return res.status(400).json({ error: "Jenis pengeluaran tidak valid" });

    const trip = await prisma.trip.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } });
    if (!trip) return res.status(404).json({ error: "Trip tidak ditemukan" });
    if (assignedToId) {
      const assignee = await prisma.user.findFirst({ where: { id: assignedToId, isActive: true }, select: { id: true } });
      if (!assignee) return res.status(400).json({ error: "PIC tidak valid" });
    }

    const created = await prisma.$transaction(async (tx) => {
      const action = await tx.tripOperationalAction.create({
        data: {
          tripId: trip.id,
          warningCode,
          actionType,
          note,
          amount: actionType === "SEND_FUNDS" ? amount : null,
          status: actionType === "RESOLVE" ? "RESOLVED" : "OPEN",
          assignedToId,
          createdById: req.user?.id,
          resolvedAt: actionType === "RESOLVE" ? new Date() : null,
        },
        include: {
          assignedTo: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });
      if (actionType === "SEND_FUNDS") {
        await tx.expense.create({
          data: {
            status: "SUBMITTED",
            paymentMethod: "BANK_TRANSFER",
            amount,
            currency: "IDR",
            category: expenseCategory,
            reason: `Dana operasional trip: ${note}`,
            notes: `Dibuat dari Pusat Tindakan Warning (${warningCode})`,
            tripId: trip.id,
            createdById: req.user?.id,
          },
        });
      }
      return action;
    });
    res.status(201).json(created);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Gagal menyimpan tindakan" });
  }
});

router.get("/:id/allocation-candidates", authRequired, async (req, res) => {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: req.params.id },
      include: { order: true, orderAllocations: { select: { orderId: true } } },
    });
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    const excludedIds = [...new Set([trip.orderId, ...trip.orderAllocations.map((item) => item.orderId)].filter(Boolean))];
    const items = await prisma.order.findMany({
      where: {
        id: { notIn: excludedIds },
        status: { in: ["DRAFT", "CONFIRMED", "IN_PROGRESS"] },
        pickupLocationId: trip.order?.pickupLocationId || undefined,
        destinationLocationId: trip.order?.destinationLocationId || undefined,
      },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ items });
  } catch (e) {
    res.status(400).json({ error: e.message || "Gagal memuat kandidat muatan" });
  }
});

router.post("/:id/allocations", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const orderId = str(req.body?.orderId);
    const qtyPlanned = Number(req.body?.qtyPlanned);
    const unitSnap = str(req.body?.unit) || "TON";
    if (!orderId) throw new Error("Order tambahan wajib dipilih");
    if (!Number.isFinite(qtyPlanned) || qtyPlanned <= 0) throw new Error("Jumlah muatan tambahan harus lebih dari nol");

    const allocation = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: req.params.id },
        include: { truck: true, order: true, orderAllocations: true },
      });
      if (!trip) throw new Error("Trip tidak ditemukan");
      if (!["PLANNED", "DISPATCHED"].includes(trip.status) || ["TO_DESTINATION", "AT_DESTINATION", "COMPLETED"].includes(trip.phase)) {
        throw new Error("Muatan tambahan hanya dapat dimasukkan sebelum kendaraan selesai memuat");
      }
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.status === "CANCELLED" || order.status === "COMPLETED") throw new Error("Order tambahan tidak tersedia");
      if (trip.order && (order.pickupLocationId !== trip.order.pickupLocationId || order.destinationLocationId !== trip.order.destinationLocationId)) {
        throw new Error("Order tambahan harus memiliki lokasi muat dan tujuan yang sama dengan trip");
      }
      const allocatedTons = trip.orderAllocations.reduce((sum, item) => {
        const unit = String(item.unitSnap || "").toUpperCase();
        return sum + (unit === "TON" ? Number(item.qtyPlanned || 0) : unit === "KG" ? Number(item.qtyPlanned || 0) / 1000 : 0);
      }, 0);
      const requestedTons = unitSnap.toUpperCase() === "TON" ? qtyPlanned : unitSnap.toUpperCase() === "KG" ? qtyPlanned / 1000 : 0;
      if (allocatedTons + requestedTons > Number(trip.truck.capacityTons || 30) + 1e-9) {
        throw new Error(`Total muatan melebihi kapasitas ${trip.truck.capacityTons || 30} ton`);
      }
      const created = await tx.tripOrderAllocation.create({
        data: { tripId: trip.id, orderId: order.id, qtyPlanned, unitSnap, isPrimary: false },
        include: { order: { include: { customer: true } } },
      });
      if (!["IN_PROGRESS", "COMPLETED"].includes(order.status)) {
        await tx.order.update({ where: { id: order.id }, data: { status: "IN_PROGRESS" } });
      }
      return created;
    });
    res.status(201).json(allocation);
  } catch (e) {
    res.status(e.code === "P2002" ? 409 : 400).json({ error: e.code === "P2002" ? "Order sudah dialokasikan ke trip ini" : e.message || "Gagal menambah muatan" });
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
        orderAllocations: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          include: { order: { include: { customer: true, materialInvoices: { where: { tripId: id }, include: { lines: true } } } } },
        },
        arrivalProofs: { orderBy: { createdAt: "desc" } },
        serviceStops: { include: { location: true }, orderBy: { startedAt: "desc" } },
        expenses: {
          orderBy: { createdAt: "desc" },
          include: { createdBy: { select: { id: true, name: true } } },
        },
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
    const proofType = str(req.body?.proofType) || "ARRIVAL";
    if (!["LOADING", "ARRIVAL"].includes(proofType)) return res.status(400).json({ error: "Jenis bukti timbangan tidak valid" });
    const proofs = Array.isArray(req.body?.proofs) ? req.body.proofs : [];
    const valid = proofs.filter((proof) => str(proof?.url)).slice(0, 10);
    if (!valid.length) return res.status(400).json({ error: "Pilih minimal satu bukti timbangan" });
    await prisma.tripArrivalProof.createMany({ data: valid.map((proof) => ({ tripId: trip.id, proofType, url: str(proof.url), fileName: str(proof.fileName), mimeType: str(proof.mimeType), size: Number.isFinite(Number(proof.size)) ? Number(proof.size) : null })) });
    const arrivalProofs = await prisma.tripArrivalProof.findMany({ where: { tripId: trip.id }, orderBy: { createdAt: "desc" } });
    res.status(201).json({ arrivalProofs });
  } catch (e) {
    res.status(400).json({ error: e.message || "Gagal menyimpan bukti timbangan" });
  }
});

/**
 * POST /trips/:id/start-delivery
 * Close the empty positioning leg after loading and start the loaded leg.
 */
router.post("/:id/start-delivery", authRequired, async (req, res) => {
  try {
    const id = req.params.id;
    const ts = toDate(req.body?.timestamp) || new Date();
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { truck: true, driverUser: true, order: true },
    });
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    if (!canWrite(req.user) && !(isDriver(req.user) && trip.driverUserId === req.user.id)) return res.status(403).json({ error: "Forbidden" });
    if (trip.purpose !== "DELIVERY") return res.status(400).json({ error: "Tahap muat hanya tersedia untuk trip pengiriman" });
    if (trip.status !== "DISPATCHED" || trip.phase !== "AT_PICKUP") {
      return res.status(400).json({ error: "Mobil harus tiba di lokasi muat sebelum memulai pengiriman" });
    }

    const saved = await prisma.trip.update({
      where: { id },
      data: { phase: "TO_DESTINATION", loadedAt: ts, gpsArrivalCandidateAt: null },
      include: { truck: true, driverUser: true, order: true, dispatchLetter: true },
    });
    res.json(normalizeTrip(saved));
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Gagal memulai pengiriman" });
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
          orderAllocations: true,
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


      if (nextStatus === "ARRIVED" && trip.purpose === "DELIVERY" && trip.phase !== "TO_DESTINATION" && trip.phase !== "AT_DESTINATION") {
        throw new Error("Trip belum menjalani tahap pengiriman dari lokasi muat ke tujuan");
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

      if (nextStatus === "DISPATCHED") {
        data.dispatchedAt = ts;
        if (trip.purpose === "DELIVERY") {
          data.phase = sameLocation(trip.truck?.currentLocation, trip.fromText) ? "AT_PICKUP" : "TO_PICKUP";
          if (data.phase === "AT_PICKUP") data.pickupArrivedAt = ts;
        }
      }
      if (nextStatus === "ARRIVED") { data.arrivedAt = ts; data.phase = "AT_DESTINATION"; }
      if (nextStatus === "COMPLETED") { data.completedAt = ts; data.phase = "COMPLETED"; }

      // ✅ ensure snapshots exist (helps search + display)
      if (!trip.plateNumberSnap && trip.truck?.plateNumber) data.plateNumberSnap = trip.truck.plateNumber;
      if (!trip.driverNameSnap && trip.driverUser?.name) data.driverNameSnap = trip.driverUser.name;

      const saved = await tx.trip.update({
        where: { id },
        data,
      });

      // Keep the physical location and backhaul availability in sync with the trip.
      await updateTruckOperationalState(tx, trip, nextStatus, ts);

      if (["ARRIVED", "COMPLETED"].includes(nextStatus)) {
        await tx.tripOrderAllocation.updateMany({
          where: { tripId: trip.id, isPrimary: true },
          data: { qtyActual: resolvedQtyActual },
        });
        if (nextStatus === "COMPLETED") {
          for (const allocation of trip.orderAllocations.filter((item) => !item.isPrimary && item.qtyActual == null)) {
            await tx.tripOrderAllocation.update({ where: { id: allocation.id }, data: { qtyActual: allocation.qtyPlanned } });
          }
        }
      }
      const affectedOrderIds = [...new Set([trip.orderId, ...trip.orderAllocations.map((item) => item.orderId)].filter(Boolean))];
      for (const affectedOrderId of affectedOrderIds) await recomputeOrderStatus(tx, affectedOrderId);

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
