// backend/src/routes/orders.js
const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { esc, num: fmtNum, money, date: fmtDate, documentHtml } = require("../utils/printDocument");

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
        pickupLocation: true,
        destinationLocation: true,
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { trips: true, proofs: true } },
        trips: {
          select: {
            status: true,
            qtyPlanned: true,
            qtyActual: true,
          },
        },
        tripAllocations: { select: { qtyPlanned: true, qtyActual: true, trip: { select: { id: true, status: true } } } },
      },
    });

    // ✅ compute qtyTripped + qtyRemaining
    const items = orders.map((o) => {
      const total = typeof o.qty === "number" ? o.qty : null;
      const shipmentTrips = o.tripAllocations?.length
        ? o.tripAllocations.map((allocation) => ({ status: allocation.trip.status, qtyPlanned: allocation.qtyPlanned, qtyActual: allocation.qtyActual }))
        : (o.trips || []);

      // count how much has been "used" by trips
      // Rule:
      // - ignore CANCELLED trips
      // Sisa order mengikuti qty yang sudah dialokasikan ke trip. Berat aktual
      // tiba dipakai untuk mencatat kehilangan, bukan membuka kembali sisa order.
      const tripped = shipmentTrips
        .filter((t) => t.status !== "CANCELLED")
        .reduce((sum, t) => sum + (typeof t.qtyPlanned === "number" ? t.qtyPlanned : 0), 0);
      const delivered = shipmentTrips
        .filter((t) => t.status === "COMPLETED")
        .reduce((sum, t) => sum + (typeof t.qtyActual === "number" ? t.qtyActual : (typeof t.qtyPlanned === "number" ? t.qtyPlanned : 0)), 0);
      const cargoLoss = shipmentTrips
        .filter((t) => t.status === "COMPLETED")
        .reduce((sum, t) => sum + Math.max(0, Number(t.qtyPlanned || 0) - Number(t.qtyActual ?? t.qtyPlanned ?? 0)), 0);

      const remaining = total == null ? null : Math.max(0, total - tripped);

      // remove trips payload from list (optional)
      const { trips, tripAllocations, ...rest } = o;

      return {
        ...rest,
        _count: { ...rest._count, trips: new Set((tripAllocations || []).map((allocation) => allocation.trip.id)).size || rest._count.trips },
        qtyTripped: tripped,
        qtyRemaining: remaining,
        qtyDelivered: delivered,
        qtyCargoLoss: cargoLoss,
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
    const cargoCategory = ["FERTILIZER", "CANGKANG", "MATERIAL"].includes(body.cargoCategory)
      ? body.cargoCategory
      : "FERTILIZER";
    const orderQty = typeof body.qty === "number" ? body.qty : num(body.qty, null);
    if (cargoCategory !== "MATERIAL" && !(Number(orderQty) > 0)) {
      return res.status(400).json({ error: "Berat/jumlah wajib diisi untuk angkutan pupuk atau cangkang" });
    }
    const locationIds = [body.pickupLocationId, body.destinationLocationId].filter(Boolean);
    const locations = locationIds.length ? await prisma.operationalLocation.findMany({ where: { id: { in: locationIds }, isActive: true } }) : [];
    const pickupLocation = locations.find((location) => location.id === body.pickupLocationId);
    const destinationLocation = locations.find((location) => location.id === body.destinationLocationId);
    if (!pickupLocation || !destinationLocation) return res.status(400).json({ error: "Lokasi muat dan tujuan wajib dipilih dari Master Lokasi aktif" });
    if (pickupLocation.id === destinationLocation.id) return res.status(400).json({ error: "Lokasi muat dan tujuan harus berbeda" });

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
          cargoCategory,
          qty: cargoCategory === "MATERIAL" ? null : orderQty,
          unit: cargoCategory === "MATERIAL" ? null : (body.unit || null),
          pickupLocationId: pickupLocation.id,
          destinationLocationId: destinationLocation.id,
          fromText: pickupLocation.name,
          toText: destinationLocation.name,
          plannedAt: body.plannedAt ? new Date(body.plannedAt) : null,
          status: body.status || "DRAFT",
          createdById: req.user.id,
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
      include: { customer: true, pickupLocation: true, destinationLocation: true, createdBy: { select: { id: true, name: true, email: true } }, proofs: true, trips: true },
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
        pickupLocation: true,
        destinationLocation: true,
        createdBy: { select: { id: true, name: true, email: true } },
        proofs: { orderBy: { createdAt: "desc" } },
        materialInvoices: { orderBy: { issuedAt: "desc" }, include: { trip: { include: { truck: true } }, lines: { orderBy: { createdAt: "asc" } } } },
        trips: {
          orderBy: { createdAt: "desc" },
          include: {
            truck: true,
            driverUser: true,
            dispatchLetter: true,
            orderAllocations: { include: { order: { include: { customer: true } } } },
          },
        },
        tripAllocations: {
          orderBy: { createdAt: "desc" },
          include: { trip: { include: { truck: true, driverUser: true, dispatchLetter: true, orderAllocations: { include: { order: { include: { customer: true } } } } } } },
        },
      },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });
    const associatedTrips = order.tripAllocations.map((allocation) => ({
      ...allocation.trip,
      allocation,
      qtyPlanned: allocation.qtyPlanned,
      qtyActual: allocation.qtyActual,
      unitSnap: allocation.unitSnap,
    }));
    const tripsById = new Map([...order.trips, ...associatedTrips].map((trip) => [trip.id, trip]));
    res.json({ ...order, trips: [...tripsById.values()], tripAllocations: undefined });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to load order" });
  }
});

