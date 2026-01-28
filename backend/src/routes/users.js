const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");

const router = express.Router();

// ✅ List all users (excluding OWNER) — OWNER/ADMIN only
router.get("/", authRequired, async (req, res) => {
  const role = req.user?.role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const q = String(req.query.q || "").trim();
  const roleFilter = String(req.query.role || "").trim(); // optional
  const take = Math.min(parseInt(req.query.take || "50", 10), 200);
  const skip = Math.max(parseInt(req.query.skip || "0", 10), 0);

  // ✅ Always exclude OWNER from results
  const where = {
    AND: [
      { role: { not: "OWNER" } },
      ...(roleFilter ? [{ role: roleFilter }] : []),
      ...(q
        ? [
            {
              OR: [
                { name: { contains: q } },
              ],
            },
          ]
        : []),
    ],
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ items, total, skip, take });
});

// Get my profile
router.get("/me", authRequired, async (req, res) => {
  const userId = req.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
    },
  });

  res.json(user);
});

// Update my profile
router.put("/me", authRequired, async (req, res) => {
  const userId = req.user.id;
  const { name, phone } = req.body;

  if (name !== undefined && String(name).trim().length < 2) {
    return res
      .status(400)
      .json({ message: "Name must be at least 2 characters." });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(phone !== undefined && { phone: String(phone).trim() }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
    },
  });

  res.json(updated);
});

// ✅ Update user status — OWNER/ADMIN only
router.patch("/:id/status", authRequired, async (req, res) => {
  const role = req.user?.role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.params;
  const { status } = req.body;

  const allowed = ["ACTIVE", "INACTIVE", "BREAK"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      status: true,
      createdAt: true,
    },
  });

  res.json(updated);
});


module.exports = router;
