ALTER TABLE "Trip" ADD COLUMN "billingCustomerId" TEXT;
CREATE INDEX "Trip_billingCustomerId_idx" ON "Trip"("billingCustomerId");
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_billingCustomerId_fkey" FOREIGN KEY ("billingCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
