-- Reformat Order numbers as ORD-YYYY-DD/MM-NNNN.
-- The sequence restarts for each calendar date in Asia/Jakarta.
WITH numbered AS (
  SELECT
    "id",
    "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta' AS local_created_at,
    ROW_NUMBER() OVER (
      PARTITION BY DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS sequence
  FROM "Order"
)
UPDATE "Order" target
SET "orderNo" =
  'ORD-' || TO_CHAR(numbered.local_created_at, 'YYYY-DD/MM-') ||
  LPAD(numbered.sequence::TEXT, 4, '0')
FROM numbered
WHERE target."id" = numbered."id";
