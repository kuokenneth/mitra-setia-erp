CREATE TABLE "OperationalLocation" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "type" TEXT NOT NULL DEFAULT 'OTHER',
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "radiusM" INTEGER NOT NULL DEFAULT 400,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationalLocation_name_key" ON "OperationalLocation"("name");
CREATE INDEX "OperationalLocation_isActive_idx" ON "OperationalLocation"("isActive");
CREATE INDEX "OperationalLocation_type_idx" ON "OperationalLocation"("type");
