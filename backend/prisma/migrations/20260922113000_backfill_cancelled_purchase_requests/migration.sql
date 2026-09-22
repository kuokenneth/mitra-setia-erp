-- Synchronize historical purchase requests whose linked purchase orders were
-- cancelled before request cancellation propagation was introduced.
UPDATE "PurchaseRequest" AS request
SET
  "status" = 'CANCELLED',
  "approvalNotes" = COALESCE(cancelled_order."cancellationReason", request."approvalNotes"),
  "approvedAt" = COALESCE(cancelled_order."cancelledAt", request."approvedAt"),
  "approvedById" = COALESCE(cancelled_order."cancelledById", request."approvedById")
FROM "PurchaseOrder" AS cancelled_order
WHERE cancelled_order."requestId" = request."id"
  AND cancelled_order."status" = 'CANCELLED'
  AND request."status" <> 'CANCELLED'
  AND NOT EXISTS (
    SELECT 1
    FROM "PurchaseOrder" AS active_order
    WHERE active_order."requestId" = request."id"
      AND active_order."status" <> 'CANCELLED'
  );
