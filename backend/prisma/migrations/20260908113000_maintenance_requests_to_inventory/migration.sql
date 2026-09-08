UPDATE "PurchaseRequest"
SET "directUse" = false,
    "purpose" = 'MAINTENANCE_STOCK_REQUEST'
WHERE "maintenanceId" IS NOT NULL;
