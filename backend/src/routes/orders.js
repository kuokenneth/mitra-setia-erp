// backend/src/routes/orders.js
const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");

const router = express.Router();

function canWrite(user) {
  return ["OWNER", "ADMIN", "STAFF"].includes(user?.role);
}

function isDriverRole(user) {
  return user?.role === "DRIVER";
}

function str(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function num(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad4(n) {
  return String(n).padStart(4, "0");
}

// Simple sequential orderNo generator for SQLite (good enough for internal ERP).
// Format: ORD-YYYY-0001
async function nextOrderNo(tx) {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;

  const last = await tx.order.findFirst({
    where: { orderNo: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    select: { orderNo: true },
  });

  let nextSeq = 1;
  if (last?.orderNo) {
    const tail = last.orderNo.replace(prefix, "");
    const parsed = parseInt(tail, 10);
    if (Number.isFinite(parsed)) nextSeq = parsed + 1;
  }

  return `${prefix}${pad4(nextSeq)}`;
}

/**
 * GET /orders
 * Filters:
 *  - status
 *  - dateFrom, dateTo (plannedAt range)
 *  - customer (name substring)
 *  - q (orderNo / toText / fromText / cargoName / customerName)
 *  - type (OUTBOUND/RETURN)
 */
router.get("/", authRequired, async (req, res) => {
  try {
    const status = str(req.query.status);
    const type = str(req.query.type);
    const q = str(req.query.q);
    const customer = str(req.query.customer);

    const dateFrom = toDate(req.query.dateFrom);
    const dateTo = toDate(req.query.dateTo);

    const where = {};

    if (status) where.status = status;
    if (type) where.orderType = type;

    if (customer) {
      where.OR = [
        { customerName: { contains: customer, mode: "insensitive" } },
        { customer: { is: { name: { contains: customer, mode: "insensitive" } } } },
      ];
    }

    if (dateFrom || dateTo) {
      where.plannedAt = {};
      if (dateFrom) where.plannedAt.gte = dateFrom;
      if (dateTo) where.plannedAt.lte = dateTo;
    }

    if (q) {
      const qFilter = {
        OR: [
          { orderNo: { contains: q, mode: "insensitive" } },
          { customerName: { contains: q, mode: "insensitive" } },
          { cargoName: { contains: q, mode: "insensitive" } },
          { fromText: { contains: q, mode: "insensitive" } },
          { toText: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { customer: { is: { name: { contains: q, mode: "insensitive" } } } },
        ],
      };

      if (where.OR) {
        where.AND = where.AND || [];
        where.AND.push(qFilter);
      } else {
        Object.assign(where, qFilter);
      }
    }

    // inside router.get("/", authRequired, async (req, res) => {
    const orders = await prisma.order.findMany({
      where,
      orderBy: [{ plannedAt: "desc" }, { createdAt: "desc" }],
      include: {
        customer: true,
        _count: { select: { trips: true, proofs: true } },
        trips: {
          select: {
            status: true,
            qtyPlanned: true,
            qtyActual: true,
          },
        },
      },
    });

    // ✅ compute qtyTripped + qtyRemaining
    const items = orders.map((o) => {
      const total = typeof o.qty === "number" ? o.qty : null;

      // count how much has been "used" by trips
      // Rule:
      // - ignore CANCELLED trips
      // - if qtyActual exists, use it; else use qtyPlanned
      const tripped = (o.trips || [])
        .filter((t) => t.status !== "CANCELLED")
        .reduce((sum, t) => sum + (typeof t.qtyActual === "number" ? t.qtyActual : (typeof t.qtyPlanned === "number" ? t.qtyPlanned : 0)), 0);

      const remaining = total == null ? null : Math.max(0, total - tripped);

      // remove trips payload from list (optional)
      const { trips, ...rest } = o;

      return {
        ...rest,
        qtyTripped: tripped,
        qtyRemaining: remaining,
      };
    });

    res.json({ items });

  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to load orders" });
  }
});

/**
 * POST /orders
 * Body:
 *  {
 *    customerId?, customerName?,
 *    orderType?, status?, plannedAt?,
 *    cargoName?, qty?, unit?,
 *    fromText?, toText?,
 *    description?, notes?,
 *    proofs?: [{ url, fileName?, mimeType?, size? }]
 *  }
 */
router.post("/", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });

    const body = req.body || {};
    const proofs = Array.isArray(body.proofs) ? body.proofs : [];

    const created = await prisma.$transaction(async (tx) => {
      const orderNo = await nextOrderNo(tx);

      const order = await tx.order.create({
        data: {
          orderNo,
          orderType: body.orderType || "OUTBOUND",
          customerId: body.customerId || null,
          customerName: body.customerName || null,
          description: body.description || null,
          notes: body.notes || null,
          cargoName: body.cargoName || null,
          qty: typeof body.qty === "number" ? body.qty : num(body.qty, null),
          unit: body.unit || null,
          fromText: body.fromText || null,
          toText: body.toText || null,
          plannedAt: body.plannedAt ? new Date(body.plannedAt) : null,
          status: body.status || "DRAFT",
        },
      });

      if (proofs.length) {
        await tx.orderProof.createMany({
          data: proofs
            .map((p) => ({
              orderId: order.id,
              url: String(p?.url || "").trim(),
              fileName: p?.fileName || null,
              mimeType: p?.mimeType || null,
              size: typeof p?.size === "number" ? p.size : num(p?.size, null),
            }))
            .filter((x) => x.url),
        });
      }

      return order;
    });

    const full = await prisma.order.findUnique({
      where: { id: created.id },
      include: { customer: true, proofs: true, trips: true },
    });

    res.json(full);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to create order" });
  }
});

