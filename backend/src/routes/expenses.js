const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { SYSTEM_ACCOUNTS, cashCode, postJournal } = require("../services/accounting");
const { esc, money, date: fmtDate, documentHtml } = require("../utils/printDocument");

const router = express.Router();

const allowedRoles = ["OWNER", "ADMIN", "STAFF"];
const proofRoles = ["OWNER", "ADMIN", "STAFF"];
const TRIP_EXPENSE_LIMIT = Number(process.env.TRIP_EXPENSE_LIMIT || 0);
const EXPENSE_CATEGORIES = ["TRIP_ALLOWANCE", "DRIVER_SALARY", "FUEL", "TOLL_PARKING", "LOADING_UNLOADING", "REPAIR_MAINTENANCE", "SPAREPART", "OFFICE_OPERATIONAL", "OTHER"];

function ensureRole(req, res) {
  const role = req.user?.role;
  if (!allowedRoles.includes(role)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

function cleanStr(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

// List expenses
router.get("/", authRequired, async (req, res) => {
  if (!ensureRole(req, res)) return;

  const q = cleanStr(req.query.q || "");
  const paymentMethod = cleanStr(req.query.paymentMethod || "");
  const take = Math.min(parseInt(req.query.take || "50", 10), 200);
  const skip = Math.max(parseInt(req.query.skip || "0", 10), 0);

  const where = {
    AND: [
      ...(paymentMethod ? [{ paymentMethod }] : []),
      ...(q
        ? [
            {
              OR: [
                { reason: { contains: q, mode: "insensitive" } },
                { clientName: { contains: q, mode: "insensitive" } },
                { bankName: { contains: q, mode: "insensitive" } },
                { accountName: { contains: q, mode: "insensitive" } },
                { accountNumber: { contains: q, mode: "insensitive" } },
              ],
            },
          ]
        : []),
    ],
  };

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        truck: { select: { id: true, plateNumber: true, brand: true, model: true } },
        trip: {
          include: {
            truck: true,
            driverUser: true,
            order: {
              select: {
                id: true,
                orderNo: true,
                customerName: true,
                fromText: true,
                toText: true,
                status: true,
              },
            },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
        proofUploadedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.expense.count({ where }),
  ]);

  // duplicate detection: same tripId + same driver
  const withDup = await Promise.all(
    items.map(async (x) => {
      const tripId = x.trip?.id || x.tripId;
      const driverId = x.trip?.driverUserId || null;
      if (!tripId || !driverId) return { ...x, duplicateFlag: false, duplicateCount: 0, duplicates: [] };

      const duplicates = await prisma.expense.findMany({
        where: { tripId, trip: { is: { driverUserId: driverId } } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          amount: true,
          currency: true,
          reason: true,
          status: true,
          accountName: true,
          accountNumber: true,
          bankName: true,
        },
      });

      return {
        ...x,
        duplicateFlag: duplicates.length > 1,
        duplicateCount: duplicates.length,
        duplicates,
      };
    })
  );

  res.json({ items: withDup, total, skip, take });
});

// Monthly report (HTML)
// GET /expenses/report?month=YYYY-MM
router.get("/report", authRequired, async (req, res) => {
  if (!ensureRole(req, res)) return;

  const month = cleanStr(req.query.month);
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).send("Invalid month format. Use YYYY-MM.");
  }

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const mon = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(mon) || mon < 1 || mon > 12) {
    return res.status(400).send("Invalid month value.");
  }

  const start = new Date(year, mon - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, mon, 1, 0, 0, 0, 0);

  const items = await prisma.expense.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "asc" },
    include: {
      trip: {
        include: {
          truck: true,
          driverUser: true,
          order: {
            select: {
              id: true,
              orderNo: true,
              customerName: true,
              fromText: true,
              toText: true,
              status: true,
            },
          },
        },
      },
      truck: { select: { plateNumber: true, brand: true, model: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      proofUploadedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  const total = items.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const approved = items.filter(x => ["APPROVED", "PAID"].includes(x.status)).length;
  const categories = { TRIP_ALLOWANCE: "Uang jalan", DRIVER_SALARY: "Gaji pengemudi", FUEL: "Bahan bakar", TOLL_PARKING: "Tol & parkir", LOADING_UNLOADING: "Bongkar muat", REPAIR_MAINTENANCE: "Perbaikan & servis", SPAREPART: "Sparepart", OFFICE_OPERATIONAL: "Operasional kantor", OTHER: "Lainnya" };
  const methods = { BANK_TRANSFER: "Transfer bank", CASH: "Tunai", OTHER: "Lainnya" };
  const statuses = { SUBMITTED: "Diajukan", APPROVED: "Disetujui", PAID: "Dibayar", REJECTED: "Ditolak" };
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(start);
  const rows = items.map((x, index) => {
    const trip = x.trip || {};
    const truck = trip.truck || x.truck;
    const tripNumber = trip.order?.orderNo || trip.id || "-";
    const route = trip.order ? `${trip.order.fromText || "-"} → ${trip.order.toText || "-"}` : "Tidak terkait trip";
    const assignment = truck?.plateNumber ? `${truck.plateNumber}${trip.driverUser?.name ? ` · ${trip.driverUser.name}` : ""}` : "-";
    return `<tr><td class="center">${index + 1}</td><td>${fmtDate(x.createdAt)}</td><td>${esc(categories[x.category] || "Lainnya")}</td><td><b>${esc(x.reason || "-")}</b><br><span class="muted">${esc(tripNumber)} · ${esc(route)}</span></td><td>${esc(assignment)}</td><td>${esc(methods[x.paymentMethod] || x.paymentMethod || "-")}</td><td>${esc(x.createdBy?.name || "-")}</td><td>${esc(statuses[x.status] || x.status || "Diajukan")}</td><td class="right">${money(x.amount)}</td></tr>`;
  }).join("");

  res.type("html").send(documentHtml({
    title: "LAPORAN PENGELUARAN BULANAN",
    subtitle: monthLabel,
    meta: `Periode: 1–${new Date(year, mon, 0).getDate()} ${esc(monthLabel)}<br>Jumlah data: ${items.length}`,
    landscape: true,
    body: `<div class="summary"><div class="box">Total pengeluaran<b>${money(total)}</b><span>Seluruh transaksi periode ini</span></div><div class="box">Jumlah transaksi<b>${items.length}</b><span>Catatan pengeluaran</span></div><div class="box">Disetujui / dibayar<b>${approved}</b><span>Dari ${items.length} transaksi</span></div></div><table><thead><tr><th class="center">No</th><th>Tanggal</th><th>Kategori</th><th>Keterangan / Trip</th><th>Armada / Pengemudi</th><th>Metode</th><th>Dibuat oleh</th><th>Status</th><th class="right">Nominal</th></tr></thead><tbody>${rows || `<tr><td colspan="9" class="center">Belum ada pengeluaran pada periode ini.</td></tr>`}</tbody><tfoot><tr><td colspan="8" class="right"><b>TOTAL PENGELUARAN</b></td><td class="right"><b>${money(total)}</b></td></tr></tfoot></table><div class="signatures"><div>Dibuat oleh</div><div>Diperiksa oleh</div><div>Disetujui oleh</div></div>`,
  }));
});

// Create expense
router.post("/", authRequired, async (req, res) => {
  if (!ensureRole(req, res)) return;

  const paymentMethod = cleanStr(req.body.paymentMethod) || "BANK_TRANSFER";
  const amount = Number(req.body.amount || 0);
  const currency = cleanStr(req.body.currency) || "IDR";
  const category = cleanStr(req.body.category) || "OTHER";
  const reason = cleanStr(req.body.reason);
  const clientName = cleanStr(req.body.clientName);
  const bankName = cleanStr(req.body.bankName);
  const accountName = cleanStr(req.body.accountName);
  const accountNumber = cleanStr(req.body.accountNumber);
  const notes = cleanStr(req.body.notes);
  const tripId = cleanStr(req.body.tripId);

  const allowedMethods = ["BANK_TRANSFER", "CASH", "OTHER"];
  if (!allowedMethods.includes(paymentMethod)) {
    return res.status(400).json({ error: "Invalid payment method" });
  }
  if (!EXPENSE_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "Kategori pengeluaran tidak valid" });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Amount must be greater than 0" });
  }
  if (!reason) {
    return res.status(400).json({ error: "Reason is required" });
  }
  let trip = null;
  if (tripId) {
    trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, driverUserId: true, status: true },
    });
    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }
    if (["COMPLETED", "CANCELLED"].includes(trip.status)) {
      return res.status(400).json({
        error: "Pengeluaran hanya dapat ditambahkan sebelum perjalanan diselesaikan",
      });
    }
  }

  const created = await prisma.expense.create({
    data: {
      status: "SUBMITTED",
      paymentMethod,
      bankName,
      accountName,
      accountNumber,
      amount: Math.round(amount),
      currency,
      category,
      reason,
      clientName,
      notes,
      tripId: tripId || null,
      createdById: req.user?.id,
    },
    include: {
      trip: {
        include: {
          truck: true,
          driverUser: true,
          order: { select: { id: true, orderNo: true, customerName: true, fromText: true, toText: true, status: true } },
        },
      },
      createdBy: { select: { id: true, name: true, email: true } },
      proofUploadedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  let duplicateFlag = false;
  if (trip?.id && trip?.driverUserId) {
    const dupCount = await prisma.expense.count({
      where: { tripId: trip.id, trip: { is: { driverUserId: trip.driverUserId } } },
    });
    duplicateFlag = dupCount > 1;
  }

  res.status(201).json({ ...created, duplicateFlag });
});

// Update expense
router.patch("/:id", authRequired, async (req, res) => {
  if (!ensureRole(req, res)) return;

  const { id } = req.params;

  const paymentMethod = cleanStr(req.body.paymentMethod);
  const amount = req.body.amount !== undefined ? Number(req.body.amount) : undefined;
  const currency = cleanStr(req.body.currency);
  const category = cleanStr(req.body.category);
  const reason = cleanStr(req.body.reason);
  const clientName = cleanStr(req.body.clientName);
  const bankName = cleanStr(req.body.bankName);
  const accountName = cleanStr(req.body.accountName);
  const accountNumber = cleanStr(req.body.accountNumber);
  const notes = cleanStr(req.body.notes);

  if (paymentMethod) {
    const allowedMethods = ["BANK_TRANSFER", "CASH", "OTHER"];
    if (!allowedMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid payment method" });
    }
  }
  if (category && !EXPENSE_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "Kategori pengeluaran tidak valid" });
  }
  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
    return res.status(400).json({ error: "Amount must be greater than 0" });
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      ...(paymentMethod && { paymentMethod }),
      ...(bankName !== undefined && { bankName }),
      ...(accountName !== undefined && { accountName }),
      ...(accountNumber !== undefined && { accountNumber }),
      ...(amount !== undefined && { amount: Math.round(amount) }),
      ...(currency && { currency }),
      ...(category && { category }),
      ...(reason && { reason }),
      ...(clientName !== undefined && { clientName }),
      ...(notes !== undefined && { notes }),
    },
    include: {
      trip: {
        include: {
          truck: true,
          driverUser: true,
          order: { select: { id: true, orderNo: true, customerName: true, fromText: true, toText: true, status: true } },
        },
      },
      createdBy: { select: { id: true, name: true, email: true } },
      proofUploadedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  res.json(updated);
});

