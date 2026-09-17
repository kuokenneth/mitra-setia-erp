-- Give service jobs a stable daily document number. Existing document numbers
-- in other tables are intentionally preserved; only newly-created documents
-- use the standardized daily format.
ALTER TABLE "TruckMaintenance" ADD COLUMN "number" TEXT;

WITH numbered AS (
  SELECT
    id,
    "createdAt",
    ROW_NUMBER() OVER (
      PARTITION BY DATE("createdAt" AT TIME ZONE 'Asia/Jakarta')
      ORDER BY "createdAt", id
    ) AS sequence
  FROM "TruckMaintenance"
)
UPDATE "TruckMaintenance" AS maintenance
SET "number" =
  'SRV-' || TO_CHAR(numbered."createdAt" AT TIME ZONE 'Asia/Jakarta', 'YYYY-DD/MM-') ||
  LPAD(numbered.sequence::TEXT, 4, '0')
FROM numbered
WHERE maintenance.id = numbered.id;

ALTER TABLE "TruckMaintenance" ALTER COLUMN "number" SET NOT NULL;
CREATE UNIQUE INDEX "TruckMaintenance_number_key" ON "TruckMaintenance"("number");
