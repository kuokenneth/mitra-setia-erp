export const CSV_HEADERS = ['tautan', 'nama_produk', 'penjual', 'merek', 'nomor_part', 'jenis', 'spesifikasi', 'kendaraan', 'harga', 'isi_kemasan', 'satuan', 'pajak', 'stok', 'kondisi', 'tanggal_diperiksa', 'ongkir'];
export const CSV_TEMPLATE = CSV_HEADERS.join(',') + '\r\n';
// RFC 4180-style quoted fields; input stays local until the user submits the import.
export function parseMarketCsv(input) {
  if (input.length > 100000) throw new Error('File CSV maksimal 100 KB.');
  const table = []; let row = [], cell = '', quoted = false, closed = false;
  const pushCell = () => { row.push(cell.trim()); cell = ''; closed = false; };
  const pushRow = () => { pushCell(); if (row.some(Boolean)) table.push(row); row = []; };
  const raw = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quoted) {
      if (ch === '"' && raw[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else cell += ch;
    } else if (ch === '"' && !cell && !closed) quoted = true;
    else if (ch === ',') pushCell();
    else if (ch === '\n') pushRow();
    else if (ch === '\r' && raw[i + 1] === '\n') continue;
    else if (closed && ch.trim()) throw new Error('Format kutipan CSV tidak valid.');
    else cell += ch;
  }
  if (quoted) throw new Error('Kutipan CSV belum ditutup.');
  if (cell || row.length) pushRow();
  if (table.length < 2) throw new Error('CSV belum memiliki data listing.');
  if (table.length > 51) throw new Error('Impor maksimal 50 listing sekaligus.');
  const header = table.shift().map(v => v.toLowerCase());
  if (new Set(header).size !== header.length) throw new Error('Kolom CSV tidak boleh duplikat.');
  for (const required of ['tautan', 'nama_produk', 'penjual', 'harga', 'satuan', 'tanggal_diperiksa']) if (!header.includes(required)) throw new Error(`Kolom ${required} wajib ada.`);
  const option = (value, values, fallback = 'UNKNOWN') => { if (!value) return fallback; const key = value.toLowerCase(); if (!values[key]) throw new Error(`Pilihan “${value}” tidak dikenali. Gunakan petunjuk pada form impor.`); return values[key]; };
  return table.map((cells, index) => {
    if (cells.length !== header.length) throw new Error(`Jumlah kolom di baris ${index + 2} berbeda dari header.`);
    const r = Object.fromEntries(header.map((key, i) => [key, cells[i]]));
    if (!r.tanggal_diperiksa) throw new Error(`Tanggal diperiksa wajib diisi pada baris ${index + 2}.`);
    return { url: r.tautan, title: r.nama_produk, seller: r.penjual, brand: r.merek || '', partNumber: r.nomor_part || '', specifications: r.spesifikasi || '', vehicleCompatibility: r.kendaraan || '',
      productType: option(r.jenis, { original: 'GENUINE', oem: 'OEM', aftermarket: 'AFTERMARKET', 'belum diketahui': 'UNKNOWN' }),
      price: r.harga, packSize: r.isi_kemasan || '1', unit: r.satuan, currency: 'IDR', observedAt: r.tanggal_diperiksa,
      taxBasis: option(r.pajak, { 'belum termasuk': 'EXCLUSIVE', 'sudah termasuk': 'INCLUSIVE', 'belum diketahui': 'UNKNOWN' }),
      availability: option(r.stok, { tersedia: 'IN_STOCK', habis: 'OUT_OF_STOCK', 'belum diketahui': 'UNKNOWN' }),
      condition: option(r.kondisi, { baru: 'NEW', bekas: 'USED', 'belum diketahui': 'UNKNOWN' }), shippingCost: r.ongkir || null };
  });
}
