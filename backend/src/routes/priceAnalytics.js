const express = require('express');
const { prisma } = require('../prisma');
const { Prisma } = require('@prisma/client');
const { authRequired } = require('../middleware/authRequired');
const { requireRole } = require('../middleware/requireRole');
const { sql, ROLES, config, parseFilters, historyCTE, where, order, warning, reference, savingsCTE } = require('../services/priceAnalytics');
const router = express.Router();
router.use(authRequired, requireRole(...ROLES));
const handle = fn => async (req,res,next) => { try { await fn(req,res); } catch(e) { if (/Tanggal|tanggal|tidak valid|wajib|satuan|mata uang|basis/.test(e.message)) return res.status(400).json({error:e.message}); console.error('Price analytics:', e.message); next(e); } };
const pageInfo = (f,total) => ({page:f.page,limit:f.limit,total:Number(total),totalPages:Math.max(1,Math.ceil(Number(total)/f.limit))});
router.get('/filters', handle(async(req,res)=>res.json({suppliers:await prisma.supplier.findMany({select:{id:true,name:true},orderBy:{name:'asc'}}), settings:config()})));
router.get('/search', handle(async(req,res)=>{
  const q=String(req.query.q||'').trim().slice(0,150);
  const items=await prisma.item.findMany({where:q?{OR:[...['name','sku','brand','partNumber'].map(key=>({[key]:{contains:q,mode:'insensitive'}})),{aliases:{hasSome:[q]}}, {AND:q.split(/\s+/).map(word=>({OR:['name','sku','brand','partNumber'].map(key=>({[key]:{contains:word,mode:'insensitive'}}))}))}]}:{},select:{id:true,name:true,sku:true,brand:true,partNumber:true,category:true,unit:true},take:12,orderBy:{name:'asc'}});
  // Alias matching is partial and case insensitive, just like the primary identifiers.
  if(q && items.length<12){ const extra=await prisma.$queryRaw`SELECT id,name,sku,brand,"partNumber",category,unit FROM "Item" WHERE EXISTS (SELECT 1 FROM unnest(aliases) a WHERE a ILIKE ${'%'+q.replace(/[\\%_]/g,'\\$&')+'%'}) ORDER BY name LIMIT 12`; for(const item of extra) if(!items.some(i=>i.id===item.id)&&items.length<12) items.push(item); }
  res.json({items});
}));
router.get('/overview',handle(async(req,res)=>{
 const f=parseFilters(req.query);
 const [metrics,saving,items,quality]=await Promise.all([
 prisma.$queryRaw`${historyCTE}, selected AS (SELECT h.*, ROW_NUMBER() OVER(PARTITION BY "itemId",unit,currency,"taxBasis" ORDER BY date DESC,id DESC) rn FROM changes h WHERE ${where(f)}) SELECT COUNT(DISTINCT "itemId")::int "itemCount", COALESCE(SUM(amount),0) spend, COUNT(DISTINCT "supplierId")::int "supplierCount", COUNT(DISTINCT "itemId") FILTER (WHERE rn=1 AND change>0)::int "increasedCount" FROM selected`,
 prisma.$queryRaw`${savingsCTE(f)} SELECT COALESCE(SUM(savings),0) savings FROM opportunities`,
 prisma.$queryRaw`${historyCTE} SELECT "itemId",name,sku,unit,SUM(qty) qty,SUM(amount) spend,COUNT(*)::int count,COUNT(DISTINCT "supplierId")::int suppliers,(array_agg("unitPrice" ORDER BY date DESC,id DESC))[1] "latestPrice",(array_agg(change ORDER BY date DESC,id DESC))[1] change FROM changes h WHERE ${where(f)} GROUP BY "itemId",name,sku,unit ORDER BY ${req.query.sort==='up'?Prisma.raw('change DESC NULLS LAST'):Prisma.raw('spend DESC')} LIMIT ${f.limit} OFFSET ${(f.page-1)*f.limit}`,
 prisma.$queryRaw`SELECT COUNT(*) FILTER(WHERE "unitPrice" IS NULL OR "unitPrice"<=0)::int "missingPrices",COUNT(*) FILTER(WHERE "priceSource"='LEGACY_BATCH')::int "legacyPrices" FROM "SparepartPurchaseHistory" h WHERE ${where({...f,direction:''})}`
 ]);
 const counts=await prisma.$queryRaw`${historyCTE} SELECT COUNT(*)::int total FROM (SELECT DISTINCT "itemId",unit FROM changes h WHERE ${where(f)}) x`;
 res.json({...metrics[0],...saving[0],quality:quality[0],items,pagination:pageInfo(f,counts[0].total)});
}));
router.get('/opportunities',handle(async(req,res)=>{
 const f=parseFilters(req.query); const cte=savingsCTE(f);
 const [items,total,signals]=await Promise.all([
 prisma.$queryRaw`${cte} SELECT * FROM opportunities ORDER BY savings DESC,id LIMIT ${f.limit} OFFSET ${(f.page-1)*f.limit}`,
 prisma.$queryRaw`${cte} SELECT COUNT(*)::int total FROM opportunities`,
 prisma.$queryRaw`${historyCTE} SELECT "itemId",name,sku,unit,COUNT(*)::int count,COUNT(DISTINCT "supplierId")::int suppliers,SUM(amount) spend,MAX("unitPrice")-MIN("unitPrice") spread,MAX(change) "maxIncrease" FROM changes h WHERE ${where(f)} GROUP BY "itemId",name,sku,unit ORDER BY spend DESC LIMIT 10`
 ]);res.json({items,signals,pagination:pageInfo(f,total[0].total)});
}));
router.post('/validate-price',handle(async(req,res)=>{
 const {itemId,unit,unitPrice,currency='IDR',taxBasis='BEFORE_ORDER_ADJUSTMENTS'}=req.body||{};
 if(!itemId||!Number.isFinite(Number(unitPrice))||Number(unitPrice)<=0) return res.status(400).json({error:'Barang dan harga positif wajib diisi'});
 const item=await prisma.item.findUnique({where:{id:itemId}});if(!item)return res.status(404).json({error:'Barang tidak ditemukan'});
 if((unit&&unit!==item.unit)||currency!=='IDR'||taxBasis!=='BEFORE_ORDER_ADJUSTMENTS')return res.status(400).json({error:'Satuan, mata uang, atau basis pajak tidak sebanding'});
 const ref=await reference(prisma,item.id,item.unit);res.json({...warning(unitPrice,ref),reference:ref,thresholds:config().thresholds});
}));
router.get('/items/:id/summary',handle(async(req,res)=>{
 const f=parseFilters({...req.query,itemId:req.params.id});
 const item=await prisma.item.findUnique({where:{id:f.itemId},include:{stocks:{select:{qty:true}},stockUnits:{where:{status:'IN_STOCK'},select:{id:true}}}});
 if(!item)return res.status(404).json({error:'Barang tidak ditemukan'});
 const [summary,latest,lowest,suppliers]=await Promise.all([
 prisma.$queryRaw`${historyCTE} SELECT SUM(qty) qty,COUNT(*)::int count,COUNT(DISTINCT "supplierId")::int "supplierCount",SUM(amount)/NULLIF(SUM(qty),0) average FROM changes h WHERE ${where(f)} AND unit=${item.unit}`,
 prisma.$queryRaw`${historyCTE} SELECT * FROM changes h WHERE ${where(f)} AND unit=${item.unit} ORDER BY date DESC,id DESC LIMIT 1`,
 prisma.$queryRaw`${historyCTE} SELECT * FROM changes h WHERE ${where(f)} AND unit=${item.unit} ORDER BY "unitPrice",date DESC,id DESC LIMIT 1`,
 prisma.$queryRaw`${historyCTE} SELECT "supplierId", "supplierName", unit, COUNT(*)::int count, SUM(amount)/NULLIF(SUM(qty),0) average,MIN("unitPrice") minimum,MAX(date) "latestDate",(array_agg("unitPrice" ORDER BY date DESC,id DESC))[1] "latestPrice" FROM changes h WHERE ${where({...f,supplierId:''})} AND unit=${item.unit} GROUP BY "supplierId","supplierName",unit ORDER BY "latestPrice"`
 ]);
 const ref=await reference(prisma,item.id,item.unit,f.to&&f.to<new Date()?f.to:new Date());
 res.json({item:{...item,stocks:undefined,stockUnits:undefined,stock:item.isSerialized?item.stockUnits.length:item.stocks.reduce((n,s)=>n+s.qty,0)},summary:summary[0],latest:latest[0]||null,lowest:lowest[0]||null,suppliers:suppliers.map(s=>({...s,recent:new Date(s.latestDate)>=new Date((f.to&&f.to<new Date()?f.to:new Date()).getTime()-config().lookbackDays*86400000)})),reference:ref});
}));
router.get('/items/:id/history',handle(async(req,res)=>{
 const f=parseFilters({...req.query,itemId:req.params.id});
 const [items,total]=await Promise.all([prisma.$queryRaw`${historyCTE} SELECT * FROM changes h WHERE ${where(f)} ORDER BY ${order(req.query)} LIMIT ${f.limit} OFFSET ${(f.page-1)*f.limit}`,prisma.$queryRaw`${historyCTE} SELECT COUNT(*)::int total FROM changes h WHERE ${where(f)}`]);res.json({items,pagination:pageInfo(f,total[0].total)});
}));
router.get('/items/:id/trends',handle(async(req,res)=>{
 const f=parseFilters({...req.query,itemId:req.params.id});
 // Each exact transaction is a chart point; bounded response, never silently aggregate same-day purchases.
 const item=await prisma.item.findUnique({where:{id:f.itemId},select:{unit:true}});
 if(!item)return res.status(404).json({error:'Barang tidak ditemukan'});
 const items=await prisma.$queryRaw`${historyCTE} SELECT id,date,"supplierId","supplierName",qty,"unitPrice",unit FROM changes h WHERE ${where(f)} AND h.unit=${item.unit} ORDER BY date,id LIMIT 1001`;
 res.json({items:items.slice(0,1000),truncated:items.length>1000});
}));
router.get('/items/:id/export',handle(async(req,res)=>{
 const f=parseFilters({...req.query,itemId:req.params.id});
 const rows=await prisma.$queryRaw`${historyCTE} SELECT * FROM changes h WHERE ${where(f)} ORDER BY ${order(req.query)} LIMIT 50001`;
 if(rows.length>50000)return res.status(400).json({error:'Ekspor maksimal 50.000 baris. Persempit rentang tanggal.'});
 const headings=['Tanggal penerimaan','Supplier','Barang','SKU','No. PO','No. Penerimaan','Satuan','Jumlah','Harga satuan (Rp)','Total (Rp)','Perubahan (%)','Sumber harga','Invoice'];
 const data=rows.map(r=>[new Date(r.date).toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'}),r.supplierName,r.name,r.sku,r.poNumber,r.receiptNumber,r.unit,String(r.qty),String(r.unitPrice),String(r.amount),r.change==null?'':String(r.change),({INVOICE:"Sesuai invoice",LEGACY_BATCH:"Arsip stok lama",RECEIPT_SNAPSHOT:"Harga sementara penerimaan"}[r.priceSource]||"Tidak diketahui"),r.invoices.map(i=>i.invoiceNumber).join('; ')]);
 if(req.query.format==='xlsx'){
 const ExcelJS=require('exceljs');const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Riwayat harga');sheet.addRow(headings);data.forEach(row=>sheet.addRow(row));sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];sheet.columns.forEach(c=>c.width=22);res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition','attachment; filename="riwayat-harga.xlsx"');await workbook.xlsx.write(res);res.end();
 }else{
 const cell=v=>'"'+String(/^[=+@\-\t\r]/.test(String(v))?"'"+v:v).replaceAll('"','""')+'"';res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="riwayat-harga.csv"');res.send('\ufeff'+[headings,...data].map(row=>row.map(cell).join(',')).join('\r\n'));
 }
}));
router.get('/suppliers/:id',handle(async(req,res)=>{
 const f=parseFilters({...req.query,supplierId:req.params.id});const supplier=await prisma.supplier.findUnique({where:{id:f.supplierId}});if(!supplier)return res.status(404).json({error:'Supplier tidak ditemukan'});
 const [metrics,items,total]=await Promise.all([
 prisma.$queryRaw`${historyCTE} SELECT COUNT(DISTINCT "itemId")::int "itemCount",COUNT(DISTINCT "receiptId")::int count,SUM(amount) spend,SUM(amount)/NULLIF(COUNT(DISTINCT "receiptId"),0) average FROM changes h WHERE ${where(f)}`,
 prisma.$queryRaw`${historyCTE} SELECT h."itemId",h.name,h.sku,h.unit,SUM(h.qty) qty,COUNT(*)::int count,SUM(h.amount) spend,MAX(h.date) "latestDate",(array_agg(h."unitPrice" ORDER BY h.date DESC,h.id DESC))[1] "latestPrice",(array_agg(h.change ORDER BY h.date DESC,h.id DESC))[1] change,
 (SELECT MIN(v."unitPrice") FROM valid v WHERE v."itemId"=h."itemId" AND v.unit=h.unit AND v."supplierId"<>${f.supplierId} AND (${f.from}::timestamp IS NULL OR v.date>=${f.from}::timestamp) AND (${f.to}::timestamp IS NULL OR v.date<=${f.to}::timestamp)) "otherMinimum"
 FROM changes h WHERE ${where(f)} GROUP BY h."itemId",h.name,h.sku,h.unit ORDER BY ${req.query.sort==='date'?Prisma.raw('"latestDate" DESC'):req.query.sort==='frequency'?Prisma.raw('count DESC'):Prisma.raw('spend DESC')} LIMIT ${f.limit} OFFSET ${(f.page-1)*f.limit}`,
 prisma.$queryRaw`${historyCTE} SELECT COUNT(*)::int total FROM (SELECT DISTINCT "itemId",unit FROM changes h WHERE ${where(f)}) x`
 ]);res.json({supplier,metrics:metrics[0],items,pagination:pageInfo(f,total[0].total)});
}));
router.use((err,req,res,next)=>{ if(res.headersSent)return next(err);res.status(500).json({error:'Analitik belum dapat dimuat. Pastikan migrasi database sudah dijalankan.'}); });
module.exports=router;
