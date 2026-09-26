ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'EMPLOYEE_RECEIVABLE';

ALTER TABLE "Expense" ADD COLUMN "employeeId" TEXT;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Expense_employeeId_idx" ON "Expense"("employeeId");
