ALTER TABLE "Trip" ADD COLUMN "tripNo" TEXT;

WITH numbered AS (
  SELECT
    "id",
    EXTRACT(YEAR FROM "createdAt")::INTEGER AS year,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM "createdAt")
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS sequence
  FROM "Trip"
  WHERE "purpose" = 'SINGLE_TRIP'
)
UPDATE "Trip" trip
SET "tripNo" = 'TRIP-' || numbered.year || '-' || LPAD(numbered.sequence::TEXT, 4, '0')
FROM numbered
WHERE trip."id" = numbered."id";

CREATE UNIQUE INDEX "Trip_tripNo_key" ON "Trip"("tripNo");
CREATE INDEX "Trip_tripNo_idx" ON "Trip"("tripNo");
