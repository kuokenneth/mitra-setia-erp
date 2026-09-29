CREATE TABLE "DispatchDocument" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "city" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pdfUrl" TEXT,
  "recipientName" TEXT,
  "cargoName" TEXT,
  "driverName" TEXT,
  "plateNumber" TEXT,
  "loadDateText" TEXT,
  "destination" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DispatchDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DispatchDocument_number_key" ON "DispatchDocument"("number");
CREATE UNIQUE INDEX "DispatchDocument_sourceType_sourceId_key" ON "DispatchDocument"("sourceType", "sourceId");
CREATE INDEX "DispatchDocument_tripId_idx" ON "DispatchDocument"("tripId");
ALTER TABLE "DispatchDocument" ADD CONSTRAINT "DispatchDocument_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
