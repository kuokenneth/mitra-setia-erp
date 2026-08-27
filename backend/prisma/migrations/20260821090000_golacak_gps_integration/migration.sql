ALTER TABLE "Truck"
  ADD COLUMN "gpsDeviceId" TEXT,
  ADD COLUMN "gpsImei" TEXT,
  ADD COLUMN "lastGpsLatitude" DOUBLE PRECISION,
  ADD COLUMN "lastGpsLongitude" DOUBLE PRECISION,
  ADD COLUMN "lastGpsSpeed" DOUBLE PRECISION,
  ADD COLUMN "lastGpsAt" TIMESTAMP(3);

ALTER TABLE "Trip"
  ADD COLUMN "destinationLat" DOUBLE PRECISION,
  ADD COLUMN "destinationLng" DOUBLE PRECISION,
  ADD COLUMN "arrivalRadiusM" INTEGER NOT NULL DEFAULT 400,
  ADD COLUMN "gpsArrivalCandidateAt" TIMESTAMP(3);

CREATE TABLE "GpsEvent" (
  "id" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'GOLACAK',
  "eventType" TEXT,
  "deviceId" TEXT,
  "imei" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "speed" DOUBLE PRECISION,
  "eventAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "raw" JSONB NOT NULL,
  "truckId" TEXT,
  CONSTRAINT "GpsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Truck_gpsDeviceId_key" ON "Truck"("gpsDeviceId");
CREATE UNIQUE INDEX "Truck_gpsImei_key" ON "Truck"("gpsImei");
CREATE UNIQUE INDEX "GpsEvent_fingerprint_key" ON "GpsEvent"("fingerprint");
CREATE INDEX "GpsEvent_deviceId_idx" ON "GpsEvent"("deviceId");
CREATE INDEX "GpsEvent_imei_idx" ON "GpsEvent"("imei");
CREATE INDEX "GpsEvent_truckId_idx" ON "GpsEvent"("truckId");
CREATE INDEX "GpsEvent_eventAt_idx" ON "GpsEvent"("eventAt");
CREATE INDEX "GpsEvent_receivedAt_idx" ON "GpsEvent"("receivedAt");
ALTER TABLE "GpsEvent" ADD CONSTRAINT "GpsEvent_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
