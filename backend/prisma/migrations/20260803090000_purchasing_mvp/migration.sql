CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED');
CREATE TYPE "PurchasePaymentStatus" AS ENUM ('UNPAID', 'WAITING_PAYMENT_APPROVAL', 'PARTIALLY_PAID', 'PAID');

CREATE TABLE "Supplier" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "phone" TEXT, "email" TEXT, "address" TEXT, "bankName" TEXT, "bankAccount" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id"));
CREATE TABLE "PurchaseRequest" ("id" TEXT NOT NULL, "number" TEXT NOT NULL, "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT', "urgency" TEXT NOT NULL DEFAULT 'NORMAL', "purpose" TEXT, "truckId" TEXT, "reason" TEXT NOT NULL, "notes" TEXT, "createdById" TEXT NOT NULL, "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "approvalNotes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id"));
CREATE TABLE "PurchaseRequestItem" ("id" TEXT NOT NULL, "requestId" TEXT NOT NULL, "itemId" TEXT NOT NULL, "originalQty" DOUBLE PRECISION NOT NULL, "approvedQty" DOUBLE PRECISION, "notes" TEXT, CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id"));
CREATE TABLE "PurchaseOrder" ("id" TEXT NOT NULL, "number" TEXT NOT NULL, "requestId" TEXT NOT NULL, "supplierId" TEXT NOT NULL, "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT', "tax" INTEGER NOT NULL DEFAULT 0, "shippingCost" INTEGER NOT NULL DEFAULT 0, "discount" INTEGER NOT NULL DEFAULT 0, "paymentTerms" TEXT, "deliveryAddress" TEXT, "estimatedArrival" TIMESTAMP(3), "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id"));
CREATE TABLE "PurchaseOrderItem" ("id" TEXT NOT NULL, "purchaseOrderId" TEXT NOT NULL, "itemId" TEXT NOT NULL, "qty" DOUBLE PRECISION NOT NULL, "unitPrice" INTEGER NOT NULL, "receivedQty" DOUBLE PRECISION NOT NULL DEFAULT 0, CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id"));
CREATE TABLE "GoodsReceipt" ("id" TEXT NOT NULL, "number" TEXT NOT NULL, "purchaseOrderId" TEXT NOT NULL, "locationId" TEXT NOT NULL, "deliveryNote" TEXT, "notes" TEXT, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdById" TEXT NOT NULL, CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id"));
CREATE TABLE "GoodsReceiptItem" ("id" TEXT NOT NULL, "receiptId" TEXT NOT NULL, "purchaseOrderItemId" TEXT NOT NULL, "qty" DOUBLE PRECISION NOT NULL, "condition" TEXT NOT NULL DEFAULT 'GOOD', CONSTRAINT "GoodsReceiptItem_pkey" PRIMARY KEY ("id"));
CREATE TABLE "PurchasePayment" ("id" TEXT NOT NULL, "number" TEXT NOT NULL, "purchaseOrderId" TEXT NOT NULL, "amount" INTEGER NOT NULL, "method" TEXT NOT NULL, "reference" TEXT, "status" "PurchasePaymentStatus" NOT NULL DEFAULT 'WAITING_PAYMENT_APPROVAL', "paidAt" TIMESTAMP(3), "createdById" TEXT NOT NULL, "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PurchasePayment_pkey" PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "PurchaseRequest_number_key" ON "PurchaseRequest"("number");
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");
CREATE UNIQUE INDEX "PurchaseOrder_number_key" ON "PurchaseOrder"("number");
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");
CREATE UNIQUE INDEX "GoodsReceipt_number_key" ON "GoodsReceipt"("number");
CREATE UNIQUE INDEX "PurchasePayment_number_key" ON "PurchasePayment"("number");

ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
