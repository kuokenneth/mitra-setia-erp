-- Analitik Harga Sparepart (rebuild): configurable thresholds.
-- Additive only. The SQL view from the previous version is no longer used:
-- price history is now derived in the application from the same tables, so
-- the view is dropped (it holds no data of its own).
DROP VIEW IF EXISTS "SparepartPurchaseHistory";

CREATE TABLE IF NOT EXISTS "PriceAnalyticsSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "mildPct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "strongPct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "highPct" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "lookbackDays" INTEGER NOT NULL DEFAULT 180,
    "minTransactions" INTEGER NOT NULL DEFAULT 2,
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PriceAnalyticsSetting_pkey" PRIMARY KEY ("id")
);

