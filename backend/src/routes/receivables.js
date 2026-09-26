const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");
const { SYSTEM_ACCOUNTS, cashCode, postJournal } = require("../services/accounting");
const { esc, num, money, date, documentHtml } = require("../utils/printDocument");
const { nextDailyNumber } = require("../utils/documentNumber");

const router = express.Router();
// Keep the running server aligned with the generated Prisma relations.
router.use(authRequired, requireRole("OWNER", "ADMIN", "STAFF"));

const invoiceInclude = {
  order: { select: { id: true, orderNo: true, deliveryOrderNo: true, spkNo: true, cargoName: true, customerName: true, customer: { select: { name: true, cargoLossTolerancePercent: true } }, qty: true, unit: true, fromText: true, toText: true, trips: { where: { status: "COMPLETED" }, include: { truck: true, dispatchLetter: true, arrivalProofs: { orderBy: { createdAt: "asc" } } } }, tripAllocations: { where: { trip: { status: "COMPLETED" } }, include: { trip: { include: { truck: true, dispatchLetter: true, arrivalProofs: { orderBy: { createdAt: "asc" } } } } } }, materialInvoices: { select: { billingCustomerName: true, lines: { select: { totalAmount: true } } } } } },
  customer: true,
  singleTrip: { include: { truck: true, arrivalProofs: { orderBy: { createdAt: "asc" } } } },
  singleTripLines: {
    include: {
      trip: {
        include: {
          truck: true,
          dispatchLetter: true,
          arrivalProofs: { orderBy: { createdAt: "asc" } },
        },
      },
    },
    orderBy: { trip: { completedAt: "asc" } },
  },
  materialInvoices: { include: { trip: { include: { truck: true } }, destinationLocation: true, lines: { include: { stockAllocations: { include: { receipt: { include: { customer: true, location: true } } } } } } } },
  manualLines: { include: { truck: { select: { id: true, plateNumber: true, brand: true, model: true } } }, orderBy: { position: "asc" } },
  createdBy: { select: { name: true } },
  payments: { include: { createdBy: { select: { name: true } } }, orderBy: { receivedAt: "desc" } },
};

router.post("/manual-invoices", async (req, res) => {
  try {
    const { customerId, dueAt, type, title, fromText, toText, reference, notes, lines = [] } = req.body;
    if (!["FERTILIZER", "CANGKANG", "MATERIAL"].includes(type)) throw new Error("Jenis tagihan manual tidak valid");
    const customer = await prisma.customer.findUnique({ where: { id: String(customerId || "") } });
    if (!customer) throw new Error("Pilih customer dari Master Customer");
    const dueDate = new Date(dueAt);
    if (Number.isNaN(dueDate.getTime())) throw new Error("Tanggal jatuh tempo tidak valid");
    if (!Array.isArray(lines) || !lines.length) throw new Error("Tambahkan minimal satu baris tagihan");
    const selectedTruckIds = lines.map(row => String(row.truckId || "")).filter(Boolean);
    if (selectedTruckIds.length !== lines.length) throw new Error("Pilih armada untuk setiap baris tagihan");
    const truckIds = [...new Set(selectedTruckIds)];
    const trucks = await prisma.truck.findMany({ where: { id: { in: truckIds } }, select: { id: true, plateNumber: true } });
    const truckById = new Map(trucks.map(truck => [truck.id, truck]));
    if (trucks.length !== truckIds.length) throw new Error("Ada armada yang tidak ditemukan di Master Armada");
    const prepared = lines.map((row, position) => {
      const quantity = Number(type === "MATERIAL" ? row.qty : row.billableKg ?? row.receivedKg ?? row.sentKg);
      const rate = Math.round(Number(row.rate || 0));
      const lineAmount = Math.round(Number(row.amount ?? quantity * rate));
      if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(rate) || rate < 0 || !Number.isFinite(lineAmount) || lineAmount < 0) throw new Error(`Baris ${position + 1} memiliki jumlah atau harga tidak valid`);
      if (!String(row.cargoName || "").trim()) throw new Error(`Nama barang baris ${position + 1} wajib diisi`);
      const truck = truckById.get(String(row.truckId));
      return { position, truckId: truck.id, data: { ...row, plateNumber: truck.plateNumber }, quantity, unit: type === "MATERIAL" ? String(row.unit || "").trim() || null : "KG", rate, amount: lineAmount };
    });
    const subtotal = prepared.reduce((sum, row) => sum + row.amount, 0);
    const tax = amount(req.body.tax || 0, "Pajak");
    const discount = amount(req.body.discount || 0, "Diskon");
    const total = subtotal + tax - discount;
    if (total <= 0) throw new Error("Total tagihan harus lebih dari nol");
    const invoiceId = await prisma.$transaction(async tx => {
      const number = await nextInvoiceNumber(tx, "INV-TGL");
      const created = await tx.invoice.create({ data: { number, billingKey: `MANUAL:${type}:${Date.now()}`, sourceType: `MANUAL_${type}`, customerId: customer.id, customerName: customer.name, customerPhone: customer.phone || null, billingAddress: customer.address || null, dueAt: dueDate, subtotal, contractSubtotal: subtotal, materialSubtotal: type === "MATERIAL" ? subtotal : 0, tax, discount, total, notes: String(notes || "").trim() || null, manualData: { title: String(title || "").trim(), fromText: String(fromText || "").trim(), toText: String(toText || "").trim(), reference: String(reference || "").trim(), type }, createdById: req.user.id, manualLines: { create: prepared } }, select: { id: true } });
      return created.id;
    });
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
    if (!invoice) throw new Error("Invoice berhasil dibuat tetapi gagal dimuat kembali");
    res.status(201).json({ ok: true, invoice: summarize(invoice) });
  } catch (error) { res.status(400).json({ error: error.message || "Gagal membuat tagihan tunggal" }); }
});

