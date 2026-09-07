-- A material invoice can originate directly from a Single Trip, without an Order.
ALTER TABLE "MaterialInvoice" ALTER COLUMN "orderId" DROP NOT NULL;
