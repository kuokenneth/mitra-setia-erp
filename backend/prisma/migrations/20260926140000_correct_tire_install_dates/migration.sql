UPDATE "TruckSparePartAssignment"
SET "installedAt" = DATE '2026-08-22' + "installedAt"::time
WHERE "stockUnitId" IN (
  SELECT "id"
  FROM "StockUnit"
  WHERE "serialNumber" IN ('2660108349', '2660108323')
);

UPDATE "StockMovement"
SET "createdAt" = DATE '2026-08-22' + "createdAt"::time
WHERE "stockUnitId" IN (
  SELECT "id"
  FROM "StockUnit"
  WHERE "serialNumber" IN ('2660108349', '2660108323')
)
AND "note" LIKE 'Migrasi ban lama terpasang%';
