// src/pages/Orders.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useRef, useState } from "react";
import { api, uploadFiles } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import { useNavigate } from "react-router-dom";
import { FiArrowRight, FiCalendar, FiChevronRight, FiFileText, FiMapPin, FiPackage, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiUploadCloud, FiX } from "react-icons/fi";
import { openProtectedFile, ProtectedImage } from "../components/ProtectedFile";
import LoadingState, { LoadingMini } from "../components/LoadingState";
import "./OrdersRedesign.css";
import "./OrdersModalRedesign.css";
import "./OrdersProgress.css";

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
  info: "#3B82F6",
  infoBg: "#EFF6FF",
};

//////////////////////
// HELPERS
//////////////////////

function fmtDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

//////////////////////
// UI COMPONENTS
//////////////////////

function StatusBadge({ status }) {
  const s = String(status || "").toUpperCase();
  const map = {
    COMPLETED: { bg: BRAND.successBg, fg: BRAND.success },
    IN_PROGRESS: { bg: BRAND.accent, fg: BRAND.primary },
    CONFIRMED: { bg: BRAND.infoBg, fg: BRAND.info },
    CANCELLED: { bg: "#F3F4F6", fg: BRAND.textMuted },
    DRAFT: { bg: BRAND.secondary, fg: BRAND.textLight },
  };
  const c = map[s] || { bg: "#F3F4F6", fg: BRAND.textMuted };

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
      {s.replaceAll("_", " ") || "—"}
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

function Card({ children, style = {} }) {
  return (
    <div
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

function MasterLocationPicker({ label, locations, locationId, text, onChange, excludeId, placeholder }) {
  const [open, setOpen] = useState(false);
  const needle = String(text || "").trim().toLocaleLowerCase("id-ID");
  const options = locations.filter((location) => location.id !== excludeId && (!needle || [location.name, location.address, location.type].some((value) => String(value || "").toLocaleLowerCase("id-ID").includes(needle)))).slice(0, 8);
  return (
    <label className="orders-location-picker">
      <span>{label}</span>
      <div className={locationId ? "selected" : ""}>
        <FiMapPin />
        <input value={text} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 150)} onChange={(event) => { onChange({ id: null, name: event.target.value }); setOpen(true); }} placeholder={placeholder} autoComplete="off" />
        {locationId && <b>MASTER</b>}
      </div>
      {open && (
        <section>
          {options.length ? options.map((location) => (
            <button key={location.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange({ id: location.id, name: location.name }); setOpen(false); }}>
              <FiMapPin />
              <span><strong>{location.name}</strong><small>{location.address || location.type} · Radius {location.radiusM} m</small></span>
            </button>
          )) : <p>Lokasi tidak ditemukan di Master Lokasi.</p>}
        </section>
      )}
    </label>
  );
}

