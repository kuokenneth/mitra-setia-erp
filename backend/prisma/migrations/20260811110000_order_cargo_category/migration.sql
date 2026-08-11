CREATE TYPE "CargoCategory" AS ENUM ('FERTILIZER', 'CANGKANG', 'MATERIAL');

ALTER TABLE "Order"
ADD COLUMN "cargoCategory" "CargoCategory" NOT NULL DEFAULT 'FERTILIZER';

UPDATE "Order"
SET "cargoCategory" = 'MATERIAL'
WHERE "qty" IS NULL OR "qty" <= 0;
