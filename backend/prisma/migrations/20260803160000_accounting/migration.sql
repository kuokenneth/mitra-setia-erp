CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "JournalStatus" AS ENUM ('POSTED', 'VOID');
CREATE TABLE "Account" ("id" TEXT NOT NULL,"code" TEXT NOT NULL,"name" TEXT NOT NULL,"type" "AccountType" NOT NULL,"isActive" BOOLEAN NOT NULL DEFAULT true,"isSystem" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "Account_pkey" PRIMARY KEY ("id"));
CREATE TABLE "JournalEntry" ("id" TEXT NOT NULL,"number" TEXT NOT NULL,"date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"description" TEXT NOT NULL,"sourceType" TEXT,"sourceId" TEXT,"status" "JournalStatus" NOT NULL DEFAULT 'POSTED',"createdById" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id"));
CREATE TABLE "JournalLine" ("id" TEXT NOT NULL,"entryId" TEXT NOT NULL,"accountId" TEXT NOT NULL,"description" TEXT,"debit" INTEGER NOT NULL DEFAULT 0,"credit" INTEGER NOT NULL DEFAULT 0,CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Account_code_key" ON "Account"("code");
CREATE INDEX "Account_type_idx" ON "Account"("type");
CREATE UNIQUE INDEX "JournalEntry_number_key" ON "JournalEntry"("number");
CREATE UNIQUE INDEX "JournalEntry_sourceType_sourceId_key" ON "JournalEntry"("sourceType","sourceId");
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");
CREATE INDEX "JournalEntry_status_idx" ON "JournalEntry"("status");
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "Account" ("id","code","name","type","isActive","isSystem","createdAt") VALUES
('sys-cash','1001','Kas','ASSET',true,true,CURRENT_TIMESTAMP),('sys-bank','1002','Bank','ASSET',true,true,CURRENT_TIMESTAMP),('sys-ar','1101','Piutang Usaha','ASSET',true,true,CURRENT_TIMESTAMP),('sys-inventory','1201','Persediaan Sparepart','ASSET',true,true,CURRENT_TIMESTAMP),('sys-ap','2001','Utang Usaha','LIABILITY',true,true,CURRENT_TIMESTAMP),('sys-equity','3001','Modal Pemilik','EQUITY',true,true,CURRENT_TIMESTAMP),('sys-revenue','4001','Pendapatan Transportasi','REVENUE',true,true,CURRENT_TIMESTAMP),('sys-expense','5001','Beban Operasional','EXPENSE',true,true,CURRENT_TIMESTAMP);
