// src/pages/Maintenance.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useRef, useState } from "react";
import { api, apiAssetUrl, getAccessToken, uploadFiles } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import { ProtectedImage } from "../components/ProtectedFile";
import LoadingState from "../components/LoadingState";
import ImageAnnotationEditor from "../components/ImageAnnotationEditor";
import UploadProgress from "../components/UploadProgress";
import { FiActivity, FiCalendar, FiCamera, FiCheck, FiClock, FiPlus, FiRefreshCw, FiSearch, FiTool, FiTruck } from "react-icons/fi";
import "./Maintenance.css";

const OIL_CHANGE_INTERVAL_KM = 8500;

//////////////////////
// THEME - CORPORATE MINIMALIST
//////////////////////

const BRAND = {
  primary: "#0D7C3D",
  primaryDark: "#0A6331",
  primaryLight: "#10A050",
  secondary: "#F5F9F7",
  accent: "#D4E8DC",
  text: "#1A1A1A",
  textLight: "#4A4A4A",
  textMuted: "#6B7280",
  white: "#FFFFFF",
  border: "#E5E7EB",
  warning: "#F59E0B",
  warningBg: "#FFFBEB",
  success: "#10B981",
  successBg: "#ECFDF5",
  danger: "#EF4444",
  dangerBg: "#FEF2F2",
};

//////////////////////
// HELPERS
//////////////////////

function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m ${ss}s`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

function fmtMoney(n, currency = "IDR") {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${currency} ${v.toLocaleString()}`;
  }
}

function fmtDateTime(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function localDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function installedDays(installedAt) {
  const start = new Date(installedAt).getTime();
  if (!Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / 86400000));
}

function purchaseRequestProgress(request) {
  if (request.status === "REJECTED") return { label: "Ditolak", className: "REJECTED" };
  if (request.status === "CANCELLED") return { label: "Dibatalkan", className: "CANCELLED" };
  if (request.status === "WAITING_APPROVAL") return { label: "Menunggu persetujuan", className: "WAITING_APPROVAL" };
  const orders = (request.purchaseOrders || []).filter((order) => order.status !== "CANCELLED");
  if (!orders.length) return { label: "Disetujui · menunggu PO", className: "APPROVED" };
  if (orders.every((order) => order.status === "FULLY_RECEIVED")) return { label: request.directUse || request.purpose === "MAINTENANCE_STOCK_REQUEST" ? "Barang sudah tiba & dipakai" : "Barang sudah tiba", className: "FULLY_RECEIVED" };
  if (orders.some((order) => ["PARTIALLY_RECEIVED", "FULLY_RECEIVED"].includes(order.status))) return { label: "Diterima sebagian", className: "PARTIALLY_RECEIVED" };
  if (orders.some((order) => order.status === "SENT_TO_SUPPLIER")) return { label: "Dipesan · dalam pengiriman", className: "SENT_TO_SUPPLIER" };
  return { label: "Pesanan sudah dibuat", className: "ORDERED" };
}

function pendingServicePurchaseRequests(job) {
  return (job?.purchaseRequests || []).filter((request) => {
    if (["REJECTED", "CANCELLED"].includes(request.status)) return false;
    if (!(request.directUse || request.purpose === "MAINTENANCE_STOCK_REQUEST")) return false;
    const activeOrders = (request.purchaseOrders || []).filter((order) => order.status !== "CANCELLED");
    if (request.status !== "APPROVED" || !activeOrders.length) return true;
    return (request.items || []).some((item) => {
      const requiredQty = Number(item.approvedQty ?? item.originalQty ?? 0);
      const receivedQty = activeOrders.reduce((sum, order) => sum + (order.items || []).filter((row) => row.itemId === item.itemId).reduce((itemSum, row) => itemSum + Number(row.receivedQty || 0), 0), 0);
      return receivedQty + 0.000001 < requiredQty;
    });
  });
}

//////////////////////
// UI COMPONENTS
//////////////////////

function StatusBadge({ status }) {
  const s = String(status || "").toUpperCase();
  const map = {
    OPEN: { bg: BRAND.warningBg, fg: BRAND.warning, label: "Open" },
    DONE: { bg: BRAND.successBg, fg: BRAND.success, label: "Done" },
    CANCELLED: { bg: "#F3F4F6", fg: BRAND.textMuted, label: "Cancelled" },
    LIVE: { bg: BRAND.accent, fg: BRAND.primary, label: "Live" },
    SELECTED: { bg: BRAND.accent, fg: BRAND.primary, label: "Selected" },
  };
  const c = map[s] || { bg: "#F3F4F6", fg: BRAND.textMuted, label: s || "—" };

  return (
    <span
      style={{
        padding: "6px 12px",
        borderRadius: 4,
        background: c.bg,
        color: c.fg,
        fontWeight: 600,
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.3px",
      }}
    >
      {c.label}
    </span>
  );
}