function Modal({ open, title, subtitle, onClose, children, width = 860, className = "" }) {
  if (!open) return null;
  return (
    <div
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
      className="orders-v3-modal-overlay"
      onMouseDown={onClose}
    >
      <div
        className={`orders-v3-modal ${className}`}
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
          className="orders-v3-modal-head"
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${BRAND.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: BRAND.text }}>{title}</h3>
            {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: BRAND.textMuted }}>{subtitle}</p>}
          </div>
          <button className="orders-v3-modal-close" type="button" onClick={onClose} aria-label="Tutup"><FiX /></button>
        </div>
        <div className="orders-v3-modal-body" style={{ padding: 20, maxHeight: "calc(100vh - 160px)", overflow: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

export default function Orders() {
  const { user } = useAuth();
  const role = user?.role || "UNKNOWN";
  const allowed = role === "OWNER" || role === "ADMIN" || role === "STAFF";
  const nav = useNavigate();

  const [items, setItems] = useState([]);
  const searchRequestRef = useRef({ id: 0, controller: null });
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [customer, setCustomer] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Create Order modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const [form, setForm] = useState({
    customerName: "",
    cargoName: "",
    cargoCategory: "FERTILIZER",
    qty: "",
    unit: "",
    fromText: "",
    toText: "",
    pickupLocationId: "",
    destinationLocationId: "",
    plannedAt: "",
    notes: "",
  });

  const [proofs, setProofs] = useState([]);

  const statusOptions = useMemo(() => ["", "DRAFT", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"], []);

  function buildQuery() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (customer.trim()) params.set("customer", customer.trim());
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      params.set("dateTo", end.toISOString());
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  async function load() {
    const requestId = searchRequestRef.current.id + 1;
    searchRequestRef.current.controller?.abort();
    const controller = new AbortController();
    searchRequestRef.current = { id: requestId, controller };
    try {
      setErr("");
      setLoading(true);
      const data = await api(`/orders${buildQuery()}`, { signal: controller.signal });
      if (searchRequestRef.current.id !== requestId) return;
      setItems(data?.items || []);
    } catch (e) {
      if (e?.name === "AbortError") return;
      setErr(e?.message || "Gagal memuat orders");
    } finally {
      if (searchRequestRef.current.id === requestId) setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(load, q.trim() || customer.trim() ? 140 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, customer, dateFrom, dateTo]);
  useEffect(() => {
    let active = true;
    api("/operational-locations").then((data) => { if (active) setLocations((data.items || []).filter((location) => location.isActive)); }).catch((error) => { if (active) setErr(error.message || "Gagal memuat Master Lokasi"); });
    return () => { active = false; };
  }, []);
  useLiveRefresh(load);

  const summary = useMemo(() => ({
    total: items.length,
    draft: items.filter((order) => order.status === "DRAFT").length,
    active: items.filter((order) => ["CONFIRMED", "IN_PROGRESS"].includes(order.status)).length,
    completed: items.filter((order) => order.status === "COMPLETED").length,
  }), [items]);

  function resetCreate() {
    setCreateErr("");
    setForm({
      customerName: "",
      cargoName: "",
      cargoCategory: "FERTILIZER",
      qty: "",
      unit: "",
      fromText: "",
      toText: "",
      pickupLocationId: "",
      destinationLocationId: "",
      plannedAt: "",
      notes: "",
    });
    setProofs([]);
  }

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function removeProof(idx) {
    setProofs((p) => p.filter((_, i) => i !== idx));
  }

  async function createOrder(statusToSave) {
    try {
      setCreateErr("");
      setCreating(true);

      const payload = {
        customerName: form.customerName || null,
        cargoName: form.cargoName || null,
        cargoCategory: form.cargoCategory,
        qty: form.cargoCategory === "MATERIAL" || !form.qty ? null : Number(form.qty),
        unit: form.cargoCategory === "MATERIAL" || !form.unit ? null : form.unit,
        fromText: form.fromText || null,
        toText: form.toText || null,
        pickupLocationId: form.pickupLocationId || null,
        destinationLocationId: form.destinationLocationId || null,
        plannedAt: form.plannedAt ? new Date(form.plannedAt).toISOString() : null,
        notes: form.notes || null,
        status: statusToSave,
        proofs,
      };

      const order = await api("/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setShowCreate(false);
      resetCreate();
      await load();
      nav(`/orders/${order.id}`);
    } catch (e) {
      setCreateErr(e?.message || "Gagal membuat order");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="orders-v3-page" data-testid="orders-page">
      <header className="orders-v3-head">
        <div><span>ORDER CONTROL</span><h1 data-testid="orders-title">Pesanan</h1><p>Kelola permintaan angkutan, pembagian trip, dan surat jalan dari satu tempat.</p></div>
        {allowed ? <button className="orders-v3-create" onClick={() => { resetCreate(); setShowCreate(true); }} data-testid="new-order-btn"><FiPlus /> Pesanan Baru</button> : <span className="orders-v3-readonly">Akses hanya-baca</span>}
      </header>

      <section className="orders-v3-summary">
        <article><span><FiFileText /></span><div><small>TOTAL PESANAN</small><strong>{summary.total}</strong><p>Hasil sesuai filter</p></div></article>
        <article><span><FiPackage /></span><div><small>DRAFT</small><strong>{summary.draft}</strong><p>Belum dikonfirmasi</p></div></article>
        <article className="active"><span><FiRefreshCw /></span><div><small>SEDANG DIPROSES</small><strong>{summary.active}</strong><p>Confirmed & in progress</p></div></article>
        <article className="done"><span><FiArrowRight /></span><div><small>SELESAI</small><strong>{summary.completed}</strong><p>Pesanan completed</p></div></article>
      </section>

      {err && <div className="orders-v3-error">{err}</div>}

      <section className="orders-v3-tools">
        <label className="orders-v3-search"><FiSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nomor pesanan, tujuan, atau muatan…" data-testid="search-input" />{loading && <LoadingMini />}</label>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="status-filter"><option value="">Semua status</option>{statusOptions.filter(Boolean).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select>
        <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nama customer" />
        <span className={`date-placeholder-wrap ${dateFrom ? "has-value" : ""}`} data-placeholder="Dari tanggal"><Input className="tablet-date-input" aria-label="Tanggal mulai" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></span>
        <span className={`date-placeholder-wrap ${dateTo ? "has-value" : ""}`} data-placeholder="Sampai tanggal"><Input className="tablet-date-input" aria-label="Tanggal selesai" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></span>
        <button className="orders-v3-reset" onClick={() => { setQ(""); setStatus(""); setCustomer(""); setDateFrom(""); setDateTo(""); }} disabled={loading}><FiX /> Reset</button>
      </section>

      <section className="orders-v3-board">
        <header><div><span>DAFTAR OPERASIONAL</span><h2>Pesanan Aktif & Riwayat</h2></div><b>{items.length} pesanan</b></header>
        <div className="orders-v3-list">
          {loading && !items.length && <LoadingState label="Memuat pesanan" note="Menyiapkan alokasi, rute, dan progres terbaru…" rows={4} />}
          {!items.length && !loading && <div className="orders-v3-empty"><FiFileText /><strong>Tidak ada pesanan ditemukan</strong><p>Coba ubah kata pencarian atau filter yang digunakan.</p></div>}
          {items.map((order) => {
            const customerName = order.customer?.name || order.customerName || "Tanpa customer";
            const total = order.qty != null ? Number(order.qty) : null;
            const remaining = order.qtyRemaining != null ? Number(order.qtyRemaining) : null;
            const allocated = total == null ? null : Math.max(0, total - (remaining ?? total));
            const allocatedPercent = total > 0 ? Math.min(100, Math.max(0, (allocated / total) * 100)) : 0;
            const unit = order.unit || "";
            return <article key={order.id} onClick={() => nav(`/orders/${order.id}`)} data-testid={`order-row-${order.id}`}>
              <div className="orders-v3-identity"><StatusBadge status={order.status} /><h3>{order.orderNo}</h3><p>{customerName}</p><small>Dibuat oleh {order.createdBy?.name || order.createdBy?.email || "Data lama"}</small></div>
              <div className="orders-v3-route"><span><FiMapPin /></span><div><small>RUTE PENGIRIMAN</small><p><b>{order.fromText || "Asal belum diisi"}</b><FiArrowRight /><b>{order.toText || "Tujuan belum diisi"}</b></p></div></div>
              <div className="orders-v3-meta">
                <div className="orders-v3-load"><FiPackage /><span><small>ALOKASI MUATAN</small>{total == null ? <><strong>{order.cargoName || "Muatan material"}</strong><em>Jumlah mengikuti faktur muatan</em></> : <><strong>{allocated} dari {total} {unit} siap diantar</strong><i><b style={{ width: `${allocatedPercent}%` }} /></i><em>{remaining ?? total} {unit} belum dibuatkan trip</em></>}</span></div>
                <div><FiCalendar /><span><small>RENCANA</small><strong>{fmtDate(order.plannedAt)}</strong></span></div>
              </div>
              <div className="orders-v3-counts"><span><b>{order._count?.trips ?? 0}</b> Trip</span><span><b>{order._count?.proofs ?? 0}</b> Bukti</span></div>
              <button type="button" onClick={(event) => { event.stopPropagation(); nav(`/orders/${order.id}`); }} aria-label={`Buka ${order.orderNo}`}><FiChevronRight /></button>
            </article>;
          })}
        </div>
      </section>

      {/* Create Order Modal */}
      <Modal
        open={showCreate}
        title="Pesanan Baru"
        subtitle="Lengkapi informasi customer, muatan, rute, dan jadwal pengiriman."
        onClose={() => !creating && setShowCreate(false)}
        className="orders-v3-create-modal"
      >
        {createErr && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 6,
              background: BRAND.dangerBg,
              color: BRAND.danger,
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            {createErr}
          </div>
        )}

        <div className="orders-v3-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
              Customer / perusahaan
            </label>
            <Input value={form.customerName} onChange={(e) => update("customerName", e.target.value)} placeholder="Contoh: PT Perkebunan Nusantara" />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
              Jenis angkutan
            </label>
            <div className="orders-v3-category" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {[
                { value: "FERTILIZER", label: "Pupuk", note: "Berat wajib diisi" },
                { value: "CANGKANG", label: "Cangkang", note: "Berat wajib diisi" },
                { value: "MATERIAL", label: "Material / Ambang", note: "Berat dari faktur muatan" },
              ].map((option) => {
                const active = form.cargoCategory === option.value;
                return <button className={active ? "active" : ""} key={option.value} type="button" onClick={() => setForm((current) => ({ ...current, cargoCategory: option.value, ...(option.value === "MATERIAL" ? { qty: "", unit: "" } : {}) }))} style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${active ? BRAND.primary : BRAND.border}`, background: active ? BRAND.accent : BRAND.white, color: BRAND.text, textAlign: "left", cursor: "pointer" }}><div style={{ fontWeight: 700, fontSize: 14 }}>{option.label}</div><div style={{ marginTop: 3, fontSize: 12, color: active ? BRAND.primary : BRAND.textMuted }}>{option.note}</div></button>;
              })}
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
              Nama barang / material
            </label>
            <Input value={form.cargoName} onChange={(e) => update("cargoName", e.target.value)} placeholder="Contoh: Pupuk NPK" />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
              Berat / jumlah {form.cargoCategory === "FERTILIZER" ? "(wajib)" : "(diisi dari faktur)"}
            </label>
            <Input type="number" disabled={form.cargoCategory === "MATERIAL"} value={form.qty} onChange={(e) => update("qty", e.target.value)} placeholder={form.cargoCategory === "MATERIAL" ? "Diisi dari faktur muatan" : "Contoh: 25"} />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
              Satuan {form.cargoCategory === "FERTILIZER" ? "(wajib)" : ""}
            </label>
            <Input disabled={form.cargoCategory === "MATERIAL"} value={form.unit} onChange={(e) => update("unit", e.target.value)} placeholder={form.cargoCategory === "MATERIAL" ? "Diisi dari faktur muatan" : "TON / M3 / UNIT"} />
          </div>

          <MasterLocationPicker label="Lokasi muat" locations={locations} locationId={form.pickupLocationId} text={form.fromText} excludeId={form.destinationLocationId} placeholder="Cari lokasi muat dari Master Lokasi…" onChange={(location) => setForm((current) => ({ ...current, pickupLocationId: location.id || "", fromText: location.name }))} />

          <MasterLocationPicker label="Tujuan bongkar" locations={locations} locationId={form.destinationLocationId} text={form.toText} excludeId={form.pickupLocationId} placeholder="Cari tujuan dari Master Lokasi…" onChange={(location) => setForm((current) => ({ ...current, destinationLocationId: location.id || "", toText: location.name }))} />

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
              Tanggal rencana
            </label>
            <Input type="date" value={form.plannedAt} onChange={(e) => update("plannedAt", e.target.value)} />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
              Catatan / instruksi khusus
            </label>
            <textarea
              style={{
                width: "100%",
                minHeight: 100,
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
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Tambahkan instruksi untuk pengiriman ini…"
            />
          </div>
        </div>

        {/* Bukti Upload */}
        <div className="orders-v3-upload" style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 10, color: BRAND.text }}>Upload Bukti — Gambar / PDF</div>

          {uploadErr && (
            <div style={{ marginBottom: 10, color: BRAND.danger, fontWeight: 500, fontSize: 14 }}>{uploadErr}</div>
          )}

          <div style={{ borderRadius: 10, border: `1.5px dashed ${uploading ? BRAND.primary : "#B7D8C5"}`, background: "linear-gradient(135deg, #F7FBF8 0%, #EEF7F1 100%)", overflow: "hidden" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", cursor: creating || uploading ? "not-allowed" : "pointer", opacity: creating ? 0.65 : 1, borderBottom: proofs.length ? `1px solid ${BRAND.border}` : "none" }}>
            <span style={{ width: 42, height: 42, borderRadius: 10, display: "grid", placeItems: "center", flex: "0 0 auto", color: BRAND.primary, background: BRAND.white, boxShadow: "0 3px 10px rgba(13,124,61,.10)" }}><FiUploadCloud size={21}/></span>
            <span style={{ display: "grid", gap: 3 }}>
              <strong style={{ fontSize: 14, color: BRAND.text }}>{uploading ? "Sedang mengunggah..." : "Pilih gambar atau PDF"}</strong>
              <span style={{ fontSize: 12, color: BRAND.textMuted }}>Bisa memilih beberapa file · maksimal 15 MB per file</span>
            </span>
            <input
              type="file" multiple accept="image/*,application/pdf" disabled={creating || uploading}
              onChange={async (e) => {
                try {
                  setUploadErr("");
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;

                  setUploading(true);
                  const uploaded = await uploadFiles(files);

                  setProofs((p) => [
                    ...p,
                    ...uploaded.map((u) => ({
                      url: u.url,
                      fileName: u.fileName,
                      mimeType: u.mimeType,
                      size: u.size,
                    })),
                  ]);

                  e.target.value = "";
                } catch (err) {
                  setUploadErr(err?.message || "Gagal mengunggah");
                } finally {
                  setUploading(false);
                }
              }}
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
            />
          </label>

          {proofs.length > 0 && (
            <div style={{ padding: 12, display: "flex", flexWrap: "wrap", gap: 10, overflow: "hidden" }}>
              {proofs.map((p, idx) => {
                const isPdf =
                  String(p.mimeType || "").includes("pdf") || String(p.url || "").toLowerCase().includes(".pdf");

                return (
                  <div
                    key={`${p.url}-${idx}`}
                    style={{
                      display: "grid",
                      gap: 8,
                      padding: 8,
                      width: 190,
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      minWidth: 0,
                      overflow: "hidden",
                      borderRadius: 10,
                      border: `1px solid ${BRAND.border}`,
                      background: BRAND.white,
                      boxShadow: "0 4px 14px rgba(17, 24, 39, .06)",
                    }}
                  >
                    {isPdf ? (
                      <div style={{ height: 112, display: "grid", placeItems: "center", gap: 4, borderRadius: 8, background: "#F3F7F4" }}>
                        <FiFileText size={30} color={BRAND.primary}/>
                        <div>
                          <button type="button" onClick={() => openProtectedFile(p.url).catch((e) => setErr(e.message))} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 12, color: BRAND.primary, fontWeight: 600 }}>Buka PDF</button>
                        </div>
                      </div>
                    ) : (
                      <ProtectedImage url={p.url} alt={p.fileName || "Bukti pesanan"} style={{ display: "block", width: "100%", height: 112, objectFit: "cover", borderRadius: 8, background: BRAND.secondary }} />
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 30px", alignItems: "center", gap: 8, padding: "2px 2px 1px 4px", minWidth: 0 }}>
                      <div title={p.fileName || "Bukti"} style={{ minWidth: 0, maxWidth: "100%", fontWeight: 500, fontSize: 12, color: BRAND.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.fileName || "Bukti"}</div>
                      <button type="button" title="Hapus" aria-label={`Hapus ${p.fileName || "bukti"}`} onClick={() => removeProof(idx)} disabled={creating || uploading} style={{ width: 30, height: 30, flex: "0 0 auto", display: "grid", placeItems: "center", border: "none", borderRadius: 8, color: BRAND.danger, background: "#FEF2F2", cursor: "pointer" }}><FiTrash2 size={14}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {proofs.length === 0 && (
            <div style={{ padding: "0 18px 14px", fontSize: 12, color: BRAND.textMuted }}>Belum ada bukti yang diunggah.</div>
          )}
          </div>
        </div>

        {/* Actions */}
        <div className="orders-v3-modal-actions" style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Button variant="secondary" onClick={() => !creating && setShowCreate(false)} disabled={creating}>
            Batal
          </Button>
          <Button variant="secondary" onClick={() => createOrder("DRAFT")} disabled={creating}>
            {creating ? "Menyimpan..." : "Simpan Draft"}
          </Button>
          <Button variant="primary" onClick={() => createOrder("CONFIRMED")} disabled={creating}>
            {creating ? "Menyimpan..." : "Konfirmasi Pesanan"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
