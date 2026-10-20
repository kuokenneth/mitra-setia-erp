const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");
const { SYSTEM_ACCOUNTS, cashCode, postJournal } = require("../services/accounting");
const { documentHtml, esc, money, date } = require("../utils/printDocument");
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
    for (const entry of entries) for (const line of entry.lines) { balances[line.accountId].debit += Number(line.debit); balances[line.accountId].credit += Number(line.credit); }
    for (const row of Object.values(balances)) row.balance = ["ASSET","EXPENSE"].includes(row.type) ? row.debit - row.credit : row.credit - row.debit;
    const rows = Object.values(balances);
    const revenue = rows.filter(x => x.type === "REVENUE").reduce((s,x)=>s+x.balance,0);
    const expenses = rows.filter(x => x.type === "EXPENSE").reduce((s,x)=>s+x.balance,0);
    const cash = rows.filter(x => [SYSTEM_ACCOUNTS.CASH,SYSTEM_ACCOUNTS.BANK].includes(x.code)).reduce((s,x)=>s+x.balance,0);
    const receivables = rows.find(x=>x.code===SYSTEM_ACCOUNTS.AR)?.balance || 0;
    const payables = rows.find(x=>x.code===SYSTEM_ACCOUNTS.AP)?.balance || 0;
    const financePayables = rows.find(x=>x.code===SYSTEM_ACCOUNTS.FINANCE_AP)?.balance || 0;
    const serializedEntries = entries.map(entry => ({ ...entry, lines: entry.lines.map(line => ({ ...line, debit: Number(line.debit), credit: Number(line.credit) })) }));
    res.json({ ok:true, from, to, accounts: rows, entries: serializedEntries, summary: { revenue, expenses, profit: revenue-expenses, cash, receivables, payables, financePayables } });
  } catch (error) { res.status(400).json({ error: error.message || "Gagal memuat accounting" }); }
});