/**
 * GET /orders/:id
 * Returns order + proofs + trips + dispatch letters
 */
router.get("/:id", authRequired, async (req, res) => {
  try {
    const id = req.params.id;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        proofs: { orderBy: { createdAt: "desc" } },
        trips: {
          orderBy: { createdAt: "desc" },
          include: {
            truck: true,
            driverUser: true,
            dispatchLetter: true,
          },
        },
      },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to load order" });
  }
});

/**
 * PATCH /orders/:id
 * Update order fields (no status auto rules here; keep it simple)
 */
router.patch("/:id", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });

    const id = req.params.id;
    const body = req.body || {};

    const updated = await prisma.order.update({
      where: { id },
      data: {
        orderType: body.orderType ?? undefined,
        customerId: body.customerId ?? undefined,
        customerName: body.customerName ?? undefined,
        description: body.description ?? undefined,
        notes: body.notes ?? undefined,
        cargoName: body.cargoName ?? undefined,
        qty: body.qty !== undefined ? num(body.qty, null) : undefined,
        unit: body.unit ?? undefined,
        fromText: body.fromText ?? undefined,
        toText: body.toText ?? undefined,
        plannedAt: body.plannedAt !== undefined ? (body.plannedAt ? new Date(body.plannedAt) : null) : undefined,
        status: body.status ?? undefined,
      },
      include: { customer: true, proofs: true },
    });

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to update order" });
  }
});

/**
 * POST /orders/:id/proofs
 * Body: { proofs: [{ url, fileName?, mimeType?, size? }, ...] }
 */
router.post("/:id/proofs", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });

    const id = req.params.id;
    const proofs = Array.isArray(req.body?.proofs) ? req.body.proofs : [];

    const exists = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: "Order not found" });

    const created = await prisma.orderProof.createMany({
      data: proofs
        .map((p) => ({
          orderId: id,
          url: String(p?.url || "").trim(),
          fileName: p?.fileName || null,
          mimeType: p?.mimeType || null,
          size: typeof p?.size === "number" ? p.size : num(p?.size, null),
        }))
        .filter((x) => x.url),
    });

    res.json({ ok: true, count: created.count });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to add proofs" });
  }
});

/**
 * POST /orders/:id/trips
 * Assign truck + driver => create a Trip
 * Rules:
 *  - Truck must be READY
 *  - Driver must be ACTIVE and role DRIVER
 *  - Driver cannot be assigned to another active trip
 *  - Truck cannot be assigned to another active trip
 *  - ✅ qtyPlanned required if order.qty exists
 *  - ✅ sum(trips.qtyPlanned) cannot exceed order.qty (excluding CANCELLED trips)
 *
 * Body:
 *  {
 *    truckId,
 *    driverUserId,
 *    plannedDepartAt?,
 *    qtyPlanned?   // ✅ NEW
 *  }
 */