function amount(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} harus berupa nominal rupiah yang valid`);
  return parsed;
}

async function nextNumber(tx, model, prefix) {
  return nextDailyNumber(tx, model, prefix);
}

async function nextInvoiceNumber(tx, prefix) {
  return nextDailyNumber(tx, "invoice", prefix);
}

function summarize(invoice) {
  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = Math.max(0, invoice.total - paid);
  const overdue = ["SENT", "PARTIALLY_PAID"].includes(invoice.status) && new Date(invoice.dueAt) < new Date();
  return { ...invoice, order: invoice.order ? { ...invoice.order, shipment: shipmentSummary(invoice.order) } : null, paid, balance, displayStatus: overdue ? "OVERDUE" : invoice.status };
}

function shipmentSummary(order) {
  const trips = order?.tripAllocations?.length ? order.tripAllocations : (order?.trips || []);
  const planned = trips.reduce((sum, trip) => sum + Number(trip.qtyPlanned || 0), 0);
  const delivered = trips.reduce((sum, trip) => sum + Number(trip.qtyActual ?? trip.qtyPlanned ?? 0), 0);
  return { planned, delivered, loss: Math.max(0, planned - delivered), unit: order?.unit || null };
}

function eligibleOrderMaterials(order) {
  const owner = String(order?.customer?.name || order?.customerName || "").trim().toLocaleLowerCase("id-ID");
  return (order?.materialInvoices || []).filter((invoice) =>
    !invoice.billedInvoiceId && invoice.destinationCompletedAt &&
    (!invoice.billingCustomerName || String(invoice.billingCustomerName).trim().toLocaleLowerCase("id-ID") === owner)
  );
}

function materialSubtotal(order) {
  return eligibleOrderMaterials(order)
    .flatMap((invoice) => invoice.lines || [])
    .reduce((sum, line) => sum + Number(line.totalAmount || 0), 0);
}

function quantityKg(qty, unit) {
  const value = Number(qty);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (String(unit || "").toUpperCase() === "TON") return value * 1000;
  if (String(unit || "").toUpperCase() === "KG") return value;
  return 0;
}

function weightKg(trip, field = "qtyActual") {
  const qty = Number(trip?.[field]);
  const unit = String(trip?.unitSnap || "").toUpperCase();
  return quantityKg(qty, unit);
}

function billingWeight(plannedKg, actualKg, tolerancePercent) {
  const planned = Math.max(0, Number(plannedKg || 0));
  const actual = Math.max(0, Number(actualKg || 0));
  const loss = Math.max(0, planned - actual);
  const tolerance = Math.max(0, Number(tolerancePercent || 0));
  const toleranceWeight = planned * tolerance / 100;
  const claimableLoss = Math.max(0, loss - toleranceWeight);
  const withinTolerance = claimableLoss <= 1e-9;
  return { planned, actual, loss, tolerance, toleranceWeight, claimableLoss, withinTolerance, billable: Math.max(0, planned - claimableLoss) };
}

router.get("/overview", async (_req, res) => {
  try {
    const [customers, trucks, invoices, eligibleOrders, materialRows, singleTrips, employeeExpenses, employeePayments] = await Promise.all([
      prisma.customer.findMany({ orderBy: { name: "asc" } }),
      prisma.truck.findMany({ select: { id: true, plateNumber: true, brand: true, model: true }, orderBy: { plateNumber: "asc" } }),
      prisma.invoice.findMany({ include: invoiceInclude, orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }] }),
      prisma.order.findMany({
        where: { status: "COMPLETED", invoices: { none: { sourceType: "ORDER", status: { not: "VOID" } } } },
        include: { customer: true, trips: { where: { status: "COMPLETED" }, select: { qtyPlanned: true, qtyActual: true, plateNumberSnap: true, truck: { select: { plateNumber: true } } } }, tripAllocations: { where: { trip: { status: "COMPLETED" } }, select: { qtyPlanned: true, qtyActual: true, trip: { select: { plateNumberSnap: true, truck: { select: { plateNumber: true } } } } } }, materialInvoices: { select: { id: true, billingCustomerName: true, billedInvoiceId: true, destinationCompletedAt: true, lines: { select: { id: true, itemName: true, qty: true, unit: true, totalAmount: true } } } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.materialInvoice.findMany({ where: { billedInvoiceId: null, destinationCompletedAt: { not: null } }, include: { lines: { include: { stockAllocations: { include: { receipt: { include: { customer: true, location: true } } } } } }, trip: { include: { truck: true } }, destinationLocation: true }, orderBy: { issuedAt: "asc" } }),
      prisma.trip.findMany({ where: { purpose: "SINGLE_TRIP", status: "COMPLETED", cargoCategorySnap: { in: ["FERTILIZER", "CANGKANG"] }, billingCustomerName: { not: null }, invoiceLines: { none: {} }, singleInvoice: null }, include: { truck: true, billingCustomer: true }, orderBy: { completedAt: "asc" } }),
      prisma.expense.findMany({ where: { category: "EMPLOYEE_RECEIVABLE", employeeId: { not: null }, status: { not: "REJECTED" } }, include: { employee: { select: { id: true, name: true, email: true } } }, orderBy: { expenseDate: "desc" } }),
      prisma.employeeReceivablePayment.findMany({ include: { employee: { select: { id: true, name: true, email: true } }, createdBy: { select: { name: true } } }, orderBy: { receivedAt: "desc" } }),
    ]);
    const rows = invoices.map(summarize);
    const stats = rows.reduce((acc, invoice) => {
      if (invoice.status !== "VOID") acc.invoiced += invoice.total;
      acc.received += invoice.paid;
      if (!['PAID', 'VOID'].includes(invoice.status)) acc.outstanding += invoice.balance;
      if (invoice.displayStatus === "OVERDUE") acc.overdue += invoice.balance;
      return acc;
    }, { invoiced: 0, received: 0, outstanding: 0, overdue: 0 });
    const groups = new Map();
    for (const item of materialRows) {
      const customerName = item.billingCustomerName || "Tanpa customer";
      const matchedCustomer = customers.find(customer => customer.name.trim().toLocaleLowerCase("id-ID") === String(customerName).trim().toLocaleLowerCase("id-ID"));
      const key = matchedCustomer ? `id:${matchedCustomer.id}` : `name:${String(customerName).trim().toLocaleLowerCase("id-ID")}`;
      const group = groups.get(key) || { key, customerId: matchedCustomer?.id || null, customerName: matchedCustomer?.name || customerName, customerPhone: matchedCustomer?.phone || "", billingAddress: matchedCustomer?.address || "", total: 0, invoiceIds: [], invoices: [] };
      group.total += item.lines.reduce((sum, line) => sum + Number(line.totalAmount || 0), 0);
      group.invoiceIds.push(item.id); group.invoices.push(item); groups.set(key, group);
    }
    const orderSources = eligibleOrders.map(order => ({ type: "ORDER", id: order.id, customerId: order.customerId || null, label: `${order.orderNo} — ${order.customer?.name || order.customerName || "Tanpa nama"}`, customerName: order.customer?.name || order.customerName || "", customerPhone: order.customer?.phone || "", billingAddress: order.customer?.address || "", order: { ...order, shipment: shipmentSummary(order), materialSubtotal: materialSubtotal(order) } }));
    const materialSources = [...groups.values()].map(group => ({ type: "MATERIAL", id: group.key, customerId: group.customerId, label: `Faktur Muatan — ${group.customerName} (${group.invoiceIds.length} faktur)`, customerName: group.customerName, customerPhone: group.customerPhone, billingAddress: group.billingAddress, materialInvoiceIds: group.invoiceIds, materialSubtotal: group.total, invoices: group.invoices }));
    const singleGroups = new Map();
    for (const trip of singleTrips) {
      const customerName = String(trip.billingCustomerName || "").trim();
      const category = String(trip.cargoCategorySnap || "").toUpperCase();
      const key = `${trip.billingCustomerId || customerName.toLocaleLowerCase("id-ID")}:${category}`;
      const group = singleGroups.get(key) || { key, customerId: trip.billingCustomerId || null, customerName, customerPhone: trip.billingCustomer?.phone || "", billingAddress: trip.billingCustomer?.address || "", cargoCategory: category, trips: [], totalWeightKg: 0 };
      group.trips.push(trip); group.totalWeightKg += weightKg(trip); singleGroups.set(key, group);
    }
    const cargoLabel = value => value === "FERTILIZER" ? "Pupuk" : value === "CANGKANG" ? "Cangkang" : value;
    const singleSources = [...singleGroups.values()].map(group => ({ type: "SINGLE_TRIP_GROUP", id: group.key, customerId: group.customerId, label: `Trip Tunggal — ${group.customerName} · ${cargoLabel(group.cargoCategory)} (${group.trips.length} trip)`, customerName: group.customerName, customerPhone: group.customerPhone, billingAddress: group.billingAddress, cargoCategory: group.cargoCategory, singleTripIds: group.trips.map(trip => trip.id), totalWeightKg: group.totalWeightKg, trips: group.trips }));
    const employeeGroups = new Map();
    for (const expense of employeeExpenses) {
      const group = employeeGroups.get(expense.employeeId) || { employee: expense.employee, total: 0, paid: 0, balance: 0, expenses: [], payments: [] };
      group.total += Number(expense.amount || 0); group.expenses.push(expense); employeeGroups.set(expense.employeeId, group);
    }
    for (const payment of employeePayments) {
      const group = employeeGroups.get(payment.employeeId);
      if (!group) continue;
      group.paid += Number(payment.amount || 0); group.payments.push(payment);
    }
    const employeeReceivables = [...employeeGroups.values()].map(group => ({ ...group, balance: Math.max(0, group.total - group.paid) })).filter(group => group.balance > 0).sort((a, b) => (a.employee?.name || a.employee?.email || "").localeCompare(b.employee?.name || b.employee?.email || "", "id"));
    res.json({ ok: true, customers, trucks, invoices: rows, employeeReceivables, eligibleOrders: orderSources.map(source => source.order), eligibleMaterialGroups: [...groups.values()], eligibleSingleTrips: singleTrips, eligibleSources: [...orderSources, ...materialSources, ...singleSources], stats });
  } catch (error) {
    res.status(400).json({ error: error.message || "Gagal memuat piutang" });
  }
});

router.post("/employees/:employeeId/payments", async (req, res) => {
  try {
    const paymentAmount = amount(req.body.amount, "Pembayaran");
    if (paymentAmount <= 0) throw new Error("Pembayaran harus lebih dari nol");
    const method = req.body.method || "BANK_TRANSFER";
    if (!["BANK_TRANSFER", "CASH", "OTHER"].includes(method)) throw new Error("Metode pembayaran tidak valid");
    const receivedAt = req.body.receivedAt ? new Date(req.body.receivedAt) : new Date();
    if (Number.isNaN(receivedAt.getTime())) throw new Error("Tanggal pembayaran tidak valid");
    const result = await prisma.$transaction(async tx => {
      const employee = await tx.user.findUnique({ where: { id: req.params.employeeId }, select: { id: true, name: true, email: true } });
      if (!employee) throw new Error("Karyawan tidak ditemukan");
      const [debt, paid] = await Promise.all([
        tx.expense.aggregate({ where: { employeeId: employee.id, category: "EMPLOYEE_RECEIVABLE", status: { not: "REJECTED" } }, _sum: { amount: true } }),
        tx.employeeReceivablePayment.aggregate({ where: { employeeId: employee.id }, _sum: { amount: true } }),
      ]);
      const balance = Number(debt._sum.amount || 0) - Number(paid._sum.amount || 0);
      if (balance <= 0) throw new Error("Karyawan ini tidak memiliki sisa piutang");
      if (paymentAmount > balance) throw new Error("Pembayaran melebihi sisa piutang karyawan");
      const number = await nextNumber(tx, "employeeReceivablePayment", "RCV-KRY");
      const payment = await tx.employeeReceivablePayment.create({ data: { number, employeeId: employee.id, amount: paymentAmount, method, reference: req.body.reference?.trim() || null, notes: req.body.notes?.trim() || null, receivedAt, createdById: req.user.id } });
      await postJournal(tx, { date: payment.receivedAt, description: `Pembayaran piutang karyawan ${employee.name || employee.email}`, sourceType: "EMPLOYEE_RECEIVABLE_PAYMENT", sourceId: payment.id, createdById: req.user.id, lines: [{ code: cashCode(payment.method), debit: payment.amount }, { code: SYSTEM_ACCOUNTS.AR, credit: payment.amount }] });
      return payment;
    });
    res.status(201).json({ ok: true, payment: result });
  } catch (error) { res.status(400).json({ error: error.message || "Gagal mencatat pembayaran piutang karyawan" }); }
});

router.get("/report", async (req, res) => {
  try {
    const month = String(req.query.month || "").trim();
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
    if (!match) return res.status(400).send("Periode harus dalam format YYYY-MM");
    const year = Number(match[1]);
    const monthNumber = Number(match[2]);
    const nextYear = monthNumber === 12 ? year + 1 : year;
    const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
    const start = new Date(`${month}-01T00:00:00+07:00`);
    const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+07:00`);
    const invoices = await prisma.invoice.findMany({ where: { issuedAt: { gte: start, lt: end } }, include: invoiceInclude, orderBy: [{ issuedAt: "asc" }, { number: "asc" }] });
    const items = invoices.map(summarize);
    const active = items.filter(item => item.status !== "VOID");
    const invoiced = active.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const received = active.reduce((sum, item) => sum + Number(item.paid || 0), 0);
    const outstanding = active.reduce((sum, item) => sum + Number(item.balance || 0), 0);
    const overdue = active.filter(item => item.displayStatus === "OVERDUE").reduce((sum, item) => sum + Number(item.balance || 0), 0);
    const labels = { DRAFT: "Draft", SENT: "Terkirim", PARTIALLY_PAID: "Dibayar sebagian", PAID: "Lunas", OVERDUE: "Jatuh tempo", VOID: "Dibatalkan" };
    const sourceText = item => item.order?.orderNo || (item.singleTripLines?.length ? `${item.singleTripLines.length} trip tunggal` : "") || item.singleTrip?.tripNo || (item.materialInvoices?.length ? `${item.materialInvoices.length} faktur muatan` : "") || (item.sourceType?.startsWith("MANUAL_") ? "Tagihan tunggal" : "-");
    const rows = items.map((item, index) => `<tr><td class="center">${index + 1}</td><td>${esc(date(item.issuedAt))}</td><td><b>${esc(item.number)}</b></td><td>${esc(item.customerName)}</td><td>${esc(sourceText(item))}</td><td>${esc(date(item.dueAt))}</td><td>${esc(labels[item.displayStatus] || item.displayStatus)}</td><td class="right">${money(item.total)}</td><td class="right">${money(item.paid)}</td><td class="right"><b>${money(item.balance)}</b></td></tr>`).join("");
    const periodLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(start);
    res.type("html").send(documentHtml({
      title: "LAPORAN PIUTANG PELANGGAN", subtitle: periodLabel, landscape: true,
      meta: `Periode invoice: ${esc(periodLabel)}<br>Jumlah tagihan: ${items.length}`,
      body: `<div class="summary"><div class="box">Total ditagih<b>${money(invoiced)}</b><span>${active.length} invoice aktif</span></div><div class="box">Sudah diterima<b>${money(received)}</b><span>Pembayaran tercatat</span></div><div class="box">Sisa piutang<b>${money(outstanding)}</b><span>Jatuh tempo: ${money(overdue)}</span></div></div><table><thead><tr><th class="center">No</th><th>Tanggal</th><th>Invoice</th><th>Pelanggan</th><th>Pesanan / Sumber</th><th>Jatuh Tempo</th><th>Status</th><th class="right">Total</th><th class="right">Dibayar</th><th class="right">Sisa</th></tr></thead><tbody>${rows || `<tr><td colspan="10" class="center">Belum ada tagihan pada periode ini.</td></tr>`}</tbody><tfoot><tr><td colspan="7" class="right"><b>TOTAL</b></td><td class="right"><b>${money(invoiced)}</b></td><td class="right"><b>${money(received)}</b></td><td class="right"><b>${money(outstanding)}</b></td></tr></tfoot></table><div class="signatures"><div>Dibuat oleh</div><div>Diperiksa oleh</div><div>Disetujui oleh</div></div>`,
    }));
  } catch (error) { res.status(400).send(error.message || "Gagal membuat laporan piutang"); }
});

