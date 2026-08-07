const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { SYSTEM_ACCOUNTS, cashCode, postJournal } = require("../services/accounting");

const router = express.Router();

const allowedRoles = ["OWNER", "ADMIN", "STAFF"];
const proofRoles = ["OWNER", "ADMIN", "STAFF"];
const TRIP_EXPENSE_LIMIT = Number(process.env.TRIP_EXPENSE_LIMIT || 0);

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
      createdBy: { select: { id: true, name: true, email: true } },
      proofUploadedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  const total = items.reduce((sum, x) => sum + (x.amount || 0), 0);

  const fmt = (v) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(v || 0);

  const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Monthly Expense रिपोर्ट - ${month}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
      h1 { margin: 0 0 8px; font-size: 22px; }
      .sub { color: #555; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f5f5f5; text-transform: uppercase; font-size: 11px; letter-spacing: .4px; }
      .right { text-align: right; white-space: nowrap; }
      .muted { color: #666; }
      .footer { margin-top: 16px; font-weight: 700; }
      @media print { body { margin: 10mm; } }
    </style>
  </head>
  <body>
    <h1>Expense Report</h1>
    <div class="sub">Month: ${month}</div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Trip</th>
          <th>Driver</th>
          <th>Truck</th>
          <th>From → To</th>
          <th>Reason</th>
          <th>Method</th>
          <th>Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${
          items.length
            ? items
                .map((x) => {
                  const t = x.trip || {};
                  const driver = t.driverUser?.name || t.driverNameSnap || "-";
                  const truck = t.truck?.plateNumber || t.plateNumberSnap || "-";
                  const from = t.order?.fromText || t.fromText || "-";
                  const to = t.order?.toText || t.toText || "-";
                  return `
          <tr>
            <td>${x.createdAt ? new Date(x.createdAt).toLocaleDateString() : "-"}</td>
            <td class="muted">${t.id || "-"}</td>
            <td>${driver}</td>
            <td>${truck}</td>
            <td>${from} → ${to}</td>
            <td>${x.reason || "-"}</td>
            <td>${x.paymentMethod || "-"}</td>
            <td class="right">${fmt(x.amount)}</td>
            <td>${x.status || "SUBMITTED"}</td>
          </tr>`;
                })
                .join("")
            : `<tr><td colspan="9">No expenses found for this month.</td></tr>`
        }
      </tbody>
    </table>
    <div class="footer">Total: ${fmt(total)}</div>
  </body>
</html>
  `;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

// Create expense
router.post("/", authRequired, async (req, res) => {
  if (!ensureRole(req, res)) return;

  const paymentMethod = cleanStr(req.body.paymentMethod) || "BANK_TRANSFER";
  const amount = Number(req.body.amount || 0);
  const currency = cleanStr(req.body.currency) || "IDR";
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
    if (trip.status !== "PLANNED") {
      return res.status(400).json({
        error: "Pengeluaran perjalanan hanya dapat dibuat sebelum kendaraan berangkat",
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

// Upload proof + mark as PAID (ADMIN/STAFF only)
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
    select: { id: true, status: true, createdById: true },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status !== "SUBMITTED") {
    return res.status(400).json({ error: "Only SUBMITTED expenses can be marked as PAID" });
  }
  if (existing.createdById && existing.createdById === req.user?.id) {
    return res.status(403).json({ error: "Maker-checker: uploader cannot be the creator" });
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
