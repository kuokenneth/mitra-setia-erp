-- Keep the business transaction date separate from the immutable creation timestamp.
ALTER TABLE "Expense" ADD COLUMN "expenseDate" TIMESTAMP(3);

UPDATE "Expense" SET "expenseDate" = "createdAt";

ALTER TABLE "Expense" ALTER COLUMN "expenseDate" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "expenseDate" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");
