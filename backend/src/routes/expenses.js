const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");

const router = express.Router();

const allowedRoles = ["OWNER", "ADMIN", "STAFF"];
const proofRoles = ["OWNER", "ADMIN", "STAFF"];

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
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.expense.count({ where }),
  ]);

  res.json({ items, total, skip, take });
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
      createdById: req.user?.id,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  res.status(201).json(created);
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
      createdBy: { select: { id: true, name: true, email: true } },
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

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      proofUrl,
      proofFileName,
      proofMimeType,
      ...(Number.isFinite(proofSize) ? { proofSize: proofSize } : {}),
      status: "PAID",
      paidAt: new Date(),
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  res.json(updated);
});

// Approve expense (OWNER only)
router.post("/:id/approve", authRequired, async (req, res) => {
  const role = req.user?.role;
  if (role !== "OWNER") {
    return res.status(403).json({ error: "Forbidden" });
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
      approvedById: req.user?.id,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  res.json(updated);
});

// Delete expense
router.delete("/:id", authRequired, async (req, res) => {
  if (!ensureRole(req, res)) return;

  const { id } = req.params;
  await prisma.expense.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
