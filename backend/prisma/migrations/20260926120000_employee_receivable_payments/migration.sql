CREATE TABLE "EmployeeReceivablePayment" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "method" "ReceivablePaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
  "reference" TEXT,
  "notes" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeReceivablePayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeReceivablePayment_number_key" ON "EmployeeReceivablePayment"("number");
CREATE INDEX "EmployeeReceivablePayment_employeeId_idx" ON "EmployeeReceivablePayment"("employeeId");
CREATE INDEX "EmployeeReceivablePayment_receivedAt_idx" ON "EmployeeReceivablePayment"("receivedAt");
ALTER TABLE "EmployeeReceivablePayment" ADD CONSTRAINT "EmployeeReceivablePayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeReceivablePayment" ADD CONSTRAINT "EmployeeReceivablePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
