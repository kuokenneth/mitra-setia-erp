// Formatting and small helpers for Analitik Harga Sparepart.
import { API_BASE, getAccessToken } from "../../api";

const rupiahFormat = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const rupiahCompact = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", notation: "compact", maximumFractionDigits: 1 });

export const rupiah = (value) => (value == null || Number.isNaN(Number(value)) ? "—" : rupiahFormat.format(Math.round(Number(value))).replace(/\s/g, ""));
export const rupiahShort = (value) => (value == null ? "—" : rupiahCompact.format(Number(value)).replace(/\s/g, ""));
export const qty = (value) => (value == null ? "—" : Number(value).toLocaleString("id-ID", { maximumFractionDigits: 3 }));
export const pct = (value, digits = 1) => (value == null ? "—" : `${value > 0 ? "+" : ""}${Number(value).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`);
export const pctPlain = (value, digits = 1) => (value == null ? "—" : `${Math.abs(Number(value)).toLocaleString("id-ID", { maximumFractionDigits: digits })}%`);

export const dateLabel = (value, withYear = true) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
};

export const monthLabel = (key) => {
  const [y, m] = String(key).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" });
};

// Today in WIB as YYYY-MM-DD, and N months back.
export const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
export function monthsAgoKey(months) {
  const [y, m, d] = todayKey().split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 - months, d));
  if (date.getUTCDate() !== d) date.setUTCDate(0); // 31 Mar − 1 month → 28/29 Feb
  return date.toISOString().slice(0, 10);
}

export const PERIODS = [
  { key: "1m", label: "1 bln", months: 1 },
  { key: "3m", label: "3 bln", months: 3 },
  { key: "6m", label: "6 bln", months: 6 },
  { key: "1y", label: "1 thn", months: 12 },
  { key: "all", label: "Semua", months: null },
];
export const periodRange = (key) => {
  const period = PERIODS.find((p) => p.key === key);
  if (!period || period.months == null) return { from: "", to: "" };
  return { from: monthsAgoKey(period.months), to: todayKey() };
};

export const CATEGORY_LABEL = {
  GENERAL_SPAREPART: "Sparepart umum",
  TIRE: "Ban",
  BATTERY: "Aki",
  OIL: "Oli & pelumas",
  OTHER: "Lainnya",
};

export const PRICE_STATUS = {
  INVOICE: { label: "Invoice", note: "Harga final dari invoice supplier." },
  PARTIAL_INVOICE: { label: "Sebagian invoice", note: "Sebagian jumlah sudah diinvoice; sisanya memakai harga sementara penerimaan." },
  RECEIPT: { label: "Sementara", note: "Harga sementara saat barang diterima. Akan diganti harga invoice ketika tagihan supplier dicatat." },
  LEGACY: { label: "Arsip stok", note: "Penerimaan lama tanpa catatan harga penerimaan; memakai harga batch stok." },
};

export const LEVEL = {
  high: { label: "Harga sangat tinggi", tone: "danger" },
  strong: { label: "Harga tinggi", tone: "warn-strong" },
  mild: { label: "Sedikit lebih tinggi", tone: "warn" },
  normal: { label: "Wajar", tone: "ok" },
  lower: { label: "Lebih rendah", tone: "good" },
};

// Consistent supplier colours: index in the item's supplier order.
export const SUPPLIER_COLORS = ["#0d7142", "#2f6fa8", "#c0702a", "#8a4fb3", "#b23b5e", "#23867c", "#7c6a17", "#55616b"];
export const supplierColor = (order, supplierId) => {
  const index = order.findIndex((s) => s.id === supplierId);
  return SUPPLIER_COLORS[(index < 0 ? order.length : index) % SUPPLIER_COLORS.length];
};

export const query = (params) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : "";
};

// Authenticated file download (CSV / Excel export).
export async function downloadFile(path, fallbackName) {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) {
    let message = `Unduhan gagal (${response.status})`;
    try { message = (await response.json()).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const name = disposition.match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