router.post("/:id/trips", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });

    const orderId = req.params.id;
    const { truckId, driverUserId, plannedDepartAt, qtyPlanned } = req.body || {};

    if (!truckId) return res.status(400).json({ error: "truckId is required" });
    if (!driverUserId) return res.status(400).json({ error: "driverUserId is required" });

    const tripQty = qtyPlanned !== undefined ? num(qtyPlanned, null) : undefined;
    if (qtyPlanned !== undefined && (tripQty === null || tripQty <= 0)) {
      return res.status(400).json({ error: "qtyPlanned must be a positive number" });
    }

    const activeTripStatuses = ["PLANNED", "DISPATCHED", "ARRIVED"];

    const trip = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("Order not found");
      if (order.status === "CANCELLED") throw new Error("Order is cancelled");

      // ✅ If order.qty exists, qtyPlanned is required and must not exceed remaining
      if (order.qty != null) {
        const q = tripQty === undefined ? null : tripQty;
        if (q === null || q <= 0) throw new Error("qtyPlanned is required for this order");

        const agg = await tx.trip.aggregate({
          where: { orderId, status: { not: "CANCELLED" } },
          _sum: { qtyPlanned: true },
        });

        const used = agg._sum.qtyPlanned || 0;
        const remaining = order.qty - used;

        if (q > remaining + 1e-9) {
          throw new Error(`Trip qty exceeds remaining. Remaining: ${remaining} ${order.unit || ""}`.trim());
        }
      }

      const truck = await tx.truck.findUnique({ where: { id: truckId } });
      if (!truck) throw new Error("Truck not found");
      if (truck.status !== "READY") throw new Error("Truck must be READY");

      const driver = await tx.user.findUnique({ where: { id: driverUserId } });
      if (!driver) throw new Error("Driver not found");
      if (!isDriverRole(driver)) throw new Error("Selected user is not a DRIVER");
      if (driver.status !== "ACTIVE") throw new Error("Driver must be ACTIVE");

      // driver active trip guard
      const driverBusy = await tx.trip.findFirst({
        where: { driverUserId, status: { in: activeTripStatuses } },
        select: { id: true },
      });
      if (driverBusy) throw new Error("Driver already has an active trip");

      // truck active trip guard
      const truckBusy = await tx.trip.findFirst({
        where: { truckId, status: { in: activeTripStatuses } },
        select: { id: true },
      });
      if (truckBusy) throw new Error("Truck already has an active trip");

      const createdTrip = await tx.trip.create({
        data: {
          orderId,
          truckId,
          driverUserId,
          status: "PLANNED",
          plannedDepartAt: plannedDepartAt ? new Date(plannedDepartAt) : null,

          // ✅ NEW fields (requires prisma schema migration)
          qtyPlanned: tripQty === undefined ? null : tripQty,
          unitSnap: order.unit || null,

          // snapshot
          plateNumberSnap: truck.plateNumber,
          driverNameSnap: driver.name || null,
          fromText: order.fromText || null,
          toText: order.toText || null,
        },
      });

      // update order status => IN_PROGRESS (if not already completed/cancelled)
      if (order.status !== "COMPLETED" && order.status !== "IN_PROGRESS") {
        await tx.order.update({
          where: { id: orderId },
          data: { status: "IN_PROGRESS" },
        });
      }

      return createdTrip;
    });

    const full = await prisma.trip.findUnique({
      where: { id: trip.id },
      include: { truck: true, driverUser: true, dispatchLetter: true },
    });

    res.json(full);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to create trip" });
  }
});

/**
 * POST /orders/:id/backhaul
 * Create Return / Backhaul order linked to original order.
 */
router.post("/:id/backhaul", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });

    const originalId = req.params.id;
    const body = req.body || {};

    const created = await prisma.$transaction(async (tx) => {
      const original = await tx.order.findUnique({ where: { id: originalId } });
      if (!original) throw new Error("Original order not found");

      const orderNo = await nextOrderNo(tx);

      const backhaul = await tx.order.create({
        data: {
          orderNo,
          orderType: "RETURN",
          status: "DRAFT",

          backhaulOfOrderId: original.id,

          customerId: original.customerId,
          customerName: original.customerName,

          fromText: original.toText || null,
          toText: body.toText || null,

          cargoName: body.cargoName ?? original.cargoName ?? null,
          qty: body.qty !== undefined ? num(body.qty, null) : original.qty,
          unit: body.unit ?? original.unit ?? null,

          plannedAt: body.plannedAt ? new Date(body.plannedAt) : null,
          notes: body.notes ?? null,
          description: body.description ?? null,
        },
      });

      return backhaul;
    });

    const full = await prisma.order.findUnique({
      where: { id: created.id },
      include: { customer: true, proofs: true, trips: true, backhaulOfOrder: true },
    });

    res.json(full);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to create backhaul order" });
  }
});

module.exports = router;
