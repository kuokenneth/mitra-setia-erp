-- Contact-only debtors for employee receivables. These people do not receive
-- login credentials and remain separate from application users.
CREATE TABLE "EmployeeReceivableParty" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeReceivableParty_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Expense" ADD COLUMN "employeePartyId" TEXT;
ALTER TABLE "EmployeeReceivablePayment" ALTER COLUMN "employeeId" DROP NOT NULL;
ALTER TABLE "EmployeeReceivablePayment" ADD COLUMN "employeePartyId" TEXT;

CREATE INDEX "EmployeeReceivableParty_name_idx" ON "EmployeeReceivableParty"("name");
CREATE INDEX "EmployeeReceivableParty_isActive_idx" ON "EmployeeReceivableParty"("isActive");
CREATE INDEX "EmployeeReceivableParty_createdById_idx" ON "EmployeeReceivableParty"("createdById");
CREATE INDEX "Expense_employeePartyId_idx" ON "Expense"("employeePartyId");
CREATE INDEX "EmployeeReceivablePayment_employeePartyId_idx" ON "EmployeeReceivablePayment"("employeePartyId");

ALTER TABLE "EmployeeReceivableParty" ADD CONSTRAINT "EmployeeReceivableParty_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_employeePartyId_fkey" FOREIGN KEY ("employeePartyId") REFERENCES "EmployeeReceivableParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeReceivablePayment" ADD CONSTRAINT "EmployeeReceivablePayment_employeePartyId_fkey" FOREIGN KEY ("employeePartyId") REFERENCES "EmployeeReceivableParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
