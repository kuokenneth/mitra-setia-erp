ALTER TABLE "MaterialInvoice" ADD COLUMN "billingCustomerId" TEXT;

UPDATE "MaterialInvoice"
SET "billingCustomerId" = (
  SELECT "Customer"."id"
  FROM "Customer"
  WHERE LOWER(TRIM("Customer"."name")) = LOWER(TRIM("MaterialInvoice"."billingCustomerName"))
  ORDER BY "Customer"."createdAt" ASC
  LIMIT 1
)
WHERE "billingCustomerName" IS NOT NULL;

CREATE INDEX "MaterialInvoice_billingCustomerId_idx" ON "MaterialInvoice"("billingCustomerId");

ALTER TABLE "MaterialInvoice"
ADD CONSTRAINT "MaterialInvoice_billingCustomerId_fkey"
FOREIGN KEY ("billingCustomerId") REFERENCES "Customer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
