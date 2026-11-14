# Cek Harga Pasar — laporan implementasi

## Fungsi yang tersedia

Tab **Harga Pasar** pada **Analitik Harga Sparepart** (`/price-analytics?tab=market`) menyediakan pencarian barang Inventory, profil barang pembanding, listing marketplace/distributor, impor CSV, penawaran supplier, verifikasi, histori pengamatan, grafik internal vs pasar, median/rentang harga, estimasi peluang penghematan, dan riwayat pekerjaan pengecekan.

Listing dan penawaran tidak membuat PO, penerimaan, invoice, stok, atau transaksi accounting. Tidak ada harga contoh atau data seed yang dimasukkan ke produksi. Data fixture hanya berada dalam tes/database lokal sementara.

### Perbandingan yang sah

1. Owner/Admin melengkapi profil: jenis original/OEM/aftermarket, merek beserta nomor part atau spesifikasi. Spesifikasi dan kompatibilitas yang dicatat harus cocok.
2. Staf menambahkan listing melalui formulir atau CSV, membuka tautan asli, lalu memverifikasi detail. Harga per kemasan dinormalisasi dengan isi kemasan ke satuan Inventory. Tautan yang berbeda hanya pada parameter pelacakan diperlakukan sebagai listing sama.
3. Hanya pengamatan yang diverifikasi, stoknya dikonfirmasi tersedia, kondisi baru, mata uang IDR, satuan sama, pajak belum termasuk, dan belum kedaluwarsa yang menjadi referensi. Jenis/merek/nomor part yang berbeda tidak digabungkan.
4. Umur pengamatan berdasarkan tanggal sumber, bukan tanggal impor, tanggal verifikasi, atau tanggal job selesai. Default kedaluwarsa 14 hari; dapat diatur 1–90 hari per barang.
5. Median/rentang memakai harga barang sebelum pajak dan ongkir agar konsisten dengan histori pembelian internal. Ongkir/biaya per satuan dengan ongkir ditampilkan terpisah; ongkir kosong berarti tidak diketahui, bukan gratis.
6. Penawaran supplier memiliki tanggal, masa berlaku, jumlah, minimum order, diskon total, ongkir, identitas barang dan lampiran opsional. Penawaran ditampilkan terpisah dari median listing publik. Verifikasi tidak mengubah penawaran menjadi pembelian.
7. Estimasi penghematan = selisih positif harga beli terakhir terhadap median listing valid × jumlah pembelian terakhir. Ini perkiraan peluang negosiasi, bukan jaminan harga transaksi atau penghematan historis.

Pengamatan harga ditambah sebagai snapshot; harga lama tidak ditimpa. Verifikasi menambahkan salinan evidence dengan tanggal pengamatan asli dan tanggal pencatatan/verifikasi baru. Penolakan listing mengeluarkannya dari referensi terkini tanpa menghapus snapshot. Grafik membedakan tanggal pembelian dari tanggal pengamatan dan tidak menganggap harga tetap di antara pengamatan.

## Integrasi eksternal yang benar-benar tersambung

**Belum ada sumber live yang diaktifkan atau diuji dengan kredensial nyata.** Tidak ditemukan kredensial penyedia harga di konfigurasi proyek.

Adapter nyata tersedia untuk **Google Shopping melalui SerpApi** menggunakan endpoint tetap `https://serpapi.com/search.json`, engine `google_shopping`, `gl=id`, `hl=id`. Adapter menerima harga IDR yang eksplisit, mencatat waktu asli respons (termasuk cache), mengabaikan harga cicilan/mata uang lain/respons tidak lengkap, dan membatasi hasil menjadi 25 listing unik. Kredensial hanya berada di backend. Error/log tidak memuat kunci atau URL autentikasi.

Dokumentasi primer yang diperiksa:

