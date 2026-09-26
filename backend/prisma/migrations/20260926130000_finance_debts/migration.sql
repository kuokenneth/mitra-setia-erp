ALTER TYPE "ExpenseCategory" ADD VALUE 'FINANCE_DEBT_PAYMENT';

CREATE TABLE "FinanceDebt" (
  "id" TEXT NOT NULL,
  "leasingName" TEXT NOT NULL,
  "contractNumber" TEXT,
  "truckId" TEXT,
  "originalAmount" INTEGER NOT NULL,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceDebt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Expense" ADD COLUMN "financeDebtId" TEXT;
CREATE INDEX "FinanceDebt_truckId_idx" ON "FinanceDebt"("truckId");
CREATE INDEX "FinanceDebt_leasingName_idx" ON "FinanceDebt"("leasingName");
CREATE INDEX "FinanceDebt_isActive_idx" ON "FinanceDebt"("isActive");
CREATE INDEX "Expense_financeDebtId_idx" ON "Expense"("financeDebtId");
ALTER TABLE "FinanceDebt" ADD CONSTRAINT "FinanceDebt_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceDebt" ADD CONSTRAINT "FinanceDebt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_financeDebtId_fkey" FOREIGN KEY ("financeDebtId") REFERENCES "FinanceDebt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "Account" ("id", "code", "name", "type", "isActive", "isSystem", "createdAt") VALUES ('sys-finance-ap', '2101', 'Utang Finance', 'LIABILITY', true, true, CURRENT_TIMESTAMP);
