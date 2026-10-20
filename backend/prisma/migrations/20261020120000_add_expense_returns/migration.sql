CREATE TABLE "ExpenseReturn" (
    "id" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" "ExpensePaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "truckId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseReturn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExpenseReturn_truckId_idx" ON "ExpenseReturn"("truckId");
CREATE INDEX "ExpenseReturn_returnDate_idx" ON "ExpenseReturn"("returnDate");
ALTER TABLE "ExpenseReturn" ADD CONSTRAINT "ExpenseReturn_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseReturn" ADD CONSTRAINT "ExpenseReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
