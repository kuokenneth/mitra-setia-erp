const express = require("express");
const bcrypt = require("bcryptjs");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

/**
 * GET /drivers
 * STAFF/ADMIN/OWNER view all drivers (returns USER.id)
 */
router.get(
  "/",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();

      const where = {
        role: "DRIVER",
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { email: { contains: q } },
              ],
            }
          : {}),
      };

      const items = await prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,        // ✅ USER.id (this is what you want to send to /trucks assign)
          name: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
          driver: {
            select: {
              id: true,
              licenseNo: true,
              phone: true,
            },
          },
        },
      });

      res.json({ items });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load drivers" });
    }
  }
);

/**
 * POST /drivers
 * STAFF/ADMIN/OWNER create a driver user (+ optional Driver profile)
 */
router.post(
  "/",
  authRequired,
  requireRole("OWNER", "ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const { name, email, password, phone, licenseNo } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: "name, email, password are required" });
      }

      const exists = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
      if (exists) return res.status(409).json({ error: "Email already in use" });

      const hashed = await bcrypt.hash(String(password), 10);

      const created = await prisma.user.create({
        data: {
          name: String(name).trim(),
          email: String(email).trim().toLowerCase(),
          password: hashed,
          role: "DRIVER",
          ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
          driver: {
            create: {
              ...(licenseNo !== undefined ? { licenseNo: String(licenseNo).trim() } : {}),
              ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
            },
          },
        },
        select: {
          id: true, // ✅ USER.id
          name: true,
          email: true,
          role: true,
          phone: true,
          driver: true,
        },
      });

      return res.status(201).json(created);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Failed to create driver" });
    }
  }
);

module.exports = router;
