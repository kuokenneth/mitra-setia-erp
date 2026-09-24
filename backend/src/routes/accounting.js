const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");
const { SYSTEM_ACCOUNTS, cashCode, postJournal } = require("../services/accounting");
const router = express.Router();
router.use(authRequired, requireRole("OWNER", "ADMIN"));

router.get("/overview", async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(new Date().getFullYear(), 0, 1);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    to.setHours(23,59,59,999);
    const [accounts, entries] = await Promise.all([
      prisma.account.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
      prisma.journalEntry.findMany({ where: { status: "POSTED", date: { gte: from, lte: to } }, include: { lines: { include: { account: true } }, createdBy: { select: { name: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 500 }),
    ]);
    const balances = Object.fromEntries(accounts.map(account => [account.id, { ...account, debit: 0, credit: 0, balance: 0 }]));
    for (const entry of entries) for (const line of entry.lines) { balances[line.accountId].debit += line.debit; balances[line.accountId].credit += line.credit; }
    for (const row of Object.values(balances)) row.balance = ["ASSET","EXPENSE"].includes(row.type) ? row.debit - row.credit : row.credit - row.debit;
    const rows = Object.values(balances);
    const revenue = rows.filter(x => x.type === "REVENUE").reduce((s,x)=>s+x.balance,0);
    const expenses = rows.filter(x => x.type === "EXPENSE").reduce((s,x)=>s+x.balance,0);
    const cash = rows.filter(x => [SYSTEM_ACCOUNTS.CASH,SYSTEM_ACCOUNTS.BANK].includes(x.code)).reduce((s,x)=>s+x.balance,0);
    const receivables = rows.find(x=>x.code===SYSTEM_ACCOUNTS.AR)?.balance || 0;
    const payables = rows.find(x=>x.code===SYSTEM_ACCOUNTS.AP)?.balance || 0;
    res.json({ ok:true, from, to, accounts: rows, entries, summary: { revenue, expenses, profit: revenue-expenses, cash, receivables, payables } });
  } catch (error) { res.status(400).json({ error: error.message || "Gagal memuat accounting" }); }
});

router.post("/sync", async (req, res) => {
  try {
    let posted = 0;
    const creator = req.user.id;
    const [invoices, customerPayments, receipts, supplierPayments, expenses, inventoryUsages, inventoryReturns] = await Promise.all([
      prisma.invoice.findMany({ where: { status: { in: ["SENT","PARTIALLY_PAID","PAID"] } } }),
      prisma.receivablePayment.findMany({ include: { invoice: true } }),
      prisma.goodsReceipt.findMany({ include: { items: { include: { purchaseOrderItem: true } }, purchaseOrder: true } }),
      prisma.purchasePayment.findMany({ where: { status: "PAID" }, include: { purchaseOrder: true } }),
      prisma.expense.findMany({ where: { status: { in: ["PAID","APPROVED"] } } }),
      prisma.stockMovement.findMany({ where: { type: "OUT", fromLocationId: { not: null }, totalCost: { gt: 0 }, NOT: [{ note: { startsWith: "Pembelian langsung" } }, { note: { startsWith: "Langsung dipasang" } }] }, include: { item: true, maintenance: true } }),
      prisma.stockMovement.findMany({ where: { type: "IN", totalCost: { gt: 0 }, OR: [{ note: { startsWith: "RETURN_OF:" } }, { note: { startsWith: "RETURN_ASSIGNMENT:" } }] }, include: { item: true, maintenance: true } }),
    ]);
    for (const invoice of invoices) { await prisma.$transaction(tx=>postJournal(tx,{date:invoice.sentAt||invoice.issuedAt,description:`Invoice ${invoice.number}`,sourceType:"CUSTOMER_INVOICE",sourceId:invoice.id,createdById:creator,lines:[{code:SYSTEM_ACCOUNTS.AR,debit:invoice.total},{code:SYSTEM_ACCOUNTS.REVENUE,credit:invoice.total}]})); posted++; }
    for (const p of customerPayments) { await prisma.$transaction(tx=>postJournal(tx,{date:p.receivedAt,description:`Penerimaan ${p.number}`,sourceType:"CUSTOMER_PAYMENT",sourceId:p.id,createdById:creator,lines:[{code:cashCode(p.method),debit:p.amount},{code:SYSTEM_ACCOUNTS.AR,credit:p.amount}]})); posted++; }
    for (const r of receipts) { const value=r.items.reduce((s,i)=>s+i.qty*i.purchaseOrderItem.unitPrice,0); if(value>0){await prisma.$transaction(tx=>postJournal(tx,{date:r.receivedAt,description:`Penerimaan barang ${r.number}`,sourceType:"GOODS_RECEIPT",sourceId:r.id,createdById:creator,lines:[{code:SYSTEM_ACCOUNTS.INVENTORY,debit:value},{code:SYSTEM_ACCOUNTS.AP,credit:value}]}));posted++;} }
    for (const p of supplierPayments) { await prisma.$transaction(tx=>postJournal(tx,{date:p.paidAt||p.createdAt,description:`Pembayaran supplier ${p.number}`,sourceType:"SUPPLIER_PAYMENT",sourceId:p.id,createdById:creator,lines:[{code:SYSTEM_ACCOUNTS.AP,debit:p.amount},{code:cashCode(p.method),credit:p.amount}]})); posted++; }
    for (const e of expenses) { await prisma.$transaction(tx=>postJournal(tx,{date:e.paidAt||e.createdAt,description:e.reason,sourceType:"EXPENSE_PAYMENT",sourceId:e.id,createdById:creator,lines:[{code:SYSTEM_ACCOUNTS.EXPENSE,debit:e.amount},{code:cashCode(e.paymentMethod),credit:e.amount}]})); posted++; }
    for (const m of inventoryUsages) { await prisma.$transaction(tx=>postJournal(tx,{date:m.createdAt,description:`Pemakaian ${m.item.name}${m.maintenance?.title?` untuk ${m.maintenance.title}`:" dari Inventory"}`,sourceType:"INVENTORY_USAGE",sourceId:m.id,createdById:m.createdById||creator,lines:[{code:SYSTEM_ACCOUNTS.EXPENSE,debit:m.totalCost},{code:SYSTEM_ACCOUNTS.INVENTORY,credit:m.totalCost}]})); posted++; }
    for (const m of inventoryReturns) { await prisma.$transaction(tx=>postJournal(tx,{date:m.createdAt,description:`Pengembalian ${m.item.name}${m.maintenance?.title?` dari ${m.maintenance.title}`:" ke Inventory"}`,sourceType:"INVENTORY_RETURN",sourceId:m.id,createdById:m.createdById||creator,lines:[{code:SYSTEM_ACCOUNTS.INVENTORY,debit:m.totalCost},{code:SYSTEM_ACCOUNTS.EXPENSE,credit:m.totalCost}]})); posted++; }
    res.json({ok:true, processed:posted});
  } catch(error){res.status(400).json({error:error.message||"Gagal sinkronisasi accounting"});}
});
module.exports = router;
