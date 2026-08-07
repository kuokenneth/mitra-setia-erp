const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();
router.use(authRequired, requireRole("OWNER", "ADMIN", "STAFF"));

const COST_FIELDS = ["depreciation", "insurance", "taxPermit", "driverSalary", "lease", "overhead"];
const round = (value, digits = 1) => Number((Number(value) || 0).toFixed(digits));
const ratio = (value, total) => total > 0 ? round((value / total) * 100) : 0;

function period(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(value || "");
  if (!match) throw new Error("Periode harus dalam format YYYY-MM");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error("Bulan tidak valid");
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return { start, end, days };
}

function tripDate(trip) {
  return trip.plannedDepartAt || trip.dispatchedAt || trip.completedAt || trip.createdAt;
}

function allocatedRevenue(trip) {
  const invoice = trip.order?.invoice;
  if (!invoice || !["SENT", "PARTIALLY_PAID", "PAID"].includes(invoice.status)) return 0;
  const eligible = trip.order.trips.filter(item => item.status !== "CANCELLED");
  if (!eligible.length) return 0;
  const weights = eligible.map(item => Math.max(0, Number(item.qtyActual ?? item.qtyPlanned ?? 0)));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const index = eligible.findIndex(item => item.id === trip.id);
  if (index < 0) return 0;
  return totalWeight > 0 ? invoice.total * weights[index] / totalWeight : invoice.total / eligible.length;
}