router.get("/report", async (req, res) => {
  try {
    const scope = req.query.scope === "year" ? "year" : "month";
    const period = String(req.query.period || "").trim();
    const match = scope === "year" ? /^(\d{4})$/.exec(period) : /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
    if (!match) return res.status(400).send(scope === "year" ? "Tahun harus dalam format YYYY" : "Bulan harus dalam format YYYY-MM");
    const year = Number(match[1]);
    const month = scope === "month" ? Number(match[2]) : 1;
    const from = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+07:00`);
    const to = scope === "year"
      ? new Date(`${year + 1}-01-01T00:00:00+07:00`)
      : new Date(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01T00:00:00+07:00`);
    const entries = await prisma.journalEntry.findMany({
      where: { status: "POSTED", date: { gte: from, lt: to } },
      include: { lines: { include: { account: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
    const totalDebit = entries.reduce((sum, entry) => sum + entry.lines.reduce((lineSum, line) => lineSum + Number(line.debit), 0), 0);
    const totalCredit = entries.reduce((sum, entry) => sum + entry.lines.reduce((lineSum, line) => lineSum + Number(line.credit), 0), 0);
    const rows = entries.flatMap((entry, entryIndex) => entry.lines.map((line, lineIndex) => `<tr><td class="center">${lineIndex === 0 ? entryIndex + 1 : ""}</td><td>${lineIndex === 0 ? esc(date(entry.date)) : ""}</td><td>${lineIndex === 0 ? `<b>${esc(entry.number)}</b><br><span class="muted">${esc((entry.sourceType || "MANUAL").replaceAll("_", " "))}</span>` : ""}</td><td>${lineIndex === 0 ? esc(entry.description) : ""}</td><td><b>${esc(line.account.code)}</b> ${esc(line.account.name)}</td><td class="right">${Number(line.debit) ? money(line.debit) : "—"}</td><td class="right">${Number(line.credit) ? money(line.credit) : "—"}</td></tr>`)).join("");
    const periodLabel = scope === "year"
      ? `Tahun ${year}`
      : new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(from);
    res.type("html").send(documentHtml({
      title: "LAPORAN JURNAL UMUM",
      subtitle: periodLabel,
      landscape: true,
      meta: `${entries.length} jurnal`,
      body: `<div class="summary"><div class="box">Jumlah jurnal<b>${entries.length}</b></div><div class="box">Total debit<b>${money(totalDebit)}</b></div><div class="box">Total kredit<b>${money(totalCredit)}</b></div></div><table><thead><tr><th class="center">No.</th><th>Tanggal</th><th>Nomor & sumber</th><th>Keterangan</th><th>Akun</th><th class="right">Debit</th><th class="right">Kredit</th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="center">Belum ada jurnal pada periode ini.</td></tr>`}</tbody><tfoot><tr><th colspan="5" class="right">TOTAL</th><th class="right">${money(totalDebit)}</th><th class="right">${money(totalCredit)}</th></tr></tfoot></table>`,
    }));
  } catch (error) {
    res.status(400).send(error.message || "Gagal membuat laporan accounting");
  }
});

router.post("/sync", async (req, res) => {
  try {
    let posted = 0;
    const creator = req.user.id;
    const [invoices, customerPayments, receipts, supplierPayments, expenses, expenseReturns, inventoryUsages, inventoryReturns, financeDebts] = await Promise.all([
      prisma.invoice.findMany({ where: { status: { in: ["SENT","PARTIALLY_PAID","PAID"] } } }),
      prisma.receivablePayment.findMany({ include: { invoice: true } }),
      prisma.goodsReceipt.findMany({ include: { items: { include: { purchaseOrderItem: true } }, purchaseOrder: true } }),
      prisma.purchasePayment.findMany({ where: { status: "PAID" }, include: { purchaseOrder: true } }),
      prisma.expense.findMany({ where: { status: { in: ["PAID","APPROVED"] } } }),
      prisma.expenseReturn.findMany(),
      prisma.stockMovement.findMany({ where: { type: "OUT", fromLocationId: { not: null }, totalCost: { gt: 0 }, NOT: [{ note: { startsWith: "Pembelian langsung" } }, { note: { startsWith: "Langsung dipasang" } }] }, include: { item: true, maintenance: true } }),
      prisma.stockMovement.findMany({ where: { type: "IN", totalCost: { gt: 0 }, OR: [{ note: { startsWith: "RETURN_OF:" } }, { note: { startsWith: "RETURN_ASSIGNMENT:" } }] }, include: { item: true, maintenance: true } }),
      prisma.financeDebt.findMany({ include: { truck: true } }),
    ]);
    for (const invoice of invoices) { await prisma.$transaction(tx=>postJournal(tx,{date:invoice.sentAt||invoice.issuedAt,description:`Invoice ${invoice.number}`,sourceType:"CUSTOMER_INVOICE",sourceId:invoice.id,createdById:creator,lines:[{code:SYSTEM_ACCOUNTS.AR,debit:invoice.total},{code:SYSTEM_ACCOUNTS.REVENUE,credit:invoice.total}]})); posted++; }
    for (const p of customerPayments) { await prisma.$transaction(tx=>postJournal(tx,{date:p.receivedAt,description:`Penerimaan ${p.number}`,sourceType:"CUSTOMER_PAYMENT",sourceId:p.id,createdById:creator,lines:[{code:cashCode(p.method),debit:p.amount},{code:SYSTEM_ACCOUNTS.AR,credit:p.amount}]})); posted++; }
    for (const r of receipts) { const value=r.items.reduce((s,i)=>s+i.qty*i.purchaseOrderItem.unitPrice,0); if(value>0){await prisma.$transaction(tx=>postJournal(tx,{date:r.receivedAt,description:`Penerimaan barang ${r.number}`,sourceType:"GOODS_RECEIPT",sourceId:r.id,createdById:creator,lines:[{code:SYSTEM_ACCOUNTS.INVENTORY,debit:value},{code:SYSTEM_ACCOUNTS.AP,credit:value}]}));posted++;} }
    for (const p of supplierPayments) { await prisma.$transaction(tx=>postJournal(tx,{date:p.paidAt||p.createdAt,description:`Pembayaran supplier ${p.number}`,sourceType:"SUPPLIER_PAYMENT",sourceId:p.id,createdById:creator,lines:[{code:SYSTEM_ACCOUNTS.AP,debit:p.amount},{code:cashCode(p.method),credit:p.amount}]})); posted++; }
    for (const e of expenses) { const debitCode=e.category==="EMPLOYEE_RECEIVABLE"?SYSTEM_ACCOUNTS.AR:e.category==="FINANCE_DEBT_PAYMENT"?SYSTEM_ACCOUNTS.FINANCE_AP:SYSTEM_ACCOUNTS.EXPENSE; await prisma.$transaction(tx=>postJournal(tx,{date:e.paidAt||e.createdAt,description:e.reason,sourceType:"EXPENSE_PAYMENT",sourceId:e.id,createdById:creator,lines:[{code:debitCode,debit:e.amount},{code:cashCode(e.paymentMethod),credit:e.amount}]})); posted++; }
    for (const r of expenseReturns) { await prisma.$transaction(tx=>postJournal(tx,{date:r.returnDate,description:`Retur pengeluaran: ${r.reason}`,sourceType:"EXPENSE_RETURN",sourceId:r.id,createdById:r.createdById||creator,lines:[{code:cashCode(r.paymentMethod),debit:r.amount},{code:SYSTEM_ACCOUNTS.EXPENSE,credit:r.amount}]})); posted++; }
    for (const m of inventoryUsages) { await prisma.$transaction(tx=>postJournal(tx,{date:m.createdAt,description:`Pemakaian ${m.item.name}${m.maintenance?.title?` untuk ${m.maintenance.title}`:" dari Inventory"}`,sourceType:"INVENTORY_USAGE",sourceId:m.id,createdById:m.createdById||creator,lines:[{code:SYSTEM_ACCOUNTS.EXPENSE,debit:m.totalCost},{code:SYSTEM_ACCOUNTS.INVENTORY,credit:m.totalCost}]})); posted++; }
    for (const m of inventoryReturns) { await prisma.$transaction(tx=>postJournal(tx,{date:m.createdAt,description:`Pengembalian ${m.item.name}${m.maintenance?.title?` dari ${m.maintenance.title}`:" ke Inventory"}`,sourceType:"INVENTORY_RETURN",sourceId:m.id,createdById:m.createdById||creator,lines:[{code:SYSTEM_ACCOUNTS.INVENTORY,debit:m.totalCost},{code:SYSTEM_ACCOUNTS.EXPENSE,credit:m.totalCost}]})); posted++; }
    for (const d of financeDebts) { await prisma.$transaction(tx=>postJournal(tx,{date:d.createdAt,description:`Saldo awal utang finance ${d.leasingName}`,sourceType:"FINANCE_DEBT",sourceId:d.id,createdById:d.createdById||creator,lines:[{code:SYSTEM_ACCOUNTS.EQUITY,debit:d.originalAmount},{code:SYSTEM_ACCOUNTS.FINANCE_AP,credit:d.originalAmount}]})); posted++; }
    res.json({ok:true, processed:posted});
  } catch(error){res.status(400).json({error:error.message||"Gagal sinkronisasi accounting"});}
});
module.exports = router;
