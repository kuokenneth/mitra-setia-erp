const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {config,parseFilters,warning,ROLES}=require('../src/services/priceAnalytics');
test('ambang peringatan dapat diatur dan memakai batas lebih dari',()=>{
 const settings=config({PRICE_WARNING_MILD:'4',PRICE_WARNING_STRONG:'8',PRICE_WARNING_HIGH:'15'});
 const ref={count:2,unitPrice:100};assert.equal(warning(104,ref,settings).level,'normal');assert.equal(warning(105,ref,settings).level,'mild');assert.equal(warning(110,ref,settings).level,'strong');assert.equal(warning(120,ref,settings).level,'high');assert.equal(warning(120,{count:1,unitPrice:100},settings).level,'insufficient');assert.equal(warning(90,ref,settings).change,-10);
});
test('tanggal WIB, pagination terbatas, tanggal tidak valid ditolak',()=>{
 assert.equal(parseFilters({from:'2026-11-01'}).from.toISOString(),'2026-10-31T17:00:00.000Z');assert.equal(parseFilters({limit:9999,page:-1}).limit,100);assert.equal(parseFilters({page:-1}).page,1);assert.throws(()=>parseFilters({from:'2026-02-30'}));assert.throws(()=>parseFilters({from:'2026-11-10',to:'2026-11-01'}));
});
test('hak akses sesuai pembelian',()=>assert.deepEqual(ROLES,['OWNER','ADMIN','STAFF','SPAREPART_ADMIN']));
const databaseUrl=process.env.TEST_DATABASE_URL;
if(databaseUrl){
 const url=new URL(databaseUrl);if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.includes('test'))throw new Error('Pengujian integrasi wajib memakai database lokal bernama test');
 process.env.DATABASE_URL=databaseUrl;process.env.JWT_SECRET='price-analytics-isolated-test';
 const {prisma}=require('../src/prisma');const express=require('express');const jwt=require('jsonwebtoken');
 let server,base,user,driver,item,supplierA,supplierB,location,request,rows=[],variant;
 const prefix=`pa-${Date.now()}`;
 const at=(day,hour=3)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+day-13);d.setUTCHours(hour,0,0,0);return d.toISOString();};
 const token=role=>jwt.sign({id:role==='DRIVER'?driver.id:user.id},process.env.JWT_SECRET);
 async function call(path,options={}){const response=await fetch(base+path,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token()}`,...options.headers}});const type=response.headers.get('content-type')||'';return {status:response.status,data:type.includes('json')?await response.json():await response.text(),response};}
 async function purchase({price=100,qty=10,date=at(1),supplier=supplierA,status='FULLY_RECEIVED',condition='GOOD',unit='PCS',taxBasis='BEFORE_ORDER_ADJUSTMENTS',currency='IDR',missing=false,selectedItem=item}={}){
 const order=await prisma.purchaseOrder.create({data:{number:`${prefix}-PO-${rows.length}`,requestId:request.id,supplierId:supplier.id,status,createdById:user.id,items:{create:{itemId:selectedItem.id,qty:100,receivedQty:qty,unitPrice:price||0}}},include:{items:true}});
 const receipt=await prisma.goodsReceipt.create({data:{number:`${prefix}-GR-${rows.length}`,purchaseOrderId:order.id,locationId:location.id,receivedAt:new Date(date),createdById:user.id,items:{create:{purchaseOrderItemId:order.items[0].id,qty,condition,originalUnitPrice:missing?null:price,purchaseUnit:unit,priceSource:missing?null:'RECEIPT_SNAPSHOT',taxBasis,currency}}},include:{items:true}});
 const row={order,receipt,line:receipt.items[0]};rows.push(row);return row;
 }
 before(async()=>{
 user=await prisma.user.create({data:{email:`${prefix}@test.invalid`,password:'test',role:'OWNER'}});driver=await prisma.user.create({data:{email:`${prefix}-driver@test.invalid`,password:'test',role:'DRIVER'}});
 item=await prisma.item.create({data:{sku:prefix,name:`${prefix} Filter Solar`,brand:'Merek Uji',partNumber:'ABC-123',aliases:['Saringan Diesel']}});variant=await prisma.item.create({data:{sku:`${prefix}-variant`,name:`${prefix} Filter Solar varian`,brand:'Merek Lain',partNumber:'XYZ-321'}});
 supplierA=await prisma.supplier.create({data:{name:`${prefix} Supplier A`}});supplierB=await prisma.supplier.create({data:{name:`${prefix} Supplier B`}});location=await prisma.inventoryLocation.create({data:{name:prefix}});request=await prisma.purchaseRequest.create({data:{number:prefix,reason:'Test',createdById:user.id,status:'APPROVED'}});
 await purchase();const partial=await purchase({price:120,qty:5,date:at(5),supplier:supplierB,status:'PARTIALLY_RECEIVED'});
 await prisma.supplierBill.create({data:{number:prefix,supplierId:supplierB.id,invoiceNumber:prefix,invoiceDate:new Date(at(6)),amount:300,createdById:user.id,items:{create:{receiptItemId:partial.line.id,qty:2,unitPrice:150,amount:300}}}});
 await prisma.supplierBill.create({data:{number:`${prefix}-void`,supplierId:supplierB.id,invoiceNumber:`${prefix}-void`,invoiceDate:new Date(at(6)),status:'VOID',amount:99999,createdById:user.id,items:{create:{receiptItemId:partial.line.id,qty:5,unitPrice:19999,amount:99995}}}});
 await purchase({price:140,qty:2,date:at(5,4),supplier:supplierB});await purchase({price:110,qty:3,date:at(10)});
 await purchase({price:999,condition:'RETURNED_TO_SUPPLIER'});await purchase({price:999,status:'CANCELLED'});await purchase({price:999,status:'DRAFT'});await purchase({missing:true});await purchase({price:0});await purchase({price:888,taxBasis:'AFTER_TAX'});await purchase({price:888,currency:'USD'});await purchase({price:999,selectedItem:variant});
 const app=express();app.use(express.json());app.use('/price-analytics',require('../src/routes/priceAnalytics'));app.use('/purchasing',require('../src/routes/purchasing'));app.use('/inventory',require('../src/routes/inventory'));server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}/price-analytics`;
 });
 after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await prisma.$disconnect();});
 test('rata-rata tertimbang, penerimaan sebagian, invoice parsial, tanpa duplikasi',async()=>{
 const r=await call(`/items/${item.id}/summary`);assert.equal(r.status,200);assert.equal(r.data.summary.count,4);assert.equal(Number(r.data.summary.qty),20);assert.equal(Number(r.data.summary.average),113.5);assert.equal(Number(r.data.latest.unitPrice),110);assert.equal(Number(r.data.lowest.unitPrice),100);assert.equal(r.data.summary.supplierCount,2);assert.ok(Math.abs(Number(r.data.latest.change)+21.4285714)<.00001);
 assert.equal(r.data.suppliers[0].supplierId,supplierA.id);assert.equal(Number(r.data.suppliers[1].average),940/7);
 });
 test('harga awal tidak berubah saat biaya stok/PO berubah',async()=>{
 await prisma.purchaseOrderItem.update({where:{id:rows[0].order.items[0].id},data:{unitPrice:9999}});const r=await call(`/items/${item.id}/history?sort=date&order=asc`);assert.equal(Number(r.data.items[0].unitPrice),100);assert.equal(r.data.pagination.total,4);assert.equal(Number(r.data.items[1].unitPrice),132);assert.equal(r.data.items[1].invoices.length,1);
 });
 test('periode/supplier tidak memotong pembanding perubahan harga sebelumnya',async()=>{
 const r=await call(`/items/${item.id}/history?from=${at(10).slice(0,10)}&supplierId=${supplierA.id}`);assert.equal(r.data.items.length,1);assert.ok(Number(r.data.items[0].change)<-21);
 });
 test('overview dan estimasi hemat memakai jumlah aktual dan tanpa harga masa depan',async()=>{
 const r=await call(`/overview?itemId=${item.id}`);assert.equal(r.status,200);assert.equal(Number(r.data.spend),2270);assert.equal(Number(r.data.savings),240);assert.equal(r.data.itemCount,1);assert.equal(r.data.quality.missingPrices,2);
 const o=await call(`/opportunities?itemId=${item.id}`);assert.equal(o.status,200);assert.equal(o.data.items.length,2);assert.equal(Number(o.data.items[0].savings),160);assert.equal(o.data.items[0].referenceSupplier,supplierA.name);
 });
 test('pencarian SKU, merek, nomor part, alias parsial tanpa menyamakan varian',async()=>{
 for(const q of [prefix,'merek uji','abc-123','saringan','DIESEL']){const r=await call(`/search?q=${encodeURIComponent(q)}`);assert.equal(r.status,200);assert.ok(r.data.items.some(i=>i.id===item.id));}
 const r=await call(`/items/${variant.id}/history`);assert.equal(r.data.items.length,1);
 });
 test('grafik mempertahankan transaksi pada hari yang sama dan paginasi/sort/filter server',async()=>{
 const r=await call(`/items/${item.id}/trends`);assert.equal(r.data.items.length,4);const same=r.data.items.filter(i=>i.date.startsWith(at(5).slice(0,10)));assert.equal(same.length,2);
 const h=await call(`/items/${item.id}/history?sort=price&order=desc&limit=1&page=2`);assert.equal(Number(h.data.items[0].unitPrice),132);assert.equal(h.data.pagination.totalPages,4);
 });
 test('peringatan harga memakai threshold dan menolak basis/satuan/mata uang berbeda',async()=>{
 const body={itemId:item.id,unit:'PCS',unitPrice:150};const r=await call('/validate-price',{method:'POST',body:JSON.stringify(body)});assert.equal(r.status,200);assert.equal(r.data.level,'high');assert.equal(Number(r.data.reference.unitPrice),110);
 for(const change of [{unit:'BOX'},{currency:'USD'},{taxBasis:'AFTER_TAX'}])assert.equal((await call('/validate-price',{method:'POST',body:JSON.stringify({...body,...change})})).status,400);
 });
 test('supplier analytics, ekspor, filter tanggal invalid, SQL parameterization',async()=>{
 const r=await call(`/suppliers/${supplierB.id}?itemId=${item.id}`);assert.equal(r.status,200);assert.equal(Number(r.data.metrics.spend),940);assert.equal(r.data.metrics.count,2);assert.equal(Number(r.data.items[0].otherMinimum),100);
 const csv=await call(`/items/${item.id}/export?format=csv`);assert.equal(csv.status,200);assert.match(csv.data,/Harga satuan/);const xlsx=await fetch(`${base}/items/${item.id}/export?format=xlsx`,{headers:{Authorization:`Bearer ${token()}`}});assert.equal(xlsx.status,200);assert.match(xlsx.headers.get('content-type'),/spreadsheet/);assert.ok((await xlsx.arrayBuffer()).byteLength>1000);
 assert.equal((await call('/overview?from=bad')).status,400);assert.equal((await call(`/items/${item.id}/history?q=${encodeURIComponent("' OR 1=1 --")}`)).data.items.length,0);
 });
 test('data kosong aman; hanya role pembelian dapat mengakses',async()=>{
 const empty=await prisma.item.create({data:{sku:`${prefix}-empty`,name:`${prefix}-empty`}});const r=await call(`/items/${empty.id}/summary`);assert.equal(r.status,200);assert.equal(r.data.latest,null);assert.equal(r.data.reference.sufficient,false);
 assert.equal((await call('/overview',{headers:{Authorization:`Bearer ${token('DRIVER')}`}})).status,403);assert.equal((await fetch(base+'/overview')).status,401);
 for(const role of ['ADMIN','STAFF','SPAREPART_ADMIN']){await prisma.user.update({where:{id:user.id},data:{role}});assert.equal((await call('/filters')).status,200);}await prisma.user.update({where:{id:user.id},data:{role:'OWNER'}});
 });
 test('perubahan satuan dipisahkan, tidak dibandingkan harga PCS dengan BOX',async()=>{
 const box=await purchase({price:1000,unit:'BOX',date:at(11)});const r=await call(`/items/${item.id}/history?sort=date`);const row=r.data.items.find(r=>r.id===box.line.id);assert.equal(row.change,null);const summary=await call(`/items/${item.id}/summary`);assert.equal(Number(summary.data.latest.unitPrice),110);const chart=await call(`/items/${item.id}/trends`);assert.ok(chart.data.items.every(r=>r.unit==='PCS'));
 });
 test('penerimaan lewat API pembelian menyimpan snapshot harga dan satuan',async()=>{
 for(const [code,type] of [['1201','ASSET'],['2001','LIABILITY']])await prisma.account.upsert({where:{code},update:{},create:{code,name:code,type}});
 const receivedItem=await prisma.item.create({data:{sku:`${prefix}-receive`,name:`${prefix}-receive`}});
 const po=await prisma.purchaseOrder.create({data:{number:`${prefix}-api`,requestId:request.id,supplierId:supplierA.id,createdById:user.id,status:'SENT_TO_SUPPLIER',items:{create:{itemId:receivedItem.id,qty:10,unitPrice:0}}},include:{items:true}});
 const result=await fetch(base.replace('/price-analytics','')+'/purchasing/receipts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token()}`},body:JSON.stringify({purchaseOrderId:po.id,locationId:location.id,items:[{purchaseOrderItemId:po.items[0].id,qty:2,unitPrice:185000}]})});const payload=await result.json();assert.equal(result.status,200,JSON.stringify(payload));
 const line=await prisma.goodsReceiptItem.findFirst({where:{receiptId:payload.receipt.id},include:{inventoryBatch:true}});assert.equal(line.originalUnitPrice,185000);assert.equal(line.purchaseUnit,'PCS');assert.equal(line.priceSource,'RECEIPT_SNAPSHOT');
 await prisma.inventoryBatch.update({where:{id:line.inventoryBatch.id},data:{unitPrice:999999}});await prisma.purchaseOrderItem.update({where:{id:po.items[0].id},data:{unitPrice:999999}});
 const h=await call(`/items/${receivedItem.id}/history`);assert.equal(h.data.pagination.total,1);assert.equal(Number(h.data.items[0].qty),2);assert.equal(Number(h.data.items[0].unitPrice),185000);
 });
 test('metadata inventory dapat disimpan dan dicari tanpa mengubah transaksi',async()=>{
 const response=await fetch(base.replace('/price-analytics','')+`/inventory/items/${variant.id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token()}`},body:JSON.stringify({brand:'Merek Metadata',partNumber:'META-123',aliases:['Nama Metadata']})});assert.equal(response.status,200);const search=await call('/search?q=metadata');assert.ok(search.data.items.some(i=>i.id===variant.id));
 });

}else test('integrasi PostgreSQL (atur TEST_DATABASE_URL lokal)',{skip:true},()=>{});
