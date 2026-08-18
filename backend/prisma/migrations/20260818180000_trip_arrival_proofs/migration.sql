CREATE TABLE "TripArrivalProof" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "size" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripArrivalProof_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TripArrivalProof_tripId_idx" ON "TripArrivalProof"("tripId");
ALTER TABLE "TripArrivalProof" ADD CONSTRAINT "TripArrivalProof_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
