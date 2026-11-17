// Preserve original receipt and bill quantities; allocate each return to the
// unbilled portion first, then reverse the remaining supplier bill lines.
function planReturn(item, qty) {
  if (item.condition === "RETURNED_TO_SUPPLIER") throw new Error("Barang sudah diretur ke supplier");
  const available = Number(item.qty) - Number(item.returnedQty || 0);
  if (!Number.isFinite(qty) || qty <= 0 || qty > available + 1e-8) throw new Error("Jumlah retur melebihi sisa penerimaan");
  const bills = item.supplierBillItems.filter(line => line.bill.status !== "VOID");
  const billed = bills.reduce((sum, line) => sum + Number(line.qty) - Number(line.returnedQty || 0), 0);
  let remaining = Math.max(0, qty - Math.max(0, available - billed));
  const adjustments = [];
  for (const line of bills) {
    const take = Math.min(remaining, Number(line.qty) - Number(line.returnedQty || 0));
    if (take <= 0) continue;
    const returnedQty = Number(line.returnedQty || 0) + take;
    // Cumulative rounding makes successive partial returns equal the original bill.
    const amount = Math.round(returnedQty * line.unitPrice) - Number(line.returnedAmount || 0);
    adjustments.push({ lineId: line.id, billId: line.billId, qty: take, amount });
    remaining -= take;
  }
  return adjustments;
}
module.exports = { planReturn };