// Faktur muatan untuk angkutan material/ambang. Faktur hanya boleh dicatat
// sesudah sebuah truk ditetapkan ke pesanan.
router.get("/:id/material-invoices/print", authRequired, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        materialInvoices: { orderBy: { issuedAt: "asc" }, include: { trip: { include: { truck: true, driverUser: true } }, lines: { orderBy: { createdAt: "asc" } } } },
      },
    });
    if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
    const invoices = order.materialInvoices || [];
    const allLines = invoices.flatMap(invoice => (invoice.lines?.length ? invoice.lines : [{ itemName: invoice.materialName, qty: invoice.qty, unit: invoice.unit, totalKg: null, totalAmount: null }]).map(line => ({ invoice, line })));
    const totalQty = allLines.reduce((sum, row) => sum + Number(row.line.qty || 0), 0);
    const totalKg = allLines.reduce((sum, row) => sum + Number(row.line.totalKg || 0), 0);
    const totalAmount = allLines.reduce((sum, row) => sum + Number(row.line.totalAmount || 0), 0);
    const rows = allLines.map((row, index) => `<tr><td class="center">${index + 1}</td><td>${fmtDate(row.invoice.issuedAt)}</td><td><b>${esc(row.invoice.number)}</b><br><span class="muted">${esc(row.invoice.billingCustomerName || order.customer?.name || order.customerName || "-")} · ${esc(row.invoice.trip?.truck?.plateNumber || "-")}${row.invoice.trip?.driverUser?.name ? ` · ${esc(row.invoice.trip.driverUser.name)}` : ""}</span></td><td>${esc(row.line.ppNumber || "-")}</td><td>${esc(row.line.poNumber || "-")}</td><td>${esc(row.line.itemName || "-")}</td><td class="right">${fmtNum(row.line.qty)} ${esc(row.line.unit || "")}</td><td class="right">${row.line.totalKg == null ? "-" : fmtNum(row.line.totalKg)}</td><td class="right">${row.line.totalAmount == null ? "-" : money(row.line.totalAmount)}</td><td>${esc(row.invoice.notes || "-")}</td></tr>`).join("");
    res.type("html").send(documentHtml({
      title: "REKAP FAKTUR MUATAN",
      subtitle: order.orderNo,
      landscape: true,
      meta: `Tanggal pesanan: ${fmtDate(order.createdAt)}<br>Jumlah faktur: ${invoices.length}`,
      body: `<div class="summary"><div class="box">Pelanggan<b>${esc(order.customer?.name || order.customerName || "-")}</b><span>${esc(order.customer?.phone || "")}</span></div><div class="box">Rute<b>${esc(order.fromText || "-")} → ${esc(order.toText || "-")}</b><span>${invoices.length} faktur muatan</span></div><div class="box">Total tercatat<b>${totalKg ? `${fmtNum(totalKg)} kg` : `${fmtNum(totalQty)} unit`}</b><span>${totalAmount ? money(totalAmount) : "Nilai belum dicatat"}</span></div></div><table><thead><tr><th class="center">No</th><th>Tanggal</th><th>Surat Jalan / Armada</th><th>No. PP</th><th>No. PO</th><th>Barang</th><th class="right">Qty</th><th class="right">Total Kg</th><th class="right">Total Rp</th><th>Catatan</th></tr></thead><tbody>${rows || `<tr><td colspan="10" class="center">Belum ada faktur muatan pada pesanan ini.</td></tr>`}</tbody><tfoot><tr><td colspan="6" class="right"><b>TOTAL</b></td><td class="right"><b>${fmtNum(totalQty)}</b></td><td class="right"><b>${fmtNum(totalKg)}</b></td><td class="right"><b>${money(totalAmount)}</b></td><td></td></tr></tfoot></table><div class="signatures"><div>Dibuat oleh</div><div>Diperiksa oleh</div><div>Disetujui oleh</div></div>`,
    }));
  } catch (e) {
    res.status(400).json({ error: e.message || "Gagal mencetak faktur muatan" });
  }
});

