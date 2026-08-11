// src/pages/Orders.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useState } from "react";
import { api, apiAssetUrl, uploadFiles } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiSearch, FiX } from "react-icons/fi";

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

function Modal({ open, title, subtitle, onClose, children, width = 860 }) {
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
      onMouseDown={onClose}
    >
      <div
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
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
        <div style={{ padding: 20, maxHeight: "calc(100vh - 160px)", overflow: "auto" }}>{children}</div>
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
    plannedAt: "",
    notes: "",
  });

  const [proofUrl, setProofUrl] = useState("");
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
    try {
      setErr("");
      setLoading(true);
      const data = await api(`/orders${buildQuery()}`);
      setItems(data?.items || []);
    } catch (e) {
      setErr(e?.message || "Gagal memuat orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLiveRefresh(load);

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
      plannedAt: "",
      notes: "",
    });
    setProofUrl("");
    setProofs([]);
  }

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function addProof() {
    const url = proofUrl.trim();
    if (!url) return;
    setProofs((p) => [...p, { url }]);
    setProofUrl("");
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
    <div data-testid="orders-page">
      {/* Header */}
      <div
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
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: BRAND.text }} data-testid="orders-title">
            Orders
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: BRAND.textMuted }}>
            Create orders, assign trips, and generate dispatch letters
          </p>
        </div>

        {allowed ? (
          <Button
            variant="primary"
            icon={FiPlus}
            onClick={() => {
              resetCreate();
              setShowCreate(true);
            }}
            data-testid="new-order-btn"
          >
            Pesanan Baru
          </Button>
        ) : (
          <span style={{ fontSize: 13, color: BRAND.textMuted, fontWeight: 500 }}>Akses hanya-baca</span>
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
        >
          {err}
        </div>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 280px", minWidth: 200 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
                Search
              </label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nomor pesanan / tujuan / muatan..."
                data-testid="search-input"
              />
            </div>

            <div style={{ flex: "0 0 160px" }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
                Status
              </label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="status-filter">
                <option value="">Semua Status</option>
                {statusOptions
                  .filter((x) => x)
                  .map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
              </Select>
            </div>

            <div style={{ flex: "1 1 180px", minWidth: 140 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
                Customer
              </label>
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer" />
            </div>

            <div style={{ flex: "0 0 150px" }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
                From Date
              </label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>

            <div style={{ flex: "0 0 150px" }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
                To Date
              </label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>

            <Button variant="primary" onClick={load} disabled={loading} data-testid="apply-btn">
              {loading ? "Memuat..." : "Apply"}
            </Button>

            <Button
              variant="secondary"
              onClick={() => {
                setQ("");
                setStatus("");
                setCustomer("");
                setDateFrom("");
                setDateTo("");
                setTimeout(load, 0);
              }}
              disabled={loading}
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* Orders List */}
      <Card>
        {/* Table Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1.1fr 0.9fr 0.9fr 0.7fr",
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
          <div>Pesanan</div>
          <div>Rute</div>
          <div>Muatan</div>
          <div>Rencana</div>
          <div style={{ textAlign: "right" }}>Tindakan</div>
        </div>

        {/* Order Rows */}
        <div style={{ padding: "8px 12px" }}>
          {items.length === 0 && !loading && (
            <div style={{ padding: 24, textAlign: "center", color: BRAND.textMuted, fontSize: 14 }}>
              Tidak ada orders ditemukan. Try changing filters.
            </div>
          )}

          {items.map((o) => {
            const customerName = o.customer?.name || o.customerName || "-";
            const route = `${o.fromText || "-"} → ${o.toText || "-"}`;
            const total = o.qty != null ? Number(o.qty) : null;
            const unit = o.unit || "";
            const remaining = o.qtyRemaining != null ? Number(o.qtyRemaining) : null;

            const cargo =
              total == null
                ? `${o.cargoName || "-"}`
                : `${o.cargoName || "-"} • ${remaining != null ? remaining : "-"} / ${total} ${unit}`;

            return (
              <div
                key={o.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1.1fr 0.9fr 0.9fr 0.7fr",
                  gap: 12,
                  padding: "16px 8px",
                  borderBottom: `1px solid ${BRAND.border}`,
                  alignItems: "center",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.secondary)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => nav(`/orders/${o.id}`)}
                data-testid={`order-row-${o.id}`}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: BRAND.text }}>
                    {o.orderNo} — {customerName}
                  </div>
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                    <StatusBadge status={o.status} />
                    {o?._count && (
                      <span style={{ fontSize: 12, color: BRAND.textMuted }}>
                        • Trip: {o._count.trips ?? 0} • Bukti: {o._count.proofs ?? 0}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 14, fontWeight: 500, color: BRAND.textLight }}>{route}</div>

                <div style={{ fontSize: 14, fontWeight: 500, color: BRAND.textLight }}>{cargo}</div>

                <div style={{ fontSize: 14, fontWeight: 600, color: BRAND.text }}>{fmtDate(o.plannedAt)}</div>

                <div style={{ textAlign: "right" }}>
                  <Button
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      nav(`/orders/${o.id}`);
                    }}
                  >
                    Open
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "12px 20px", borderTop: `1px solid ${BRAND.border}`, fontSize: 13, color: BRAND.textMuted }}>
          Tip: Click an order row to view details, assign trips, and generate dispatch letters.
        </div>
      </Card>

      {/* Create Order Modal */}
      <Modal
        open={showCreate}
        title="Create Pesanan Baru"
        subtitle="Isi permintaan, lalu tetapkan kendaraan dan buat surat jalan."
        onClose={() => !creating && setShowCreate(false)}
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
              Customer / Company name
            </label>
            <Input value={form.customerName} onChange={(e) => update("customerName", e.target.value)} placeholder="Kepada Yth" />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
              Jenis angkutan
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {[
                { value: "FERTILIZER", label: "Pupuk", note: "Berat wajib diisi" },
                { value: "CANGKANG", label: "Cangkang", note: "Berat wajib diisi" },
                { value: "MATERIAL", label: "Material / Ambang", note: "Berat dari faktur muatan" },
              ].map((option) => {
                const active = form.cargoCategory === option.value;
                return <button key={option.value} type="button" onClick={() => setForm((current) => ({ ...current, cargoCategory: option.value, ...(option.value === "MATERIAL" ? { qty: "", unit: "" } : {}) }))} style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${active ? BRAND.primary : BRAND.border}`, background: active ? BRAND.accent : BRAND.white, color: BRAND.text, textAlign: "left", cursor: "pointer" }}><div style={{ fontWeight: 700, fontSize: 14 }}>{option.label}</div><div style={{ marginTop: 3, fontSize: 12, color: active ? BRAND.primary : BRAND.textMuted }}>{option.note}</div></button>;
              })}
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
              Nama barang / material
            </label>
            <Input value={form.cargoName} onChange={(e) => update("cargoName", e.target.value)} placeholder="Cargo name" />
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

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
              From location
            </label>
            <Input value={form.fromText} onChange={(e) => update("fromText", e.target.value)} placeholder="Origin" />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
              To destination
            </label>
            <Input value={form.toText} onChange={(e) => update("toText", e.target.value)} placeholder="Destination" />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
              Planned date
            </label>
            <Input type="date" value={form.plannedAt} onChange={(e) => update("plannedAt", e.target.value)} />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
              Notes / special instructions
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
              placeholder="Notes..."
            />
          </div>
        </div>

        {/* Bukti Upload */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 10, color: BRAND.text }}>Upload Bukti — Gambar / PDF</div>

          {uploadErr && (
            <div style={{ marginBottom: 10, color: BRAND.danger, fontWeight: 500, fontSize: 14 }}>{uploadErr}</div>
          )}

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              disabled={creating || uploading}
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
              style={{
                height: 44,
                padding: "10px 14px",
                borderRadius: 6,
                border: `1px solid ${BRAND.border}`,
                fontWeight: 500,
                maxWidth: 360,
                background: BRAND.white,
              }}
            />

            <span style={{ fontSize: 13, color: BRAND.textMuted }}>
              {uploading ? "Sedang mengunggah..." : "Bisa memilih beberapa file · maks. 15 MB per file"}
            </span>
          </div>

          {proofs.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {proofs.map((p, idx) => {
                const isPdf =
                  String(p.mimeType || "").includes("pdf") || String(p.url || "").toLowerCase().includes(".pdf");

                return (
                  <div
                    key={`${p.url}-${idx}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      borderRadius: 6,
                      border: `1px solid ${BRAND.border}`,
                      background: BRAND.secondary,
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      {isPdf ? (
                        <div style={{ fontWeight: 600, color: BRAND.textLight }}>PDF</div>
                      ) : (
                        <img
                          src={apiAssetUrl(p.url)}
                          alt="Bukti pesanan"
                          style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4 }}
                        />
                      )}
                      <div>
                        <div style={{ fontWeight: 500, color: BRAND.text }}>{p.fileName || "Bukti"}</div>
                        <a
                          href={apiAssetUrl(p.url)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 13, color: BRAND.primary, fontWeight: 500 }}
                        >
                          Buka
                        </a>
                      </div>
                    </div>
                    <Button variant="secondary" onClick={() => removeProof(idx)} disabled={creating || uploading}>
                      Hapus
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {proofs.length === 0 && (
            <div style={{ marginTop: 10, fontSize: 13, color: BRAND.textMuted }}>Belum ada bukti yang diunggah.</div>
          )}
        </div>

        {/* Actions */}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Button variant="secondary" onClick={() => !creating && setShowCreate(false)} disabled={creating}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => createOrder("DRAFT")} disabled={creating}>
            {creating ? "Menyimpan..." : "Save Draft"}
          </Button>
          <Button variant="primary" onClick={() => createOrder("CONFIRMED")} disabled={creating}>
            {creating ? "Menyimpan..." : "Confirm Order"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
