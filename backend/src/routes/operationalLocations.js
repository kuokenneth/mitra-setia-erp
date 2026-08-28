const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();
router.use(authRequired, requireRole("OWNER", "ADMIN", "STAFF"));

const TYPES = new Set(["BASE", "CUSTOMER", "WAREHOUSE", "PORT", "OTHER"]);

function payload(body) {
  const name = String(body?.name || "").trim();
  const address = String(body?.address || "").trim() || null;
  const type = String(body?.type || "OTHER").trim().toUpperCase();
  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);
  const radiusM = Math.round(Number(body?.radiusM ?? 400));
  if (!name) throw new Error("Nama lokasi wajib diisi");
  if (!TYPES.has(type)) throw new Error("Jenis lokasi tidak valid");
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Latitude tidak valid");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("Longitude tidak valid");
  if (radiusM < 50 || radiusM > 5000) throw new Error("Radius harus antara 50 dan 5000 meter");
  return { name, address, type, latitude, longitude, radiusM, isActive: body?.isActive !== false };
}

router.get("/", async (_req, res) => {
  const items = await prisma.operationalLocation.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  res.json({ items });
});

router.post("/", async (req, res) => {
  try {
    const item = await prisma.operationalLocation.create({ data: payload(req.body) });
    res.status(201).json(item);
  } catch (error) {
    res.status(error.code === "P2002" ? 409 : 400).json({ error: error.code === "P2002" ? "Nama lokasi sudah digunakan" : error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const item = await prisma.operationalLocation.update({ where: { id: req.params.id }, data: payload(req.body) });
    res.json(item);
  } catch (error) {
    res.status(error.code === "P2025" ? 404 : error.code === "P2002" ? 409 : 400).json({ error: error.code === "P2025" ? "Lokasi tidak ditemukan" : error.code === "P2002" ? "Nama lokasi sudah digunakan" : error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.operationalLocation.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(error.code === "P2025" ? 404 : 400).json({ error: error.code === "P2025" ? "Lokasi tidak ditemukan" : error.message });
  }
});

module.exports = router;