function Button({ variant = "secondary", children, icon: Icon, ...props }) {
  const styles = {
    primary: {
      background: BRAND.primary,
      color: BRAND.white,
      border: "none",
    },
    secondary: {
      background: BRAND.white,
      color: BRAND.textLight,
      border: `1px solid ${BRAND.border}`,
    },
    danger: {
      background: BRAND.dangerBg,
      color: BRAND.danger,
      border: `1px solid ${BRAND.danger}20`,
    },
  };

  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 16px",
    borderRadius: 6,
    fontWeight: 500,
    fontSize: 14,
    cursor: props.disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s ease",
    opacity: props.disabled ? 0.6 : 1,
    ...styles[variant],
  };

  return (
    <button
      style={baseStyle}
      onMouseEnter={(e) => {
        if (!props.disabled) {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
      {...props}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

function Card({ children, style = {}, className = "" }) {
  return (
    <div className={className}
      style={{
        background: BRAND.white,
        borderRadius: 8,
        border: `1px solid ${BRAND.border}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input
      style={{
        width: "100%",
        height: 44,
        padding: "0 14px",
        borderRadius: 6,
        border: `1px solid ${BRAND.border}`,
        outline: "none",
        fontSize: 14,
        fontWeight: 500,
        color: BRAND.text,
        background: BRAND.white,
        transition: "border-color 0.2s ease",
        boxSizing: "border-box",
      }}
      onFocus={(e) => (e.target.style.borderColor = BRAND.primary)}
      onBlur={(e) => (e.target.style.borderColor = BRAND.border)}
      {...props}
    />
  );
}

function Select({ children, ...props }) {
  return (
    <select
      style={{
        width: "100%",
        height: 44,
        padding: "0 14px",
        paddingRight: 36,
        borderRadius: 6,
        border: `1px solid ${BRAND.border}`,
        outline: "none",
        fontSize: 14,
        fontWeight: 500,
        color: BRAND.text,
        background: BRAND.white,
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236B7280' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        cursor: "pointer",
        boxSizing: "border-box",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

function SearchableItemPicker({ items, value, onChange, disabled, placeholder, testId }) {
  const [query, setQuery] = useState("");
  const selected = items.find((item) => item.id === value);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items.slice(0, 100);
    return items.filter((item) => `${item.sku || ""} ${item.name || ""} ${item.unit || ""}`.toLowerCase().includes(keyword)).slice(0, 100);
  }, [items, query]);

  return (
    <div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={testId}
      />
      <div style={{ maxHeight: 190, overflowY: "auto", marginTop: 8, border: `1px solid ${BRAND.border}`, borderRadius: 6, background: BRAND.white }}>
        {!filtered.length ? (
          <div style={{ padding: 12, fontSize: 13, color: BRAND.textMuted }}>Tidak ada sparepart yang cocok.</div>
        ) : filtered.map((item) => (
          <button
            type="button"
            key={item.id}
            disabled={disabled}
            onClick={() => { onChange(item.id); setQuery(""); }}
            style={{ display: "block", width: "100%", padding: "10px 12px", border: "none", borderBottom: `1px solid ${BRAND.border}`, background: item.id === value ? BRAND.successBg : BRAND.white, boxShadow: item.id === value ? `inset 4px 0 0 ${BRAND.primary}` : "none", color: BRAND.text, textAlign: "left", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13 }}
          >
            {item.id === value && <strong style={{ color: BRAND.primary, marginRight: 7 }}>✓</strong>}<strong>{item.sku}</strong> — {item.name} <span style={{ color: BRAND.textMuted }}>({item.unit || "PCS"})</span>
          </button>
        ))}
      </div>
      <div style={{ minHeight: 18, marginTop: 8, padding: "9px 11px", borderRadius: 6, border: `1px solid ${selected ? BRAND.primary : BRAND.border}`, background: selected ? BRAND.successBg : BRAND.secondary, fontSize: 12, color: selected ? BRAND.primary : BRAND.textMuted, fontWeight: selected ? 700 : 400 }}>
        {selected ? `✓ DIPILIH: ${selected.sku} — ${selected.name}` : "Belum ada item dipilih."}
      </div>
      {!query && items.length > 100 && <div style={{ marginTop: 6, fontSize: 12, color: BRAND.textMuted }}>Menampilkan 100 item pertama. Ketik SKU atau nama untuk mencari.</div>}
    </div>
  );
}

function SearchableStockUnitPicker({ units, value, onChange, disabled, placeholder, testId }) {
  const [query, setQuery] = useState("");
  const selected = units.find((unit) => unit.id === value) || null;
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return units.slice(0, 100);
    return units.filter((unit) => `${unit.serialNumber || ""} ${unit.barcode || ""} ${unit.location?.name || ""}`.toLowerCase().includes(keyword)).slice(0, 100);
  }, [units, query]);
  const label = (unit) => `${unit.serialNumber || unit.barcode || unit.id.slice(0, 8)} • ${unit.location?.name || "Tanpa lokasi"}`;

  return (
    <div>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} disabled={disabled} data-testid={testId} />
      <div style={{ maxHeight: 190, overflowY: "auto", marginTop: 8, border: `1px solid ${BRAND.border}`, borderRadius: 6, background: BRAND.white }}>
        {!filtered.length ? <div style={{ padding: 12, fontSize: 13, color: BRAND.textMuted }}>Tidak ada unit stok yang cocok.</div> : filtered.map((unit) => (
          <button type="button" key={unit.id} disabled={disabled} onClick={() => { onChange(unit.id); setQuery(""); }} style={{ display: "block", width: "100%", padding: "10px 12px", border: "none", borderBottom: `1px solid ${BRAND.border}`, background: unit.id === value ? BRAND.successBg : BRAND.white, boxShadow: unit.id === value ? `inset 4px 0 0 ${BRAND.primary}` : "none", color: BRAND.text, textAlign: "left", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13 }}>
            {unit.id === value && <strong style={{ color: BRAND.primary, marginRight: 7 }}>✓</strong>}{label(unit)}
          </button>
        ))}
      </div>
      <div style={{ minHeight: 18, marginTop: 8, padding: "9px 11px", borderRadius: 6, border: `1px solid ${selected ? BRAND.primary : BRAND.border}`, background: selected ? BRAND.successBg : BRAND.secondary, fontSize: 12, color: selected ? BRAND.primary : BRAND.textMuted, fontWeight: selected ? 700 : 400 }}>
        {selected ? `✓ UNIT BARU DIPILIH: ${label(selected)}` : "Pilih unit baru berdasarkan serial atau barcode."}
      </div>
    </div>
  );
}

function SearchableDonorUnitPicker({ assignments, value, onChange, disabled, testId }) {
  const [query, setQuery] = useState("");
  const selected = assignments.find((assignment) => assignment.id === value) || null;
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return assignments.slice(0, 100);
    return assignments.filter((assignment) => `${assignment.stockUnit?.serialNumber || ""} ${assignment.stockUnit?.barcode || ""} ${assignment.truck?.plateNumber || ""}`.toLowerCase().includes(keyword)).slice(0, 100);
  }, [assignments, query]);
  const label = (assignment) => `${assignment.stockUnit?.serialNumber || assignment.stockUnit?.barcode || assignment.id.slice(0, 8)} • ${assignment.truck?.plateNumber || "Nomor polisi tidak tersedia"}`;
  return <div>
    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nomor seri / nomor polisi donor..." disabled={disabled} data-testid={testId} />
    <div style={{ maxHeight: 160, overflowY: "auto", marginTop: 8, border: `1px solid ${BRAND.border}`, borderRadius: 6, background: BRAND.white }}>
      {!filtered.length ? <div style={{ padding: 12, fontSize: 13, color: BRAND.textMuted }}>Tidak ada unit atau mobil donor yang cocok.</div> : filtered.map((assignment) => <button type="button" key={assignment.id} disabled={disabled} onClick={() => { onChange(assignment.id); setQuery(""); }} style={{ display: "block", width: "100%", padding: "10px 12px", border: "none", borderBottom: `1px solid ${BRAND.border}`, background: assignment.id === value ? BRAND.successBg : BRAND.white, boxShadow: assignment.id === value ? `inset 4px 0 0 ${BRAND.primary}` : "none", color: BRAND.text, textAlign: "left", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13 }}>
        {assignment.id === value && <strong style={{ color: BRAND.primary, marginRight: 7 }}>✓</strong>}{label(assignment)}
      </button>)}
    </div>
    <div style={{ minHeight: 18, marginTop: 8, padding: "9px 11px", borderRadius: 6, border: `1px solid ${selected ? BRAND.primary : BRAND.border}`, background: selected ? BRAND.successBg : BRAND.secondary, fontSize: 12, color: selected ? BRAND.primary : BRAND.textMuted, fontWeight: selected ? 700 : 400 }}>{selected ? `✓ DONOR DIPILIH: ${label(selected)}` : "Pilih unit berdasarkan nomor seri atau nomor polisi mobil donor."}</div>
  </div>;
}

function SearchableSwapUnitPicker({ assignments, value, onChange, disabled, plateNumber, testId }) {
  const [query, setQuery] = useState("");
  const selected = assignments.find((assignment) => assignment.stockUnitId === value) || null;
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return assignments.slice(0, 100);
    return assignments.filter((assignment) => `${assignment.stockUnit?.serialNumber || ""} ${assignment.stockUnit?.barcode || ""} ${assignment.stockUnit?.item?.sku || ""} ${assignment.stockUnit?.item?.name || ""} ${plateNumber || ""}`.toLowerCase().includes(keyword)).slice(0, 100);
  }, [assignments, plateNumber, query]);
  const label = (assignment) => `${assignment.stockUnit?.serialNumber || assignment.stockUnit?.barcode || assignment.stockUnitId.slice(0, 8)} • ${plateNumber || "Mobil servis"}`;
  return <div>
    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nomor seri / nomor polisi mobil servis..." disabled={disabled} data-testid={testId} />
    <div style={{ maxHeight: 160, overflowY: "auto", marginTop: 8, border: `1px solid ${BRAND.border}`, borderRadius: 6, background: BRAND.white }}>
      {!filtered.length ? <div style={{ padding: 12, fontSize: 13, color: BRAND.textMuted }}>Tidak ada unit mobil servis yang cocok.</div> : filtered.map((assignment) => <button type="button" key={assignment.assignmentId || assignment.stockUnitId} disabled={disabled} onClick={() => { onChange(assignment.stockUnitId); setQuery(""); }} style={{ display: "block", width: "100%", padding: "10px 12px", border: "none", borderBottom: `1px solid ${BRAND.border}`, background: assignment.stockUnitId === value ? BRAND.warningBg : BRAND.white, boxShadow: assignment.stockUnitId === value ? `inset 4px 0 0 ${BRAND.warning}` : "none", color: BRAND.text, textAlign: "left", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13 }}>
        {assignment.stockUnitId === value && <strong style={{ color: BRAND.warning, marginRight: 7 }}>✓</strong>}{label(assignment)}
      </button>)}
    </div>
    <div style={{ minHeight: 18, marginTop: 8, padding: "9px 11px", borderRadius: 6, border: `1px solid ${selected ? BRAND.warning : BRAND.border}`, background: selected ? BRAND.warningBg : BRAND.secondary, fontSize: 12, color: selected ? BRAND.text : BRAND.textMuted, fontWeight: selected ? 700 : 400 }}>{selected ? `✓ UNIT TUKAR DIPILIH: ${label(selected)}` : "Pilih unit dari mobil servis yang akan dipasang ke mobil donor."}</div>
  </div>;
}

function SearchableInstalledUnitPicker({ assignments, value, onChange, disabled, loading, testId }) {
  const [query, setQuery] = useState("");
  const selected = assignments.find((assignment) => assignment.stockUnitId === value) || null;
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return assignments.slice(0, 100);
    return assignments.filter((assignment) => {
      const unit = assignment.stockUnit || {};
      return `${unit.serialNumber || ""} ${unit.barcode || ""} ${unit.item?.sku || ""} ${unit.item?.name || ""}`.toLowerCase().includes(keyword);
    }).slice(0, 100);
  }, [assignments, query]);
  const label = (assignment) => {
    const unit = assignment.stockUnit || {};
    const days = installedDays(assignment.installedAt);
    return `${unit.serialNumber || unit.barcode || assignment.stockUnitId.slice(0, 8)} • ${days == null ? "umur tidak diketahui" : `${days} hari digunakan`}`;
  };

  return (
    <div>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={loading ? "Memuat unit terpasang..." : "Cari unit lama untuk diganti (opsional)..."} disabled={disabled || loading} data-testid={testId} />
      <div style={{ maxHeight: 190, overflowY: "auto", marginTop: 8, border: `1px solid ${BRAND.border}`, borderRadius: 6, background: BRAND.white }}>
        <button type="button" disabled={disabled || loading} onClick={() => { onChange(""); setQuery(""); }} style={{ display: "block", width: "100%", padding: "10px 12px", border: "none", borderBottom: `1px solid ${BRAND.border}`, background: value ? BRAND.white : BRAND.successBg, boxShadow: value ? "none" : `inset 4px 0 0 ${BRAND.primary}`, color: value ? BRAND.textMuted : BRAND.primary, textAlign: "left", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, fontWeight: value ? 400 : 700 }}>
          {!value && <span style={{ marginRight: 7 }}>✓</span>}Pasang baru — tidak mengganti unit lama
        </button>
        {!loading && !filtered.length ? <div style={{ padding: 12, fontSize: 13, color: BRAND.textMuted }}>Tidak ada unit terpasang yang cocok.</div> : filtered.map((assignment) => (
          <button type="button" key={assignment.stockUnitId} disabled={disabled || loading} onClick={() => { onChange(assignment.stockUnitId); setQuery(""); }} style={{ display: "block", width: "100%", padding: "10px 12px", border: "none", borderBottom: `1px solid ${BRAND.border}`, background: assignment.stockUnitId === value ? BRAND.warningBg : BRAND.white, boxShadow: assignment.stockUnitId === value ? `inset 4px 0 0 ${BRAND.warning}` : "none", color: BRAND.text, textAlign: "left", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13 }}>
            {assignment.stockUnitId === value && <strong style={{ color: BRAND.warning, marginRight: 7 }}>✓</strong>}{label(assignment)}
          </button>
        ))}
      </div>
      <div style={{ minHeight: 18, marginTop: 8, padding: "9px 11px", borderRadius: 6, border: `1px solid ${selected ? BRAND.warning : BRAND.primary}`, background: selected ? BRAND.warningBg : BRAND.successBg, fontSize: 12, color: selected ? "#9A6700" : BRAND.primary, fontWeight: 700 }}>
        {selected ? `⚠ AKAN DIGANTI: ${label(selected)}` : "✓ MODE PASANG BARU — tidak ada unit lama yang dilepas."}
      </div>
    </div>
  );
}

function LastPartChange({ item, history, loading }) {
  if (!item) return null;
  if (loading) return <div className="maintenance-last-change loading"><FiClock /><span>Memeriksa riwayat {item.name}…</span></div>;
  if (!history) return <div className="maintenance-last-change empty"><FiClock /><span><strong>Belum pernah diganti</strong><small>Belum ada pemakaian {item.name} pada kendaraan ini.</small></span></div>;
  const daysAgo = Number(history.daysAgo || 0);
  return <div className="maintenance-last-change"><FiClock /><span><strong>Terakhir diganti {daysAgo === 0 ? "hari ini" : `${daysAgo} hari lalu`}</strong><small>{fmtDateTime(history.usedAt)} · {history.qty} {item.unit || "unit"}{history.serialNumber ? ` · ${history.serialNumber}` : ""}{history.maintenance?.title ? ` · ${history.maintenance.title}` : ""}</small></span></div>;
}

function SelectedSerialAge({ item, assignment }) {
  if (!item) return null;
  if (!assignment) return <div className="maintenance-last-change empty"><FiClock /><span><strong>Pilih nomor seri unit lama</strong><small>Usia pemakaian akan mengikuti unit yang dipilih untuk dilepas.</small></span></div>;
  const days = installedDays(assignment.installedAt);
  const serial = assignment.stockUnit?.serialNumber || assignment.stockUnit?.barcode || assignment.stockUnitId;
  return <div className="maintenance-last-change"><FiClock /><span><strong>{days === 0 ? "Dipasang hari ini" : `Dipasang ${days} hari lalu`}</strong><small>{serial} · {fmtDateTime(assignment.installedAt)} · {item.name}</small></span></div>;
}

function ServicePhoto({ photo, alt }) {
  const directUrl = apiAssetUrl(photo);
  const isDirect = /^https?:\/\//i.test(directUrl) && !directUrl.includes("/api/uploads/");
  const [src, setSrc] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const url = apiAssetUrl(photo);
    if (/^https?:\/\//i.test(url) && !url.includes("/api/uploads/")) return undefined;

    let active = true;
    let objectUrl = "";
    const token = getAccessToken();
    fetch(url, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (!blob.type.startsWith("image/")) throw new Error("File bukan gambar");
        objectUrl = URL.createObjectURL(blob);
        if (active) setSrc(objectUrl);
      })
      .catch(() => active && setLoadError("Foto tidak dapat dimuat"));

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo]);

  if (loadError) return <div style={{ display: "grid", placeItems: "center", height: "100%", padding: 12, color: BRAND.danger, fontSize: 13, textAlign: "center" }}>{loadError}</div>;
  const displaySrc = isDirect ? directUrl : src;
  if (!displaySrc) return <div style={{ display: "grid", placeItems: "center", height: "100%", color: BRAND.textMuted, fontSize: 13 }}>Memuat foto...</div>;
  return <img src={displaySrc} alt={alt} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />;
}

function Modal({ open, title, onClose, children, width = 900, className = "" }) {
  if (!open) return null;
  return (
    <div
      className="maintenance-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 9999,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`maintenance-modal ${className}`}
        style={{
          width: "100%",
          maxWidth: width,
          background: BRAND.white,
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="maintenance-modal-header"
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${BRAND.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: BRAND.text }}>{title}</h3>
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        </div>
        <div
          className="maintenance-modal-body"
          style={{
            padding: 20,
            maxHeight: "calc(100vh - 160px)",
            overflow: "auto",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

//////////////////////
// MAIN COMPONENT
//////////////////////

export default function Maintenance() {
  const { user } = useAuth();
  const role = user?.role || "UNKNOWN";
  const allowed = role === "OWNER" || role === "ADMIN" || role === "STAFF" || role === "SPAREPART_ADMIN";

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [listSummary, setListSummary] = useState({ total: 0, open: 0, done: 0, cancelled: 0 });

  // live duration
  const [tick, setTick] = useState(0);

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [trucks, setTrucks] = useState([]);
  const [truckSearch, setTruckSearch] = useState("");
  const [trucksLoading, setTrucksLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    truckId: "",
    title: "",
    note: "",
    odometerKm: "",
  });

  // detail modal
  const [showDetail, setShowDetail] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("PARTS");
  const [partMode, setPartMode] = useState("SERIALIZED");

  // items/locations
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);

  // assign serialized
  const [assignItemId, setAssignItemId] = useState("");
  const [availableUnits, setAvailableUnits] = useState([]);
  const [unitPick, setUnitPick] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [serializedSource, setSerializedSource] = useState("INVENTORY");
  const [donorUnits, setDonorUnits] = useState([]);
  const [donorAssignmentId, setDonorAssignmentId] = useState("");
  const [donorMode, setDonorMode] = useState("TAKE_ONLY");
  const [returnAssignments, setReturnAssignments] = useState([]);
  const [returnStockUnitId, setReturnStockUnitId] = useState("");
  const [replaceDisposition, setReplaceDisposition] = useState("IN_STOCK");

  // use non-serialized
  const [useItemId, setUseItemId] = useState("");
  const [useLocationId, setUseLocationId] = useState("");
  const [useQty, setUseQty] = useState("");
  const [useNote, setUseNote] = useState("");
  const [stockSource, setStockSource] = useState("INVENTORY");
  const [donorStocks, setDonorStocks] = useState([]);
  const [donorTruckId, setDonorTruckId] = useState("");
  const [useOilDate, setUseOilDate] = useState(localDateValue());
  const [useOilOdometer, setUseOilOdometer] = useState("");
  const [usingStock, setUsingStock] = useState(false);
  const [returnStockTarget, setReturnStockTarget] = useState(null);
  const [returnStockForm, setReturnStockForm] = useState({ qty: "", reason: "" });
  const [returnStockError, setReturnStockError] = useState("");
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [retreadOptions, setRetreadOptions] = useState({ items: [], suppliers: [], locations: [] });
  const [retreadForm, setRetreadForm] = useState({ toItemId: "", locationId: "", supplierId: "", cost: "", sentAt: "", notes: "" });
  const [progressNote, setProgressNote] = useState("");
  const [savingProgressNote, setSavingProgressNote] = useState(false);
  const [purchaseRequestForm, setPurchaseRequestForm] = useState({ itemId: "", qty: 1, urgency: "URGENT", reason: "", notes: "", newItem: false, sku: "", name: "", unit: "PCS", isSerialized: false });
  const [purchaseDamagePhoto, setPurchaseDamagePhoto] = useState(null);
  const [showPurchasePhotoEditor, setShowPurchasePhotoEditor] = useState(false);
  const [purchaseUploadProgress, setPurchaseUploadProgress] = useState(null);
  const [purchasePhotoError, setPurchasePhotoError] = useState("");
  const [requestingPurchase, setRequestingPurchase] = useState(false);
  const [, setSerializedHistory] = useState(null);
  const [stockHistory, setStockHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState({ serialized: false, stock: false });

  const truckSearchTimer = useRef(null);
  const purchaseDamageInputRef = useRef(null);

  async function load(targetPage = page) {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("page", String(targetPage));

      const data = await api("/maintenance?" + params.toString());
      setJobs(data.jobs || []);
      const nextPagination = data.pagination || { page: 1, limit: 10, total: (data.jobs || []).length, totalPages: 1 };
      setPagination(nextPagination);
      setPage(nextPagination.page);
      setListSummary(data.summary || { total: nextPagination.total, open: 0, done: 0, cancelled: 0 });
    } catch (e) {
      setErr(e.message || "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }
  useLiveRefresh(load);

  async function loadTrucks(search = "") {
    setTrucksLoading(true);
    try {
      const qs = search ? `?q=${encodeURIComponent(search)}` : "";
      const data = await api("/maintenance/trucks" + qs);
      setTrucks(data.trucks || []);
    } finally {
      setTrucksLoading(false);
    }
  }

  async function loadItemsAndLocations() {
    const [itemsRes, locRes] = await Promise.all([api("/inventory/items"), api("/inventory/locations")]);
    setItems(itemsRes.items || []);
    setLocations(locRes.locations || []);
  }

  async function openDetail(id) {
    setShowDetail(true);
    setDetailTab("PARTS");
    setActiveId(id);
    setActiveJob(null);
    setDetailLoading(true);
    try {
      const data = await api("/maintenance/" + id);
      setActiveJob(data.job);

      setAssignItemId("");
      setSerializedHistory(null);
      setAvailableUnits([]);
      setUnitPick("");
      setAssignNote("");
      setSerializedSource("INVENTORY");
      setDonorUnits([]);
      setDonorAssignmentId("");
      setDonorMode("TAKE_ONLY");
      setReturnAssignments([]);
      setReturnStockUnitId("");
      setReplaceDisposition("IN_STOCK");

      setUseItemId("");
      setStockHistory(null);
      setUseLocationId("");
      setUseQty("");
      setUseNote("");
      setUseOilDate(localDateValue());
      setUseOilOdometer("");
      setPhotoError("");
      setProgressNote("");
      setPurchaseRequestForm({ itemId: "", qty: 1, urgency: "URGENT", reason: "", notes: "", newItem: false, sku: "", name: "", unit: "PCS", isSerialized: false });
    } catch (e) {
      setErr(e.message || "Gagal memuat detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail() {
    if (!activeId) return;
    try {
      const data = await api("/maintenance/" + activeId);
      setActiveJob(data.job);
    } catch {
      // Background refresh failures are surfaced by the next foreground load.
    }
  }

  async function loadPartHistory(itemId, kind) {
    const setter = kind === "serialized" ? setSerializedHistory : setStockHistory;
    if (!itemId || !activeJob?.id) {
      setter(null);
      return;
    }
    setHistoryLoading((value) => ({ ...value, [kind]: true }));
    try {
      const data = await api(`/maintenance/${activeJob.id}/part-history/${itemId}`);
      setter(data.history || null);
    } catch (error) {
      setter(null);
      setErr(error.message || "Gagal memuat riwayat penggantian");
    } finally {
      setHistoryLoading((value) => ({ ...value, [kind]: false }));
    }
  }

  async function createMaintenancePurchaseRequest(event) {
    event.preventDefault();
    if (!activeJob?.id) return;
    const form = purchaseRequestForm;
    if (!purchaseDamagePhoto) {
      setPurchasePhotoError("Foto bukti barang rusak wajib ditambahkan sebelum membuat permintaan.");
      return;
    }
    setPurchasePhotoError("");
    const selectedItem = items.find(item => item.id === form.itemId);
    const availableQty = Number(selectedItem?.qtyTotal || 0);
    if (!form.newItem && availableQty > 0 && !form.acknowledgeAvailableStock) {
      setPurchaseRequestForm(current => ({ ...current, acknowledgeAvailableStock: true }));
      setErr(`Peringatan: stok ${selectedItem.name} masih tersedia ${availableQty.toLocaleString("id-ID")} ${selectedItem.unit}. Periksa Inventory terlebih dahulu, atau klik Tetap Buat Permintaan jika pembelian memang diperlukan.`);
      return;
    }
    setRequestingPurchase(true); setErr("");
    try {
      setPurchaseUploadProgress(0);
      const proof = (await uploadFiles([purchaseDamagePhoto], { onProgress: setPurchaseUploadProgress }))[0];
      await api(`/maintenance/${activeJob.id}/purchase-requests`, { method: "POST", body: JSON.stringify({ itemId: form.newItem ? undefined : form.itemId, newItem: form.newItem ? { sku: form.sku, name: form.name, unit: form.unit, isSerialized: form.isSerialized } : undefined, qty: form.qty, urgency: form.urgency, reason: form.reason, notes: form.notes, acknowledgeAvailableStock: Boolean(form.acknowledgeAvailableStock), damageProofUrl: proof?.url, damageProofFileName: proof?.fileName, damageProofMimeType: proof?.mimeType, damageProofSize: proof?.size }) });
      setPurchaseRequestForm({ itemId: "", qty: 1, urgency: "URGENT", reason: "", notes: "", newItem: false, sku: "", name: "", unit: "PCS", isSerialized: false });
      setPurchaseDamagePhoto(null);
      setPurchasePhotoError("");
      await refreshDetail();
    } catch (e) {
      if (String(e.message || "").startsWith("Stok ") && String(e.message || "").includes(" masih tersedia ")) {
        setPurchaseRequestForm(current => ({ ...current, acknowledgeAvailableStock: true }));
      }
      setErr(e.message || "Gagal membuat permintaan pembelian");
    }
    finally { setRequestingPurchase(false); setPurchaseUploadProgress(null); }
  }

  useEffect(() => {
    load();
    loadItemsAndLocations().catch(() => {});
  // Initial page bootstrap; live refresh handles subsequent updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!showCreate) return;
    loadTrucks("").catch((e) => setErr(e.message || "Gagal memuat kendaraan"));
  }, [showCreate]);

  useEffect(() => {
    if (!showCreate) return;
    if (truckSearchTimer.current) clearTimeout(truckSearchTimer.current);
    truckSearchTimer.current = setTimeout(() => {
      loadTrucks(truckSearch.trim()).catch(() => {});
    }, 250);
    return () => {
      if (truckSearchTimer.current) clearTimeout(truckSearchTimer.current);
    };
  }, [truckSearch, showCreate]);

  const filteredTrucks = useMemo(() => {
    const s = truckSearch.trim().toLowerCase();
    if (!s) return trucks;
    return (trucks || []).filter((t) => String(t.plateNumber || "").toLowerCase().includes(s));
  }, [trucks, truckSearch]);

  const selectedTruck = useMemo(() => {
    return (trucks || []).find((t) => t.id === createForm.truckId) || null;
  }, [trucks, createForm.truckId]);

  const fullTitle = useMemo(() => {
    const plate = selectedTruck?.plateNumber ? String(selectedTruck.plateNumber).trim() : "";
    const t = String(createForm.title || "").trim();
    if (!plate && !t) return "";
    if (!plate) return t;
    if (!t) return plate;
    return `${plate} - ${t}`;
  }, [selectedTruck, createForm.title]);

  const serializedItems = useMemo(() => (items || []).filter((i) => i.isSerialized), [items]);
  const nonSerializedItems = useMemo(() => (items || []).filter((i) => !i.isSerialized), [items]);
  const selectedUseItem = useMemo(() => nonSerializedItems.find((item) => item.id === useItemId) || null, [nonSerializedItems, useItemId]);
  const selectedSerializedItem = useMemo(() => serializedItems.find((item) => item.id === assignItemId) || null, [serializedItems, assignItemId]);
  const selectedReturnAssignment = useMemo(() => returnAssignments.find((assignment) => assignment.stockUnitId === returnStockUnitId) || null, [returnAssignments, returnStockUnitId]);
  const hasPreviousOilOdometer = activeJob?.previousOilChange?.odometerKm != null;
  const previousOilOdometer = Number(activeJob?.previousOilChange?.odometerKm || 0);
  const minimumOilOdometer = hasPreviousOilOdometer ? previousOilOdometer + OIL_CHANGE_INTERVAL_KM : 0;
  const enteredOilOdometer = Number(useOilOdometer);
  const oilOdometerValid = useOilOdometer !== "" && Number.isInteger(enteredOilOdometer) && enteredOilOdometer >= 0;
  const oilMileageEligible = oilOdometerValid && (!hasPreviousOilOdometer || enteredOilOdometer >= minimumOilOdometer);

  async function startCreate() {
    setErr("");
    setShowCreate(true);
    setTruckSearch("");
    setTrucks([]);
    setCreateForm({ truckId: "", title: "", note: "", odometerKm: "" });
  }

  async function createJob() {
    setCreating(true);
    setErr("");
    try {
      const payload = {
        truckId: createForm.truckId,
        title: fullTitle,
        note: createForm.note || undefined,
        odometerKm: createForm.odometerKm ? Number(createForm.odometerKm) : undefined,
      };

      const data = await api("/maintenance", { method: "POST", body: JSON.stringify(payload) });
      setShowCreate(false);
      await load();
      if (data?.job?.id) openDetail(data.job.id);
    } catch (e) {
      setErr(e.message || "Gagal membuat");
    } finally {
      setCreating(false);
    }
  }

  async function setJobStatus(newStatus) {
    if (!activeJob?.id) return;
    try {
      await api(`/maintenance/${activeJob.id}/status`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
      await refreshDetail();
      await load();
    } catch (e) {
      setErr(e.message || "Gagal memperbarui status");
    }
  }

  async function loadAvailableUnits(itemId) {
    if (!activeJob?.id || !itemId) return;
    const data = await api(`/maintenance/${activeJob.id}/available-units?itemId=${encodeURIComponent(itemId)}`);
    const units = data.units || [];
    setAvailableUnits(units);
    setUnitPick("");
  }

  async function loadDonorUnits(itemId) {
    if (!activeJob?.id || !itemId) return;
    const res = await api(`/maintenance/${activeJob.id}/donor-units?itemId=${encodeURIComponent(itemId)}`);
    setDonorUnits(res.units || []);
    setDonorAssignmentId("");
  }

  async function loadDonorStocks(itemId) {
    if (!activeJob?.id || !itemId) return;
    const res = await api(`/maintenance/${activeJob.id}/donor-stock?itemId=${encodeURIComponent(itemId)}`);
    setDonorStocks(res.stocks || []);
    setDonorTruckId("");
  }

  async function loadReturnAssignments(itemId = assignItemId) {
    if (!activeJob?.id || !itemId) {
      setReturnAssignments([]);
      setReturnStockUnitId("");
      return;
    }
    const selectedItem = (items || []).find((item) => item.id === itemId);
    const filter = selectedItem?.category === "TIRE" ? "category=TIRE" : `itemId=${encodeURIComponent(itemId)}`;
    const res = await api(`/maintenance/${activeJob.id}/assigned-units?${filter}`);
    setReturnAssignments(res.units || []);
    setReturnStockUnitId("");
  }

  async function changeReplaceDisposition(value) {
    setReplaceDisposition(value);
    if (!["RETREADING", "SECOND"].includes(value)) return;
    try {
      const data = await api("/inventory/retread-options");
      const options = { items: data.items || [], suppliers: data.suppliers || [], locations: data.locations || [] };
      setRetreadOptions(options);
      const oldItemId = selectedReturnAssignment?.stockUnit?.itemId;
      setRetreadForm({
        toItemId: value === "RETREADING" ? options.items.find((item) => item.id !== oldItemId && /masak|retread/i.test(`${item.sku || ""} ${item.name || ""}`))?.id || "" : "",
        locationId: value === "SECOND" ? options.locations[0]?.id || "" : "",
        supplierId: "",
        cost: "",
        sentAt: "",
        notes: "",
      });
    } catch (error) {
      setReplaceDisposition("IN_STOCK");
      setErr(error.message || "Gagal memuat pilihan masak ban");
    }
  }

  async function assignUnit() {
    if (!activeJob?.id) return;
    if (!unitPick) return setErr("Pick a stock unit first");

    setAssigning(true);
    setErr("");
    try {
      if (replaceDisposition === "RETREADING") {
        if (!retreadForm.toItemId) throw new Error("Pilih item tujuan Ban Masak");
      }
      if (replaceDisposition === "SECOND" && !retreadForm.locationId) throw new Error("Pilih lokasi stok Ban Second");
      await api(`/maintenance/${activeJob.id}/assign-unit`, {
        method: "POST",
        body: JSON.stringify({
          stockUnitId: unitPick,
          note: assignNote || undefined,
          replaceStockUnitId: returnStockUnitId || undefined,
          replaceDisposition,
          retread: replaceDisposition === "RETREADING" ? {
            toItemId: retreadForm.toItemId,
            supplierId: retreadForm.supplierId || undefined,
            sentAt: retreadForm.sentAt || undefined,
            notes: retreadForm.notes || undefined,
          } : undefined,
          second: replaceDisposition === "SECOND" ? { locationId: retreadForm.locationId, notes: retreadForm.notes || undefined } : undefined,
        }),
      });

      setAssignNote("");
      setUnitPick("");
      setReturnStockUnitId("");
      setReplaceDisposition("IN_STOCK");
      setRetreadForm({ toItemId: "", locationId: "", supplierId: "", cost: "", sentAt: "", notes: "" });
      await refreshDetail();
      await load();

      if (assignItemId) {
        await Promise.all([loadAvailableUnits(assignItemId), loadReturnAssignments(assignItemId)]);
      }
    } catch (e) {
      setErr(e.message || "Failed to assign unit");
    } finally {
      setAssigning(false);
    }
  }

  function openReturnStock(movement) {
    if (!activeJob?.id || !movement?.id) return;
    const alreadyReturned = (activeJob.movements || []).filter((row) => row.type === "IN" && String(row.note || "").startsWith(`RETURN_OF:${movement.id}`)).reduce((sum, row) => sum + Number(row.qty || 0), 0);
    const remaining = Math.max(0, Number(movement.qty || 0) - alreadyReturned);
    if (!remaining) return;
    setErr("");
    setReturnStockError("");
    setReturnStockTarget({ movement, remaining });
    setReturnStockForm({ qty: String(remaining), reason: "" });
  }

  async function returnNonSerializedStock(event) {
    event.preventDefault();
    if (!activeJob?.id || !returnStockTarget?.movement?.id) return;
    const { movement, remaining } = returnStockTarget;
    const unit = movement.item?.unit || "unit";
    const requestedQty = Number(String(returnStockForm.qty).trim().replace(",", "."));
    if (!Number.isFinite(requestedQty) || requestedQty <= 0 || requestedQty > remaining + 0.000001) {
      setReturnStockError(`Jumlah pengembalian harus lebih dari 0 dan maksimal ${remaining} ${unit}.`);
      return;
    }
    const reason = returnStockForm.reason.trim();
    if (!reason) {
      setReturnStockError("Alasan pengembalian wajib diisi.");
      return;
    }
    setUsingStock(true); setErr(""); setReturnStockError("");
    try {
      await api(`/maintenance/${activeJob.id}/return-stock`, { method: "POST", body: JSON.stringify({ movementId: movement.id, qty: requestedQty, reason }) });
      setReturnStockTarget(null);
      setReturnStockForm({ qty: "", reason: "" });
      await refreshDetail(); await load();
    } catch (e) { setReturnStockError(e.message || "Gagal mengembalikan stok ke Inventory"); }
    finally { setUsingStock(false); }
  }

  async function installDonorUnit() {
    if (!activeJob?.id || !donorAssignmentId) return;
    setAssigning(true); setErr("");
    try {
      await api(`/maintenance/${activeJob.id}/transfer-donor-unit`, { method: "POST", body: JSON.stringify({ assignmentId: donorAssignmentId, returnStockUnitId, note: assignNote || undefined }) });
      setDonorAssignmentId(""); setReturnStockUnitId(""); setAssignNote("");
      await refreshDetail(); await load();
      if (assignItemId) await Promise.all([loadDonorUnits(assignItemId), loadReturnAssignments(assignItemId)]);
    } catch (e) { setErr(e.message || "Gagal memindahkan sparepart donor"); }
    finally { setAssigning(false); }
  }

  async function useStock() {
    if (!activeJob?.id) return;
    const qty = Number(useQty);

    if (!useItemId) return setErr("Select item");
    if (stockSource === "INVENTORY" && !useLocationId) return setErr("Pilih lokasi stok");
    if (stockSource === "DONOR" && !donorTruckId) return setErr("Pilih mobil donor");
    if (!Number.isFinite(qty) || qty <= 0) return setErr("Qty must be > 0");
    if (selectedUseItem?.category === "OIL" && !useOilDate) return setErr("Tanggal ganti oli wajib diisi");
    if (selectedUseItem?.category === "OIL" && (!Number.isInteger(Number(useOilOdometer)) || Number(useOilOdometer) < 0)) return setErr("Odometer saat ganti oli wajib diisi");
    if (selectedUseItem?.category === "OIL" && hasPreviousOilOdometer && !oilMileageEligible) {
      return setErr(`Kendaraan harus berjalan minimal ${OIL_CHANGE_INTERVAL_KM.toLocaleString("id-ID")} km sejak ganti oli terakhir. Odometer minimal ${minimumOilOdometer.toLocaleString("id-ID")} km.`);
    }

    setUsingStock(true);
    setErr("");
    try {
      await api(stockSource === "DONOR" ? `/maintenance/${activeJob.id}/transfer-donor-stock` : `/maintenance/${activeJob.id}/use-stock`, {
        method: "POST",
        body: JSON.stringify({
          itemId: useItemId,
          locationId: stockSource === "INVENTORY" ? useLocationId : undefined,
          donorTruckId: stockSource === "DONOR" ? donorTruckId : undefined,
          qty,
          note: useNote || undefined,
          oilChangedAt: selectedUseItem?.category === "OIL" ? useOilDate : undefined,
          odometerKm: selectedUseItem?.category === "OIL" ? Number(useOilOdometer) : undefined,
        }),
      });
      setUseQty("");
      setUseNote("");
      if (stockSource === "DONOR") await loadDonorStocks(useItemId);
      if (selectedUseItem?.category === "OIL") setUseOilOdometer("");
      await refreshDetail();
      await load();
    } catch (e) {
      setErr(e.message || "Failed to use stock");
    } finally {
      setUsingStock(false);
    }
  }

  async function updatePhotos(photos) {
    if (!activeJob?.id) return;
    const data = await api(`/maintenance/${activeJob.id}/photos`, {
      method: "PATCH",
      body: JSON.stringify({ photos }),
    });
    setActiveJob((job) => (job ? { ...job, photos: data.job.photos || [] } : job));
  }

  async function addProgressNote() {
    const content = progressNote.trim();
    if (!activeJob?.id || !content) return;
    setSavingProgressNote(true);
    setErr("");
    try {
      await api(`/maintenance/${activeJob.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setProgressNote("");
      await refreshDetail();
      await load();
    } catch (e) {
      setErr(e.message || "Gagal menambahkan catatan");
    } finally {
      setSavingProgressNote(false);
    }
  }

  async function uploadMaintenancePhotos(files) {
    const selected = Array.from(files || []);
    if (!selected.length || !activeJob?.id) return;
    setPhotoError("");
    setUploadingPhotos(true);
    try {
      const uploaded = await uploadFiles(selected);
      const photoUrls = uploaded.filter((file) => String(file.mimeType || "").startsWith("image/")).map((file) => file.url);
      if (!photoUrls.length) throw new Error("Pilih file gambar untuk dokumentasi servis.");
      await updatePhotos([...(activeJob.photos || []), ...photoUrls].slice(0, 10));
    } catch (e) {
      setPhotoError(e.message || "Gagal mengunggah foto");
    } finally {
      setUploadingPhotos(false);
    }
  }

  // live tick usage
  const _ = tick;
  const maintenanceSummary = listSummary;
  const pendingPartsRequests = pendingServicePurchaseRequests(activeJob);
  const hasPendingParts = pendingPartsRequests.length > 0;
  const serializedHistoryRows = useMemo(() => {
    const installed = (activeJob?.sparePartAssignments || []).map((assignment) => ({
      ...assignment,
      historyType: "INSTALLED",
      eventAt: assignment.installedAt,
      item: assignment.stockUnit?.item,
      serial: assignment.stockUnit?.serialNumber || assignment.stockUnit?.barcode || assignment.stockUnitId?.slice(0, 8),
      source: assignment.stockUnit?.location?.name || "Inventory",
      historyUnitPrice: assignment.installCost,
      historyTotalCost: assignment.installCost,
    }));
    const removed = (activeJob?.movements || [])
      .filter((movement) => movement.stockUnitId
        && !String(movement.note || "").startsWith("Assigned to maintenance:")
        && !String(movement.note || "").startsWith("RETURN_ASSIGNMENT:"))
      .map((movement) => ({
        ...movement,
        historyType: "REMOVED",
        eventAt: movement.createdAt,
        serial: movement.stockUnit?.serialNumber || movement.stockUnit?.barcode || movement.stockUnitId?.slice(0, 8),
        source: movement.toLocation?.name || movement.toTruck?.plateNumber || "Keluar dari armada",
        historyUnitPrice: movement.unitPrice ?? movement.stockUnit?.assignments?.[0]?.installCost,
        historyTotalCost: movement.totalCost ?? movement.stockUnit?.assignments?.[0]?.installCost,
      }));
    return [...installed, ...removed].sort((a, b) => new Date(b.eventAt) - new Date(a.eventAt));
  }, [activeJob]);

  return (
    <div className="maintenance-page" data-testid="maintenance-page">
      {/* Header */}
      <div className="maintenance-head"
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <span className="maintenance-eyebrow">BENGKEL & PERAWATAN ARMADA</span><h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              color: BRAND.text,
            }}
            data-testid="maintenance-title"
          >
            Servis Kendaraan
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: BRAND.textMuted }}>
            Pantau pekerjaan bengkel, waktu pengerjaan, dan penggunaan sparepart.
          </p>
        </div>

        {allowed && (
          <Button variant="primary" icon={FiPlus} onClick={startCreate} data-testid="new-maintenance-btn">
            <span>Servis Baru</span>
          </Button>
        )}
      </div>

      {/* Error Alert */}
      {err && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 6,
            background: BRAND.dangerBg,
            border: `1px solid ${BRAND.danger}20`,
            color: BRAND.danger,
            fontWeight: 500,
            fontSize: 14,
          }}
          data-testid="error-alert"
        >
          {err}
        </div>
      )}

      <section className="maintenance-stats">
        <article><span><FiTool /></span><div><small>TOTAL SERVIS</small><strong>{maintenanceSummary.total}</strong><p>Dalam hasil pencarian</p></div></article>
        <article className="open"><span><FiActivity /></span><div><small>SEDANG DIKERJAKAN</small><strong>{maintenanceSummary.open}</strong><p>Pekerjaan bengkel aktif</p></div></article>
        <article className="done"><span><FiCheck /></span><div><small>SELESAI</small><strong>{maintenanceSummary.done}</strong><p>Servis telah ditutup</p></div></article>
        <article><span><FiClock /></span><div><small>DIBATALKAN</small><strong>{maintenanceSummary.cancelled}</strong><p>Riwayat tidak dilanjutkan</p></div></article>
      </section>

      {/* Filters Card */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ padding: 20 }}>
          <div
            className="maintenance-filter-grid"
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <div style={{ flex: "1 1 260px", minWidth: 200 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
                Cari servis
              </label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari judul / nomor polisi..."
                data-testid="search-input"
              />
            </div>

            <div style={{ flex: "0 0 160px" }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
                Status
              </label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="status-filter">
                <option value="">Semua Status</option>
                <option value="OPEN">OPEN</option>
                <option value="DONE">DONE</option>
                <option value="CANCELLED">CANCELLED</option>
              </Select>
            </div>

            <div style={{ flex: "0 0 150px" }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
                Dari tanggal
              </label>
              <span className={`date-placeholder-wrap ${from ? "has-value" : ""}`} data-placeholder="Pilih tanggal awal"><Input className="tablet-date-input" aria-label="Tanggal awal servis" type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="from-date" /></span>
            </div>

            <div style={{ flex: "0 0 150px" }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
                Sampai tanggal
              </label>
              <span className={`date-placeholder-wrap ${to ? "has-value" : ""}`} data-placeholder="Pilih tanggal akhir"><Input className="tablet-date-input" aria-label="Tanggal akhir servis" type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="to-date" /></span>
            </div>

            <Button variant="primary" icon={FiSearch} onClick={() => { setPage(1); load(1); }} disabled={loading} data-testid="apply-filter-btn">
              {loading ? "Memuat..." : "Terapkan"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Jobs List */}
      <Card style={{ overflow: "hidden", borderRadius: 14 }}>
        {/* Table Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 0.5fr 0.5fr 0.4fr",
            gap: 12,
            padding: "14px 20px",
            background: BRAND.secondary,
            borderBottom: `1px solid ${BRAND.border}`,
            fontSize: 12,
            fontWeight: 600,
            color: BRAND.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          <div>Pekerjaan servis</div>
          <div>Status</div>
          <div>Durasi</div>
          <div style={{ textAlign: "right" }}>Tindakan</div>
        </div>

        {/* Job Rows */}
        <div style={{ padding: "8px 12px" }}>
          {loading && (!jobs || jobs.length === 0) && <LoadingState compact label="Memuat bengkel" note="Mengambil pekerjaan, kendaraan, dan durasi servis…" rows={5} />}
          {(jobs || []).map((j) => {
            const createdMs = new Date(j.createdAt).getTime();
            const endMs = j.status === "OPEN" ? Date.now() : j.doneAt ? new Date(j.doneAt).getTime() : Date.now();
            const dur = Math.max(0, endMs - createdMs);

            return (
              <div
                key={j.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 0.5fr 0.5fr 0.4fr",
                  gap: 12,
                  padding: "16px 8px",
                  borderBottom: `1px solid ${BRAND.border}`,
                  alignItems: "center",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.secondary)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                className="maintenance-job-row" data-testid={`job-row-${j.id}`}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: BRAND.text }}>{j.title}</div>
                  <small style={{ display: "block", marginTop: 3, color: BRAND.primary, fontWeight: 700 }}>{j.number}</small>
                  <div style={{ fontSize: 13, color: BRAND.textMuted, marginTop: 4 }}>
                    <FiTruck /> {j.truck?.plateNumber || "—"} <span>•</span> <FiCalendar /> {fmtDateTime(j.createdAt)}
                  </div>
                </div>

                <div>
                  <StatusBadge status={j.status} />
                </div>

                <div className={`maintenance-duration ${j.status === "OPEN" ? "is-live" : ""}`}>
                  <span>{j.status === "OPEN" && <i aria-hidden="true" />}{j.status === "OPEN" ? "Sedang berjalan" : "Total waktu"}</span>
                  <strong>{fmtDuration(dur)}</strong>
                </div>

                <div style={{ textAlign: "right" }}>
                  <Button variant="secondary" onClick={() => openDetail(j.id)} data-testid={`open-job-${j.id}`}>
                    Detail
                  </Button>
                </div>
              </div>
            );
          })}

          {!loading && (!jobs || jobs.length === 0) && (
            <div style={{ padding: 24, textAlign: "center", color: BRAND.textMuted, fontSize: 14 }}>
              Tidak ada pekerjaan servis ditemukan.
            </div>
          )}
        </div>
        {pagination.totalPages > 1 && (
          <div className="maintenance-pagination">
            <span>Menampilkan {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} dari {pagination.total} servis</span>
            <div>
              <button type="button" disabled={loading || pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Sebelumnya</button>
              <b>Halaman {pagination.page} dari {pagination.totalPages}</b>
              <button type="button" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>Berikutnya</button>
            </div>
          </div>
        )}
      </Card>

      {/* CREATE MODAL */}
      <Modal open={showCreate} title="Buat Servis Baru" onClose={() => setShowCreate(false)} width={1040} className="maintenance-create-modal">
        <div className="maintenance-create-grid">
          {/* Truck Picker */}
          <Card style={{ overflow: "hidden", borderRadius: 12 }}>
            <div className="maintenance-create-section">
              <div className="maintenance-create-title"><span>1</span><div><strong>Pilih kendaraan</strong><small>Armada READY atau yang sudah berada di bengkel.</small></div></div>
              <Input
                value={truckSearch}
                onChange={(e) => setTruckSearch(e.target.value)}
                placeholder="Cari nomor polisi..."
                data-testid="truck-search"
              />

              <div className="maintenance-truck-list">
                {trucksLoading && <LoadingState compact label="Memuat kendaraan" note="Mencari armada yang tersedia…" rows={3} />}
                {!trucksLoading && (filteredTrucks || []).length === 0 && (
                  <div style={{ padding: 12, color: BRAND.textMuted, fontSize: 14 }}>Tidak ada kendaraan ditemukan.</div>
                )}

                {(filteredTrucks || []).map((t) => {
                  const selected = createForm.truckId === t.id;
                  const unavailable = Boolean(t.activeService);
                  return (
                    <button type="button"
                      key={t.id}
                      disabled={unavailable}
                      onClick={() => !unavailable && setCreateForm((f) => ({ ...f, truckId: t.id }))}
                      className={`maintenance-truck-option ${selected ? "selected" : ""} ${unavailable ? "unavailable" : ""}`}
                      data-testid={`truck-option-${t.id}`}
                    >
                      <i><FiTruck /></i><span><b>{t.plateNumber}</b><small>{unavailable ? `${t.activeService.number} · ${t.activeService.title}` : `${t.brand || "—"} ${t.model || ""}`}</small></span><em>{unavailable ? "SEDANG SERVIS" : selected ? "DIPILIH" : t.status}</em>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Job Info */}
          <Card style={{ overflow: "hidden", borderRadius: 12 }}>
            <div className="maintenance-create-section">
              <div className="maintenance-create-title"><span>2</span><div><strong>Rincian servis</strong><small>Catat jenis pekerjaan dan kondisi awal kendaraan.</small></div></div>

              <div className="maintenance-create-fields">
                <label>Jenis pekerjaan / keluhan
                <Input
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Contoh: servis rem, ganti oli, perbaikan kopling"
                  data-testid="job-title-input"
                /></label>

                <label>Odometer saat masuk <small>Opsional</small>
                <Input
                  type="number"
                  min="0"
                  value={createForm.odometerKm}
                  onChange={(e) => setCreateForm((f) => ({ ...f, odometerKm: e.target.value }))}
                  placeholder="Contoh: 125000 km"
                  data-testid="odometer-input"
                /></label>

                <label>Catatan awal <small>Opsional</small>
                <textarea
                  style={{
                    width: "100%",
                    minHeight: 120,
                    padding: 14,
                    borderRadius: 6,
                    border: `1px solid ${BRAND.border}`,
                    outline: "none",
                    fontSize: 14,
                    fontWeight: 500,
                    color: BRAND.text,
                    resize: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                  value={createForm.note}
                  onChange={(e) => setCreateForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Jelaskan gejala, permintaan pengemudi, atau pemeriksaan yang perlu dilakukan..."
                  data-testid="job-note-input"
                /></label>

                {selectedTruck && <><div className="maintenance-selected-summary"><FiCheck /><span><small>ARMADA TERPILIH</small><strong>{selectedTruck.plateNumber}</strong><em>{selectedTruck.brand || ""} {selectedTruck.model || ""} · {createForm.odometerKm ? `${Number(createForm.odometerKm).toLocaleString("id-ID")} km` : "Odometer belum dicatat"}</em></span></div><div className={`maintenance-last-service ${selectedTruck.lastService ? "has-history" : "empty"}`}><FiClock /><span><small>RIWAYAT SERVIS TERAKHIR</small>{selectedTruck.lastService ? <><strong>Terakhir servis {installedDays(selectedTruck.lastService.doneAt || selectedTruck.lastService.createdAt) === 0 ? "hari ini" : `${installedDays(selectedTruck.lastService.doneAt || selectedTruck.lastService.createdAt)} hari lalu`}</strong><em>{selectedTruck.lastService.title} · {fmtDateTime(selectedTruck.lastService.doneAt || selectedTruck.lastService.createdAt)}{selectedTruck.lastService.odometerKm != null ? ` · ${Number(selectedTruck.lastService.odometerKm).toLocaleString("id-ID")} km` : ""}</em></> : <><strong>Belum ada riwayat servis</strong><em>Servis ini akan menjadi catatan pertama kendaraan.</em></>}</span></div></>}

                <div className="maintenance-create-actions">
                  <Button variant="secondary" onClick={() => setShowCreate(false)}>
                    Batal
                  </Button>
                  <Button
                    variant="primary"
                    onClick={createJob}
                    disabled={creating || !createForm.truckId || !String(createForm.title || "").trim()}
                    data-testid="create-job-btn"
                  >
                    {creating ? "Membuat..." : "Mulai Servis"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </Modal>

      {/* DETAIL MODAL */}
      <Modal open={showDetail && !showPurchasePhotoEditor} title="Detail Servis" onClose={() => setShowDetail(false)} width={1320} className="maintenance-detail-modal">
        {detailLoading || !activeJob ? (
          <LoadingState compact label="Memuat detail servis" note="Menyiapkan pekerjaan dan penggunaan sparepart…" rows={4} />
        ) : (
          <div className="maintenance-detail-layout" style={{ display: "grid", gridTemplateColumns: "minmax(320px, 0.8fr) minmax(620px, 1.6fr)", gap: 20 }}>
            <section className="maintenance-detail-hero">
              <div className="maintenance-detail-hero-main">
                <div><small>DETAIL PEKERJAAN SERVIS · {activeJob.number}</small><h2>{activeJob.title}</h2><p><b>{activeJob.truck?.plateNumber || "—"}</b><span>•</span><FiCalendar /> Masuk {fmtDateTime(activeJob.createdAt)}</p></div>
                <div className="maintenance-hero-side"><StatusBadge status={activeJob.status} />{allowed && <div className="maintenance-hero-actions"><Button variant="primary" icon={FiCheck} onClick={() => setJobStatus("DONE")} disabled={activeJob.status !== "OPEN" || hasPendingParts} title={hasPendingParts ? "Sparepart pesanan belum diterima dan dipasang seluruhnya" : undefined} data-testid="mark-done-hero-btn">Selesaikan</Button><Button variant="secondary" icon={FiRefreshCw} onClick={refreshDetail}>Muat Ulang</Button></div>}</div>
              </div>
              {hasPendingParts && <div className="maintenance-pending-parts-warning"><FiClock /><span><strong>Servis belum dapat diselesaikan</strong><small>Sparepart dari {pendingPartsRequests.map(request => request.number).join(", ")} belum diterima dan dipasang seluruhnya.</small></span></div>}
              <div className="maintenance-detail-metrics">
                <article><small>DURASI {activeJob.status === "OPEN" ? "BERJALAN" : "TOTAL"}</small><strong>{fmtDuration((activeJob.status === "OPEN" ? Date.now() : activeJob.doneAt ? new Date(activeJob.doneAt).getTime() : Date.now()) - new Date(activeJob.createdAt).getTime())}</strong><span><FiClock /> Waktu pengerjaan bengkel</span></article>
                <article><small>BIAYA SPAREPART</small><strong>{fmtMoney(activeJob.totalCost || 0, activeJob.currency || "IDR")}</strong><span><FiTool /> Akumulasi pemakaian stok</span></article>
                <article><small>DOKUMENTASI</small><strong>{(activeJob.photos || []).length} foto</strong><span><FiActivity /> Kondisi dan hasil servis</span></article>
              </div>
            </section>
            <nav className="maintenance-detail-tabs" aria-label="Bagian detail servis">
              <button type="button" className={detailTab === "PARTS" ? "active" : ""} onClick={() => setDetailTab("PARTS")}><FiTool /><span>Sparepart</span><b>{(activeJob.sparePartAssignments || []).length + (activeJob.movements || []).filter((movement) => movement.type === "OUT").length}</b></button>
              <button type="button" className={detailTab === "PURCHASE" ? "active" : ""} onClick={() => setDetailTab("PURCHASE")}><FiPlus /><span>Pesan Sparepart</span><b>{(activeJob.purchaseRequests || []).length}</b></button>
              <button type="button" className={detailTab === "PHOTOS" ? "active" : ""} onClick={() => setDetailTab("PHOTOS")}><FiActivity /><span>Foto</span><b>{(activeJob.photos || []).length}</b></button>
              <button type="button" className={detailTab === "NOTES" ? "active" : ""} onClick={() => setDetailTab("NOTES")}><FiClock /><span>Catatan</span><b>{(activeJob.notes || []).length + (activeJob.note ? 1 : 0)}</b></button>
            </nav>
            {/* LEFT - Job Info */}
            <Card className="maintenance-detail-summary">
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: BRAND.text }}>{activeJob.title}</div>
                    <div style={{ fontSize: 13, color: BRAND.textMuted, marginTop: 4 }}>
                    {activeJob.truck?.plateNumber || "—"} • Dibuat: {fmtDateTime(activeJob.createdAt)}
                    </div>
                  </div>
                  <StatusBadge status={activeJob.status} />
                </div>

                {/* Duration Card */}
                <div
                  className="maintenance-part-box serialized"
                  style={{
                    padding: 16,
                    borderRadius: 6,
                    background: BRAND.secondary,
                    border: `1px solid ${BRAND.border}`,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500, color: BRAND.textMuted, marginBottom: 6 }}>
                    {activeJob.status === "OPEN" ? "Durasi berjalan" : "Total durasi"}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: BRAND.text }}>
                    {fmtDuration(
                      (activeJob.status === "OPEN"
                        ? Date.now()
                        : activeJob.doneAt
                        ? new Date(activeJob.doneAt).getTime()
                        : Date.now()) - new Date(activeJob.createdAt).getTime()
                    )}
                  </div>
                </div>

                {/* Cost Card */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 6,
                    background: BRAND.secondary,
                    border: `1px solid ${BRAND.border}`,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500, color: BRAND.textMuted, marginBottom: 6 }}>
                    Total biaya suku cadang
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: BRAND.primary }}>
                    {fmtMoney(activeJob.totalCost || 0, activeJob.currency || "IDR")}
                  </div>
                </div>

                {/* Actions */}
                {allowed && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button
                      variant="primary"
                      icon={FiCheck}
                      onClick={() => setJobStatus("DONE")}
                      disabled={activeJob.status !== "OPEN" || hasPendingParts}
                      title={hasPendingParts ? "Sparepart pesanan belum diterima dan dipasang seluruhnya" : undefined}
                      data-testid="mark-done-btn"
                    >
                      Selesaikan Servis
                    </Button>
                    <Button variant="secondary" icon={FiRefreshCw} onClick={refreshDetail} data-testid="refresh-btn">
                      Muat Ulang
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {detailTab === "PHOTOS" && <Card className="maintenance-detail-photos" style={{ gridColumn: "1 / -1", gridRow: "2" }}>
              <div style={{ padding: 16 }}>
                {activeJob.isOilChange && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 18 }}>
                    <div style={{ padding: 14, borderRadius: 6, border: `1px solid ${BRAND.primary}`, background: BRAND.successBg }}>
                      <div style={{ fontWeight: 700, color: BRAND.primary }}>Ganti oli sekarang</div>
                      <div style={{ marginTop: 6 }}>{fmtDateTime(activeJob.oilChangedAt)} • {Number(activeJob.odometerKm || 0).toLocaleString()} km</div>
                      <div style={{ marginTop: 5, fontSize: 12, color: BRAND.textMuted }}>{(activeJob.photos || []).length} bukti foto</div>
                    </div>
                    <div style={{ padding: 14, borderRadius: 6, border: `1px solid ${BRAND.border}`, background: BRAND.secondary }}>
                      <div style={{ fontWeight: 700, color: BRAND.text }}>Ganti oli sebelumnya</div>
                      {activeJob.previousOilChange ? (
                        <>
                          <div style={{ marginTop: 6 }}>{fmtDateTime(activeJob.previousOilChange.oilChangedAt)} • {Number(activeJob.previousOilChange.odometerKm || 0).toLocaleString()} km</div>
                          <div style={{ marginTop: 5, fontSize: 12, color: BRAND.textMuted }}>
                            Selisih {Math.max(0, Number(activeJob.odometerKm || 0) - Number(activeJob.previousOilChange.odometerKm || 0)).toLocaleString()} km • {(activeJob.previousOilChange.photos || []).length} bukti foto
                          </div>
                        </>
                      ) : <div style={{ marginTop: 6, color: BRAND.textMuted }}>Belum ada riwayat sebelumnya.</div>}
                    </div>
                    {!!activeJob.previousOilChange?.photos?.length && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: BRAND.text }}>Bukti foto penggantian sebelumnya</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                          {activeJob.previousOilChange.photos.map((photo, index) => (
                            <div key={photo} style={{ height: 150, borderRadius: 6, overflow: "hidden", border: `1px solid ${BRAND.border}`, background: BRAND.white }}>
                              <ProtectedImage url={photo} alt={`Bukti ganti oli sebelumnya ${index + 1}`} style={{ width: "100%", height: "150px", objectFit: "cover" }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="maintenance-detail-section-heading"><span>02</span><div><strong>Dokumentasi servis</strong><small>Foto komponen, proses pemasangan, dan hasil pekerjaan.</small></div></div>
                {allowed && (
                  <label className={`maintenance-photo-dropzone ${uploadingPhotos ? "uploading" : ""}`}>
                    <input type="file" accept="image/*" multiple hidden disabled={uploadingPhotos} onChange={(e) => { uploadMaintenancePhotos(e.target.files); e.target.value = ""; }} />
                    <span className="maintenance-photo-dropzone-icon"><FiCamera /></span>
                    <span><strong>{uploadingPhotos ? "Mengunggah foto…" : "Ketuk untuk tambah foto"}</strong><small>Foto komponen, proses pemasangan, atau hasil pekerjaan · maksimal 10 foto</small></span>
                    <b>{(activeJob.photos || []).length}/10</b>
                  </label>
                )}
                {photoError && <div style={{ marginTop: 10, color: BRAND.danger, fontSize: 13 }}>{photoError}</div>}
                {(activeJob.photos || []).length ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginTop: 16 }}>
                    {(activeJob.photos || []).map((photo, index) => (
                      <div key={photo} style={{ position: "relative", height: 240, borderRadius: 8, overflow: "hidden", border: `1px solid ${BRAND.border}`, background: BRAND.secondary }}>
                        <ProtectedImage url={photo} alt={`Dokumentasi servis ${index + 1}`} style={{ display: "block", width: "100%", height: "240px", objectFit: "cover" }} />
                        {allowed && <button type="button" onClick={() => updatePhotos((activeJob.photos || []).filter((_, photoIndex) => photoIndex !== index)).catch((e) => setPhotoError(e.message || "Gagal menghapus foto"))} style={{ position: "absolute", top: 6, right: 6, border: "none", borderRadius: 4, background: "rgba(255,255,255,0.92)", color: BRAND.danger, cursor: "pointer", padding: "4px 7px", fontWeight: 700 }}>×</button>}
                      </div>
                    ))}
                  </div>
                ) : <div style={{ marginTop: 14, color: BRAND.textMuted, fontSize: 13 }}>Belum ada foto dokumentasi.</div>}
              </div>
            </Card>}

            {detailTab === "NOTES" && <Card className="maintenance-detail-notes" style={{ gridColumn: "1 / -1" }}>
              <div style={{ padding: 16 }}>
                <div className="maintenance-detail-section-heading"><span>03</span><div><strong>Catatan perkembangan</strong><small>Temuan baru dan pembaruan selama pengerjaan.</small></div></div>
                <div style={{ marginTop: 5, fontSize: 13, color: BRAND.textMuted }}>
                  Tambahkan temuan kerusakan atau pekerjaan baru tanpa menghapus riwayat sebelumnya.
                </div>

                {allowed && activeJob.status === "OPEN" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end", marginTop: 14 }}>
                    <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
                      Catatan baru
                      <textarea
                        value={progressNote}
                        onChange={(e) => setProgressNote(e.target.value.slice(0, 2000))}
                        placeholder="Contoh: Saat dibongkar ditemukan bearing roda aus dan perlu diganti."
                        style={{ width: "100%", minHeight: 82, padding: 12, borderRadius: 6, border: `1px solid ${BRAND.border}`, resize: "vertical", font: "inherit", boxSizing: "border-box" }}
                      />
                    </label>
                    <Button variant="primary" onClick={addProgressNote} disabled={savingProgressNote || !progressNote.trim()}>
                      {savingProgressNote ? "Menyimpan..." : "Tambah Catatan"}
                    </Button>
                  </div>
                ) : null}

                <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                  {activeJob.note ? (
                    <div style={{ padding: 13, borderRadius: 6, border: `1px solid ${BRAND.accent}`, background: BRAND.successBg }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                        <strong style={{ fontSize: 13, color: BRAND.primary }}>Catatan awal servis</strong>
                        <span style={{ fontSize: 12, color: BRAND.textMuted }}>{fmtDateTime(activeJob.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.55, color: BRAND.textLight, whiteSpace: "pre-wrap" }}>{activeJob.note}</div>
                    </div>
                  ) : null}
                  {(activeJob.notes || []).map((entry) => (
                    <div key={entry.id} style={{ padding: 13, borderRadius: 6, border: `1px solid ${BRAND.border}`, background: BRAND.secondary }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                        <strong style={{ fontSize: 13, color: BRAND.text }}>{entry.createdBy?.name || entry.createdBy?.email || "Pengguna"}</strong>
                        <span style={{ fontSize: 12, color: BRAND.textMuted }}>{fmtDateTime(entry.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.55, color: BRAND.textLight, whiteSpace: "pre-wrap" }}>{entry.content}</div>
                    </div>
                  ))}
                  {!activeJob.note && (activeJob.notes || []).length === 0 ? <div style={{ color: BRAND.textMuted, fontSize: 13 }}>Belum ada catatan perkembangan.</div> : null}
                </div>
              </div>
            </Card>}

            {/* RIGHT - Spare Parts */}
            {["PARTS", "PURCHASE"].includes(detailTab) && <Card className={`maintenance-detail-parts ${detailTab === "PURCHASE" ? "purchase-only" : "stock-only"}`} style={{ gridColumn: "2", gridRow: "1" }}>
              <div style={{ padding: 16 }}>
                {detailTab === "PARTS" ? <div className="maintenance-detail-section-heading"><span>01</span><div><strong>Penggunaan sparepart</strong><small>Pilih jenis sparepart yang akan dicatat pada servis ini.</small></div></div> : <div className="maintenance-detail-section-heading"><span>01</span><div><strong>Pesan sparepart untuk servis</strong><small>Barang yang diterima masuk Inventory dan dipasang manual dari servis ini.</small></div></div>}

                {detailTab === "PARTS" && <div className="maintenance-part-mode" role="tablist" aria-label="Jenis penggunaan sparepart">
                  <button type="button" role="tab" aria-selected={partMode === "SERIALIZED"} className={partMode === "SERIALIZED" ? "active" : ""} onClick={() => setPartMode("SERIALIZED")}>
                    <span>A</span><div><strong>Unit berserial</strong><small>Ban, aki, dan komponen bernomor seri</small></div>
                  </button>
                  <button type="button" role="tab" aria-selected={partMode === "STOCK"} className={partMode === "STOCK" ? "active" : ""} onClick={() => setPartMode("STOCK")}>
                    <span>B</span><div><strong>Stok biasa</strong><small>Oli, grease, baut, dan barang satuan</small></div>
                  </button>
                </div>}

                <form className={`maintenance-direct-request ${detailTab !== "PURCHASE" ? "maintenance-detail-section-hidden" : ""}`} onSubmit={createMaintenancePurchaseRequest}>
                  <section className={`maintenance-request-card maintenance-proof-card ${purchasePhotoError ? "has-error" : ""}`}><div className="maintenance-request-card-title"><span>03</span><div><strong>Bukti barang rusak</strong><small>Foto wajib disertakan agar pemilik dapat memeriksa pengajuan.</small></div></div><button type="button" className={`maintenance-damage-proof ${purchaseDamagePhoto ? "has-file" : ""}`} onClick={() => purchaseDamageInputRef.current?.click()}><span className="maintenance-proof-icon"><FiCamera /></span><span className="maintenance-proof-copy"><strong>{purchaseDamagePhoto ? "Foto siap dikirim" : "Ketuk untuk tambah foto barang rusak"}</strong><small>{purchaseDamagePhoto ? `${purchaseDamagePhoto.name} · Ketuk kembali untuk mengganti` : "Ambil foto menggunakan kamera belakang"}</small></span></button>{purchasePhotoError && <div className="maintenance-proof-error">{purchasePhotoError}</div>}{purchaseDamagePhoto && <button type="button" className="maintenance-proof-annotate" onClick={() => setShowPurchasePhotoEditor(true)}>Tandai bagian yang rusak (opsional)</button>}<UploadProgress progress={purchaseUploadProgress} label="Mengunggah bukti barang rusak" /><button className="maintenance-request-submit maintenance-proof-submit" disabled={requestingPurchase || activeJob.status !== "OPEN"}>{requestingPurchase ? "Mengirim..." : purchaseRequestForm.acknowledgeAvailableStock ? "Tetap Buat Permintaan" : "Buat Permintaan"}</button></section>
                  <div className="maintenance-request-head"><span><FiPlus /></span><div><strong>Pesan sparepart untuk servis ini</strong><small>Permintaan tetap terlacak di servis; barang masuk Inventory saat diterima.</small></div><em>UNTUK SERVIS</em></div>
                  <section className="maintenance-request-card"><div className="maintenance-request-card-title"><span>01</span><div><strong>Pilih barang</strong><small>Gunakan katalog atau daftarkan sparepart baru.</small></div></div><div className="maintenance-request-mode"><button type="button" className={!purchaseRequestForm.newItem ? "active" : ""} onClick={() => { setErr(""); setPurchaseRequestForm(form => ({ ...form, newItem: false, acknowledgeAvailableStock: false })); }}>Pilih katalog</button><button type="button" className={purchaseRequestForm.newItem ? "active" : ""} onClick={() => { setErr(""); setPurchaseRequestForm(form => ({ ...form, newItem: true, acknowledgeAvailableStock: false })); }}>Sparepart baru</button></div>
                    {!purchaseRequestForm.newItem ? <label>Sparepart<SearchableItemPicker items={items} value={purchaseRequestForm.itemId} onChange={itemId => { setErr(""); setPurchaseRequestForm(form => ({ ...form, itemId, acknowledgeAvailableStock: false })); }} disabled={requestingPurchase} placeholder="Cari SKU atau nama sparepart..." testId="maintenance-purchase-item-search" />{Number(items.find(item => item.id === purchaseRequestForm.itemId)?.qtyTotal || 0) > 0 && <span className="maintenance-stock-warning">⚠ Stok masih tersedia: <b>{Number(items.find(item => item.id === purchaseRequestForm.itemId)?.qtyTotal || 0).toLocaleString("id-ID")} {items.find(item => item.id === purchaseRequestForm.itemId)?.unit}</b>. Periksa Inventory sebelum membeli.</span>}</label> : <div className="maintenance-request-new-item"><label>SKU<input required value={purchaseRequestForm.sku} onChange={event => setPurchaseRequestForm(form => ({ ...form, sku: event.target.value }))} placeholder="Contoh: BRK-HINO-02" /></label><label>Nama sparepart<input required value={purchaseRequestForm.name} onChange={event => setPurchaseRequestForm(form => ({ ...form, name: event.target.value }))} placeholder="Contoh: Master rem Hino" /></label><label>Satuan<select value={purchaseRequestForm.unit} onChange={event => setPurchaseRequestForm(form => ({ ...form, unit: event.target.value }))}><option>PCS</option><option>SET</option><option>UNIT</option><option>LITER</option></select></label><label className="maintenance-request-check"><input type="checkbox" checked={purchaseRequestForm.isSerialized} onChange={event => setPurchaseRequestForm(form => ({ ...form, isSerialized: event.target.checked }))} /> Memiliki nomor serial</label></div>}
                  </section>
                  <section className="maintenance-request-card"><div className="maintenance-request-card-title"><span>02</span><div><strong>Detail kebutuhan</strong><small>Tentukan jumlah, tingkat urgensi, dan alasan pemesanan.</small></div></div><div className="maintenance-request-fields"><label>Jumlah<input required type="number" min="0.01" step="0.01" value={purchaseRequestForm.qty} onChange={event => setPurchaseRequestForm(form => ({ ...form, qty: event.target.value }))} /></label><label>Urgensi<select value={purchaseRequestForm.urgency} onChange={event => setPurchaseRequestForm(form => ({ ...form, urgency: event.target.value }))}><option value="NORMAL">Normal</option><option value="URGENT">Mendesak</option><option value="CRITICAL">Kritis</option></select></label><label>Alasan kebutuhan<input required value={purchaseRequestForm.reason} onChange={event => setPurchaseRequestForm(form => ({ ...form, reason: event.target.value }))} placeholder="Contoh: komponen rusak dan tidak tersedia di gudang" /></label></div></section>
                  {(activeJob.purchaseRequests?.length || activeJob.partRepairs?.length) ? <section className="maintenance-request-log"><div className="maintenance-request-card-title"><span>RIWAYAT</span><div><strong>Permintaan dari servis ini</strong><small>Status pembelian, pengiriman, dan penerimaan barang.</small></div></div>{!!activeJob.purchaseRequests?.length && <div className="maintenance-request-history">{activeJob.purchaseRequests.map(request => { const progress = purchaseRequestProgress(request); const orderNumbers = (request.purchaseOrders || []).filter(order => order.status !== "CANCELLED").map(order => order.number).join(", "); return <span key={request.id}><b>{request.number}</b><small>{request.items?.map(row => `${row.item.name} · ${row.originalQty} ${row.item.unit}`).join(", ")}{orderNumbers ? ` · ${orderNumbers}` : ""}</small><em className={progress.className}>{progress.label}</em></span>; })}</div>}{!!activeJob.partRepairs?.length && <div className="maintenance-request-history">{activeJob.partRepairs.map(repair => <span key={repair.id}><b>PERBAIKAN · {repair.stockUnit?.serialNumber || repair.stockUnit?.barcode || "Tanpa serial"}</b><small>{repair.stockUnit?.item?.name}{repair.supplier?.name ? ` · ${repair.supplier.name}` : " · Vendor belum dipilih"}</small><em className={repair.status}>{repair.status === "SENT" ? "DALAM PERBAIKAN" : repair.status}</em></span>)}</div>}</section> : <div className="maintenance-request-empty">Belum ada permintaan pembelian dari servis ini.</div>}
                </form>

                {/* A) Serialized assign */}
                <div
                  className={`maintenance-part-box serialized ${detailTab !== "PARTS" || partMode !== "SERIALIZED" ? "maintenance-detail-section-hidden" : ""}`}
                  style={{
                    padding: 16,
                    borderRadius: 6,
                    border: `1px solid ${BRAND.border}`,
                    marginBottom: 16,
                  }}
                >
                  <div className="maintenance-part-box-title"><span>A</span><div><strong>Pasang unit berserial</strong><small>Ban, aki, atau komponen yang memiliki nomor seri.</small></div></div>

                  <div className="maintenance-source-switch">
                    <button type="button" className={serializedSource === "INVENTORY" ? "active" : ""} onClick={() => { setSerializedSource("INVENTORY"); setDonorAssignmentId(""); setDonorMode("TAKE_ONLY"); setReturnStockUnitId(""); }}><span>01</span><div><strong>Dari Inventory</strong><small>Pasang baru atau ganti unit terpasang</small></div></button>
                    <button type="button" className={serializedSource === "DONOR" ? "active" : ""} onClick={() => { setSerializedSource("DONOR"); setUnitPick(""); setReturnStockUnitId(""); setReplaceDisposition("IN_STOCK"); }}><span>02</span><div><strong>Dari mobil lain</strong><small>Ambil saja atau tukar antar armada</small></div></button>
                  </div>

                  <div className={`maintenance-serialized-grid source-${serializedSource.toLowerCase()}`}>
                    <div className="maintenance-part-field item-field"><label>Jenis sparepart</label><SearchableItemPicker
                      items={serializedItems}
                      value={assignItemId}
                      onChange={async (v) => {
                        setAssignItemId(v);
                        setUnitPick("");
                        setAvailableUnits([]);
                        setDonorUnits([]);
                        setDonorAssignmentId("");
                        setDonorMode("TAKE_ONLY");
                        setReturnAssignments([]);
                        setReturnStockUnitId("");
                        setReplaceDisposition("IN_STOCK");
                        if (!v) return;
                        await Promise.all([loadAvailableUnits(v), loadDonorUnits(v), loadReturnAssignments(v), loadPartHistory(v, "serialized")]);
                      }}
                      disabled={!allowed || activeJob.status !== "OPEN"}
                      placeholder="Cari SKU / nama item serialized..."
                      testId="serialized-item-search"
                    /></div>

                    {serializedSource === "INVENTORY" ? <div className="maintenance-part-field"><label>Unit baru dari Inventory</label><SearchableStockUnitPicker
                      units={availableUnits}
                      value={unitPick}
                      onChange={setUnitPick}
                      disabled={!allowed || activeJob.status !== "OPEN" || !assignItemId}
                      placeholder="Cari serial / barcode unit baru..."
                      testId="stock-unit-search"
                    /></div> : <div className="maintenance-part-field"><label>Unit dan mobil donor</label><SearchableDonorUnitPicker assignments={donorUnits} value={donorAssignmentId} onChange={setDonorAssignmentId} disabled={!allowed || activeJob.status !== "OPEN" || !assignItemId} testId="donor-unit-search" /></div>}
                    {serializedSource === "DONOR" && <div className="maintenance-donor-transfer-column">
                      <div className="maintenance-part-field"><label>Cara pemindahan</label><Select value={donorMode} onChange={(e) => { setDonorMode(e.target.value); if (e.target.value === "TAKE_ONLY") setReturnStockUnitId(""); }} disabled={!allowed || activeJob.status !== "OPEN" || !donorAssignmentId}>
                        <option value="TAKE_ONLY">Ambil saja — mobil donor dibiarkan tanpa unit</option>
                        <option value="SWAP">Tukar sparepart antar mobil</option>
                      </Select></div>
                      {donorMode === "SWAP" && <div className="maintenance-part-field"><label>Unit dari mobil servis untuk ditukar</label><SearchableSwapUnitPicker assignments={returnAssignments.filter((a) => a.stockUnit?.itemId === assignItemId)} value={returnStockUnitId} onChange={setReturnStockUnitId} plateNumber={activeJob?.truck?.plateNumber} disabled={!allowed || activeJob.status !== "OPEN" || !assignItemId} testId="swap-unit-search" /></div>}
                    </div>}
                    {serializedSource === "INVENTORY" && <div className="maintenance-part-field"><label>Unit lama yang dilepas <em>Opsional</em></label><Select value={returnStockUnitId} onChange={(e) => { const nextId=e.target.value; const nextAssignment=returnAssignments.find((assignment)=>assignment.stockUnitId===nextId); setReturnStockUnitId(nextId); if(nextAssignment?.stockUnit?.item?.category==="TIRE") changeReplaceDisposition("SECOND"); else setReplaceDisposition("IN_STOCK"); }} disabled={!allowed || activeJob.status !== "OPEN" || !assignItemId}>
                      <option value="">Tidak mengganti unit lama</option>
                      {returnAssignments.map((a) => <option key={a.assignmentId} value={a.stockUnitId}>Ganti {a.stockUnit?.item?.name} · {a.stockUnit?.serialNumber || a.stockUnit?.barcode || a.stockUnitId} · {installedDays(a.installedAt)} hari</option>)}
                    </Select></div>}
                    {serializedSource === "INVENTORY" && returnStockUnitId && <div className="maintenance-part-field"><label>Setelah dilepas</label><Select value={replaceDisposition} onChange={(e) => changeReplaceDisposition(e.target.value)} disabled={!allowed || activeJob.status !== "OPEN"}>
                      {selectedReturnAssignment?.stockUnit?.item?.category === "TIRE" ? <><option value="SECOND">Jadikan Ban Second & kembali ke Inventory</option><option value="RETREADING">Kirim untuk masak ban</option></> : <><option value="IN_STOCK">Unit lama kembali ke Inventory</option><option value="REPAIRING">Unit lama dikirim untuk perbaikan</option></>}
                      <option value="SCRAPPED">Unit lama di-scrap</option>
                    </Select></div>}
                    {serializedSource === "INVENTORY" && returnStockUnitId && replaceDisposition === "SECOND" && <div className="maintenance-retread-inline maintenance-second-inline">
                      <div className="maintenance-retread-notice"><strong>Ban lama menjadi {selectedReturnAssignment?.stockUnit?.item?.sku}_SECOND</strong><small>Nomor seri tetap sama dan unit kembali tersedia di Inventory.</small></div>
                      <label className="wide">Lokasi stok Ban Second<Select value={retreadForm.locationId} onChange={(e)=>setRetreadForm((form)=>({...form,locationId:e.target.value}))}><option value="">Pilih lokasi Inventory</option>{retreadOptions.locations.map((location)=><option key={location.id} value={location.id}>{location.name}</option>)}</Select></label>
                      <label className="wide">Catatan<Input value={retreadForm.notes} onChange={(e)=>setRetreadForm((form)=>({...form,notes:e.target.value}))} placeholder="Contoh: tapak masih layak sebagai ban second"/></label>
                    </div>}
                    {serializedSource === "INVENTORY" && returnStockUnitId && replaceDisposition === "RETREADING" && <div className="maintenance-retread-inline">
                      <div className="maintenance-retread-notice"><strong>Ban lama akan dikirim untuk masak</strong><small>Nomor seri tetap sama dan status unit berubah menjadi RETREADING. Harga final diisi saat penerimaan Ban Masak.</small></div>
                      <label>Item tujuan setelah dimasak<Select value={retreadForm.toItemId} onChange={(e)=>setRetreadForm((form)=>({...form,toItemId:e.target.value}))}><option value="">Pilih item Ban Masak</option>{retreadOptions.items.filter((item)=>item.id!==selectedReturnAssignment?.stockUnit?.itemId).map((item)=><option key={item.id} value={item.id}>{item.sku} — {item.name}</option>)}</Select></label>
                      <label>Vendor masak ban<Select value={retreadForm.supplierId} onChange={(e)=>setRetreadForm((form)=>({...form,supplierId:e.target.value}))}><option value="">Tanpa vendor</option>{retreadOptions.suppliers.map((supplier)=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</Select></label>
                      <label>Tanggal dilepas / dikirim<Input type="datetime-local" value={retreadForm.sentAt} onChange={(e)=>setRetreadForm((form)=>({...form,sentAt:e.target.value}))}/></label>
                      <label className="wide">Catatan masak<Input value={retreadForm.notes} onChange={(e)=>setRetreadForm((form)=>({...form,notes:e.target.value}))} placeholder="Contoh: casing masih layak"/></label>
                    </div>}
                  </div>

                  <SelectedSerialAge item={selectedSerializedItem} assignment={selectedReturnAssignment} />

                  <div className="maintenance-install-footer">
                    <Input
                      value={assignNote}
                      onChange={(e) => setAssignNote(e.target.value)}
                      placeholder="Catatan pemasangan (opsional)"
                      disabled={!allowed || activeJob.status !== "OPEN"}
                      data-testid="assign-note-input"
                    />
                    <Button
                      variant="primary"
                      onClick={serializedSource === "DONOR" ? installDonorUnit : assignUnit}
                      disabled={!allowed || activeJob.status !== "OPEN" || assigning || (serializedSource === "DONOR" ? !donorAssignmentId || (donorMode === "SWAP" && !returnStockUnitId) : !unitPick)}
                      data-testid="assign-unit-btn"
                    >
                      {assigning ? "Memasang..." : serializedSource === "DONOR" ? "Pindahkan & Pasang" : "Pasang Unit"}
                    </Button>
                  </div>
                </div>

                {/* B) Non-serialized use */}
                <div
                  className={`maintenance-part-box stock ${detailTab !== "PARTS" || partMode !== "STOCK" ? "maintenance-detail-section-hidden" : ""}`}
                  style={{
                    padding: 16,
                    borderRadius: 6,
                    border: `1px solid ${BRAND.border}`,
                  }}
                >
                  <div className="maintenance-part-box-title"><span>B</span><div><strong>Pasang sparepart non-serial</strong><small>Oli, grease, baut, atau komponen yang dicatat berdasarkan jumlah.</small></div></div>

                  <div className="maintenance-source-switch" role="tablist" aria-label="Sumber stok non-serial">
                    <button type="button" className={stockSource === "INVENTORY" ? "active" : ""} onClick={() => { setStockSource("INVENTORY"); setDonorTruckId(""); }}><span>01</span><div><strong>Dari Inventory</strong><small>Ambil stok dari lokasi gudang</small></div></button>
                    <button type="button" className={stockSource === "DONOR" ? "active" : ""} onClick={() => { setStockSource("DONOR"); setUseLocationId(""); if (useItemId) loadDonorStocks(useItemId).catch((e) => setErr(e.message)); }} disabled={selectedUseItem?.category === "OIL"}><span>02</span><div><strong>Dari mobil lain</strong><small>Ambil sparepart dari armada lain</small></div></button>
                  </div>

                  <div className={`maintenance-serialized-grid source-${stockSource.toLowerCase()}`}>
                    <div className="maintenance-part-field item-field"><label>Jenis sparepart</label><SearchableItemPicker
                      items={nonSerializedItems}
                      value={useItemId}
                      onChange={(itemId) => { const picked = nonSerializedItems.find((item) => item.id === itemId); setUseItemId(itemId); setDonorTruckId(""); loadPartHistory(itemId, "stock"); if (picked?.category === "OIL") setStockSource("INVENTORY"); else if (stockSource === "DONOR") loadDonorStocks(itemId).catch((e) => setErr(e.message)); }}
                      disabled={!allowed || activeJob.status !== "OPEN"}
                      placeholder="Cari SKU / nama sparepart..."
                      testId="non-serialized-item-search"
                    /></div>

                    {stockSource === "INVENTORY" ? <div className="maintenance-part-field"><label>Lokasi stok Inventory</label><Select
                      value={useLocationId}
                      onChange={(e) => setUseLocationId(e.target.value)}
                      disabled={!allowed || activeJob.status !== "OPEN"}
                      data-testid="location-select"
                    >
                      <option value="">Pilih lokasi stok</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </Select></div> : <div className="maintenance-part-field"><label>Mobil donor</label><Select value={donorTruckId} onChange={(e) => setDonorTruckId(e.target.value)} disabled={!allowed || activeJob.status !== "OPEN" || !useItemId}>
                      <option value="">Pilih nomor polisi donor</option>
                      {donorStocks.map((stock) => <option key={stock.truckId} value={stock.truckId}>{stock.truck?.plateNumber} · tersedia {Number(stock.qty).toLocaleString("id-ID")} {stock.item?.unit}</option>)}
                    </Select></div>}
                  </div>

                  <LastPartChange item={selectedUseItem} history={stockHistory} loading={historyLoading.stock} />

                  {selectedUseItem?.category === "OIL" && (
                    <div style={{ padding: 14, marginBottom: 10, borderRadius: 6, border: `1px solid ${BRAND.primary}`, background: BRAND.successBg }}>
                      <div style={{ marginBottom: 10, fontWeight: 700, color: BRAND.primary }}>Data ganti oli</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 600 }}>
                          Tanggal ganti oli
                          <Input type="date" value={useOilDate} onChange={(e) => setUseOilDate(e.target.value)} disabled={!allowed || activeJob.status !== "OPEN"} />
                        </label>
                        <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 600 }}>
                          Odometer saat ganti oli
                          <Input type="number" min={0} value={useOilOdometer} onChange={(e) => setUseOilOdometer(e.target.value)} placeholder={hasPreviousOilOdometer ? `Minimal ${minimumOilOdometer.toLocaleString("id-ID")} km` : "Masukkan odometer saat ini"} disabled={!allowed || activeJob.status !== "OPEN"} />
                        </label>
                      </div>
                      <div style={{ marginTop: 10, fontSize: 12, color: BRAND.textLight }}>
                        {activeJob.previousOilChange
                          ? `Terakhir: ${fmtDateTime(activeJob.previousOilChange.oilChangedAt)} • ${Number(activeJob.previousOilChange.odometerKm || 0).toLocaleString()} km`
                          : "Belum ada riwayat ganti oli sebelumnya."}
                      </div>
                      <div style={{ marginTop: 5, fontSize: 12, fontWeight: 700, color: oilMileageEligible ? BRAND.primary : BRAND.warning }}>
                        {!hasPreviousOilOdometer
                          ? "Catatan pertama akan dijadikan odometer acuan ganti oli berikutnya."
                          : oilMileageEligible
                            ? `Memenuhi interval ${OIL_CHANGE_INTERVAL_KM.toLocaleString("id-ID")} km.`
                            : `Odometer minimal untuk ganti oli: ${minimumOilOdometer.toLocaleString("id-ID")} km.`}
                      </div>
                      <div style={{ marginTop: 5, fontSize: 12, color: BRAND.textMuted }}>Foto dokumentasi dapat diunggah secara opsional pada bagian foto maintenance.</div>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <Input
                      value={useQty}
                      onChange={(e) => setUseQty(e.target.value)}
                      placeholder="Jumlah"
                      disabled={!allowed || activeJob.status !== "OPEN"}
                      data-testid="qty-input"
                    />
                    <Input
                      value={useNote}
                      onChange={(e) => setUseNote(e.target.value)}
                      placeholder="Catatan pemakaian (opsional)"
                      disabled={!allowed || activeJob.status !== "OPEN"}
                      data-testid="use-note-input"
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      variant="danger"
                      onClick={useStock}
                      disabled={!allowed || activeJob.status !== "OPEN" || usingStock}
                      data-testid="use-stock-btn"
                    >
                      {usingStock ? "Menyimpan..." : stockSource === "DONOR" ? "Pindahkan & Pasang" : "Gunakan Stok"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>}

            {/* FULL WIDTH TABLES */}
            {detailTab === "PARTS" && <Card className="maintenance-detail-history" style={{ gridColumn: "1 / -1" }}>
              <div style={{ padding: 16 }}>
                <div className="maintenance-detail-section-heading maintenance-history-heading"><span>RIWAYAT</span><div><strong>Sparepart yang sudah digunakan</strong><small>Semua unit dan stok yang tercatat pada pekerjaan servis ini.</small></div></div>

                {/* Serialized Table */}
                <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.textMuted, marginBottom: 8 }}>
                  Riwayat unit berserial
                </div>
                <div style={{ overflow: "auto", marginBottom: 20 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ textAlign: "left", fontSize: 12, color: BRAND.textMuted, borderBottom: `1px solid ${BRAND.border}` }}>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Waktu</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Barang</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Unit</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Pergerakan</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Dari / Tujuan</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Harga/Unit</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Total Biaya</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serializedHistoryRows.map((a) => (
                        <tr key={a.id} style={{ borderBottom: `1px solid ${BRAND.border}` }}>
                          <td style={{ padding: "12px 8px", color: BRAND.textLight }}>{fmtDateTime(a.eventAt)}</td>
                          <td style={{ padding: "12px 8px", fontWeight: 500, color: BRAND.text }}>
                            {a.item?.sku} — {a.item?.name}
                          </td>
                          <td style={{ padding: "12px 8px", color: BRAND.textLight }}>{a.serial || "—"}</td>
                          <td style={{ padding: "12px 8px" }}><span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: a.historyType === "REMOVED" || a.removedAt ? BRAND.dangerBg : BRAND.successBg, color: a.historyType === "REMOVED" || a.removedAt ? BRAND.danger : BRAND.primary, fontSize: 11, fontWeight: 700 }}>{a.historyType === "REMOVED" ? "KELUAR / DILEPAS" : a.removedAt ? "DIPASANG, LALU DILEPAS" : "DIPASANG"}</span></td>
                          <td style={{ padding: "12px 8px", color: BRAND.textLight }}>{a.source || "—"}</td>
                          <td style={{ padding: "12px 8px", color: BRAND.textLight }}>{a.historyUnitPrice == null ? "—" : fmtMoney(a.historyUnitPrice)}</td>
                          <td style={{ padding: "12px 8px", fontWeight: 600, color: BRAND.primary }}>{a.historyTotalCost == null ? "—" : fmtMoney(a.historyTotalCost)}</td>
                          <td style={{ padding: "12px 8px", color: BRAND.textMuted }}>{a.note || "—"}</td>
                        </tr>
                      ))}
                      {serializedHistoryRows.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ padding: 16, color: BRAND.textMuted, textAlign: "center" }}>
                            Belum ada riwayat sparepart berserial.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Movements Table */}
                <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.textMuted, marginBottom: 8 }}>
                  Stok non-serial yang digunakan
                </div>
                <div style={{ overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ textAlign: "left", fontSize: 12, color: BRAND.textMuted, borderBottom: `1px solid ${BRAND.border}` }}>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Waktu</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Jenis</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Barang</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Jumlah</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Harga/Unit</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Total Biaya</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Dari</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Catatan</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Tindakan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeJob.movements || []).filter((m) => !m.stockUnitId && (m.type === "OUT" || (m.type === "ADJUST" && m.fromTruckId))).map((m) => {
                        const returnedQty=(activeJob.movements||[]).filter(row=>row.type==="IN"&&String(row.note||"").startsWith(`RETURN_OF:${m.id}`)).reduce((sum,row)=>sum+Number(row.qty||0),0);
                        const returnableQty=m.type==="OUT"&&m.fromLocationId&&m.item?.category!=="OIL"?Math.max(0,Number(m.qty||0)-returnedQty):0;
                        return <tr key={m.id} style={{ borderBottom: `1px solid ${BRAND.border}` }}>
                          <td style={{ padding: "12px 8px", color: BRAND.textLight }}>{fmtDateTime(m.createdAt)}</td>
                          <td style={{ padding: "12px 8px", fontWeight: 500, color: BRAND.text }}>{m.type}</td>
                          <td style={{ padding: "12px 8px", color: BRAND.textLight }}>
                            {m.item?.sku} — {m.item?.name}
                          </td>
                          <td style={{ padding: "12px 8px", fontWeight: 600, color: BRAND.text }}>{m.qty}</td>
                          <td style={{ padding: "12px 8px", color: BRAND.textLight }}>{m.unitPrice == null ? "—" : fmtMoney(m.unitPrice)}</td>
                          <td style={{ padding: "12px 8px", fontWeight: 600, color: BRAND.primary }}>{m.totalCost == null ? "—" : fmtMoney(m.totalCost)}</td>
                          <td style={{ padding: "12px 8px", color: BRAND.textLight }}>{m.fromTruck?.plateNumber ? `${m.fromTruck.plateNumber} → ${m.toTruck?.plateNumber || activeJob.truck?.plateNumber}` : m.fromLocation?.name || "—"}</td>
                          <td style={{ padding: "12px 8px", color: BRAND.textMuted }}>{m.note || "—"}</td>
                          <td style={{ padding: "12px 8px" }}>{returnableQty>0&&activeJob.status==="OPEN"?<Button variant="secondary" onClick={()=>openReturnStock(m)} disabled={usingStock}>Kembalikan</Button>:<span style={{color:BRAND.textMuted}}>{returnedQty>0?`Dikembalikan ${returnedQty}`:"—"}</span>}</td>
                        </tr>})}
                      {(activeJob.movements || []).filter((m) => !m.stockUnitId && (m.type === "OUT" || (m.type === "ADJUST" && m.fromTruckId))).length === 0 && (
                        <tr>
                          <td colSpan={9} style={{ padding: 16, color: BRAND.textMuted, textAlign: "center" }}>
                            Belum ada suku cadang non-serialized yang digunakan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>}
          </div>
        )}
      </Modal>

      {/* Keep the native camera picker outside the fixed, scrollable modal. Mobile
          Safari/WebViews can leave that composited modal blank after camera return. */}
      <input
        ref={purchaseDamageInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          if (file) {
            setPurchaseDamagePhoto(file);
            setPurchasePhotoError("");
            // Open in the same React update as the selected file. Timers started
            // immediately after returning from the native camera can be suspended
            // by Android WebView/Chrome, leaving the editor closed indefinitely.
            // The detail modal is conditionally unmounted while this is true, so
            // only one fixed overlay is ever composited at a time.
            setShowPurchasePhotoEditor(true);
          }
          event.target.value = "";
        }}
      />

      <ImageAnnotationEditor file={purchaseDamagePhoto} open={showPurchasePhotoEditor} onClose={() => setShowPurchasePhotoEditor(false)} onSave={(file) => { setPurchaseDamagePhoto(file); setShowPurchasePhotoEditor(false); }} />

      <Modal
        open={Boolean(returnStockTarget)}
        title="Kembalikan Sparepart"
        onClose={() => !usingStock && setReturnStockTarget(null)}
        width={560}
        className="maintenance-return-modal"
      >
        {returnStockTarget && <form className="maintenance-return-form" onSubmit={returnNonSerializedStock}>
          <div className="maintenance-return-summary">
            <span>BARANG</span>
            <strong>{returnStockTarget.movement.item?.name || "Sparepart"}</strong>
            <small>{returnStockTarget.movement.item?.sku || "—"} · Dari {returnStockTarget.movement.fromLocation?.name || "Inventory"}</small>
          </div>
          <div className="maintenance-return-fields">
            <label>
              Jumlah dikembalikan
              <Input
                required
                autoFocus
                type="number"
                min="0.01"
                max={returnStockTarget.remaining}
                step="0.01"
                value={returnStockForm.qty}
                onChange={(event) => setReturnStockForm((form) => ({ ...form, qty: event.target.value }))}
              />
              <small>Maksimal {returnStockTarget.remaining} {returnStockTarget.movement.item?.unit || "unit"}</small>
            </label>
            <label>
              Alasan pengembalian
              <textarea
                required
                maxLength={500}
                rows={4}
                value={returnStockForm.reason}
                onChange={(event) => setReturnStockForm((form) => ({ ...form, reason: event.target.value }))}
                placeholder="Contoh: sparepart tidak jadi digunakan karena komponen lama masih layak"
              />
              <small>Wajib diisi dan akan tercatat dalam riwayat stok.</small>
            </label>
          </div>
          {returnStockError && <div className="maintenance-return-error">{returnStockError}</div>}
          <div className="maintenance-return-actions">
            <Button variant="secondary" type="button" disabled={usingStock} onClick={() => setReturnStockTarget(null)}>Batal</Button>
            <Button variant="primary" disabled={usingStock}>{usingStock ? "Mengembalikan..." : "Konfirmasi Pengembalian"}</Button>
          </div>
        </form>}
      </Modal>

    </div>
  );
}