router.get("/", async (req, res) => {
  try {
    const current = new Date();
    const month = req.query.month || `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
    const { start, end, days } = period(month);
    const dateRange = { gte: start, lt: end };
    const trucks = await prisma.truck.findMany({
      orderBy: { plateNumber: "asc" },
      include: {
        trips: {
          where: {
            OR: [
              { plannedDepartAt: dateRange },
              { plannedDepartAt: null, dispatchedAt: dateRange },
              { plannedDepartAt: null, dispatchedAt: null, completedAt: dateRange },
              { plannedDepartAt: null, dispatchedAt: null, completedAt: null, createdAt: dateRange },
            ],
          },
          include: {
            expenses: { where: { status: { in: ["PAID", "APPROVED"] } }, orderBy: { createdAt: "asc" } },
            order: { include: { invoice: true, trips: { select: { id: true, status: true, qtyActual: true, qtyPlanned: true } } } },
          },
        },
        sparePartAssignments: { where: { installedAt: dateRange }, include: { stockUnit: { select: { purchasePrice: true, item: { select: { name: true, sku: true } } } } } },
        monthlyCosts: { where: { month: start } },
        expenses: {
          where: {
            status: { in: ["PAID", "APPROVED"] },
            OR: [{ paidAt: dateRange }, { paidAt: null, createdAt: dateRange }],
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const rows = trucks.map(truck => {
      const operationalTrips = truck.trips.filter(item => item.status !== "CANCELLED");
      const completedTrips = operationalTrips.filter(item => item.status === "COMPLETED").length;
      const revenue = Math.round(operationalTrips.reduce((sum, item) => sum + allocatedRevenue(item), 0));
      const tripExpenses = operationalTrips.reduce((sum, item) => sum + item.expenses.reduce((cost, expense) => cost + expense.amount, 0), 0);
      const vehicleExpenses = truck.expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const spareParts = truck.sparePartAssignments.reduce((sum, item) => sum + (item.installCost ?? item.stockUnit.purchasePrice ?? 0), 0);
      const fixedCosts = truck.monthlyCosts[0] || Object.fromEntries(COST_FIELDS.map(field => [field, 0]));
      const fixedTotal = COST_FIELDS.reduce((sum, field) => sum + (fixedCosts[field] || 0), 0);
      const totalCost = tripExpenses + vehicleExpenses + spareParts + fixedTotal;
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? round((profit / revenue) * 100) : (totalCost > 0 ? -100 : 0);
      const activeDays = new Set(operationalTrips.map(item => tripDate(item)?.toISOString().slice(0, 10)).filter(Boolean)).size;
      const contributionPerTrip = operationalTrips.length ? (revenue - tripExpenses - spareParts) / operationalTrips.length : 0;
      const tripDetails = operationalTrips.map(item => {
        const tripRevenue = Math.round(allocatedRevenue(item));
        const expenseTotal = item.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const invoiceTotal = item.order?.invoice?.total || 0;
        return {
          id: item.id,
          purpose: item.purpose,
          status: item.status,
          date: tripDate(item),
          fromText: item.fromText || item.order?.fromText,
          toText: item.toText || item.order?.toText,
          orderNo: item.order?.orderNo || null,
          customerName: item.order?.customerName || null,
          invoiceNumber: item.order?.invoice?.number || null,
          invoiceTotal,
          allocatedRevenue: tripRevenue,
          allocationPercent: invoiceTotal > 0 ? round((tripRevenue / invoiceTotal) * 100) : 0,
          quantity: item.qtyActual ?? item.qtyPlanned ?? null,
          unit: item.unitSnap || item.order?.unit || null,
          expenseTotal,
          netContribution: tripRevenue - expenseTotal,
          expenses: item.expenses.map(expense => ({ id: expense.id, reason: expense.reason, amount: expense.amount, status: expense.status, paidAt: expense.paidAt || expense.createdAt })),
        };
      });
      const sparePartDetails = truck.sparePartAssignments.map(item => ({
        id: item.id,
        name: item.stockUnit.item?.name || "Sparepart",
        sku: item.stockUnit.item?.sku || null,
        installedAt: item.installedAt,
        cost: item.installCost ?? item.stockUnit.purchasePrice ?? 0,
      }));
      return {
        truck: { id: truck.id, plateNumber: truck.plateNumber, brand: truck.brand, model: truck.model, status: truck.status },
        trips: { total: operationalTrips.length, completed: completedTrips, cancelled: truck.trips.length - operationalTrips.length },
        revenue, tripExpenses, vehicleExpenses, spareParts, fixedCosts: Object.fromEntries(COST_FIELDS.map(field => [field, fixedCosts[field] || 0])),
        fixedTotal, totalCost, profit, margin,
        tripDetails, sparePartDetails,
        vehicleExpenseDetails: truck.expenses.map(expense => ({ id: expense.id, reason: expense.reason, amount: expense.amount, status: expense.status, paidAt: expense.paidAt || expense.createdAt })),
        costRatio: revenue > 0 ? ratio(totalCost, revenue) : (totalCost > 0 ? 100 : 0),
        completionRate: ratio(completedTrips, operationalTrips.length),
        utilizationRate: round(Math.min(100, (activeDays / days) * 100)), activeDays,
        breakEvenTrips: contributionPerTrip > 0 ? Math.ceil(fixedTotal / contributionPerTrip) : null,
        health: margin >= 20 ? "HEALTHY" : margin >= 0 ? "WATCH" : "LOSS",
      };
    });
    const summary = rows.reduce((result, row) => ({
      revenue: result.revenue + row.revenue, totalCost: result.totalCost + row.totalCost,
      profit: result.profit + row.profit, trips: result.trips + row.trips.total,
    }), { revenue: 0, totalCost: 0, profit: 0, trips: 0 });
    summary.margin = summary.revenue > 0 ? round((summary.profit / summary.revenue) * 100) : 0;
    rows.forEach(row => { row.revenueContribution = ratio(row.revenue, summary.revenue); });
    res.json({ ok: true, month, summary, rows });
  } catch (error) {
    res.status(400).json({ error: error.message || "Gagal menghitung profit armada" });
  }
});

router.put("/fixed-costs", requireRole("OWNER", "ADMIN"), async (req, res) => {
  try {
    const { truckId, month, notes = null } = req.body;
    if (!truckId) throw new Error("Truk wajib dipilih");
    const { start } = period(month);
    const data = { notes: notes?.trim() || null };
    for (const field of COST_FIELDS) {
      const value = Math.round(Number(req.body[field] || 0));
      if (!Number.isFinite(value) || value < 0) throw new Error("Biaya tidak boleh negatif");
      data[field] = value;
    }
    const cost = await prisma.truckMonthlyCost.upsert({
      where: { truckId_month: { truckId, month: start } },
      create: { truckId, month: start, ...data }, update: data,
    });
    res.json({ ok: true, cost });
  } catch (error) {
    res.status(400).json({ error: error.message || "Gagal menyimpan biaya tetap" });
  }
});

module.exports = router;
