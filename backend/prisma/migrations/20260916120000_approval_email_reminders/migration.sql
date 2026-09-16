ALTER TABLE "PurchaseRequest" ADD COLUMN "approvalReminderSentAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "approvalReminderSentAt" TIMESTAMP(3);