// Upload proof + mark as PAID. The creator may upload their own proof;
// OWNER approval remains the separate verification step.
router.post("/:id/proof", authRequired, async (req, res) => {
  const role = req.user?.role;
  if (!proofRoles.includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.params;
  const proofUrl = cleanStr(req.body.proofUrl);
  const proofFileName = cleanStr(req.body.proofFileName);
  const proofMimeType = cleanStr(req.body.proofMimeType);
  const proofSize = req.body.proofSize !== undefined ? Number(req.body.proofSize) : undefined;

  if (!proofUrl) {
    return res.status(400).json({ error: "proofUrl is required" });
  }

  const existing = await prisma.expense.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status !== "SUBMITTED") {
    return res.status(400).json({ error: "Only SUBMITTED expenses can be marked as PAID" });
  }
  const updated = await prisma.$transaction(async tx => {
    const paid = await tx.expense.update({
      where: { id },
      data: {
        proofUrl,
        proofFileName,
        proofMimeType,
        ...(Number.isFinite(proofSize) ? { proofSize: proofSize } : {}),
        status: "PAID",
        paidAt: new Date(),
        proofUploadedById: req.user?.id,
      },
      include: {
        trip: {
          include: {
            truck: true,
            driverUser: true,
            order: { select: { id: true, orderNo: true, customerName: true, fromText: true, toText: true, status: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
        proofUploadedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    });
    await postJournal(tx, { date: paid.paidAt, description: paid.reason, sourceType: "EXPENSE_PAYMENT", sourceId: paid.id, createdById: req.user.id, lines: [{ code: SYSTEM_ACCOUNTS.EXPENSE, debit: paid.amount }, { code: cashCode(paid.paymentMethod), credit: paid.amount }] });
    return paid;
  });

  res.json(updated);
});

// Replace an incorrect proof before owner approval. Financial values/status and
// the accounting journal remain unchanged.
router.patch("/:id/proof", authRequired, async (req, res) => {
  if (!proofRoles.includes(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
  const proofUrl = cleanStr(req.body.proofUrl);
  if (!proofUrl) return res.status(400).json({ error: "Bukti pembayaran wajib diisi" });
  const existing = await prisma.expense.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } });
  if (!existing) return res.status(404).json({ error: "Pengeluaran tidak ditemukan" });
  if (existing.status !== "PAID") return res.status(400).json({ error: existing.status === "APPROVED" ? "Bukti pengeluaran yang sudah disetujui tidak dapat diganti" : "Bukti hanya dapat diganti setelah pembayaran" });
  const proofSize = req.body.proofSize !== undefined ? Number(req.body.proofSize) : undefined;
  const updated = await prisma.expense.update({
    where: { id: existing.id },
    data: {
      proofUrl,
      proofFileName: cleanStr(req.body.proofFileName),
      proofMimeType: cleanStr(req.body.proofMimeType),
      ...(Number.isFinite(proofSize) ? { proofSize } : {}),
      proofUploadedById: req.user.id,
    },
  });
  res.json({ ok: true, expense: updated });
});

// Approve expense (OWNER only)
router.post("/:id/approve", authRequired, async (req, res) => {
  const approver = await prisma.user.findUnique({
    where: { id: req.user?.id },
    select: { id: true, role: true, isActive: true, status: true },
  });
  if (!approver || !approver.isActive || approver.status !== "ACTIVE") {
    return res.status(403).json({ error: "Akun tidak aktif" });
  }
  if (approver.role !== "OWNER") {
    return res.status(403).json({ error: `Hanya OWNER yang dapat menyetujui pengeluaran. Role akun saat ini: ${approver.role}` });
  }

  const { id } = req.params;
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status !== "PAID") {
    return res.status(400).json({ error: "Only PAID expenses can be approved" });
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: approver.id,
    },
    include: {
      trip: {
        include: {
          truck: true,
          driverUser: true,
          order: { select: { id: true, orderNo: true, customerName: true, fromText: true, toText: true, status: true } },
        },
      },
      createdBy: { select: { id: true, name: true, email: true } },
      proofUploadedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  res.json(updated);
});

// Delete expense
router.delete("/:id", authRequired, async (req, res) => {
  if (!ensureRole(req, res)) return;

  const { id } = req.params;
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Pengeluaran tidak ditemukan" });
  if (existing.status !== "SUBMITTED") return res.status(400).json({ error: "Pengeluaran yang sudah dibayar tidak dapat dihapus" });
  await prisma.expense.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
