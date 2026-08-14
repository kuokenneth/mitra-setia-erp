-- Existing orders remain valid without a creator; all newly created orders
-- receive createdById from the authenticated user in the API.
ALTER TABLE "Order" ADD COLUMN "createdById" TEXT;

CREATE INDEX "Order_createdById_idx" ON "Order"("createdById");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
