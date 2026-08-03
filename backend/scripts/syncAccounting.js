const { prisma } = require("../src/prisma");
const { SYSTEM_ACCOUNTS, cashCode, postJournal } = require("../src/services/accounting");

async function sync() {
  const [invoices, customerPayments, receipts, supplierPayments, expenses] = await Promise.all([
    prisma.invoice.findMany({ where: { status: { in: ["SENT", "PARTIALLY_PAID", "PAID"] } } }),
    prisma.receivablePayment.findMany(),
    prisma.goodsReceipt.findMany({ include: { items: { include: { purchaseOrderItem: true } }, purchaseOrder: true } }),
    prisma.purchasePayment.findMany({ where: { status: "PAID" } }),
    prisma.expense.findMany({ where: { status: { in: ["PAID", "APPROVED"] } } }),
  ]);
  for (const x of invoices) await prisma.$transaction(tx => postJournal(tx, { date: x.sentAt || x.issuedAt, description: `Invoice ${x.number}`, sourceType: "CUSTOMER_INVOICE", sourceId: x.id, lines: [{ code: SYSTEM_ACCOUNTS.AR, debit: x.total }, { code: SYSTEM_ACCOUNTS.REVENUE, credit: x.total }] }));
  for (const x of customerPayments) await prisma.$transaction(tx => postJournal(tx, { date: x.receivedAt, description: `Penerimaan ${x.number}`, sourceType: "CUSTOMER_PAYMENT", sourceId: x.id, lines: [{ code: cashCode(x.method), debit: x.amount }, { code: SYSTEM_ACCOUNTS.AR, credit: x.amount }] }));
  for (const x of receipts) { const value = x.items.reduce((sum, i) => sum + i.qty * i.purchaseOrderItem.unitPrice, 0) + (x.purchaseOrder.status === "FULLY_RECEIVED" && x === receipts.filter(r => r.purchaseOrderId === x.purchaseOrderId).sort((a,b) => b.receivedAt-a.receivedAt)[0] ? x.purchaseOrder.tax + x.purchaseOrder.shippingCost - x.purchaseOrder.discount : 0); if (value > 0) await prisma.$transaction(tx => postJournal(tx, { date: x.receivedAt, description: `Penerimaan barang ${x.number}`, sourceType: "GOODS_RECEIPT", sourceId: x.id, lines: [{ code: SYSTEM_ACCOUNTS.INVENTORY, debit: value }, { code: SYSTEM_ACCOUNTS.AP, credit: value }] })); }
  for (const x of supplierPayments) await prisma.$transaction(tx => postJournal(tx, { date: x.paidAt || x.createdAt, description: `Pembayaran supplier ${x.number}`, sourceType: "SUPPLIER_PAYMENT", sourceId: x.id, lines: [{ code: SYSTEM_ACCOUNTS.AP, debit: x.amount }, { code: cashCode(x.method), credit: x.amount }] }));
  for (const x of expenses) await prisma.$transaction(tx => postJournal(tx, { date: x.paidAt || x.createdAt, description: x.reason, sourceType: "EXPENSE_PAYMENT", sourceId: x.id, lines: [{ code: SYSTEM_ACCOUNTS.EXPENSE, debit: x.amount }, { code: cashCode(x.paymentMethod), credit: x.amount }] }));
  const entries = await prisma.journalEntry.count();
  console.log(JSON.stringify({ ok: true, entries }));
}
sync().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
