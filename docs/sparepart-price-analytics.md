# Analitik Harga Sparepart

Halaman `/price-analytics` tersedia bagi OWNER, ADMIN, STAFF, dan SPAREPART_ADMIN, sama dengan modul pembelian. Sidebar menggunakan kelompok Bengkel & Pembelian. Tidak ada data contoh di aplikasi; fixture hanya berada dalam pengujian.

## Definisi transaksi dan harga

- Satu transaksi analitik adalah satu `GoodsReceiptItem`, bukan jumlah pesanan atau baris invoice tambahan. Tanggal transaksi adalah `GoodsReceipt.receivedAt`, filter tanggal memakai hari WIB.
- Hanya PO `PARTIALLY_RECEIVED` / `FULLY_RECEIVED` tanpa pembatalan, kuantitas positif, dan kondisi selain `RETURNED_TO_SUPPLIER`. Jasa perbaikan dan vulkanisir yang tertaut pada PO tidak dicampur dengan pembelian barang.
- Harga satuan dalam IDR sebelum pajak, diskon, dan ongkos tingkat PO. Total KPI adalah nilai barang diterima sebelum penyesuaian tersebut, bukan total pembayaran kas. Sistem pembelian saat ini tidak menyimpan mata uang atau basis pajak per PO; IDR dan harga baris sebelum penyesuaian adalah konvensi yang digunakan.
- `originalUnitPrice` dan `purchaseUnit` pada penerimaan baru menyimpan snapshot. Invoice tidak mengubahnya. Harga efektif mengalokasikan harga invoice ke jumlah yang ditagih, dan harga snapshot ke jumlah yang belum ditagih. Invoice VOID diabaikan. Kelebihan alokasi invoice menghasilkan harga tidak valid yang dikecualikan dari analitik.
- Harga historis tidak berasal dari `PurchaseOrderItem.unitPrice` yang bisa berubah. Arsip lama memakai harga `InventoryBatch` saat migrasi, ditandai `LEGACY_BATCH`: ini adalah bukti terbaik yang tersedia, bukan jaminan harga awal. Bila batch juga tidak memiliki harga dan invoice belum lengkap, harga tidak diketahui dan dikecualikan. Harga asli yang sudah tertimpa sebelum fitur ini tidak dapat dipulihkan.
- Harga nol tidak masuk analitik pembelian sparepart. Koreksi jumlah atau retur mengikuti kondisi dan jumlah penerimaan pada sumber. Sistem belum memiliki kuantitas retur supplier parsial terstruktur; jangan menganggap retur pemakaian internal sebagai retur pembelian.
- Produk dibandingkan berdasarkan ID barang, satuan snapshot, mata uang dan basis harga yang identik. Nama mirip tidak digabung. Grafik/detail ringkasan dan pembanding menggunakan satuan barang saat ini. Riwayat tetap memperlihatkan satuan lama dan menghitung perubahan dalam satuan yang sama.
- Perubahan memakai LAG harga sebanding berdasarkan tanggal dan ID penerimaan sebagai pemecah seri, sebelum filter tanggal/supplier diterapkan. Pembelian pada hari yang sama tetap terpisah.
- Rata-rata = SUM(harga × jumlah) / SUM(jumlah), dihitung di PostgreSQL `numeric`. API mengirim nilai desimal sebagai string agar perhitungan uang tidak bergantung pada float JavaScript. Pembulatan Rupiah hanya untuk tampilan.

## Referensi dan estimasi

Referensi adalah harga pembelian terakhir barang/satuan yang sama dalam periode pembanding, didukung jumlah transaksi minimum. Juga ditampilkan minimum historis dan rata-rata tertimbang periode pembanding. Referensi tidak sama dengan penawaran aktif; modul ini belum menyimpan quotation supplier.

Penghematan = (harga dibeli − harga lebih rendah dari supplier lain) × jumlah diterima aktual. Pembanding harus tercatat lebih dahulu dalam periode pembanding. Data masa depan tidak dipakai untuk membentuk peluang transaksi sebelumnya. Ini estimasi untuk negosiasi, bukan jaminan penghematan. Daftar prioritas menampilkan belanja terbesar, frekuensi, kompetisi supplier, rentang harga, dan kenaikan transaksi terbesar pada periode terpilih; gunakan filter satu tahun untuk evaluasi tahunan.

Konfigurasi environment backend (opsional):

| Variabel | Default |
| --- | --- |
| `PRICE_LOOKBACK_DAYS` | 90 |
| `PRICE_MIN_TRANSACTIONS` | 2 |
| `PRICE_WARNING_MILD` | 5 |
| `PRICE_WARNING_STRONG` | 10 |
| `PRICE_WARNING_HIGH` | 20 |

