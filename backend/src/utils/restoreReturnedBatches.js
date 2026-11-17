// Restore FIFO provenance instead of creating an unrelated receipt batch.
// alreadyReturned includes earlier returns/repair dispatches from the same OUT.
async function restoreReturnedBatches(tx, movement, qty, alreadyReturned = 0) {
  const allocations = await tx.stockMovementBatchAllocation.findMany({ where: { movementId: movement.id }, include: { batch: true }, orderBy: { id: 'asc' } });
  let skip = alreadyReturned, remaining = qty;
  const restored = [];
  for (const allocation of allocations) {
    const omitted = Math.min(skip, allocation.qty); skip -= omitted;
    const take = Math.min(remaining, allocation.qty - omitted);
    if (take <= 0) continue;
    if (allocation.batch.itemId !== movement.itemId || allocation.batch.locationId !== movement.fromLocationId) throw new Error('Batch asal pengembalian tidak sesuai lokasi/item');
    const updated = await tx.inventoryBatch.updateMany({ where: { id: allocation.batchId, remainingQty: { lte: allocation.batch.receivedQty - take } }, data: { remainingQty: { increment: take } } });
    if (updated.count !== 1) throw new Error('Saldo batch asal berubah. Muat ulang servis.');
    restored.push({ batchId: allocation.batchId, qty: take }); remaining -= take;
    if (remaining <= 0.000001) break;
  }
  // Legacy usage without recorded FIFO allocations retains its existing fallback.
  if (remaining > 0.000001) {
    const batch = await tx.inventoryBatch.create({ data: { itemId: movement.itemId, locationId: movement.fromLocationId, receivedQty: remaining, remainingQty: remaining, unitPrice: movement.unitPrice, receivedAt: new Date() } });
    restored.push({ batchId: batch.id, qty: remaining });
  }
  return restored;
}
module.exports = { restoreReturnedBatches };
