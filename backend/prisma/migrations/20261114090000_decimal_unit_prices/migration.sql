BEGIN;
-- Preserve fractional unit prices; document totals and journals remain whole rupiah.
DROP VIEW IF EXISTS "SparepartPurchaseHistory";
ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "unitPrice" TYPE DOUBLE PRECISION;
ALTER TABLE "SupplierBillRepairItem" ALTER COLUMN "unitPrice" TYPE DOUBLE PRECISION;
ALTER TABLE "SupplierBillItem" ALTER COLUMN "unitPrice" TYPE DOUBLE PRECISION;
ALTER TABLE "GoodsReceiptItem" ALTER COLUMN "originalUnitPrice" TYPE DOUBLE PRECISION;
ALTER TABLE "StockUnit" ALTER COLUMN "purchasePrice" TYPE DOUBLE PRECISION;
ALTER TABLE "TruckSparePartAssignment" ALTER COLUMN "installCost" TYPE DOUBLE PRECISION;
ALTER TABLE "TruckPartStock" ALTER COLUMN "unitPrice" TYPE DOUBLE PRECISION;
ALTER TABLE "InventoryBatch" ALTER COLUMN "unitPrice" TYPE DOUBLE PRECISION;
ALTER TABLE "StockMovement" ALTER COLUMN "unitPrice" TYPE DOUBLE PRECISION;
CREATE VIEW "SparepartPurchaseHistory" AS
WITH billed AS (
 SELECT bi."receiptItemId", SUM(bi.qty::numeric) qty, SUM(bi.qty::numeric * bi."unitPrice"::numeric) amount,
        jsonb_agg(jsonb_build_object('id', b.id, 'number', b.number, 'invoiceNumber', b."invoiceNumber", 'qty', bi.qty, 'unitPrice', bi."unitPrice"::numeric, 'proofUrl', b."proofUrl", 'proofFileName', b."proofFileName", 'proofMimeType', b."proofMimeType") ORDER BY b."invoiceDate", bi.id) invoices
 FROM "SupplierBillItem" bi JOIN "SupplierBill" b ON b.id = bi."billId"
 WHERE b.status <> 'VOID' GROUP BY bi."receiptItemId"
), base AS (
 SELECT r.id, i.id "itemId", i.name, i.sku, i.brand, i."partNumber", i.aliases, i.category::text category,
 COALESCE(r."purchaseUnit", i.unit) unit, r.currency, r."taxBasis", g."receivedAt" date,
 s.id "supplierId", s.name "supplierName", p.id "poId", p.number "poNumber", g.id "receiptId", g.number "receiptNumber", g."deliveryNote", g."deliveryNoteProofUrl" "receiptProofUrl", g."deliveryNoteFileName" "receiptProofFileName", g."deliveryNoteMimeType" "receiptProofMimeType",
 r.qty::numeric qty, COALESCE(b.invoices, '[]'::jsonb) invoices,
 CASE WHEN COALESCE(b.qty,0) > r.qty::numeric + 0.000001 THEN NULL
      WHEN COALESCE(b.qty,0) >= r.qty::numeric - 0.000001 THEN b.amount / NULLIF(b.qty,0)
      WHEN r."originalUnitPrice"::numeric > 0 THEN (COALESCE(b.amount,0) + (r.qty::numeric-COALESCE(b.qty,0))*r."originalUnitPrice"::numeric) / NULLIF(r.qty::numeric,0)
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

COMMIT;
