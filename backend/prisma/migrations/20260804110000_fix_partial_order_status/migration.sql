-- Reopen orders that were incorrectly completed while their delivered quantity
-- was still below the contracted/order quantity.
UPDATE "Order" AS o
SET "status" = 'IN_PROGRESS'
WHERE o."status" = 'COMPLETED'
  AND o."qty" IS NOT NULL
  AND COALESCE(
    (
      SELECT SUM(COALESCE(t."qtyActual", t."qtyPlanned", 0))
      FROM "Trip" AS t
      WHERE t."orderId" = o."id"
        AND t."status" = 'COMPLETED'
    ),
    0
  ) < o."qty";
