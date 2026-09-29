CREATE TABLE "PurchaseRequestDamageProof" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "size" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseRequestDamageProof_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseRequestDamageProof_requestId_idx" ON "PurchaseRequestDamageProof"("requestId");

ALTER TABLE "PurchaseRequestDamageProof"
ADD CONSTRAINT "PurchaseRequestDamageProof_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