router.post("/invoices", async (req, res) => {
  try {
    const { orderId, customerId, customerName, customerPhone, billingAddress, dueAt, notes, sourceType = "ORDER", materialInvoiceIds = [], materialLineAmounts = {}, singleTripId, singleTripIds = [] } = req.body;
    const contractSubtotal = amount(req.body.contractSubtotal ?? req.body.subtotal, "Harga kontrak");
    const tax = amount(req.body.tax || 0, "Pajak");
    const discount = amount(req.body.discount || 0, "Diskon");
    const requestedTolerance = req.body.tolerancePercent === undefined || req.body.tolerancePercent === "" ? null : Number(req.body.tolerancePercent);
    const dueDate = new Date(dueAt);
    if (!customerName?.trim()) throw new Error("Nama pelanggan wajib diisi");
    if (Number.isNaN(dueDate.getTime())) throw new Error("Tanggal jatuh tempo tidak valid");
    if (requestedTolerance !== null && (!Number.isFinite(requestedTolerance) || requestedTolerance < 0 || requestedTolerance > 100)) throw new Error("Persentase susut harus antara 0 sampai 100 persen");

    const invoiceId = await prisma.$transaction(async (tx) => {
      if (sourceType === "MATERIAL") {
        const items = await tx.materialInvoice.findMany({
          where: { id: { in: materialInvoiceIds }, billedInvoiceId: null, destinationCompletedAt: { not: null } },
          select: { id: true, billingCustomerName: true },
        });
        if (!items.length || items.length !== materialInvoiceIds.length) throw new Error("Faktur Muatan tidak tersedia atau sudah ditagih");
        const resolvedCustomerId = customerId || null;
        const customerKey = customerName.trim().toLocaleLowerCase("id-ID");
        if (items.some((item) => String(item.billingCustomerName || "").trim().toLocaleLowerCase("id-ID") !== customerKey)) throw new Error("Semua Faktur Muatan harus untuk customer yang sama");
        const subtotal = 0;
        const total = 0;
        const number = await nextInvoiceNumber(tx, "INV");
        const sourceKey = [...materialInvoiceIds].sort().join(",");
        const created = await tx.invoice.create({ data: { number, billingKey: `MATERIAL:${sourceKey}`, sourceType, customerId: resolvedCustomerId, customerName: customerName.trim(), customerPhone: customerPhone?.trim() || null, billingAddress: billingAddress?.trim() || null, dueAt: dueDate, subtotal, contractSubtotal: 0, materialSubtotal: subtotal, tax, discount, total, notes: notes?.trim() || null, createdById: req.user.id }, select: { id: true } });
        await tx.materialInvoice.updateMany({ where: { id: { in: materialInvoiceIds } }, data: { billedInvoiceId: created.id } }); return created.id;
      }
      if (sourceType === "SINGLE_TRIP") {
        const trip = await tx.trip.findFirst({ where: { id: singleTripId, purpose: "SINGLE_TRIP", status: "COMPLETED", singleInvoice: null } });
        if (!trip) throw new Error("Trip Tunggal tidak tersedia atau sudah ditagih");
        if (contractSubtotal <= 0) throw new Error("Nilai tagihan Trip Tunggal harus lebih dari nol");
        const total = contractSubtotal + tax - discount;
        if (total <= 0) throw new Error("Total invoice harus lebih dari nol");
        const number = await nextInvoiceNumber(tx, "INV");
        const created = await tx.invoice.create({ data: { number, billingKey: `SINGLE_TRIP:${trip.id}`, sourceType, singleTripId: trip.id, customerName: customerName.trim(), customerPhone: customerPhone?.trim() || null, billingAddress: billingAddress?.trim() || null, dueAt: dueDate, subtotal: contractSubtotal, contractSubtotal, tax, discount, total, notes: notes?.trim() || null, createdById: req.user.id }, select: { id: true } });
        return created.id;
      }
      if (sourceType === "SINGLE_TRIP_GROUP") {
        const ids = [...new Set(singleTripIds)].filter(Boolean);
        if (!ids.length) throw new Error("Pilih minimal satu Trip Tunggal");
        const trips = await tx.trip.findMany({
          where: { id: { in: ids }, purpose: "SINGLE_TRIP", status: "COMPLETED", cargoCategorySnap: { in: ["FERTILIZER", "CANGKANG"] }, invoiceLines: { none: {} }, singleInvoice: null },
          select: { id: true, tripNo: true, qtyActual: true, qtyPlanned: true, unitSnap: true, cargoCategorySnap: true, billingCustomerId: true, billingCustomerName: true, billingCustomer: { select: { cargoLossTolerancePercent: true } } },
        });
        if (trips.length !== ids.length) throw new Error("Sebagian trip tidak tersedia atau sudah ditagih");
        const customerKey = customerName.trim().toLocaleLowerCase("id-ID");
        const category = String(trips[0].cargoCategorySnap || "");
        if (trips.some(trip => String(trip.billingCustomerName || "").trim().toLocaleLowerCase("id-ID") !== customerKey || trip.cargoCategorySnap !== category)) throw new Error("Semua trip harus memiliki customer dan jenis muatan yang sama");
        const tolerancePercent = requestedTolerance ?? Number(trips[0].billingCustomer?.cargoLossTolerancePercent || 0);
        const lines = trips.map(trip => { const actualWeightKg = weightKg(trip); if (actualWeightKg <= 0) throw new Error(`${trip.tripNo || "Trip"} belum memiliki berat aktual dalam TON/KG`); const plannedWeightKg = weightKg(trip, "qtyPlanned") || actualWeightKg; const billing = billingWeight(plannedWeightKg, actualWeightKg, tolerancePercent); return { tripId: trip.id, actualWeightKg, plannedWeightKg, billableWeightKg: billing.billable, cargoLossWeightKg: billing.loss, tolerancePercent, ratePerKg: 0, amount: 0 }; });
        const subtotal = 0;
        const total = 0;
        const number = await nextInvoiceNumber(tx, "INV");
        const billingIds = ids.slice().sort();
        const created = await tx.invoice.create({ data: { number, billingKey: `SINGLE_TRIP_GROUP:${billingIds.join(",")}`, sourceType, customerId: trips[0].billingCustomerId || null, customerName: customerName.trim(), customerPhone: customerPhone?.trim() || null, billingAddress: billingAddress?.trim() || null, dueAt: dueDate, subtotal, contractSubtotal: subtotal, plannedQuantity: lines.reduce((sum, line) => sum + Number(line.plannedWeightKg || 0), 0), deliveredQuantity: lines.reduce((sum, line) => sum + line.actualWeightKg, 0), billableQuantity: lines.reduce((sum, line) => sum + Number(line.billableWeightKg || 0), 0), cargoLossQuantity: lines.reduce((sum, line) => sum + billingWeight(line.plannedWeightKg, line.actualWeightKg, tolerancePercent).claimableLoss, 0), tolerancePercent, tax, discount, total, notes: notes?.trim() || null, createdById: req.user.id, singleTripLines: { create: lines } }, select: { id: true } });
        if (trips[0].billingCustomerId) await tx.customer.update({ where: { id: trips[0].billingCustomerId }, data: { cargoLossTolerancePercent: tolerancePercent } });
        return created.id;
      }
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true, status: true, qty: true, unit: true, customerId: true,
          customer: { select: { cargoLossTolerancePercent: true } },
          invoices: { select: { sourceType: true, status: true } },
          trips: { where: { status: "COMPLETED" }, select: { qtyPlanned: true, qtyActual: true } },
          tripAllocations: { where: { trip: { status: "COMPLETED" } }, select: { qtyPlanned: true, qtyActual: true } },
        },
      });
      if (!order || order.status !== "COMPLETED") throw new Error("Invoice hanya dapat dibuat dari pesanan yang selesai");
      if (order.invoices.some((item) => item.sourceType === "ORDER" && item.status !== "VOID")) throw new Error("Pesanan ini sudah memiliki invoice");
      const shipment = shipmentSummary(order);
      const plannedQuantity = shipment.planned > 0 ? shipment.planned : Number(order.qty || 0);
      const deliveredQuantity = shipment.delivered;
      const plannedKg = quantityKg(plannedQuantity, order.unit);
      const deliveredKg = quantityKg(deliveredQuantity, order.unit);
      const tolerancePercent = requestedTolerance ?? Number(order.customer?.cargoLossTolerancePercent || 0);
      const billing = billingWeight(plannedKg, deliveredKg, tolerancePercent);
      const subtotal = 0;
      const cargoLossAmount = 0;
      const total = 0;
      const number = await nextInvoiceNumber(tx, "INV");
      const created = await tx.invoice.create({
        data: {
          number, orderId, billingKey: `ORDER:${orderId}`, sourceType: "ORDER", customerId: order.customerId, customerName: customerName.trim(),
          customerPhone: customerPhone?.trim() || null, billingAddress: billingAddress?.trim() || null,
          dueAt: dueDate, subtotal, contractSubtotal: 0, plannedQuantity: plannedKg || null,
          deliveredQuantity: plannedKg > 0 ? deliveredKg : null, billableQuantity: billing.billable || null, tolerancePercent,
          cargoLossQuantity: plannedKg > 0 ? billing.claimableLoss : null,
          cargoLossAmount, materialSubtotal: 0, tax, discount, total, notes: notes?.trim() || null, createdById: req.user.id,
        },
        select: { id: true },
      });
      if (order.customerId) await tx.customer.update({ where: { id: order.customerId }, data: { cargoLossTolerancePercent: tolerancePercent } });
      return created.id;
    });
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
    if (!invoice) throw new Error("Invoice berhasil dibuat tetapi gagal dimuat kembali");
    res.status(201).json({ ok: true, invoice: summarize(invoice) });
  } catch (error) {
    const status = error.code === "P2002" ? 409 : 400;
    res.status(status).json({ error: error.message || "Gagal membuat invoice" });
  }
});

