ALTER TABLE "Truck"
ADD COLUMN "capacityTons" DOUBLE PRECISION NOT NULL DEFAULT 30;

ALTER TABLE "Invoice"
ADD COLUMN "materialSubtotal" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "TripOrderAllocation" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "qtyPlanned" DOUBLE PRECISION,
    "qtyActual" DOUBLE PRECISION,
    "unitSnap" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TripOrderAllocation_pkey" PRIMARY KEY ("id")
);

INSERT INTO "TripOrderAllocation" (
    "id", "tripId", "orderId", "qtyPlanned", "qtyActual", "unitSnap", "isPrimary", "createdAt", "updatedAt"
)
SELECT
    'legacy-' || "id", "id", "orderId", "qtyPlanned", "qtyActual", "unitSnap", true, "createdAt", "updatedAt"
FROM "Trip"
WHERE "orderId" IS NOT NULL;

CREATE UNIQUE INDEX "TripOrderAllocation_tripId_orderId_key" ON "TripOrderAllocation"("tripId", "orderId");
CREATE INDEX "TripOrderAllocation_tripId_idx" ON "TripOrderAllocation"("tripId");
CREATE INDEX "TripOrderAllocation_orderId_idx" ON "TripOrderAllocation"("orderId");

ALTER TABLE "TripOrderAllocation"
ADD CONSTRAINT "TripOrderAllocation_tripId_fkey"
FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TripOrderAllocation"
ADD CONSTRAINT "TripOrderAllocation_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
