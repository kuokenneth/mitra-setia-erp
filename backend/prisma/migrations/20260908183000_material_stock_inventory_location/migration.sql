ALTER TABLE "MaterialStockReceipt" DROP CONSTRAINT "MaterialStockReceipt_locationId_fkey";

INSERT INTO "InventoryLocation" ("id", "name", "createdAt")
SELECT 'matloc_' || md5(location."id"), location."name", CURRENT_TIMESTAMP
FROM "OperationalLocation" location
WHERE EXISTS (
  SELECT 1 FROM "MaterialStockReceipt" stock WHERE stock."locationId" = location."id"
)
ON CONFLICT ("name") DO NOTHING;

UPDATE "MaterialStockReceipt" stock
SET "locationId" = inventory."id"
FROM "OperationalLocation" operational
JOIN "InventoryLocation" inventory ON inventory."name" = operational."name"
WHERE stock."locationId" = operational."id";

ALTER TABLE "MaterialStockReceipt"
ADD CONSTRAINT "MaterialStockReceipt_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