router.patch("/invoices/:id/draft", async (req, res) => {
  try {
    const tax = amount(req.body.tax || 0, "Pajak");
    const discount = amount(req.body.discount || 0, "Diskon");
    const dueAt = new Date(req.body.dueAt);
    if (Number.isNaN(dueAt.getTime())) throw new Error("Tanggal jatuh tempo tidak valid");
    const saved = await prisma.$transaction(async tx => {
      const invoice = await tx.invoice.findUnique({ where: { id: req.params.id }, include: { customer: true, order: { include: { customer: true, trips: { where: { status: "COMPLETED" } }, tripAllocations: { where: { trip: { status: "COMPLETED" } } } } }, singleTripLines: true, materialInvoices: { include: { lines: true } } } });
      if (!invoice || invoice.status !== "DRAFT") throw new Error("Hanya invoice Draft yang dapat diubah");
      let contractSubtotal = 0;
      let materialSubtotal = 0;
      let subtotal = 0;
      let cargoLossAmount = 0;
      const requestedTolerance = Number(req.body.tolerancePercent ?? invoice.tolerancePercent ?? invoice.customer?.cargoLossTolerancePercent ?? 0);
      if (!Number.isFinite(requestedTolerance) || requestedTolerance < 0 || requestedTolerance > 100) throw new Error("Toleransi susut harus antara 0 sampai 100 persen");
      if (invoice.sourceType === "MATERIAL") {
        for (const line of invoice.materialInvoices.flatMap(row => row.lines)) {
          const rate = amount(req.body.materialLineRates?.[line.id], `Harga ${line.itemName}`);
          if (rate <= 0) throw new Error(`Harga ${line.itemName} wajib diisi`);
          const lineTotal = Math.round(Number(line.qty) * rate);
          await tx.materialInvoiceLine.update({ where: { id: line.id }, data: { totalAmount: lineTotal } });
          materialSubtotal += lineTotal;
        }
        subtotal = materialSubtotal;
      } else if (invoice.sourceType === "SINGLE_TRIP_GROUP") {
        const ratePerKg = amount(req.body.ratePerKg, "Harga per kg");
        if (ratePerKg <= 0) throw new Error("Harga per kg wajib diisi");
        for (const line of invoice.singleTripLines) {
          const billing = billingWeight(line.plannedWeightKg ?? line.actualWeightKg, line.actualWeightKg, requestedTolerance);
          const lineAmount = Math.round(billing.billable * ratePerKg);
          await tx.singleTripInvoiceLine.update({ where: { id: line.id }, data: { ratePerKg, amount: lineAmount, billableWeightKg: billing.billable, cargoLossWeightKg: billing.loss, tolerancePercent: requestedTolerance } });
          subtotal += lineAmount;
        }
        contractSubtotal = subtotal;
        await tx.invoice.update({ where: { id: invoice.id }, data: { ratePerKg, billableQuantity: invoice.singleTripLines.reduce((sum, line) => sum + billingWeight(line.plannedWeightKg ?? line.actualWeightKg, line.actualWeightKg, requestedTolerance).billable, 0), cargoLossQuantity: invoice.singleTripLines.reduce((sum, line) => sum + billingWeight(line.plannedWeightKg ?? line.actualWeightKg, line.actualWeightKg, requestedTolerance).claimableLoss, 0), tolerancePercent: requestedTolerance } });
      } else {
        const ratePerKg = amount(req.body.ratePerKg, "Harga per kg");
        if (ratePerKg <= 0) throw new Error("Harga per kg wajib diisi");
        const shipment = shipmentSummary(invoice.order);
        const planned = shipment.planned > 0 ? shipment.planned : Number(invoice.order?.qty || 0);
        const plannedKg = quantityKg(planned, invoice.order?.unit);
        const actualKg = quantityKg(shipment.delivered, invoice.order?.unit);
        const tolerancePercent = requestedTolerance;
        const billing = billingWeight(plannedKg, actualKg, tolerancePercent);
        subtotal = Math.round(billing.billable * ratePerKg);
        contractSubtotal = Math.round(plannedKg * ratePerKg);
        cargoLossAmount = Math.max(0, contractSubtotal - subtotal);
        await tx.invoice.update({ where: { id: invoice.id }, data: { ratePerKg, plannedQuantity: plannedKg, deliveredQuantity: actualKg, billableQuantity: billing.billable, cargoLossQuantity: billing.claimableLoss, tolerancePercent } });
      }
      if (invoice.customerId && invoice.sourceType !== "MATERIAL") await tx.customer.update({ where: { id: invoice.customerId }, data: { cargoLossTolerancePercent: requestedTolerance } });
      const total = subtotal + tax - discount;
      if (total <= 0) throw new Error("Total invoice harus lebih dari nol");
      return tx.invoice.update({ where: { id: invoice.id }, data: { dueAt, contractSubtotal, materialSubtotal, subtotal, cargoLossAmount, tax, discount, total, notes: req.body.notes?.trim() || null }, include: invoiceInclude });
    });
    res.json({ ok: true, invoice: summarize(saved) });
  } catch (error) { res.status(400).json({ error: error.message || "Gagal menyimpan harga invoice" }); }
});

