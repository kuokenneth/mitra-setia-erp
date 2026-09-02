ALTER TABLE "Invoice"
ADD COLUMN "contractSubtotal" INTEGER,
ADD COLUMN "plannedQuantity" DOUBLE PRECISION,
ADD COLUMN "deliveredQuantity" DOUBLE PRECISION,
ADD COLUMN "cargoLossQuantity" DOUBLE PRECISION,
ADD COLUMN "cargoLossAmount" INTEGER;
