-- Reformat Single Trip numbers as TRIP-YYYY-DD/MM-NNNN.
-- The sequence restarts for each calendar date.
WITH numbered AS (
  SELECT
    "id",
    "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta' AS local_created_at,
    ROW_NUMBER() OVER (
      PARTITION BY DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS sequence
  FROM "Trip"
  WHERE "purpose" = 'SINGLE_TRIP'
)
UPDATE "Trip" trip
SET "tripNo" =
  'TRIP-' || TO_CHAR(numbered.local_created_at, 'YYYY-DD/MM-') ||
  LPAD(numbered.sequence::TEXT, 4, '0')
FROM numbered
WHERE trip."id" = numbered."id";
