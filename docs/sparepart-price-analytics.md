# Analitik Harga Sparepart

Menu **Bengkel & Pembelian › Analitik Harga Sparepart** (`/price-analytics`) untuk OWNER, ADMIN, STAFF dan SPAREPART_ADMIN (sama dengan menu Pembelian). Ambang peringatan hanya dapat diubah oleh OWNER/ADMIN.

## Definisi data

| Hal | Definisi |
| --- | --- |
| Satu transaksi pembelian | Satu baris barang yang **diterima** (`GoodsReceiptItem`). Baris PO hanyalah pesanan; jumlah yang belum diterima tidak dihitung. Invoice memberi harga pada barang yang sudah diterima, jadi tidak menambah transaksi (tidak ada hitungan ganda PO / penerimaan / invoice). |
| Tanggal transaksi | `GoodsReceipt.receivedAt` — tanggal barang diterima, dalam hari WIB. |
| Harga satuan | Harga invoice supplier bila seluruh jumlah sudah diinvoice. Sebelum itu: harga sementara saat penerimaan (`GoodsReceiptItem.originalUnitPrice`). Invoice sebagian = rata-rata tertimbang keduanya. Invoice VOID diabaikan. Penerimaan lama tanpa harga penerimaan memakai harga batch stok (ditandai "Arsip stok"). |
| Tidak dihitung | PO dibatalkan, barang diretur ke supplier, jasa perbaikan/vulkanisir, jumlah 0, baris tanpa harga sama sekali, invoice melebihi jumlah diterima. |
| Basis harga | Harga per baris dalam IDR **sebelum** pajak, diskon, dan ongkos kirim tingkat PO. |
| Sebanding | Hanya barang yang sama (ID barang), satuan sama, mata uang sama, basis pajak sama. Nama yang mirip tidak pernah digabung. |
| Perubahan harga | Dibanding pembelian sebanding sebelumnya (urut tanggal terima), dari supplier mana pun; dihitung dari seluruh riwayat sebelum filter diterapkan. |
| Rata-rata | Tertimbang jumlah: Σ(harga × jumlah) / Σ jumlah. Dihitung dengan bilangan bulat (BigInt), dibulatkan hanya untuk tampilan. |
| Harga Referensi Pembelian | Harga pembelian sebanding terakhir dalam periode pembanding (default 180 hari), hanya bila ada minimal 2 transaksi. Bila kurang: "Data historis belum cukup untuk menentukan harga referensi." Bukan harga pasar atau penawaran supplier. |
| Potensi penghematan (estimasi) | Untuk tiap pembelian: (harga dibeli − harga sebanding termurah yang tercatat **sebelumnya** dalam periode pembanding) × jumlah yang benar-benar diterima, hanya bila selisihnya di atas ambang ringan. Bahan negosiasi, bukan jaminan. |

Harga historis tidak pernah ditimpa: harga penerimaan tersimpan di `originalUnitPrice`, harga invoice di `SupplierBillItem`. Perubahan harga PO atau nilai stok tidak mengubah riwayat. Riwayat lama langsung terbaca tanpa input ulang.

## Peringatan harga di Pembelian

- **Terima barang**: saat harga sementara diketik.
- **Tagihan supplier**: saat harga invoice diketik (baris yang sedang ditagih tidak dipakai sebagai pembanding).
- **Buat PO**: PO di sistem ini tidak memuat harga, jadi yang ditampilkan adalah harga referensi per barang.

Tingkat: lebih dari 5% = ringan, lebih dari 10% = kuat, lebih dari 20% = harga tinggi. Peringatan **tidak memblokir** penyimpanan. Ambang, periode pembanding, dan minimal transaksi diubah lewat tombol **Ambang peringatan** (OWNER/ADMIN) dan disimpan di tabel `PriceAnalyticsSetting`.

## API (`/price-analytics`)

| Metode & path | Fungsi |
| --- | --- |
| GET `/meta` | Supplier dengan riwayat, pengaturan, hak ubah pengaturan |
| GET/PUT `/settings` | Baca / ubah ambang (PUT: OWNER, ADMIN) |
| GET `/search?q=` | Cari nama, SKU, merek, nomor part, nama alternatif |
| GET `/overview` | KPI, daftar sparepart (paginasi), nilai per bulan, supplier teratas |
| GET `/opportunities?type=overpaid\|increases\|spread\|spend\|competition` | Peluang penghematan |
| GET `/items/:id` | Info barang, kartu harga, referensi, perbandingan supplier, titik grafik |
| GET `/items/:id/history` | Riwayat harga (filter, urut, paginasi) |
| GET `/items/:id/export?format=csv\|xlsx` | Ekspor riwayat terfilter (maks. 20.000 baris) |
| GET `/suppliers/:id` | Analitik supplier |
| POST `/check-price` | Pembanding harga untuk form Pembelian |

Filter umum: `from`, `to` (YYYY-MM-DD, WIB), `category`, `supplierId`, `page`, `limit` (maks. 100).

## Deployment

1. Backup database seperti biasa.
2. Di folder `backend`: `npx prisma generate` lalu `npx prisma migrate deploy` (sudah dijalankan otomatis oleh `npm start`).
   - `20261113100000_sparepart_price_analytics` — kolom merek/nomor part/alias barang, snapshot harga penerimaan, indeks.
   - `20261113150000_price_analytics_settings` — tabel `PriceAnalyticsSetting`; menghapus SQL view lama `SparepartPurchaseHistory` (view tidak menyimpan data dan tidak dipakai lagi).
   Kedua migrasi hanya menambah; tidak ada data yang dihapus.
3. Deploy backend dan build frontend seperti biasa.

Tanpa migrasi kedua, halaman tetap berjalan dengan ambang default; hanya penyimpanan pengaturan yang menolak.

## Pengujian

`cd backend && npm test` — 30 pengujian tanpa koneksi database: harga invoice vs sementara, invoice sebagian/VOID, PO batal, retur, penerimaan sebagian, data kosong, rata-rata tertimbang desimal, urutan perubahan, satuan/mata uang/pajak berbeda, perbandingan supplier, penghematan (tanpa data masa depan), pencarian, ekspor CSV, peringatan, serta hak akses API.
