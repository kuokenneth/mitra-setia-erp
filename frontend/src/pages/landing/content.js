/*
 * CV. Mitra Setia — landing page content.
 * Everything a non-developer may need to edit lives here.
 *
 * Values wrapped in [square brackets] are PLACEHOLDERS for data that has not
 * been confirmed yet. They render on the page with a dashed underline so they
 * are easy to spot. Replace them with verified company data before going live,
 * or set them to null to hide that row entirely.
 */

export const COMPANY = {
  name: "CV. Mitra Setia",
  domain: "mitrasetia.co.id",
  city: "Medan, Sumatera Utara",
  whatsappNumber: "6285389191318",
  whatsappDisplay: "+62 853-8919-1318",
  email: "[info@mitrasetia.co.id]", // confirm the mailbox exists before launch
  address: "[Alamat kantor lengkap], Medan, Sumatera Utara",
};

export const isPlaceholder = value => typeof value === "string" && /\[.+\]/.test(value);
export const clean = value => (typeof value === "string" ? value.replace(/[[\]]/g, "") : value);

export const waLink = message =>
  `https://wa.me/${COMPANY.whatsappNumber}?text=${encodeURIComponent(message)}`;

export const WA_GENERAL = waLink("Halo CV. Mitra Setia, saya ingin berkonsultasi mengenai kebutuhan pengangkutan.");
export const WA_CONSULT = waLink(
  "Halo CV. Mitra Setia, saya ingin mengonsultasikan kebutuhan pengiriman.\n\nJenis muatan: \nRute (asal - tujuan): \nPerkiraan volume: \nJadwal: "
);

/*
 * The three official services. Copy approved by the company (Oct 2026).
 * NOTE: the exact cargo covered by "ambang" is still to be confirmed with the
 * company — keep its image and wording neutral (no specific material) until then.
 */
export const SERVICES = [
  {
    id: "pupuk",
    title: "Pengangkutan Pupuk",
    decor: "Pengangkutan Pupuk",   // large outlined background text (max two lines)
    text: "Layanan pengangkutan pupuk untuk mendukung kebutuhan distribusi perkebunan dan industri, dengan fokus pada ketepatan pengiriman dan keandalan operasional.",
    image: "/landing/svc-pupuk.webp",
    alt: "Pekerja memuat karung ke atas truk CV. Mitra Setia",
    cta: "Diskusikan pengangkutan pupuk",
  },
  {
    id: "cangkang",
    title: "Pengangkutan Cangkang",
    decor: "Pengangkutan Cangkang",
    text: "Solusi transportasi cangkang kelapa sawit untuk mendukung kebutuhan logistik industri dan distribusi bahan bakar biomassa.",
    image: "/landing/svc-cangkang.webp",
    alt: "Jalan lintas perkebunan di Sumatera Utara dilihat dari udara",
    cta: "Diskusikan pengangkutan cangkang",
  },
  {
    id: "ambang-material",
    title: "Pengangkutan Ambang & Material",
    decor: "Ambang & Material",
    text: "Layanan pengangkutan material curah untuk mendukung kebutuhan proyek konstruksi, infrastruktur, dan kegiatan industri.",
    image: "/landing/svc-material.webp",
    alt: "Barisan dump truck heavy-duty CV. Mitra Setia",
    cta: "Diskusikan pengangkutan ambang & material",
  },
];

/* Fleet: only verified figures should appear here. */
export const FLEET = {
  model: "[Hino FM 280 JW]", // confirm the exact model of the units in operation
  specs: [
    { label: "Tipe unit", value: "Dump truck heavy-duty" },
    { label: "Konfigurasi sumbu", value: "[6×4]" },
    { label: "Jumlah unit", value: "[isi jumlah unit]" },
    { label: "Kapasitas muatan", value: "[isi kapasitas per unit]" },
    { label: "Area operasional", value: "Sumatera Utara" },
  ],
};

export const STEPS = [
  { title: "Perencanaan Pengiriman", text: "Jenis muatan, volume, rute, dan jadwal disepakati bersama pelanggan sebelum pekerjaan dimulai." },
  { title: "Penugasan Armada", text: "Unit dan pengemudi ditugaskan sesuai jenis muatan, kondisi rute, dan jadwal yang telah direncanakan." },
  { title: "Proses Pengangkutan", text: "Muatan dimuat, diperiksa, dan dilengkapi dokumen pengiriman sebelum unit berangkat." },
  { title: "Pemantauan Perjalanan", text: "Tim operasional kami mengikuti perjalanan setiap unit secara internal dan berkoordinasi bila ada perubahan di lapangan." },
  { title: "Penyelesaian Pengiriman", text: "Muatan diserahterimakan di lokasi tujuan dan dokumen pengiriman diselesaikan bersama penerima." },
];

export const REASONS = [
  { title: "Armada operasional", text: "Unit heavy-duty yang disiapkan untuk pekerjaan angkutan berat di Sumatera Utara." },
  { title: "Pengalaman dalam logistik industri", text: "Terbiasa menangani pengangkutan pupuk, cangkang kelapa sawit, serta ambang dan material curah untuk pelanggan bisnis." },
  { title: "Koordinasi pengiriman", text: "Satu alur komunikasi dari perencanaan, keberangkatan, hingga serah terima muatan." },
  { title: "Fokus pada keandalan", text: "Disiplin operasional dan dokumentasi yang tertib di setiap tahap pekerjaan." },
  { title: "Kemitraan bisnis jangka panjang", text: "Kami membangun kerja sama yang berkelanjutan, bukan sekadar satu kali pengiriman." },
];
