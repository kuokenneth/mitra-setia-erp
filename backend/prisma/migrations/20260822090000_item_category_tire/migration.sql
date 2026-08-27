CREATE TYPE "ItemCategory" AS ENUM ('GENERAL_SPAREPART', 'TIRE', 'BATTERY', 'OTHER');

ALTER TABLE "Item"
  ADD COLUMN "category" "ItemCategory" NOT NULL DEFAULT 'GENERAL_SPAREPART';

CREATE INDEX "Item_category_idx" ON "Item"("category");