- [SerpApi Google Shopping API](https://serpapi.com/google-shopping-api)
- [Negara Google Shopping yang didukung](https://serpapi.com/google-shopping-countries)
- [Blibli Seller API](https://seller-api.blibli.com/) — API seller tidak diasumsikan sebagai katalog pencarian seluruh kompetitor.

Tokopedia, Shopee, Blibli, dan distributor tampil sebagai sumber impor manual. **Tidak ada scraping langsung, penghindaran anti-bot/CAPTCHA, atau klaim bahwa marketplace tersebut sudah berhasil diperiksa.** Google Shopping adalah indeks hasil pencarian, bukan integrasi resmi langsung ke semua marketplace; cakupan produk bergantung hasil penyedia.

Hasil otomatis tetap **Perlu Verifikasi**. Cuplikan pencarian tidak dianggap membuktikan merek, nomor part, isi kemasan, pajak, stok, kondisi atau kompatibilitas. Staf harus melengkapi dan memeriksa detail sebelum menjadi referensi. Pengecekan produk spesifik memakai pencarian ulang barang; adapter tidak mengklaim menyediakan API detail merchant yang tidak tersedia.

### Mengaktifkan penyedia

Owner perlu akun/API key SerpApi dengan akses yang sesuai. Atur environment **backend Render**:

```dotenv
SERPAPI_API_KEY=<kunci akun penyedia>
MARKET_SERPAPI_ENABLED=true
MARKET_HIGH_SPEND_IDR=10000000
```

Jangan menambahkan kunci ke frontend, kode Git, atau file CSV. Konfigurasi `.env.example` menonaktifkan provider secara default. Aktivasi ini dapat memakai kuota akun penyedia. Koneksi live harus divalidasi dengan pengecekan satu barang setelah kunci tersedia; tes otomatis saat ini memakai mock penyedia, bukan harga live.

## Jadwal, antrean dan kegagalan

`MarketPriceMonitor` menyimpan `enabled`, interval (default 7 hari), masa berlaku dan tanggal pemeriksaan berikutnya. `MarketPriceCheckJob` menyimpan status, percobaan, waktu tersedia, token lease, hasil, error tersanitasi dan log peristiwa. Worker server membangunkan antrean setiap 30 detik; CLI `backend/scripts/runMarketPriceChecks.js` dapat memproses satu siklus melalui cron eksternal pada deployment yang sama. Jalankan cron tiap menit untuk menguras antrean sesuai batas sumber; interval pemeriksaan per barang tetap mengikuti monitor (default tujuh hari).

Deduplikasi memakai indeks unik nullable `activeKey`. Claim lintas proses memakai transaction advisory lock dan `FOR UPDATE SKIP LOCKED`. Lease 3 menit dapat direbut setelah worker mati; token mencegah worker lama menyimpan hasil setelah diambil worker lain. Maksimal 3 percobaan, backoff 1 lalu 2 menit; kegagalan final mencoba lagi paling cepat sehari berikutnya untuk monitor aktif. Batas penyedia global satu job per menit tersimpan di PostgreSQL; tombol manual dibatasi 5 job per pengguna per 10 menit; hasil job sukses dipakai ulang selama 5 menit. Timeout upstream 15 detik. Kesuksesan tanpa hasil ditulis sebagai 0 listing, bukan harga baru.

Antrean/jadwal tidak hilang saat server tidur atau restart. Pemeriksaan yang jatuh tempo dilanjutkan ketika backend/worker kembali aktif. **Render yang tidur tidak dapat mengeksekusi tepat pada jadwal**; untuk jadwal independen gunakan worker selalu aktif atau Render Cron yang menjalankan CLI. Modul tidak mengklaim pemantauan aktif jika provider belum dikonfigurasi.

## Peringatan pembelian

`POST /price-analytics/check-price` menambahkan properti `market` berisi median, terendah, jumlah listing, sumber dan tanggal pengamatan. Komponen `PurchasePriceWarning` menampilkan referensi pasar walaupun histori internal belum cukup. Ambang menggunakan pengaturan analitik yang sudah ada; penyimpanan pembelian tidak diblokir jika sumber pasar bermasalah.

Pada aplikasi saat ini harga diisi pada **Terima Barang** dan **Tagihan Supplier**; **Buat PO** menampilkan referensi karena form PO belum mengisi harga. Integrasi mengikuti alur tersebut.

Peringatan lintas barang: harga di atas median, rentang listing lebar, tren median turun, pengamatan kedaluwarsa, pembanding kurang, dan pembelian 12 bulan bernilai tinggi (default Rp10 juta, environment dapat mengubahnya). Selisih/potensi hemat hanya dihitung dari listing yang layak. Laporan dibatasi 100 barang yang memiliki profil monitor, dengan penanda jika data terpotong.

## Database dan migrasi

Migrasi: `backend/prisma/migrations/20261114110000_market_price_intelligence/migration.sql`.

Hanya menambah 5 tabel dan relasi/index/constraint:

- `MarketPriceMonitor` → `Item`
- `MarketProductListing` → `Item`
- `MarketPriceSnapshot` → `MarketProductListing`, unik listing/event pengamatan
- `SupplierPriceQuotation` → `Item`, `Supplier`
- `MarketPriceCheckJob` → `Item`, unique active work

Nilai harga/ongkir/diskon baru menggunakan PostgreSQL `DECIMAL(18,2)`, jumlah/isi kemasan `DECIMAL(18,3)`, dan perhitungan `Prisma.Decimal`. Tabel transaksi lama tidak diubah oleh migrasi ini. Migrasi dibungkus transaksi; tidak menghapus tabel, view atau isi database yang ada.

## API baru

Akses: OWNER, ADMIN, STAFF, SPAREPART_ADMIN; profil/jadwal hanya OWNER/ADMIN.

| Metode | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/market-prices/meta` | Status sumber, supplier, hak kelola |
| GET | `/market-prices/items/:id` | Barang/profil, internal vs pasar, listing, quotation, job dan histori |
| PUT | `/market-prices/items/:id/profile` | Profil, interval, kedaluwarsa, aktivasi |
| POST | `/market-prices/items/:id/check` | Enqueue pengecekan nyata, atau hasil cache aktif |
| POST | `/market-prices/items/:id/listings` | Satu listing atau array `listings` maksimal 50; transaksi atomik |
| POST | `/market-prices/listings/:id/review` | Verifikasi dengan acknowledgement atau kecualikan |
| POST | `/market-prices/items/:id/quotations` | Tambah penawaran supplier dengan validasi |
| POST | `/market-prices/quotations/:id/review` | Verifikasi atau batalkan penawaran |
| GET | `/market-prices/alerts?type=&priority=&sort=` | Filter peringatan dan estimasi hemat |

Form CSV menyediakan template kosong dan petunjuk kolom; tidak ada harga fiktif di template. Batas file 100 KB, maksimal 50 listing per impor.

## Berkas yang berubah

- Schema/migrasi Prisma dan `.env.example`.
- `backend/src/services/marketPrices/{core,providers,store,jobs}.js`: validasi, pencocokan, aritmetika, adapter dan antrean.
- `backend/src/routes/marketPrices.js`, `backend/src/server.js`: API dan startup worker.
- `backend/src/routes/priceAnalytics.js`: referensi pasar pada form pembelian.
- `backend/scripts/runMarketPriceChecks.js`: satu siklus worker untuk cron eksternal.
- `frontend/src/pages/PriceAnalytics.jsx`: navigasi tab.
- `frontend/src/pages/priceAnalytics/MarketPrices.jsx`, `MarketPrices.css`, `MarketChart.jsx`, `marketCsv.js`: UI, form, impor dan grafik.
- `frontend/src/components/PurchasePriceWarning.jsx`: peringatan pasar yang tetap terpisah dari histori internal.
- `backend/tests/marketPrices.test.js`, `marketPrices.integration.test.js`, `marketCsv.test.js`.

## Hasil pengujian dan batas verifikasi

**58 tes lulus**, termasuk 11 tes integrasi HTTP/PostgreSQL lokal. Migrasi dijalankan pada PostgreSQL lokal baru dari schema ERP sebelum fitur ini. Tes mencakup permission, kecocokan, staleness, decimal, MOQ/diskon/tanggal quotation, impor atomik, URL duplikat, status provider tanpa key, warning, alert, dua worker bersamaan, retry, cache, pemulihan jadwal dan lease. Build frontend dan ESLint pada berkas frontend yang disentuh lulus.

Untuk menjalankan integrasi, sediakan database PostgreSQL lokal disposable yang namanya diawali `market_test`, terapkan schema/migrasi, lalu:

```sh
MARKET_TEST_DATABASE_URL=postgresql://USER@127.0.0.1:54329/market_test_erp npm --prefix backend test
```

Tes integrasi menolak database selain localhost/127.0.0.1 dan nama `market_test*`. Tanpa environment tersebut tes integrasi di-skip, tidak pernah memakai database produksi sebagai fallback.

Pratinjau browser melalui tool desktop mengalami timeout; layout visual belum terverifikasi. Pengujian provider live belum dilakukan karena key belum tersedia.

## Deployment dan pekerjaan yang masih diperlukan

Kode belum dipush/deploy dan migrasi belum dijalankan di Render pada implementasi ini. Setelah disetujui untuk menerbitkan fitur baru:

1. Gunakan backup database produksi sebelum migrasi seperti proses operasional biasa.
2. Deploy backend dengan `prisma generate` dan `prisma migrate deploy` (prestart proyek sudah menjalankannya).
3. Deploy build frontend ke Netlify.
4. Fitur manual/quotation/verifikasi langsung dapat digunakan tanpa API key.
5. Untuk pencarian otomatis: konfigurasi key dan enablement SerpApi, pastikan paket/akses penyedia sesuai, validasi satu pengecekan, lalu Owner mengaktifkan monitor per barang.
6. Untuk berjalan ketika web service tidur: siapkan worker selalu aktif atau cron eksternal; CLI tersedia tetapi jadwal hosting belum dibuat.

Belum tersedia: akses langsung otomatis Tokopedia/Shopee/Blibli, harga final checkout/ongkir nyata tanpa data sumber, konfirmasi keaslian/fitment otomatis, dan jaminan harga transaksi. Semua status tersebut ditampilkan secara eksplisit; tidak diganti dengan harga simulasi.