router.get("/invoices/:id/print", async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: invoiceInclude });
    if (!invoice) return res.status(404).send("Invoice tidak ditemukan");

    const materialEvidence = [...new Map((invoice.materialInvoices || []).flatMap(materialInvoice =>
      (materialInvoice.lines || []).flatMap(line => (line.stockAllocations || []).map(allocation => allocation.receipt))
    ).filter(Boolean).map(receipt => [receipt.id, receipt])).values()];
    const proofTrips = invoice.singleTripLines?.length
      ? invoice.singleTripLines.map(line => line.trip)
      : invoice.singleTrip ? [invoice.singleTrip]
        : invoice.order?.tripAllocations?.length ? invoice.order.tripAllocations.map(row => row.trip)
          : invoice.order?.trips || [];
    const deliveryEvidence = proofTrips.flatMap(trip => (trip?.arrivalProofs || []).map(proof => ({ ...proof, trip })));

    let rowNumber = 0;
    const orderEntries = invoice.order
      ? (invoice.order.tripAllocations?.length
          ? invoice.order.tripAllocations.map(item => ({ ...item, unitSnap: item.unitSnap || invoice.order.unit, trip: item.trip }))
          : (invoice.order.trips || []).map(trip => ({ qtyPlanned: trip.qtyPlanned, qtyActual: trip.qtyActual, unitSnap: trip.unitSnap || invoice.order.unit, trip })))
      : [];
    const weightRows = invoice.singleTripLines?.length
      ? invoice.singleTripLines.map(line => ({ trip: line.trip, plannedKg: Number(line.plannedWeightKg ?? line.actualWeightKg ?? 0), actualKg: Number(line.actualWeightKg || 0), billableKg: Number(line.billableWeightKg ?? line.actualWeightKg ?? 0), lossKg: Number(line.cargoLossWeightKg ?? Math.max(0, Number(line.plannedWeightKg || 0) - Number(line.actualWeightKg || 0))), tolerancePercent: Number(line.tolerancePercent ?? invoice.tolerancePercent ?? 0), ratePerKg: Number(line.ratePerKg || 0), amount: Number(line.amount || 0) }))
      : orderEntries.map(item => {
          const plannedKg = quantityKg(item.qtyPlanned, item.unitSnap);
          const actualKg = quantityKg(item.qtyActual ?? item.qtyPlanned, item.unitSnap);
          const billing = billingWeight(plannedKg, actualKg, invoice.tolerancePercent || 0);
          return { trip: item.trip, plannedKg, actualKg, billableKg: billing.billable, lossKg: billing.loss, tolerancePercent: Number(invoice.tolerancePercent || 0), ratePerKg: Number(invoice.ratePerKg || 0), amount: Math.round(billing.billable * Number(invoice.ratePerKg || 0)) };
        });
    const totalPhysicalLossKg = weightRows.reduce((sum, row) => sum + row.lossKg, 0);
    const totalToleranceKg = weightRows.reduce((sum, row) => sum + (row.plannedKg * row.tolerancePercent / 100), 0);
    const totalClaimableLossKg = weightRows.reduce((sum, row) => sum + Math.max(0, row.lossKg - (row.plannedKg * row.tolerancePercent / 100)), 0);
    const shipmentRows = weightRows.map((row, index) => `<tr><td class="center">${index + 1}</td><td>${esc(date(row.trip?.completedAt))}</td><td>${esc(row.trip?.truck?.plateNumber || row.trip?.plateNumberSnap || "-")}</td><td>${esc(row.trip?.dispatchLetter?.number || row.trip?.tripNo || "-")}</td><td class="right">${esc(num(row.plannedKg))}</td><td class="right">${esc(num(row.actualKg))}</td><td class="right">${esc(num(row.actualKg - row.plannedKg))}</td><td class="right">${esc(num(row.billableKg))}</td><td class="right">${money(row.ratePerKg)}</td><td class="right"><b>${money(row.amount)}</b></td></tr>`).join("");
    const singleTripRows = (invoice.singleTripLines || []).map(line => {
      rowNumber += 1;
      const trip = line.trip;
      const cargo = trip.cargoCategorySnap === "FERTILIZER" ? "Pupuk" : trip.cargoCategorySnap === "CANGKANG" ? "Cangkang" : trip.cargoNameSnap || "Muatan";
      return `<tr><td class="center">${rowNumber}</td><td>${esc(date(trip.completedAt))}</td><td>${esc(trip.truck?.plateNumber || trip.plateNumberSnap || "-")}</td><td>${esc(trip.tripNo || "-")}</td><td>${esc(cargo)}<div class="muted">${esc(trip.fromText || "-")} → ${esc(trip.toText || "-")}</div></td><td class="right">${esc(num(line.actualWeightKg))}</td><td>KG</td><td class="right">${money(line.ratePerKg)}</td><td class="right"><b>${money(line.amount)}</b></td></tr>`;
    }).join("");
    const materialRows = (invoice.materialInvoices || []).flatMap((materialInvoice) => {
      rowNumber += 1;
      const lines = materialInvoice.lines?.length ? materialInvoice.lines : [{ itemName: "Ambang / Material", qty: 0, unit: "-", totalAmount: 0 }];
      return lines.map((line, lineIndex) => {
        const qty = Number(line.qty || 0);
        const lineTotal = Number(line.totalAmount || 0);
        const unitPrice = qty > 0 ? lineTotal / qty : 0;
        const destination = materialInvoice.destinationLocation?.name || materialInvoice.destinationText || "-";
        return `<tr>
          <td class="center">${lineIndex === 0 ? rowNumber : ""}</td>
          <td>${lineIndex === 0 ? esc(date(materialInvoice.issuedAt)) : ""}</td>
          <td>${lineIndex === 0 ? esc(materialInvoice.trip?.truck?.plateNumber || "-") : ""}</td>
          <td>${lineIndex === 0 ? esc(materialInvoice.number) : ""}</td>
          <td>${esc(line.itemName || "Ambang / Material")}<div class="muted">${lineIndex === 0 ? `Tujuan: ${esc(destination)}` : ""}</div></td>
          <td class="right">${esc(num(qty))}</td><td>${esc(line.unit || "-")}</td>
          <td class="right">${money(unitPrice)}</td><td class="right"><b>${money(lineTotal)}</b></td>
        </tr>`;
      });
    }).join("");
    const evidenceHtml = materialEvidence.length ? `<section style="margin-top:16px"><h3>REFERENSI BUKTI MATERIAL</h3><p class="muted">Foto asli tersedia pada Detail Invoice di sistem.</p><table><thead><tr><th>No. Penerimaan</th><th>Tanggal</th><th>Material</th><th>Qty Masuk</th><th>Lokasi</th><th>Nama File</th></tr></thead><tbody>${materialEvidence.map(receipt => `<tr><td>${esc(receipt.number)}</td><td>${esc(date(receipt.receivedAt))}</td><td>${esc(receipt.itemName)}</td><td>${esc(num(receipt.qtyReceived))} ${esc(receipt.unit)}</td><td>${esc(receipt.location?.name || "-")}</td><td>${esc(receipt.proofFileName || "Bukti foto")}</td></tr>`).join("")}</tbody></table></section>` : "";
    const deliveryEvidenceHtml = deliveryEvidence.length ? `<section style="margin-top:16px"><h3>REFERENSI BUKTI PENGIRIMAN</h3><p class="muted">Foto/PDF asli tersedia pada Detail Invoice di sistem.</p><table><thead><tr><th>Trip</th><th>No. Polisi</th><th>Jenis Bukti</th><th>Tanggal</th><th>Nama File</th></tr></thead><tbody>${deliveryEvidence.map(proof => `<tr><td>${esc(proof.trip?.tripNo || "-")}</td><td>${esc(proof.trip?.truck?.plateNumber || proof.trip?.plateNumberSnap || "-")}</td><td>${esc(proof.proofType === "LOADING" ? "Timbang muat" : "Timbang sampai")}</td><td>${esc(date(proof.createdAt, true))}</td><td>${esc(proof.fileName || "Bukti pengiriman")}</td></tr>`).join("")}</tbody></table></section>` : "";
    const manualType = invoice.sourceType?.startsWith("MANUAL_") ? invoice.sourceType.slice(7) : null;
    const manualRows = (invoice.manualLines || []).map((line, index) => {
      const row = line.data || {};
      if (manualType === "FERTILIZER") return `<tr><td class="center">${index + 1}</td><td>${esc(date(row.date))}</td><td>${esc(row.plateNumber || "-")}</td><td class="right">${esc(num(row.sentPackages || 0))}</td><td class="right">${esc(num(row.sentKg || 0))}</td><td class="right">${esc(num(row.receivedPackages || 0))}</td><td class="right">${esc(num(row.receivedKg || 0))}</td><td class="right">${esc(num(Number(row.receivedKg || 0) - Number(row.sentKg || 0)))}</td><td class="right">${money(line.rate)}</td><td class="right"><b>${money(line.amount)}</b></td></tr>`;
      if (manualType === "CANGKANG") return `<tr><td class="center">${index + 1}</td><td>${esc(date(row.date))}</td><td>${esc(row.plateNumber || "-")}</td><td>${esc(date(row.unloadingDate))}</td><td>${esc(row.cargoName || "Cangkang")}</td><td class="right">${esc(num(row.sentKg || 0))}</td><td class="right">${esc(num(row.receivedKg || 0))}</td><td class="right">${esc(num(Number(row.receivedKg || 0) - Number(row.sentKg || 0)))}</td><td class="right">${money(line.rate)}</td><td class="right"><b>${money(line.amount)}</b></td></tr>`;
      return `<tr><td class="center">${index + 1}</td><td>${esc(date(row.date))}</td><td>${esc(row.plateNumber || "-")}</td><td>${esc(row.documentNo || "-")}</td><td>${esc(row.cargoName || "Ambang / Material")}</td><td class="right">${esc(num(row.qty || 0))}</td><td>${esc(row.unit || "-")}</td><td class="right">${money(line.rate)}</td><td class="right"><b>${money(line.amount)}</b></td></tr>`;
    }).join("");
    const manualTable = manualType === "FERTILIZER" ? `<table><thead><tr><th>No.</th><th>Tanggal</th><th>No. Polisi</th><th class="right">Zak Kirim</th><th class="right">KG Kirim</th><th class="right">Zak Terima</th><th class="right">KG Terima</th><th class="right">Selisih</th><th class="right">Ongkos/KG</th><th class="right">Jumlah</th></tr></thead><tbody>${manualRows}</tbody></table>` : manualType === "CANGKANG" ? `<table><thead><tr><th>No.</th><th>Tgl SP</th><th>No. Polisi</th><th>Tgl Bongkar</th><th>Jenis Barang</th><th class="right">Timb. Kirim</th><th class="right">Timb. Bongkar</th><th class="right">Selisih</th><th class="right">Ongkos/KG</th><th class="right">Jumlah</th></tr></thead><tbody>${manualRows}</tbody></table>` : manualType === "MATERIAL" ? `<table><thead><tr><th>No.</th><th>Tanggal</th><th>No. Polisi</th><th>Surat/Faktur</th><th>Nama Barang</th><th class="right">Qty</th><th>Satuan</th><th class="right">Harga</th><th class="right">Jumlah</th></tr></thead><tbody>${manualRows}</tbody></table>` : "";

    const sourceDescription = invoice.order
      ? `${invoice.order.orderNo} · ${invoice.order.fromText || "-"} → ${invoice.order.toText || "-"}`
      : invoice.singleTripLines?.length
        ? `${invoice.singleTripLines.length} Trip Tunggal · ${invoice.singleTripLines[0]?.trip?.cargoCategorySnap === "FERTILIZER" ? "Pupuk" : "Cangkang"}`
      : invoice.singleTrip
        ? `${invoice.singleTrip.tripNo || "Trip"} · ${invoice.singleTrip.truck?.plateNumber || "-"}`
        : manualType ? `Tagihan Tunggal · ${manualType === "FERTILIZER" ? "Pupuk" : manualType === "CANGKANG" ? "Cangkang" : "Ambang / Material"}` : `${invoice.materialInvoices.length} Faktur Muatan`;
    const fallbackRows = singleTripRows || materialRows || `<tr><td class="center">1</td><td>${esc(date(invoice.issuedAt))}</td><td>${esc(invoice.singleTrip?.truck?.plateNumber || "-")}</td><td>${esc(invoice.order?.orderNo || invoice.singleTrip?.tripNo || "-")}</td><td>${esc(invoice.order?.cargoName || invoice.singleTrip?.cargoNameSnap || "Ongkos angkut")}</td><td class="right">1</td><td>Trip</td><td class="right">${money(invoice.contractSubtotal || invoice.subtotal)}</td><td class="right"><b>${money(invoice.contractSubtotal || invoice.subtotal)}</b></td></tr>`;
    const status = statusLabelForPrint(invoice.status);
    const body = `
      <div class="summary"><div class="box">Ditagihkan kepada<b>${esc(invoice.customerName)}</b><span class="muted">${esc(invoice.billingAddress || "Alamat belum dicatat")}</span></div><div class="box">Sumber tagihan<b>${esc(sourceDescription)}</b><span class="muted">${invoice.order ? `DO: ${esc(invoice.order.deliveryOrderNo || "-")} · SPK: ${esc(invoice.order.spkNo || "-")}` : esc(invoice.customerPhone || "Nomor telepon belum dicatat")}</span></div><div class="box">Jatuh tempo<b>${esc(date(invoice.dueAt))}</b><span class="muted">Status: ${esc(status)}</span></div></div>
      ${manualType ? `<div class="box" style="margin-top:14px"><b>${esc(invoice.manualData?.title || sourceDescription)}</b><br><span class="muted">${esc(invoice.manualData?.fromText || "-")} → ${esc(invoice.manualData?.toText || "-")}${invoice.manualData?.reference ? ` · ${esc(invoice.manualData.reference)}` : ""}</span></div>${manualTable}` : shipmentRows ? `<div class="box" style="margin-top:14px"><b>RINCIAN ONGKOS ANGKUT ${esc(invoice.order?.cargoName || invoice.singleTripLines?.[0]?.trip?.cargoNameSnap || "MUATAN")}</b><br><span class="muted">${esc(invoice.order?.fromText || invoice.singleTripLines?.[0]?.trip?.fromText || "-")} → ${esc(invoice.order?.toText || invoice.singleTripLines?.[0]?.trip?.toText || "-")}</span><br><span class="muted">No. Pesanan: ${esc(invoice.order?.orderNo || "-")} · No. DO: ${esc(invoice.order?.deliveryOrderNo || "-")} · No. SPK: ${esc(invoice.order?.spkNo || "-")} · Toleransi susut: ${esc(num(invoice.tolerancePercent || 0))}%</span></div><table><thead><tr><th>No.</th><th>Tanggal</th><th>No. Polisi</th><th>Surat Jalan</th><th class="right">KG Kirim</th><th class="right">KG Diterima</th><th class="right">Selisih</th><th class="right">KG Ditagih</th><th class="right">Ongkos/KG</th><th class="right">Jumlah</th></tr></thead><tbody>${shipmentRows}</tbody><tfoot><tr><td colspan="4" class="right"><b>TOTAL</b></td><td class="right"><b>${num(weightRows.reduce((sum,row)=>sum+row.plannedKg,0))}</b></td><td class="right"><b>${num(weightRows.reduce((sum,row)=>sum+row.actualKg,0))}</b></td><td class="right"><b>${num(weightRows.reduce((sum,row)=>sum+row.actualKg-row.plannedKg,0))}</b></td><td class="right"><b>${num(weightRows.reduce((sum,row)=>sum+row.billableKg,0))}</b></td><td></td><td class="right"><b>${money(weightRows.reduce((sum,row)=>sum+row.amount,0))}</b></td></tr></tfoot></table>` : `<table><thead><tr><th>No.</th><th>Tanggal</th><th>No. Pol.</th><th>Surat Jalan / Faktur</th><th>Jenis Barang & Tujuan</th><th class="right">Banyak</th><th>Satuan</th><th class="right">Harga</th><th class="right">Jumlah</th></tr></thead><tbody>${fallbackRows}</tbody></table>`}
      ${shipmentRows ? `<div class="box" style="margin-top:14px;line-height:1.8"><b>Ongkos/Kg</b> : ${money(weightRows[0]?.ratePerKg || invoice.ratePerKg || 0)}<br><b>Perhitungan</b> : ${num(weightRows.reduce((sum,row)=>sum+row.billableKg,0))} kg × ${money(weightRows[0]?.ratePerKg || invoice.ratePerKg || 0)}<br><span class="muted">Susut fisik ${num(totalPhysicalLossKg)} kg · jatah toleransi ${num(totalToleranceKg)} kg (${num(invoice.tolerancePercent || 0)}%) · susut yang diklaim ${num(totalClaimableLossKg)} kg</span><br><span class="muted">KG ditagih = KG kirim − susut yang melebihi toleransi.</span></div>` : ""}
      <table style="width:42%;margin-left:auto"><tbody><tr><td>Subtotal</td><td class="right"><b>${money(invoice.subtotal)}</b></td></tr>${invoice.tax ? `<tr><td>Pajak</td><td class="right">${money(invoice.tax)}</td></tr>` : ""}${invoice.discount ? `<tr><td>Diskon</td><td class="right">-${money(invoice.discount)}</td></tr>` : ""}<tr><td><b>TOTAL TAGIHAN</b></td><td class="right"><b>${money(invoice.total)}</b></td></tr></tbody></table>
      ${invoice.notes ? `<div class="box" style="margin-top:14px"><span class="muted">Catatan</span><br>${esc(invoice.notes)}</div>` : ""}
      <div class="signatures"><div>Pelanggan</div><div>Dibuat oleh</div><div>CV. Mitra Setia</div></div>${evidenceHtml}${deliveryEvidenceHtml}`;
    res.type("html").send(documentHtml({ title: "TAGIHAN ONGKOS ANGKUT", subtitle: invoice.number, meta: `Tanggal invoice: ${esc(date(invoice.issuedAt))}<br>Customer: ${esc(invoice.customerName)}`, body, landscape: Boolean(materialRows && !shipmentRows) }));
  } catch (error) {
    res.status(400).send(error.message || "Gagal membuat dokumen invoice");
  }
});

