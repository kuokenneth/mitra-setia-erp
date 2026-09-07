-- Repair schema drift: the oil tracking migration is recorded in some
-- environments although these nullable costing columns are absent.
ALTER TABLE "StockMovement"
  ADD COLUMN IF NOT EXISTS "unitPrice" INTEGER,
  ADD COLUMN IF NOT EXISTS "totalCost" INTEGER;
