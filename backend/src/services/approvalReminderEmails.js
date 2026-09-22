const { prisma } = require("../prisma");
const { emailOwnerConfigured, sendOwnerEmail } = require("./emailNotifications");

const ONE_HOUR_MS = 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
let reminderInterval;
let checkInProgress = false;

const money = value => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
}).format(Number(value || 0));

async function releasePurchaseRequestClaim(id, claimedAt) {
  await prisma.purchaseRequest.updateMany({
    where: { id, status: "WAITING_APPROVAL", approvalReminderSentAt: claimedAt },
    data: { approvalReminderSentAt: null },
  });
}

async function releaseExpenseClaim(id, claimedAt) {
  await prisma.expense.updateMany({
    where: { id, status: "PAID", approvalReminderSentAt: claimedAt },
    data: { approvalReminderSentAt: null },
  });
}

async function remindPurchaseRequest(request) {
  const claimedAt = new Date();
  const claim = await prisma.purchaseRequest.updateMany({
    where: { id: request.id, status: "WAITING_APPROVAL", approvalReminderSentAt: null },
    data: { approvalReminderSentAt: claimedAt },
  });
  if (!claim.count) return false;
  try {
    const items = request.items.map(row => `${row.item.name} · ${row.originalQty} ${row.item.unit}`).join(", ");
    await sendOwnerEmail({
      event: "Pengajuan sparepart belum disetujui selama 1 jam",
      title: request.maintenance?.truck?.plateNumber
        ? `${request.number} · ${request.maintenance.truck.plateNumber}`
        : request.number,
      details: `${items}\nAlasan: ${request.reason}\nDiajukan oleh: ${request.createdBy?.name || "Pengguna ERP"}`,
      path: `/purchasing?approveRequest=${encodeURIComponent(request.id)}`,
      actionLabel: "Setujui Permintaan",
      proof: { url: request.damageProofUrl, fileName: request.damageProofFileName, mimeType: request.damageProofMimeType },
    });
    return true;
  } catch (error) {
    await releasePurchaseRequestClaim(request.id, claimedAt).catch(() => {});
    throw error;
  }
}

async function remindExpense(expense) {
  const claimedAt = new Date();
  const claim = await prisma.expense.updateMany({
    where: { id: expense.id, status: "PAID", approvalReminderSentAt: null },
    data: { approvalReminderSentAt: claimedAt },
  });
  if (!claim.count) return false;
  try {
    await sendOwnerEmail({
      event: "Pengeluaran belum disetujui selama 1 jam",
      title: expense.reason || "Pengeluaran operasional",
      details: `${money(expense.amount)} · ${expense.category}\nBukti diunggah oleh: ${expense.proofUploadedBy?.name || expense.proofUploadedBy?.email || "Pengguna ERP"}`,
      path: "/expenses",
    });
    return true;
  } catch (error) {
    await releaseExpenseClaim(expense.id, claimedAt).catch(() => {});
    throw error;
  }
}

async function checkApprovalReminders(now = new Date()) {
  if (!emailOwnerConfigured()) return { sent: 0, reason: "disabled" };
  if (checkInProgress) return { sent: 0, reason: "running" };
  checkInProgress = true;
  try {
    const threshold = new Date(now.getTime() - ONE_HOUR_MS);
    const [requests, expenses] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where: { status: "WAITING_APPROVAL", approvalReminderSentAt: null, createdAt: { lte: threshold } },
        include: {
          items: { include: { item: true } },
          maintenance: { include: { truck: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
      prisma.expense.findMany({
        where: { status: "PAID", approvalReminderSentAt: null, paidAt: { lte: threshold } },
        include: { proofUploadedBy: { select: { name: true, email: true } } },
        orderBy: { paidAt: "asc" },
        take: 50,
      }),
    ]);

    let sent = 0;
    for (const request of requests) sent += Number(await remindPurchaseRequest(request));
    for (const expense of expenses) sent += Number(await remindExpense(expense));
    return { sent };
  } finally {
    checkInProgress = false;
  }
}

function startApprovalReminderEmails() {
  if (process.env.APPROVAL_REMINDER_EMAILS_ENABLED === "false") return;
  setImmediate(() => checkApprovalReminders().catch(error => console.error("Approval reminder check failed:", error.message)));
  reminderInterval = setInterval(() => {
    checkApprovalReminders().catch(error => console.error("Approval reminder check failed:", error.message));
  }, CHECK_INTERVAL_MS);
  reminderInterval.unref?.();
  console.log("Approval reminder emails scheduled for pending items older than 1 hour");
}

module.exports = { checkApprovalReminders, startApprovalReminderEmails };
