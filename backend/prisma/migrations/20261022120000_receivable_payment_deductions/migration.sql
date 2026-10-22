ALTER TABLE "ReceivablePayment"
ADD COLUMN "pph23Amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "claimAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "adminFee" INTEGER NOT NULL DEFAULT 0;

INSERT INTO "Account" ("id", "code", "name", "type", "isSystem", "isActive", "createdAt")
VALUES ('sys-withholding-tax', '1102', 'PPh 23 Dibayar di Muka', 'ASSET', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