router.post("/:id/material-invoices", authRequired, async (req, res) => {
  try {
    if (!canWrite(req.user)) return res.status(403).json({ error: "Forbidden" });
    const orderId = req.params.id;
    const { tripId, number, materialName, qty, unit, billingCustomerName, issuedAt, notes, proof, lines: inputLines } = req.body || {};
    if (!tripId) return res.status(400).json({ error: "Trip wajib diisi" });
    if (!str(billingCustomerName)) return res.status(400).json({ error: "Customer tujuan tagihan wajib diisi" });
    const lines = Array.isArray(inputLines) && inputLines.length
      ? inputLines.map((line) => ({ ppNumber: str(line.ppNumber), poNumber: str(line.poNumber), itemName: String(line.itemName || "").trim(), qty: num(line.qty, 0), unit: String(line.unit || "").trim(), totalKg: num(line.totalKg, null), totalAmount: num(line.totalAmount, null) }))
      : [{ ppNumber: null, poNumber: null, itemName: String(materialName || "").trim(), qty: num(qty, 0), unit: String(unit || "").trim(), totalKg: null, totalAmount: null }];
    if (lines.some((line) => !line.itemName || line.qty <= 0 || !line.unit)) return res.status(400).json({ error: "Setiap baris muatan wajib memiliki nama barang, qty, dan satuan" });
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { cargoCategory: true } });
    if (!order) return res.status(404).json({ error: "Order tidak ditemukan" });
    const trip = await prisma.trip.findFirst({
      where: { id: String(tripId), OR: [{ orderId }, { orderAllocations: { some: { orderId } } }] },
      include: { truck: true, orderAllocations: true, dispatchLetter: { select: { number: true } } },
    });
    if (!trip) return res.status(400).json({ error: "Tetapkan truk ke pesanan terlebih dahulu" });
    if (!trip.dispatchLetter?.number) return res.status(400).json({ error: "Buat Surat Jalan untuk trip ini terlebih dahulu" });
    const lineTons = lines.reduce((sum, line) => {
      if (line.totalKg != null) return sum + Number(line.totalKg) / 1000;
      if (String(line.unit).toUpperCase() === "TON") return sum + Number(line.qty);
      if (String(line.unit).toUpperCase() === "KG") return sum + Number(line.qty) / 1000;
      return sum;
    }, 0);
    const allocation = trip.orderAllocations.find((item) => item.orderId === orderId);
    const allocationTons = String(allocation?.unitSnap || "").toUpperCase() === "KG" ? Number(allocation?.qtyPlanned || 0) / 1000 : Number(allocation?.qtyPlanned || 0);
    if (order.cargoCategory === "MATERIAL" && allocationTons > 0 && lineTons > allocationTons + 1e-9) {
      return res.status(400).json({ error: `Berat Faktur Muatan melebihi alokasi ${allocation.qtyPlanned} ${allocation.unitSnap || "TON"}` });
    }
    if (order.cargoCategory !== "MATERIAL") {
      const allocatedTons = trip.orderAllocations.filter((item) => String(item.unitSnap || "").toUpperCase() === "TON").reduce((sum, item) => sum + Number(item.qtyPlanned || 0), 0);
      if (allocatedTons + lineTons > Number(trip.truck.capacityTons || 30) + 1e-9) {
        return res.status(400).json({ error: `Total muatan melebihi kapasitas ${trip.truck.capacityTons || 30} ton` });
      }
    }
    const documentNumber = trip.dispatchLetter.number;
    const invoice = await prisma.materialInvoice.create({
      data: { orderId, tripId: trip.id, number: documentNumber, materialName: lines.length === 1 ? lines[0].itemName : "Multiple materials", qty: lines.reduce((sum, line) => sum + line.qty, 0), unit: lines.length === 1 ? lines[0].unit : "LINES", billingCustomerName: str(billingCustomerName), issuedAt: issuedAt ? new Date(issuedAt) : new Date(), notes: str(notes), proofUrl: str(proof?.url), proofFileName: str(proof?.fileName), proofMimeType: str(proof?.mimeType), proofSize: num(proof?.size, null), lines: { create: lines } },
      include: { trip: { include: { truck: true } }, lines: true },
    });
    res.json({ invoice });
  } catch (e) {
    res.status(400).json({ error: e.code === "P2002" ? "Nomor faktur sudah dipakai pada pesanan ini" : e.message || "Gagal menyimpan faktur muatan" });
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
    const locationIds = [body.pickupLocationId, body.destinationLocationId].filter(Boolean);
    const locations = locationIds.length
      ? await prisma.operationalLocation.findMany({ where: { id: { in: locationIds }, isActive: true } })
      : [];
    const pickupLocation = body.pickupLocationId !== undefined
      ? locations.find((location) => location.id === body.pickupLocationId)
      : undefined;
    const destinationLocation = body.destinationLocationId !== undefined
      ? locations.find((location) => location.id === body.destinationLocationId)
      : undefined;
    if (body.pickupLocationId !== undefined && !pickupLocation) return res.status(400).json({ error: "Lokasi muat wajib dipilih dari Master Lokasi aktif" });
    if (body.destinationLocationId !== undefined && !destinationLocation) return res.status(400).json({ error: "Tujuan wajib dipilih dari Master Lokasi aktif" });
    if (pickupLocation && destinationLocation && pickupLocation.id === destinationLocation.id) return res.status(400).json({ error: "Lokasi muat dan tujuan harus berbeda" });

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
        pickupLocationId: pickupLocation?.id,
        destinationLocationId: destinationLocation?.id,
        fromText: pickupLocation?.name ?? body.fromText ?? undefined,
        toText: destinationLocation?.name ?? body.toText ?? undefined,
        plannedAt: body.plannedAt !== undefined ? (body.plannedAt ? new Date(body.plannedAt) : null) : undefined,
        status: body.status ?? undefined,
      },
      include: { customer: true, pickupLocation: true, destinationLocation: true, createdBy: { select: { id: true, name: true, email: true } }, proofs: true },
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
 *  - Truck must be READY or waiting for a backhaul
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

    const tripQty = qtyPlanned != null ? num(qtyPlanned, null) : undefined;
    if (qtyPlanned != null && (tripQty === null || tripQty <= 0)) {
      return res.status(400).json({ error: "qtyPlanned must be a positive number" });
    }

    const activeTripStatuses = ["PLANNED", "DISPATCHED", "ARRIVED"];

    const trip = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { pickupLocation: true, destinationLocation: true } });
      if (!order) throw new Error("Order not found");
      if (order.status === "CANCELLED") throw new Error("Order is cancelled");

      // Material/ambang receives its actual weight through MaterialInvoice after
      // loading. Fertilizer must always have a planned load quantity.
      const isMaterialShipment = order.cargoCategory === "MATERIAL" || (!(Number(order.qty) > 0) && order.cargoCategory !== "CANGKANG");
      if (!isMaterialShipment) {
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
      if (truck.status !== "READY") throw new Error("Armada harus berstatus READY");
      const plannedTons = String(order.unit || "").toUpperCase() === "TON" ? Number(tripQty || 0) : String(order.unit || "").toUpperCase() === "KG" ? Number(tripQty || 0) / 1000 : 0;
      if (plannedTons > Number(truck.capacityTons || 30) + 1e-9) throw new Error(`Muatan melebihi kapasitas ${truck.capacityTons || 30} ton`);
      if (!order.pickupLocation || !order.destinationLocation) {
        throw new Error("Lokasi muat dan tujuan order wajib dipilih dari Master Lokasi sebelum membuat trip");
      }
      // Any READY truck may be assigned. If it is outside the pickup radius,
      // the trip begins in TO_PICKUP and GPS tracks the empty leg first.

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
          destinationLat: order.destinationLocation?.latitude ?? null,
          destinationLng: order.destinationLocation?.longitude ?? null,
          arrivalRadiusM: order.destinationLocation?.radiusM ?? 400,
          pickupLat: order.pickupLocation?.latitude ?? null,
          pickupLng: order.pickupLocation?.longitude ?? null,
          pickupRadiusM: order.pickupLocation?.radiusM ?? 400,
        },
      });

      await tx.tripOrderAllocation.create({
        data: {
          tripId: createdTrip.id,
          orderId: order.id,
          qtyPlanned: createdTrip.qtyPlanned,
          unitSnap: createdTrip.unitSnap,
          isPrimary: true,
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
    }, { maxWait: 5000, timeout: 15000 });

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
          createdById: req.user.id,
        },
      });

      return backhaul;
    });

    const full = await prisma.order.findUnique({
      where: { id: created.id },
      include: { customer: true, createdBy: { select: { id: true, name: true, email: true } }, proofs: true, trips: true, backhaulOfOrder: true },
    });

    res.json(full);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to create backhaul order" });
  }
});

module.exports = router;
