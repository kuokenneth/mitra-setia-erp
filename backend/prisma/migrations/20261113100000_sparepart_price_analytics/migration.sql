ALTER TABLE "Item" ADD COLUMN "brand" TEXT, ADD COLUMN "partNumber" TEXT, ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "GoodsReceiptItem" ADD COLUMN "originalUnitPrice" INTEGER, ADD COLUMN "purchaseUnit" TEXT, ADD COLUMN "priceSource" TEXT, ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'IDR', ADD COLUMN "taxBasis" TEXT NOT NULL DEFAULT 'BEFORE_ORDER_ADJUSTMENTS';
-- Best available legacy evidence, never the mutable current PO line price.
UPDATE "GoodsReceiptItem" r SET "originalUnitPrice" = b."unitPrice", "priceSource" = 'LEGACY_BATCH', "purchaseUnit" = i.unit
FROM "InventoryBatch" b JOIN "Item" i ON i.id = b."itemId" WHERE b."goodsReceiptItemId" = r.id;
UPDATE "GoodsReceiptItem" r SET "purchaseUnit" = i.unit FROM "PurchaseOrderItem" p JOIN "Item" i ON i.id = p."itemId" WHERE p.id = r."purchaseOrderItemId" AND r."purchaseUnit" IS NULL;
CREATE INDEX "PurchaseOrderItem_itemId_purchaseOrderId_idx" ON "PurchaseOrderItem"("itemId", "purchaseOrderId");
CREATE INDEX "GoodsReceipt_receivedAt_purchaseOrderId_idx" ON "GoodsReceipt"("receivedAt", "purchaseOrderId");
CREATE INDEX "GoodsReceiptItem_purchaseOrderItemId_receiptId_idx" ON "GoodsReceiptItem"("purchaseOrderItemId", "receiptId");
-- One row per received line: invoices price only their allocated quantity, not an extra purchase.
CREATE VIEW "SparepartPurchaseHistory" AS
WITH billed AS (
 SELECT bi."receiptItemId", SUM(bi.qty::numeric) qty, SUM(bi.qty::numeric * bi."unitPrice") amount,
        jsonb_agg(jsonb_build_object('id', b.id, 'number', b.number, 'invoiceNumber', b."invoiceNumber", 'qty', bi.qty, 'unitPrice', bi."unitPrice", 'proofUrl', b."proofUrl", 'proofFileName', b."proofFileName", 'proofMimeType', b."proofMimeType") ORDER BY b."invoiceDate", bi.id) invoices
 FROM "SupplierBillItem" bi JOIN "SupplierBill" b ON b.id = bi."billId"
 WHERE b.status <> 'VOID' GROUP BY bi."receiptItemId"
), base AS (
 SELECT r.id, i.id "itemId", i.name, i.sku, i.brand, i."partNumber", i.aliases, i.category::text category,
 COALESCE(r."purchaseUnit", i.unit) unit, r.currency, r."taxBasis", g."receivedAt" date,
 s.id "supplierId", s.name "supplierName", p.id "poId", p.number "poNumber", g.id "receiptId", g.number "receiptNumber", g."deliveryNote", g."deliveryNoteProofUrl" "receiptProofUrl", g."deliveryNoteFileName" "receiptProofFileName", g."deliveryNoteMimeType" "receiptProofMimeType",
 r.qty::numeric qty, COALESCE(b.invoices, '[]'::jsonb) invoices,
 CASE WHEN COALESCE(b.qty,0) > r.qty::numeric + 0.000001 THEN NULL
      WHEN COALESCE(b.qty,0) >= r.qty::numeric - 0.000001 THEN b.amount / NULLIF(b.qty,0)
      WHEN r."originalUnitPrice" > 0 THEN (COALESCE(b.amount,0) + (r.qty::numeric-COALESCE(b.qty,0))*r."originalUnitPrice") / NULLIF(r.qty::numeric,0)
 END "unitPrice",
 CASE WHEN COALESCE(b.qty,0) >= r.qty::numeric - 0.000001 THEN 'INVOICE' ELSE COALESCE(r."priceSource", 'MISSING') END "priceSource"
 FROM "GoodsReceiptItem" r JOIN "GoodsReceipt" g ON g.id=r."receiptId"
 JOIN "PurchaseOrderItem" pi ON pi.id=r."purchaseOrderItemId"
 JOIN "PurchaseOrder" p ON p.id=g."purchaseOrderId" JOIN "Item" i ON i.id=pi."itemId"
 JOIN "Supplier" s ON s.id=p."supplierId" LEFT JOIN billed b ON b."receiptItemId"=r.id
 WHERE p.status IN ('PARTIALLY_RECEIVED','FULLY_RECEIVED') AND p."cancelledAt" IS NULL
 AND r.condition <> 'RETURNED_TO_SUPPLIER' AND r.qty > 0
 AND pi."partRepairId" IS NULL AND pi."tireRetreadId" IS NULL
)
SELECT *, qty * "unitPrice" amount FROM base;
