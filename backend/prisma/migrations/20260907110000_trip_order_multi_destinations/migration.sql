ALTER TABLE "TripOrderAllocation"
  ADD COLUMN "stopSequence" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "destinationArrivedAt" TIMESTAMP(3),
  ADD COLUMN "destinationCompletedAt" TIMESTAMP(3);

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "tripId"
    ORDER BY "isPrimary" DESC, "createdAt" ASC
  ) AS sequence
  FROM "TripOrderAllocation"
)
UPDATE "TripOrderAllocation" allocation
SET "stopSequence" = ranked.sequence
FROM ranked
WHERE allocation."id" = ranked."id";

CREATE INDEX "TripOrderAllocation_tripId_stopSequence_idx"
ON "TripOrderAllocation"("tripId", "stopSequence");