function statusLabelForPrint(status) {
  return ({ DRAFT: "Draft", SENT: "Terkirim", PARTIALLY_PAID: "Dibayar sebagian", PAID: "Lunas", VOID: "Dibatalkan" })[status] || status;
}

router.patch("/invoices/:id/send", async (req, res) => {
  try {
    const current = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      select: { id: true, number: true, status: true, total: true },
    });
    if (!current || current.status !== "DRAFT") return res.status(400).json({ error: "Hanya invoice draft yang dapat dikirim" });
    if (current.total <= 0) return res.status(400).json({ error: "Lengkapi harga di Detail Invoice sebelum mengirim" });
    const invoiceId = await prisma.$transaction(async tx => {
      const updated = await tx.invoice.update({
        where: { id: current.id },
        data: { status: "SENT", sentAt: new Date() },
        select: { id: true, number: true, total: true, sentAt: true },
      });
      await postJournal(tx, { date: updated.sentAt, description: `Invoice ${updated.number}`, sourceType: "CUSTOMER_INVOICE", sourceId: updated.id, createdById: req.user.id, lines: [{ code: SYSTEM_ACCOUNTS.AR, debit: updated.total }, { code: SYSTEM_ACCOUNTS.REVENUE, credit: updated.total }] });
      return updated.id;
    });
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
    if (!invoice) throw new Error("Invoice berhasil dikirim tetapi gagal dimuat kembali");
    res.json({ ok: true, invoice: summarize(invoice) });
  } catch (error) { res.status(400).json({ error: error.message || "Gagal mengirim invoice" }); }
});

