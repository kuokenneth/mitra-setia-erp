ALTER TABLE "StoredFile" ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'DATABASE';
ALTER TABLE "StoredFile" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "StoredFile" ALTER COLUMN "data" DROP NOT NULL;

CREATE UNIQUE INDEX "StoredFile_storageKey_key" ON "StoredFile"("storageKey");
CREATE INDEX "StoredFile_storageProvider_idx" ON "StoredFile"("storageProvider");
