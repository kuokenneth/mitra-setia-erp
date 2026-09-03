ALTER TABLE "MaterialInvoice"
ADD COLUMN "billingCustomerName" TEXT;

UPDATE "MaterialInvoice" mi
SET "billingCustomerName" = COALESCE(c."name", o."customerName")
FROM "Order" o
LEFT JOIN "Customer" c ON c."id" = o."customerId"
WHERE mi."orderId" = o."id";
