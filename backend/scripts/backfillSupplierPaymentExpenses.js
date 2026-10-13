const { prisma } = require("../src/prisma");

async function main() {
  const created = await prisma.$transaction(async (tx) => {
    const payments = await tx.purchasePayment.findMany({
      where: { status: "PAID", supplierBillId: { not: null } },
      include: { supplierBill: { include: { supplier: true } } },
    });
    let count = 0;
    for (const payment of payments) {
      const marker = `AUTO_SUPPLIER_PAYMENT:${payment.id}`;
      if (await tx.expense.findFirst({ where: { notes: marker }, select: { id: true } })) continue;
      const links = await tx.supplierBillReceipt.findMany({
        where: { billId: payment.supplierBillId },
        include: {
          receipt: {
            include: {
              purchaseOrder: {
                include: { request: { include: { maintenance: true } } },
              },
            },
          },
        },
      });
      const truckIds = [...new Set(links.map((link) => {
        const request = link.receipt.purchaseOrder.request;
        return request?.maintenance?.truckId || (request?.purpose === "TRUCK" ? request.truckId : null);
      }).filter(Boolean))];
      const bill = payment.supplierBill;
      await tx.expense.create({
        data: {
          status: "APPROVED",
          paymentMethod: ["BANK_TRANSFER", "CASH", "OTHER"].includes(payment.method) ? payment.method : "OTHER",
          amount: payment.amount,
          currency: "IDR",
          category: "SPAREPART",
          reason: `Pembayaran sparepart ${bill.supplier?.name || "supplier"} · ${bill.invoiceNumber}`,
          clientName: bill.supplier?.name || null,
          notes: marker,
          truckId: truckIds.length === 1 ? truckIds[0] : null,
          proofUrl: payment.proofUrl,
          proofFileName: payment.proofFileName,
          proofMimeType: payment.proofMimeType,
          proofSize: payment.proofSize,
          paidAt: payment.paidAt || payment.approvedAt || payment.createdAt,
          proofUploadedById: payment.createdById,
          createdById: payment.createdById,
          approvedById: payment.approvedById,
          approvedAt: payment.approvedAt || payment.paidAt || payment.createdAt,
          expenseDate: payment.paidAt || payment.approvedAt || payment.createdAt,
        },
      });
      count += 1;
    }
    return count;
  }, { timeout: 30_000 });
  console.log(JSON.stringify({ created }));
}

main().finally(() => prisma.$disconnect());
