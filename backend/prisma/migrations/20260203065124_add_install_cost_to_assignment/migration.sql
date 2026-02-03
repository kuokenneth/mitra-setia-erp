-- AlterTable
ALTER TABLE "public"."StockUnit" ADD COLUMN     "currency" TEXT DEFAULT 'IDR';

-- AlterTable
ALTER TABLE "public"."TruckSparePartAssignment" ADD COLUMN     "currency" TEXT DEFAULT 'IDR',
ADD COLUMN     "installCost" INTEGER;
