# Retur pembelian

Dari **Pembelian → Penerimaan Barang → Retur Barang**, pilih jumlah barang atau nomor seri, tanggal, alasan, dan foto bukti opsional. Penerimaan dan jumlah awal tetap tersimpan. Kartu penerimaan menampilkan Retur sebagian/penuh, jumlah retur per barang, nomor retur dan bukti foto. Penerimaan yang seluruh barangnya sudah diretur ada pada filter Selesai.

- Retur hanya menggunakan stok dari batch dan lokasi penerimaan asal. Barang yang sudah dipakai, dipasang, atau dipindahkan harus dikembalikan ke lokasi/batch yang sesuai dulu.
- Jumlah belum ditagih dikurangi terlebih dahulu. Jika retur melebihi bagian belum ditagih, sisa retur mengurangi tagihan supplier yang aktif. Invoice VOID tidak ikut dihitung.
- Jumlah dan harga invoice asli tetap tersimpan; kolom returnedQty/returnedAmount menyimpan pengurangnya. Saldo amount tagihan adalah nilai setelah retur.
- Pembayaran yang sudah lunas menghasilkan kredit supplier, terlihat di riwayat retur dan kartu tagihan. Retur belum mencatat dana kas/bank masuk. Penyelesaian kredit, pengembalian uang, dan penerimaan pengganti belum termasuk tahap ini.
- Jurnal retur: debit utang supplier, kredit persediaan sebesar nilai stok yang dikembalikan. Pengajuan pembayaran yang masih menunggu persetujuan harus diselesaikan terlebih dahulu.
- Jasa perbaikan/retread tidak menggunakan retur barang ini. PO tetap menyimpan jumlah penerimaan historis; retur tidak membuka kembali sisa PO.

## Aktivasi

Migrasi baru: `backend/prisma/migrations/202611170001_purchase_returns/migration.sql`.
Jalankan `npx prisma migrate deploy` di backend lalu restart backend. Client Prisma sudah dihasilkan saat implementasi. Database aplikasi belum diubah: deployment migrasi remote ditolak auto-review dan membutuhkan persetujuan pengguna. Ada satu catatan migrasi historis remote yang tidak tersedia lokal (`20260908194500_material_invoice_customer_relation`); jangan reset database atau menghapus catatan itu.

## Validasi

- Build dan ESLint frontend.
- Regression test backend: `npm test`.
- Uji integrasi khusus, hanya database lokal disposable: `PURCHASE_RETURN_TEST_DATABASE_URL=postgresql://... node --test tests/purchaseReturn.integration.test.js`.
- Uji mencakup stok dan tagihan, kredit setelah lunas, rollback pembayaran tertunda, provenance nomor seri, barang terpakai, bukti opsional, dan retur bersamaan.
- SQL migrasi diuji pada salinan skema lama di PostgreSQL sementara; form diperiksa pada viewport desktop dan ponsel menggunakan data contoh.