router.post("/invoices/:id/payments", async (req, res) => {
  try {
    const paymentAmount = amount(req.body.amount, "Pembayaran");
    if (paymentAmount <= 0) throw new Error("Pembayaran harus lebih dari nol");
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: req.params.id }, include: { payments: true } });
      if (!invoice || !["SENT", "PARTIALLY_PAID"].includes(invoice.status)) throw new Error("Invoice belum dikirim atau sudah ditutup");
      const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const balance = invoice.total - paid;
      if (paymentAmount > balance) throw new Error("Pembayaran melebihi sisa piutang");
      const number = await nextNumber(tx, "receivablePayment", "RCV");
      const payment = await tx.receivablePayment.create({ data: {
        number, invoiceId: invoice.id, amount: paymentAmount, method: req.body.method || "BANK_TRANSFER",
        reference: req.body.reference?.trim() || null, notes: req.body.notes?.trim() || null,
        receivedAt: req.body.receivedAt ? new Date(req.body.receivedAt) : new Date(), createdById: req.user.id,
      } });
      await postJournal(tx, { date: payment.receivedAt, description: `Penerimaan ${payment.number}`, sourceType: "CUSTOMER_PAYMENT", sourceId: payment.id, createdById: req.user.id, lines: [{ code: cashCode(payment.method), debit: payment.amount }, { code: SYSTEM_ACCOUNTS.AR, credit: payment.amount }] });
      const fullyPaid = paymentAmount === balance;
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: fullyPaid ? "PAID" : "PARTIALLY_PAID", paidAt: fullyPaid ? new Date() : null } });
      return payment;
    });
    res.status(201).json({ ok: true, payment: result });
  } catch (error) { res.status(400).json({ error: error.message || "Gagal mencatat pembayaran" }); }
});

router.patch("/invoices/:id/void", requireRole("OWNER", "ADMIN"), async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { payments: true } });
    if (!invoice || invoice.payments.length) return res.status(400).json({ error: "Invoice dengan pembayaran tidak dapat dibatalkan" });
    const updated = await prisma.$transaction(async tx => {
      const result = await tx.invoice.update({ where: { id: invoice.id }, data: { status: "VOID", billingKey: `VOID:${invoice.id}:${invoice.billingKey}`, singleTripId: null } });
      await tx.materialInvoice.updateMany({ where: { billedInvoiceId: invoice.id }, data: { billedInvoiceId: null } });
      if (invoice.status !== "DRAFT") await postJournal(tx, { date: new Date(), description: `Pembatalan invoice ${invoice.number}`, sourceType: "CUSTOMER_INVOICE_VOID", sourceId: invoice.id, createdById: req.user.id, lines: [{ code: SYSTEM_ACCOUNTS.REVENUE, debit: invoice.total }, { code: SYSTEM_ACCOUNTS.AR, credit: invoice.total }] });
      return result;
    });
    res.json({ ok: true, invoice: updated });
  } catch (error) { res.status(400).json({ error: error.message || "Gagal membatalkan invoice" }); }
});

module.exports = router;
