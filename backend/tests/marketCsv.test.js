const { test } = require('node:test');
const assert = require('node:assert/strict');
let csv;
const load = async () => csv ||= await import('../../frontend/src/pages/priceAnalytics/marketCsv.js');
test('CSV import handles UTF-8 BOM, quoted commas, escaped quotes and decimal prices', async () => {
  const { parseMarketCsv } = await load();
  const data = '\uFEFFtautan,nama_produk,penjual,harga,satuan,tanggal_diperiksa,jenis,pajak,stok,kondisi\r\nhttps://supplier.example/product,"Filter, Hino ""Asli""",Toko,147552.60,PCS,2026-11-14,original,belum termasuk,tersedia,baru\r\n';
  const rows = parseMarketCsv(data);
  assert.equal(rows.length, 1); assert.equal(rows[0].title, 'Filter, Hino "Asli"'); assert.equal(rows[0].price, '147552.60'); assert.equal(rows[0].productType, 'GENUINE'); assert.equal(rows[0].availability, 'IN_STOCK');
});
test('CSV rejects malformed, duplicate columns, excess rows and missing observation dates', async () => {
  const { parseMarketCsv, CSV_TEMPLATE } = await load();
  for (const invalid of [CSV_TEMPLATE, 'a,a\n1,2', 'tautan,nama_produk,penjual,harga,satuan,tanggal_diperiksa\nhttps://shop.example,p,s,1,PCS,', 'tautan,nama_produk\n"unclosed', 'x'.repeat(100001)]) assert.throws(() => parseMarketCsv(invalid));
  const row = 'https://shop.example,p,s,1,PCS,2026-11-14\n';
  assert.throws(() => parseMarketCsv('tautan,nama_produk,penjual,harga,satuan,tanggal_diperiksa\n' + row.repeat(51)));
});
