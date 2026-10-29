const { prisma } = require("../prisma");
const { emailOwnerConfigured, sendOwnerEmail } = require("./emailNotifications");

const JAKARTA_UTC_OFFSET_HOURS = 7;
const SUMMARY_HOUR = 18;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
let summaryTimer;

const money = value => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
}).format(Number(value || 0));

function nextRunDelay(now = new Date()) {
  const jakartaNow = new Date(now.getTime() + JAKARTA_UTC_OFFSET_HOURS * ONE_HOUR_MS);
  const targetAsJakartaUtc = Date.UTC(
    jakartaNow.getUTCFullYear(),
    jakartaNow.getUTCMonth(),
    jakartaNow.getUTCDate(),
    SUMMARY_HOUR,
  );
  let target = targetAsJakartaUtc - JAKARTA_UTC_OFFSET_HOURS * ONE_HOUR_MS;
  if (target <= now.getTime()) target += ONE_DAY_MS;
  return target - now.getTime();
}

function jakartaDate(value = new Date()) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

async function buildDailyOwnerSummary(now = new Date()) {
  const inThirtyDays = new Date(now.getTime() + 30 * ONE_DAY_MS);
  const gpsFreshnessLimit = new Date(now.getTime() - ONE_HOUR_MS);
  const [
    purchaseApprovals,
    expenseApprovals,
    paymentApprovals,
    overdueSupplierBills,
    overdueInvoices,
    delayedPurchaseOrders,
    arrivedTrips,
    openMaintenance,
    expiringDocuments,
    staleGps,
    openTripActions,
  ] = await Promise.all([
    prisma.purchaseRequest.count({ where: { status: "WAITING_APPROVAL" } }),
    prisma.expense.aggregate({ where: { status: "PAID" }, _count: true, _sum: { amount: true } }),
    prisma.purchasePayment.aggregate({ where: { status: "WAITING_PAYMENT_APPROVAL" }, _count: true, _sum: { amount: true } }),
    prisma.supplierBill.findMany({
      where: { dueDate: { lt: now }, status: { in: ["OPEN", "WAITING_PAYMENT_APPROVAL", "PARTIALLY_PAID"] } },
      select: { amount: true, payments: { where: { status: "PAID" }, select: { amount: true } } },
    }),
    prisma.invoice.findMany({
      where: { dueAt: { lt: now }, status: { in: ["SENT", "PARTIALLY_PAID"] } },
      select: { total: true, payments: { select: { amount: true } } },
    }),
    prisma.purchaseOrder.count({
      where: { estimatedArrival: { lt: now }, status: { in: ["APPROVED", "SENT_TO_SUPPLIER", "PARTIALLY_RECEIVED"] } },
    }),
    prisma.trip.count({ where: { status: "ARRIVED" } }),
    prisma.truckMaintenance.count({ where: { status: "OPEN" } }),
    prisma.truck.count({ where: { stnkExpiry: { lte: inThirtyDays } } }),
    prisma.truck.count({
      where: {
        OR: [{ gpsDeviceId: { not: null } }, { gpsImei: { not: null } }],
        AND: [{ OR: [{ lastGpsAt: null }, { lastGpsAt: { lt: gpsFreshnessLimit } }] }],
      },
    }),
    prisma.tripOperationalAction.count({ where: { status: "OPEN" } }),
  ]);

  const overdueSupplierAmount = overdueSupplierBills.reduce((total, bill) => {
    const paid = bill.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return total + Math.max(0, Number(bill.amount || 0) - paid);
  }, 0);
  const overdueReceivableAmount = overdueInvoices.reduce((total, invoice) => {
    const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return total + Math.max(0, Number(invoice.total || 0) - paid);
  }, 0);

  const sections = [
    ["PERSETUJUAN", [
      `${purchaseApprovals} permintaan pembelian menunggu persetujuan`,
      `${expenseApprovals._count} pengeluaran (${money(expenseApprovals._sum.amount)}) menunggu persetujuan`,
      `${paymentApprovals._count} pembayaran supplier (${money(paymentApprovals._sum.amount)}) menunggu persetujuan`,
    ]],
    ["KEUANGAN", [
      `${overdueSupplierBills.length} tagihan supplier lewat jatuh tempo · sisa ${money(overdueSupplierAmount)}`,
      `${overdueInvoices.length} piutang customer lewat jatuh tempo · sisa ${money(overdueReceivableAmount)}`,
    ]],
    ["OPERASIONAL", [
      `${delayedPurchaseOrders} PO melewati estimasi kedatangan`,
      `${arrivedTrips} trip sudah tiba dan belum diselesaikan`,
      `${openMaintenance} pekerjaan servis masih terbuka`,
      `${openTripActions} tindak lanjut warning trip masih terbuka`,
    ]],
    ["ARMADA", [
      `${expiringDocuments} STNK sudah habis atau akan habis dalam 30 hari`,
      `${staleGps} perangkat GPS tidak update lebih dari 1 jam`,
    ]],
  ];

  const actionCount = purchaseApprovals + expenseApprovals._count + paymentApprovals._count
    + overdueSupplierBills.length + overdueInvoices.length + delayedPurchaseOrders + arrivedTrips
    + openMaintenance + openTripActions + expiringDocuments + staleGps;
  const details = sections.map(([heading, rows]) => `${heading}\n${rows.map(row => `• ${row}`).join("\n")}`).join("\n\n");
  return {
    event: "Update harian pukul 18.00 WIB",
    title: actionCount ? `${actionCount} hal perlu diperiksa · ${jakartaDate(now)}` : `Semua aman · ${jakartaDate(now)}`,
    details,
    path: "/",
  };
}

async function sendDailyOwnerSummary() {
  if (!emailOwnerConfigured()) return { sent: false, reason: "disabled" };
  return sendOwnerEmail(await buildDailyOwnerSummary());
}

function scheduleNextSummary() {
  clearTimeout(summaryTimer);
  summaryTimer = setTimeout(async () => {
    try {
      await sendDailyOwnerSummary();
    } catch (error) {
      console.error("Daily owner summary failed:", error.message);
    } finally {
      scheduleNextSummary();
    }
  }, nextRunDelay());
  summaryTimer.unref?.();
}

function startDailyOwnerSummary() {
  if (process.env.DAILY_OWNER_SUMMARY_ENABLED === "false") return;
  scheduleNextSummary();
  console.log("Daily owner email summary scheduled for 18:00 WIB");
}

module.exports = { buildDailyOwnerSummary, nextRunDelay, sendDailyOwnerSummary, startDailyOwnerSummary };
