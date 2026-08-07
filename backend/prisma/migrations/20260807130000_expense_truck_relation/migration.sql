ALTER TABLE "Expense" ADD COLUMN "truckId" TEXT;

CREATE INDEX "Expense_truckId_idx" ON "Expense"("truckId");

ALTER TABLE "Expense"
ADD CONSTRAINT "Expense_truckId_fkey"
FOREIGN KEY ("truckId") REFERENCES "Truck"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
