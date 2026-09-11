const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();
router.use(authRequired, requireRole("OWNER"));

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(req.query.pageSize, 10) || 50));
    const resource = String(req.query.resource || "").trim();
    const action = String(req.query.action || "").trim();
    const actorRole = String(req.query.actorRole || "").trim();
    const q = String(req.query.q || "").trim();
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      return res.status(400).json({ error: "Filter tanggal tidak valid" });
    }
    const where = {
      ...(resource ? { resource } : {}),
      ...(action ? { action } : {}),
      ...(actorRole ? { actorRole } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(q ? { OR: [
        { actorName: { contains: q, mode: "insensitive" } },
        { actorEmail: { contains: q, mode: "insensitive" } },
        { path: { contains: q, mode: "insensitive" } },
        { entityId: { contains: q, mode: "insensitive" } },
      ] } : {}),
    };
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [total, items, resources, actionGroups, actorRows, today] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.auditLog.findMany({ distinct: ["resource"], select: { resource: true }, orderBy: { resource: "asc" } }),
      prisma.auditLog.groupBy({ by: ["action"], where, _count: { _all: true } }),
      prisma.auditLog.findMany({ where, distinct: ["userId"], select: { userId: true, actorEmail: true } }),
      prisma.auditLog.count({ where: { ...where, createdAt: { ...(where.createdAt || {}), gte: startOfToday } } }),
    ]);
    const byAction = Object.fromEntries(actionGroups.map((row) => [row.action, row._count._all]));
    res.json({
      items,
      total,
      page,
      pageSize,
      resources: resources.map((row) => row.resource),
      summary: { today, actors: actorRows.length, deletes: byAction.DELETE || 0, byAction },
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "Gagal memuat audit trail" });
  }
});

module.exports = router;