Ambang berupa persen dan peringatan muncul bila *lebih dari* ambang. Peringatan tidak memblokir transaksi. Alur PO saat ini tidak menerima harga saat dibuat; referensi ditampilkan di pembuatan PO, peringatan aktif pada input harga penerimaan dan invoice supplier. Alur persetujuan tetap memakai kebijakan yang ada.

## API

Semua endpoint di bawah `/price-analytics`, menggunakan autentikasi dan role pembelian:

| Metode / Path | Fungsi |
| --- | --- |
| GET `/filters` | Supplier dan konfigurasi referensi |
| GET `/search?q=` | Pencarian nama, SKU, merek, nomor part, alias |
| GET `/overview` | KPI, daftar belanja, kualitas arsip |
| GET `/items/:id/summary` | Identitas/stok, ringkasan, perbandingan supplier, referensi |
| GET `/items/:id/history` | Riwayat terfilter dan paginasi |
| GET `/items/:id/trends` | Titik transaksi grafik |
| GET `/items/:id/export?format=csv\|xlsx` | Ekspor seluruh hasil filter |
| GET `/suppliers/:id` | Analitik supplier dan barang yang dibeli |
| GET `/opportunities` | Estimasi hemat dan prioritas evaluasi |
| POST `/validate-price` | Peringatan harga; body `itemId`, `unit`, `unitPrice`, opsional `currency`, `taxBasis` |

Filter: `from`, `to` (YYYY-MM-DD), `supplierId`, `itemId`, `category`, `direction=up|down`, `q`, `page`, `limit` (maksimal 100). Riwayat mendukung `sort=date|price|qty|supplier`, `order=asc|desc`. Ringkasan mendukung `sort=up`, supplier mendukung `sort=frequency|date` (default nilai pembelian). Data tabel dipaginasi di server. Grafik maksimal 1.000 titik dan menampilkan pemberitahuan bila perlu mempersempit periode. Ekspor maksimal 50.000 baris dan menolak hasil lebih besar. CSV melindungi sel dari formula injection.

Bukti penerimaan/invoice yang tersedia memakai komponen preview file terlindungi, dan tautan dokumen cetak menggunakan endpoint pembelian yang ada. Merek, nomor part, dan alias opsional dapat diisi lewat form tambah/edit Inventory; tidak perlu memasukkan ulang transaksi lama.

## Migrasi dan deployment

1. Backup database sesuai prosedur deployment yang sudah berlaku.
2. Dari direktori backend jalankan `npx prisma generate` dan `npx prisma migrate deploy` sebelum menjalankan aplikasi baru. Migrasi baru: `20261113100000_sparepart_price_analytics`. Tidak ada penghapusan tabel atau reset database.
3. Migrasi menambah metadata barang, snapshot penerimaan, indeks relasi/tanggal, dan SQL view `SparepartPurchaseHistory`. View tidak menduplikasi transaksi. Jangan mengganti migrasi ini dengan `prisma db push`, karena view merupakan SQL yang tidak dikelola Prisma schema.
4. Deploy backend dan build frontend seperti biasa; isi konfigurasi threshold bila perlu.

Rantai migrasi lama pada database kosong gagal lebih awal pada `20260807130000_expense_truck_relation` karena tabel `Expense` tidak tersedia. Fitur ini tidak mengubah migrasi lama tersebut. Deployment database yang sudah berjalan harus memeriksa status migrasi yang ada. Migrasi baru diuji terpisah dengan baseline dari schema sebelum perubahan dan PostgreSQL uji lokal.

## Verifikasi

- `npm --prefix frontend run lint`
- `npm --prefix frontend run build`
- `cd backend && npx prisma validate && npx prisma generate`
- `npm --prefix backend test` (unit test; integrasi dilewati tanpa database uji)
- `TEST_DATABASE_URL=postgresql://...@127.0.0.1:PORT/nama_test npm --prefix backend test`

Integrasi hanya menerima database lokal bernama mengandung `test`; fixture menulis transaksi uji, jangan gunakan database operasional. Database uji perlu baseline schema dan migrasi SQL/view di atas. Pengujian mencakup kalkulasi historis, invoice parsial/VOID, rata-rata tertimbang, jumlah diterima sebagian, supplier, penghematan, harga yang tidak tertimpa perubahan PO, pembatalan, retur, data kosong, beda satuan/mata uang/basis pajak, pagination, pencarian, ekspor, peringatan, dan autentikasi/role.

Hasil verifikasi implementasi: 15 pengujian backend lulus pada PostgreSQL uji, lint frontend bersih, build frontend berhasil, dan Prisma schema valid. Browser headless memverifikasi pencarian dengan keyboard dan detail grafik; tidak ditemukan error JavaScript atau overflow halaman pada viewport 1440, 768, dan 390 piksel. Build masih memberi peringatan ukuran bundle Vite di atas 500 kB.
