const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");

const router = express.Router();
router.use(authRequired);

router.get("/", async (_req, res) => {
  try {
    const items = await prisma.customer.findMany({ orderBy: { name: "asc" } });
    res.json({ items });
  } catch (error) { res.status(400).json({ error: error.message || "Gagal memuat customer" }); }
});

router.post("/", async (req, res) => {
  try {
    if (!["OWNER", "ADMIN", "STAFF"].includes(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Nama customer wajib diisi" });
    const existing = await prisma.customer.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (existing) return res.status(409).json({ error: "Customer dengan nama tersebut sudah ada", customer: existing });
    const customer = await prisma.customer.create({ data: { name, phone: String(req.body?.phone || "").trim() || null, address: String(req.body?.address || "").trim() || null } });
    res.status(201).json(customer);
  } catch (error) { res.status(400).json({ error: error.message || "Gagal menambah customer" }); }
});

module.exports = router;
