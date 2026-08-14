// src/pages/OrderDetail.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiAssetUrl, uploadFiles } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import {
  FiActivity,
  FiArrowLeft,
  FiCalendar,
  FiCheck,
  FiClock,
  FiExternalLink,
  FiFile,
  FiMapPin,
  FiPackage,
  FiPlus,
  FiUser,
  FiX,
} from "react-icons/fi";

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

function fmtDateTime(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("id-ID");
}

function fmtNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x % 1 === 0 ? String(x) : x.toFixed(2);
}

function useIsNarrow(breakpoint = 980) {
  const [narrow, setNarrow] = useState(() => (typeof window !== "undefined" ? window.innerWidth < breakpoint : false));
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return narrow;
}

//////////////////////
// UI COMPONENTS
//////////////////////

function StatusBadge({ status, type = "order" }) {
  const s = String(status || "").toUpperCase();
  const orderMap = {
    COMPLETED: { bg: BRAND.successBg, fg: BRAND.success },
    IN_PROGRESS: { bg: BRAND.accent, fg: BRAND.primary },
    CONFIRMED: { bg: BRAND.infoBg, fg: BRAND.info },
    CANCELLED: { bg: "#F3F4F6", fg: BRAND.textMuted },
    DRAFT: { bg: BRAND.secondary, fg: BRAND.textLight },
  };
  const tripMap = {
    COMPLETED: { bg: BRAND.successBg, fg: BRAND.success },
    ARRIVED: { bg: BRAND.infoBg, fg: BRAND.info },
    DISPATCHED: { bg: BRAND.accent, fg: BRAND.primary },
    CANCELLED: { bg: "#F3F4F6", fg: BRAND.textMuted },
  };
  const map = type === "trip" ? tripMap : orderMap;
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

function Button({ variant = "secondary", children, icon: Icon, size = "default", ...props }) {
  const styles = {
    primary: { background: BRAND.primary, color: BRAND.white, border: "none" },
    secondary: { background: BRAND.white, color: BRAND.textLight, border: `1px solid ${BRAND.border}` },
    danger: { background: BRAND.dangerBg, color: BRAND.danger, border: `1px solid ${BRAND.danger}20` },
  };

  const sizeStyles = {
    small: { padding: "6px 12px", fontSize: 13 },
    default: { padding: "10px 16px", fontSize: 14 },
  };

  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 6,
    fontWeight: 500,
    cursor: props.disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s ease",
    opacity: props.disabled ? 0.6 : 1,
    ...styles[variant],
    ...sizeStyles[size],
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
      {Icon && <Icon size={size === "small" ? 14 : 16} />}
      {children}
    </button>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{ background: BRAND.white, borderRadius: 8, border: `1px solid ${BRAND.border}`, ...style }}>
      {children}
    </div>
  );
}

function InfoTile({ icon, label, value, sub }) {
  const TileIcon = icon;
  return (
    <div style={{ border: `1px solid ${BRAND.border}`, borderRadius: 10, padding: 16, background: BRAND.white, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: BRAND.textMuted, fontSize: 12, marginBottom: 9 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", color: BRAND.primary, background: BRAND.secondary }}>
          <TileIcon size={14} />
        </span>
        {label}
      </div>
      <div style={{ color: BRAND.text, fontSize: 15, fontWeight: 600, overflowWrap: "anywhere" }}>{value || "—"}</div>
      {sub ? <div style={{ color: BRAND.textMuted, fontSize: 12, marginTop: 5 }}>{sub}</div> : null}
    </div>
  );
}

function Input({ style = {}, ...props }) {
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
        boxSizing: "border-box",
        ...style,
      }}
      {...props}
    />
  );
}

function Select({ children, style = {}, ...props }) {
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
        cursor: props.disabled ? "not-allowed" : "pointer",
        boxSizing: "border-box",
        opacity: props.disabled ? 0.7 : 1,
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  );
}

function Modal({ open, title, subtitle, onClose, children, width = 1100 }) {
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
          maxHeight: "90vh",
          background: BRAND.white,
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
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
        <div style={{ padding: 20, overflow: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 16px",
        borderRadius: 6,
        border: `1px solid ${active ? BRAND.primary : BRAND.border}`,
        background: active ? BRAND.accent : BRAND.white,
        color: active ? BRAND.primary : BRAND.textLight,
        fontWeight: 500,
        fontSize: 14,
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      {children}
    </button>
  );
}

//////////////////////
// MAIN COMPONENT
//////////////////////

export default function OrderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const role = user?.role || "UNKNOWN";
  const canWrite = role === "OWNER" || role === "ADMIN" || role === "STAFF";

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [order, setOrder] = useState(null);

  // tab
  const [tab, setTab] = useState("TRIPS");

  // assign trip modal
  const [showAssign, setShowAssign] = useState(false);
  const [truckQ, setTruckQ] = useState("");
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [assignErr, setAssignErr] = useState("");
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [plannedDepartAt, setPlannedDepartAt] = useState("");
  const [tripQty, setTripQty] = useState("");

  // proofs upload
  const [uploadingProofs, setUploadingProofs] = useState(false);
  const [uploadProofErr, setUploadProofErr] = useState("");
  const [materialInvoiceForm, setMaterialInvoiceForm] = useState({ tripId: "", number: "", issuedAt: new Date().toISOString().slice(0, 10), notes: "" });
  const [materialInvoiceLines, setMaterialInvoiceLines] = useState([{ ppNumber: "", poNumber: "", itemName: "", qty: "", unit: "PCS", totalKg: "", totalAmount: "" }]);
  const [materialInvoiceProof, setMaterialInvoiceProof] = useState(null);
  const [savingMaterialInvoice, setSavingMaterialInvoice] = useState(false);
  const [materialInvoiceError, setMaterialInvoiceError] = useState("");

  const trips = order?.trips || [];
  const proofs = order?.proofs || [];
  const materialInvoices = order?.materialInvoices || [];
  const isNarrow = useIsNarrow(980);

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const data = await api(`/orders/${id}`);
      setOrder(data);
    } catch (e) {
      setErr(e?.message || "Gagal memuat order");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);
  useLiveRefresh(load);

  async function createMaterialInvoice(event) {
    event.preventDefault();
    setMaterialInvoiceError("");
    setSavingMaterialInvoice(true);
    try {
      const uploaded = materialInvoiceProof ? await uploadFiles([materialInvoiceProof]) : [];
      const proof = uploaded[0] ? { url: uploaded[0].url, fileName: uploaded[0].fileName, mimeType: uploaded[0].mimeType, size: uploaded[0].size } : undefined;
      await api(`/orders/${id}/material-invoices`, { method: "POST", body: JSON.stringify({ ...materialInvoiceForm, lines: materialInvoiceLines, proof }) });
      setMaterialInvoiceForm((form) => ({ ...form, number: "", notes: "" }));
      setMaterialInvoiceLines([{ ppNumber: "", poNumber: "", itemName: "", qty: "", unit: "PCS", totalKg: "", totalAmount: "" }]);
      setMaterialInvoiceProof(null);
      await load();
    } catch (error) {
      setMaterialInvoiceError(error.message || "Gagal menyimpan faktur muatan");
    } finally {
      setSavingMaterialInvoice(false);
    }
  }

  async function loadDrivers() {
    const data = await api(`/drivers`);
    const items = data?.items || data || [];
    const only = items.filter((u) => u.isActive !== false);
    setDrivers(only);
  }

  async function loadTrucks(q) {
    const data = await api(`/trucks${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    const items = data?.items || data || [];
    const origin = String(order?.fromText || "").trim().toLowerCase();
    const available = items
      .filter((t) =>
        ["READY", "WAITING_BACKHAUL"].includes(t.status)
        && origin
        && String(t.currentLocation || "").trim().toLowerCase() === origin
      );
    setTrucks(available);
  }

  async function openAssignModal() {
    setAssignErr("");
    setShowAssign(true);
    setSelectedTruckId("");
    setSelectedDriverId("");
    setPlannedDepartAt("");
    setTruckQ("");
    setTripQty("");

    try {
      await Promise.all([loadDrivers(), loadTrucks("")]);
    } catch (e) {
      setAssignErr(e?.message || "Gagal memuat drivers/trucks");
    }
  }

  const filteredTrucks = useMemo(() => {
    const q = truckQ.trim().toLowerCase();
    if (!q) return trucks;
    return trucks.filter((t) => String(t.plateNumber || "").toLowerCase().includes(q));
  }, [trucks, truckQ]);

  const selectedTruck = useMemo(() => trucks.find((t) => t.id === selectedTruckId) || null, [trucks, selectedTruckId]);

  const usedPlanned = useMemo(() => {
    return (trips || [])
      .filter((t) => String(t.status || "").toUpperCase() !== "CANCELLED")
      .reduce((sum, t) => sum + (Number(t.qtyPlanned) || 0), 0);
  }, [trips]);

  const remaining = useMemo(() => {
    if (order?.cargoCategory === "MATERIAL" || !(Number(order?.qty) > 0)) return null;
    const rem = Number(order.qty) - usedPlanned;
    return Number.isFinite(rem) ? Math.max(0, rem) : null;
  }, [order?.qty, usedPlanned]);
  const isMaterialShipment = order?.cargoCategory === "MATERIAL" || (!(Number(order?.qty) > 0) && order?.cargoCategory !== "CANGKANG");
  const hasPlannedQty = !isMaterialShipment && Number(order?.qty) > 0;

  async function createTrip() {
    try {
      setAssignErr("");
      setAssigning(true);

      const truck = trucks.find((t) => t.id === selectedTruckId);

      if (!selectedTruckId) throw new Error("Please select a truck");
      if (!selectedDriverId) throw new Error("Please select a driver");

      const needsQty = !isMaterialShipment;
      const qNum = tripQty ? Number(tripQty) : null;

      if (needsQty) {
        if (!Number.isFinite(qNum) || qNum <= 0) throw new Error("Please input Trip Qty");
      }

      const tripPayload = {
        truckId: selectedTruckId,
        driverUserId: selectedDriverId,
        plannedDepartAt: plannedDepartAt ? new Date(plannedDepartAt).toISOString() : null,
      };
      if (needsQty || Number.isFinite(qNum)) tripPayload.qtyPlanned = qNum;

      await api(`/orders/${id}/trips`, {
        method: "POST",
        body: JSON.stringify(tripPayload),
      });

      setShowAssign(false);
      await load();
    } catch (e) {
      setAssignErr(e?.message || "Gagal membuat trip");
    } finally {
      setAssigning(false);
    }
  }

  async function generateDispatch(tripId) {
    try {
      await api(`/dispatch/trips/${tripId}`, {
        method: "POST",
        body: JSON.stringify({
          city: "Medan",
          companyName: "CV. MITRA SETIA",
          companyAddress:
            "JLN. CEMARA NO. 40 TELP. (061) 6642646. FAX. (061) 6642647\nDs. Sampali Kec. Percut Sei Tuan Kab. Deli Serdang",
          companyPhone: "Telp. (061) 6642646",
        }),
      });
      await load();
    } catch (e) {
      alert(e?.message || "Failed to generate dispatch letter");
    }
  }

  async function patchOrderStatus(nextStatus) {
    try {
      await api(`/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await load();
    } catch (e) {
      alert(e?.message || "Gagal memperbarui order");
    }
  }

  if (loading && !order) {
    return (
      <div data-testid="order-detail-loading">
        <Card style={{ padding: 24 }}>
          <div style={{ color: BRAND.textMuted }}>Memuat...</div>
        </Card>
      </div>
    );
  }

  if (err) {
    return (
      <div data-testid="order-detail-error">
        <Card style={{ padding: 24 }}>
          <div style={{ color: BRAND.danger, fontWeight: 600, marginBottom: 16 }}>{err}</div>
          <Button variant="secondary" icon={FiArrowLeft} onClick={() => nav("/orders")}>
            Back
          </Button>
        </Card>
      </div>
    );
  }

  if (!order) return null;

  const customerName = order.customer?.name || order.customerName || "-";
  const cargo = `${order.cargoName || "-"}${hasPlannedQty ? ` • ${order.qty} ${order.unit || ""}` : ""}`;
  const route = `${order.fromText || "-"} → ${order.toText || "-"}`;
  const completedQty = trips
    .filter((t) => String(t.status || "").toUpperCase() === "COMPLETED")
    .reduce((sum, t) => sum + Number(t.qtyActual ?? t.qtyPlanned ?? 0), 0);
  const completedTrips = trips.filter((t) => String(t.status || "").toUpperCase() === "COMPLETED").length;
  const materialLines = materialInvoices.flatMap((invoice) =>
    invoice.lines?.length
      ? invoice.lines
      : invoice.materialName
        ? [{ itemName: invoice.materialName, qty: invoice.qty, unit: invoice.unit, totalKg: null }]
        : []
  );
  const materialTotalKg = materialLines.reduce((sum, line) => sum + (Number(line.totalKg) || 0), 0);
  const materialCargoLabel = materialLines.length
    ? `${materialLines.length} jenis barang dari faktur muatan`
    : "Muatan belum diisi";
  const tripCompletionLabel = isMaterialShipment
    ? `${completedTrips} dari ${trips.length} trip selesai`
    : `${fmtNum(completedQty)} ${order.unit || ""} selesai diangkut`;
  const completionPct = order.qty
    ? Math.max(0, Math.min(100, Math.round((completedQty / Number(order.qty)) * 100)))
    : order.status === "COMPLETED" ? 100 : 0;

  return (
    <div data-testid="order-detail-page">
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
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: BRAND.text }}>
            {order.orderNo} — {customerName}
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: BRAND.textMuted }}>
            {route} • {cargo} • Planned: {fmtDate(order.plannedAt)}
            {hasPlannedQty && (
              <span style={{ fontWeight: 600, marginLeft: 8 }}>
                • Remaining: {fmtNum(remaining)} {order.unit || ""}
              </span>
            )}
          </p>
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <StatusBadge status={order.status} />
            {order.orderType && (
              <span
                style={{
                  padding: "6px 12px",
                  borderRadius: 4,
                  background: BRAND.secondary,
                  color: BRAND.textLight,
                  fontWeight: 500,
                  fontSize: 12,
                }}
              >
                {String(order.orderType).replaceAll("_", " ")}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="secondary" icon={FiArrowLeft} onClick={() => nav("/orders")}>
            Back
          </Button>

          {canWrite && (
            <>
              <Button variant="primary" icon={FiPlus} onClick={openAssignModal} disabled={order.status === "CANCELLED"}>
                Assign Trip
              </Button>

              {order.status === "CANCELLED" ? (
                <Button variant="secondary" onClick={() => patchOrderStatus("DRAFT")}>
                  Reopen
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    icon={FiCheck}
                    onClick={() => patchOrderStatus("CONFIRMED")}
                    disabled={order.status === "CONFIRMED" || order.status === "COMPLETED"}
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="danger"
                    icon={FiX}
                    onClick={() => patchOrderStatus("CANCELLED")}
                    disabled={order.status === "COMPLETED"}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Card>
        {/* Tabs */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BRAND.border}`, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <TabButton active={tab === "INFO"} onClick={() => setTab("INFO")}>
            Info
          </TabButton>
          <TabButton active={tab === "PROOFS"} onClick={() => setTab("PROOFS")}>
            Bukti ({proofs.length})
          </TabButton>
          <TabButton active={tab === "TRIPS"} onClick={() => setTab("TRIPS")}>
            Trips ({trips.length})
          </TabButton>
          <TabButton active={tab === "MATERIAL_INVOICES"} onClick={() => setTab("MATERIAL_INVOICES")}>
            Faktur Muatan ({materialInvoices.length})
          </TabButton>
        </div>

        {/* Tab Content */}
        <div style={{ padding: 20 }}>
          {tab === "INFO" && (
            <div>
              <div style={{ padding: isNarrow ? 18 : 22, borderRadius: 12, background: "linear-gradient(135deg, #F5FAF7 0%, #EDF6F1 100%)", border: "1px solid #DFEBE4" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ color: BRAND.primary, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>RINGKASAN PESANAN</div>
                    <div style={{ color: BRAND.text, fontSize: 20, fontWeight: 650, marginTop: 7 }}>{isMaterialShipment ? materialCargoLabel : (order.cargoName || "Muatan belum diisi")}</div>
                    <div style={{ color: BRAND.textMuted, fontSize: 13, marginTop: 5 }}>{route}</div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                {hasPlannedQty ? (
                  <div style={{ marginTop: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: BRAND.textMuted, marginBottom: 8 }}>
                      <span>Realisasi muatan</span>
                      <span><strong style={{ color: BRAND.text }}>{fmtNum(completedQty)} / {fmtNum(order.qty)} {order.unit || ""}</strong> · {completionPct}%</span>
                    </div>
                    <div style={{ height: 9, background: "#DCE9E1", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${completionPct}%`, height: "100%", borderRadius: 999, background: completionPct >= 100 ? BRAND.success : BRAND.primary, transition: "width .3s ease" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8, fontSize: 12, color: BRAND.textMuted }}>
                      <span>Dialokasikan: {fmtNum(usedPlanned)} {order.unit || ""}</span>
                      <span>Sisa: {fmtNum(remaining)} {order.unit || ""}</span>
                    </div>
                  </div>
                ) : isMaterialShipment && materialLines.length ? (
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 18, fontSize: 13, color: BRAND.textMuted }}>
                    <span><strong style={{ color: BRAND.text }}>{materialLines.length}</strong> baris barang tercatat</span>
                    {materialTotalKg > 0 && <span><strong style={{ color: BRAND.text }}>{fmtNum(materialTotalKg)} kg</strong> total muatan</span>}
                    <span><strong style={{ color: BRAND.text }}>{completedTrips}/{trips.length}</strong> trip selesai</span>
                  </div>
                ) : null}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
                <InfoTile icon={FiUser} label="Pelanggan" value={customerName} sub={order.customer?.phone || undefined} />
                <InfoTile icon={FiPackage} label="Muatan" value={isMaterialShipment ? materialCargoLabel : cargo} sub={isMaterialShipment ? `${materialInvoices.length} faktur muatan` : (order.orderType ? String(order.orderType).replaceAll("_", " ") : undefined)} />
                <InfoTile icon={FiMapPin} label="Rute" value={route} sub="Lokasi asal dan tujuan" />
                <InfoTile icon={FiCalendar} label="Jadwal" value={fmtDate(order.plannedAt)} sub="Deadline selesai pengiriman" />
                <InfoTile icon={FiActivity} label="Perjalanan" value={`${trips.length} trip`} sub={tripCompletionLabel} />
                <InfoTile icon={FiClock} label="Dibuat oleh" value={order.createdBy?.name || order.createdBy?.email || "Data lama"} sub={fmtDateTime(order.createdAt)} />
              </div>

              <div style={{ marginTop: 14, padding: 16, border: `1px solid ${BRAND.border}`, borderRadius: 10, background: BRAND.white }}>
                <div style={{ color: BRAND.textMuted, fontSize: 12, marginBottom: 7 }}>Catatan</div>
                <div style={{ color: BRAND.textLight, fontSize: 14, lineHeight: 1.6 }}>{order.notes || "Tidak ada catatan tambahan."}</div>
              </div>
            </div>
          )}

          {tab === "PROOFS" && (
            <div>
              {canWrite && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      disabled={uploadingProofs}
                      onChange={async (e) => {
                        try {
                          setUploadProofErr("");
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;

                          setUploadingProofs(true);
                          const uploaded = await uploadFiles(files);

                          await api(`/orders/${id}/proofs`, {
                            method: "POST",
                            body: JSON.stringify({
                              proofs: uploaded.map((u) => ({
                                url: u.url,
                                fileName: u.fileName || null,
                                mimeType: u.mimeType || null,
                                size: typeof u.size === "number" ? u.size : null,
                              })),
                            }),
                          });

                          e.target.value = "";
                          await load();
                        } catch (err) {
                          setUploadProofErr(err?.message || "Gagal mengunggah");
                        } finally {
                          setUploadingProofs(false);
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
                      {uploadingProofs ? "Sedang mengunggah..." : "Pilih beberapa gambar atau PDF · maks. 15 MB per file"}
                    </span>
                  </div>
                  {uploadProofErr && <div style={{ marginTop: 10, color: BRAND.danger, fontWeight: 500 }}>{uploadProofErr}</div>}
                </div>
              )}

              {proofs.length === 0 ? (
                <div style={{ color: BRAND.textMuted, fontSize: 14 }}>Belum ada bukti pesanan.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
                  {proofs.map((p) => {
                    const isPdf =
                      String(p.mimeType || "").toLowerCase().includes("pdf") ||
                      String(p.url || "").toLowerCase().includes(".pdf");

                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: 12,
                          borderRadius: 6,
                          border: `1px solid ${BRAND.border}`,
                          background: BRAND.secondary,
                        }}
                      >
                        <div style={{ fontSize: 12, color: BRAND.textMuted, marginBottom: 8 }}>{fmtDateTime(p.createdAt)}</div>

                        {isPdf ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <FiFile size={24} color={BRAND.textLight} />
                            <a href={apiAssetUrl(p.url)} target="_blank" rel="noreferrer" style={{ color: BRAND.primary, fontWeight: 500 }}>
                              Buka PDF
                            </a>
                          </div>
                        ) : (
                          <a href={apiAssetUrl(p.url)} target="_blank" rel="noreferrer">
                            <img src={apiAssetUrl(p.url)} alt="Bukti pesanan" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 4 }} />
                          </a>
                        )}

                        {p.fileName && <div style={{ marginTop: 8, fontSize: 12, color: BRAND.textMuted }}>{p.fileName}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "TRIPS" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {trips.length === 0 ? (
                <div style={{ padding: 20, borderRadius: 6, border: `1px dashed ${BRAND.border}`, color: BRAND.textMuted, textAlign: "center" }}>
                  Belum ada perjalanan. Klik "Tetapkan Perjalanan" untuk membuatnya.
                </div>
              ) : (
                trips.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: 16,
                      borderRadius: 6,
                      border: `1px solid ${BRAND.border}`,
                      background: BRAND.secondary,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: BRAND.text }}>
                        {t.truck?.plateNumber || t.plateNumberSnap || "-"} — {t.driverUser?.name || t.driverNameSnap || "-"}
                      </div>
                      <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <StatusBadge status={t.status} type="trip" />
                        {t.qtyPlanned != null && (
                          <span style={{ fontSize: 13, color: BRAND.textMuted }}>
                            Qty: {fmtNum(t.qtyPlanned)} {t.unitSnap || order.unit || ""}
                          </span>
                        )}
                        <span style={{ fontSize: 13, color: BRAND.textMuted }}>Planned: {fmtDateTime(t.plannedDepartAt)}</span>
                        {t.dispatchedAt && <span style={{ fontSize: 13, color: BRAND.textMuted }}>Dispatched: {fmtDateTime(t.dispatchedAt)}</span>}
                      </div>

                      {t.dispatchLetter?.pdfUrl ? (
                        <div style={{ marginTop: 8, fontSize: 13 }}>
                          Dispatch:{" "}
                          <a href={t.dispatchLetter.pdfUrl} target="_blank" rel="noreferrer" style={{ color: BRAND.primary, fontWeight: 500 }}>
                            Open PDF
                          </a>{" "}
                          <span style={{ color: BRAND.textMuted }}>({t.dispatchLetter.number})</span>
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: 13, color: BRAND.textMuted }}>Surat jalan belum dibuat.</div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <Button variant="secondary" size="small" icon={FiExternalLink} onClick={() => nav(`/trips/${t.id}`)}>
                        Open Trip
                      </Button>
                      {canWrite && (
                        <Button variant="primary" size="small" onClick={() => generateDispatch(t.id)}>
                          {t.dispatchLetter ? "Buat Ulang" : "Generate"} Dispatch
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "MATERIAL_INVOICES" && (
            <div>
              <div style={{ marginBottom: 18, color: BRAND.textMuted, fontSize: 14 }}>Khusus angkutan material/ambang. Input faktur setelah truk ditetapkan dan barang dimuat.</div>
              {canWrite && (trips.length ? (
                <form onSubmit={createMaterialInvoice} style={{ padding: 16, border: `1px solid ${BRAND.border}`, borderRadius: 10, background: BRAND.secondary, marginBottom: 20 }}>
                  <div style={{ fontWeight: 650, color: BRAND.text, marginBottom: 14 }}>Tambah Faktur Muatan</div>
                  <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                    <label style={{ fontSize: 12, color: BRAND.textMuted }}>Truk<select required value={materialInvoiceForm.tripId} onChange={(e) => { const trip = trips.find((item) => item.id === e.target.value); setMaterialInvoiceForm((f) => ({ ...f, tripId: e.target.value, number: trip?.dispatchLetter?.number || "" })); }} style={{ width: "100%", marginTop: 6, height: 42, borderRadius: 6, border: `1px solid ${BRAND.border}`, padding: "0 10px" }}><option value="">Pilih truk</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.truck?.plateNumber || trip.plateNumberSnap || "-"} · {trip.dispatchLetter?.number || "Surat jalan belum dibuat"}</option>)}</select></label>
                    <label style={{ fontSize: 12, color: BRAND.textMuted }}>No. Surat Jalan<Input readOnly value={materialInvoiceForm.number} placeholder="Pilih trip yang sudah memiliki surat jalan" style={{ marginTop: 6, background: BRAND.secondary, color: BRAND.primary, fontWeight: 700 }} /></label>
                    <label style={{ fontSize: 12, color: BRAND.textMuted }}>Tanggal<Input required type="date" value={materialInvoiceForm.issuedAt} onChange={(e) => setMaterialInvoiceForm((f) => ({ ...f, issuedAt: e.target.value }))} style={{ marginTop: 6 }} /></label>
                  </div>
                  <div style={{ marginTop: 16, overflowX: "auto" }}>
                    <div style={{ fontWeight: 650, color: BRAND.text, marginBottom: 8 }}>Rincian barang dalam GRN</div>
                    <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse", fontSize: 12 }}><thead><tr style={{ textAlign: "left", color: BRAND.textMuted }}><th>NO. PP</th><th>NO. PO</th><th>Nama barang</th><th>Qty</th><th>Satuan</th><th>Total Kg</th><th>Total Rp</th><th></th></tr></thead><tbody>{materialInvoiceLines.map((line, index) => <tr key={index}><td><Input value={line.ppNumber} onChange={(e) => setMaterialInvoiceLines((lines) => lines.map((row, i) => i === index ? { ...row, ppNumber: e.target.value } : row))} placeholder="No. PP" /></td><td><Input value={line.poNumber} onChange={(e) => setMaterialInvoiceLines((lines) => lines.map((row, i) => i === index ? { ...row, poNumber: e.target.value } : row))} placeholder="No. PO" /></td><td><Input required value={line.itemName} onChange={(e) => setMaterialInvoiceLines((lines) => lines.map((row, i) => i === index ? { ...row, itemName: e.target.value } : row))} placeholder="Nama barang" /></td><td><Input required type="number" min="0.01" step="any" value={line.qty} onChange={(e) => setMaterialInvoiceLines((lines) => lines.map((row, i) => i === index ? { ...row, qty: e.target.value } : row))} /></td><td><Input required value={line.unit} onChange={(e) => setMaterialInvoiceLines((lines) => lines.map((row, i) => i === index ? { ...row, unit: e.target.value } : row))} /></td><td><Input type="number" min="0" step="any" value={line.totalKg} onChange={(e) => setMaterialInvoiceLines((lines) => lines.map((row, i) => i === index ? { ...row, totalKg: e.target.value } : row))} /></td><td><Input type="number" min="0" step="1" value={line.totalAmount} onChange={(e) => setMaterialInvoiceLines((lines) => lines.map((row, i) => i === index ? { ...row, totalAmount: e.target.value } : row))} /></td><td><Button type="button" variant="danger" size="small" disabled={materialInvoiceLines.length === 1} onClick={() => setMaterialInvoiceLines((lines) => lines.filter((_, i) => i !== index))}>×</Button></td></tr>)}</tbody></table>
                    <Button type="button" variant="secondary" size="small" onClick={() => setMaterialInvoiceLines((lines) => [...lines, { ppNumber: "", poNumber: "", itemName: "", qty: "", unit: "PCS", totalKg: "", totalAmount: "" }])} style={{ marginTop: 10 }}>+ Tambah baris barang</Button>
                  </div>
                  <label style={{ display: "block", marginTop: 12, fontSize: 12, color: BRAND.textMuted }}>Catatan<Input value={materialInvoiceForm.notes} onChange={(e) => setMaterialInvoiceForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Catatan opsional" style={{ marginTop: 6 }} /></label>
                  <label style={{ display: "block", marginTop: 12, fontSize: 12, color: BRAND.textMuted }}>Bukti Delivery Order / Faktur (PDF atau gambar)<input type="file" accept="image/*,application/pdf" onChange={(e) => setMaterialInvoiceProof(e.target.files?.[0] || null)} style={{ display: "block", marginTop: 6, fontSize: 13 }} />{materialInvoiceProof && <span style={{ display: "block", marginTop: 5, color: BRAND.primary }}>{materialInvoiceProof.name}</span>}</label>
                  {materialInvoiceError && <div style={{ marginTop: 10, color: BRAND.danger, fontSize: 13 }}>{materialInvoiceError}</div>}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}><Button type="submit" variant="primary" disabled={savingMaterialInvoice}>{savingMaterialInvoice ? "Menyimpan..." : "Simpan Faktur"}</Button></div>
                </form>
              ) : <div style={{ padding: 16, border: `1px dashed ${BRAND.border}`, color: BRAND.textMuted, borderRadius: 8, marginBottom: 18 }}>Tetapkan truk ke pesanan terlebih dahulu sebelum memasukkan faktur muatan.</div>)}
              {materialInvoices.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}><thead><tr style={{ textAlign: "left", color: BRAND.textMuted, borderBottom: `1px solid ${BRAND.border}` }}><th style={{ padding: 10 }}>Tanggal</th><th style={{ padding: 10 }}>No. GRN / Surat Jalan</th><th style={{ padding: 10 }}>Truk</th><th style={{ padding: 10 }}>Rincian Muatan</th><th style={{ padding: 10 }}>Bukti</th><th style={{ padding: 10 }}>Catatan</th></tr></thead><tbody>{materialInvoices.map((invoice) => <tr key={invoice.id} style={{ borderBottom: `1px solid ${BRAND.border}` }}><td style={{ padding: 10, verticalAlign: "top" }}>{fmtDate(invoice.issuedAt)}</td><td style={{ padding: 10, fontWeight: 600, verticalAlign: "top" }}>{invoice.number}</td><td style={{ padding: 10, verticalAlign: "top" }}>{invoice.trip?.truck?.plateNumber || "-"}</td><td style={{ padding: 10 }}>{invoice.lines?.length ? <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr style={{ color: BRAND.textMuted }}><th style={{ textAlign: "left" }}>PP</th><th style={{ textAlign: "left" }}>PO</th><th style={{ textAlign: "left" }}>Barang</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Kg</th><th style={{ textAlign: "right" }}>Rp</th></tr></thead><tbody>{invoice.lines.map((line) => <tr key={line.id}><td>{line.ppNumber || "-"}</td><td>{line.poNumber || "-"}</td><td>{line.itemName}</td><td style={{ textAlign: "right" }}>{fmtNum(line.qty)} {line.unit}</td><td style={{ textAlign: "right" }}>{line.totalKg != null ? fmtNum(line.totalKg) : "-"}</td><td style={{ textAlign: "right" }}>{line.totalAmount != null ? Number(line.totalAmount).toLocaleString("id-ID") : "-"}</td></tr>)}</tbody></table> : `${invoice.materialName} — ${fmtNum(invoice.qty)} ${invoice.unit}`}</td><td style={{ padding: 10, verticalAlign: "top" }}>{invoice.proofUrl ? <a href={apiAssetUrl(invoice.proofUrl)} target="_blank" rel="noreferrer" style={{ color: BRAND.primary, fontWeight: 600 }}>Buka file</a> : "-"}</td><td style={{ padding: 10, color: BRAND.textMuted, verticalAlign: "top" }}>{invoice.notes || "-"}</td></tr>)}</tbody></table></div> : <div style={{ padding: 20, color: BRAND.textMuted, textAlign: "center" }}>Belum ada faktur muatan.</div>}
            </div>
          )}

        </div>
      </Card>

      {/* Assign Trip Modal */}
      <Modal
        open={showAssign}
        title="Assign Truck & Driver"
        subtitle="Truck must be READY. Driver must be ACTIVE and not on another active trip."
        onClose={() => setShowAssign(false)}
      >
        {assignErr && (
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
            {assignErr}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1.15fr 0.85fr", gap: 20 }}>
          {/* LEFT - Truck Picker */}
          <Card>
            <div style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: BRAND.text }}>Pilih Kendaraan</div>
              <div style={{ fontSize: 13, color: BRAND.textMuted, marginBottom: 12 }}>Hanya kendaraan yang berada di lokasi asal <strong>{order?.fromText || "—"}</strong> yang dapat dipilih.</div>

              <Input placeholder="Cari nomor polisi..." value={truckQ} onChange={(e) => setTruckQ(e.target.value)} />

              <div style={{ marginTop: 12, maxHeight: isNarrow ? 200 : 350, overflow: "auto" }}>
                {filteredTrucks.map((t) => {
                  const active = selectedTruckId === t.id;
                  return (
                    <div
                      key={t.id}
                      style={{
                        padding: 14,
                        borderRadius: 6,
                        border: `1px solid ${active ? BRAND.primary : BRAND.border}`,
                        background: active ? BRAND.accent : BRAND.white,
                        marginTop: 8,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onClick={() => {
                        setSelectedTruckId(t.id);
                        if (t.driverUserId) setSelectedDriverId(t.driverUserId);
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 600, color: BRAND.text }}>{t.plateNumber}</div>
                      <div style={{ fontSize: 13, color: BRAND.textMuted, marginTop: 4 }}>
                        {t.brand || "-"} {t.model ? `• ${t.model}` : ""} • {t.status}
                      </div>
                      <div style={{ fontSize: 12, color: BRAND.primary, marginTop: 4, fontWeight: 600 }}>
                        Lokasi: {t.currentLocation || "Belum diatur"}
                      </div>
                    </div>
                  );
                })}

                {filteredTrucks.length === 0 && (
                  <div style={{ padding: 12, color: BRAND.textMuted, fontSize: 14 }}>Tidak ada kendaraan siap pakai di {order?.fromText || "lokasi asal"}.</div>
                )}
              </div>
            </div>
          </Card>

          {/* RIGHT - Informasi Perjalanan */}
          <Card>
            <div style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: BRAND.text }}>Informasi Perjalanan</div>
              <div style={{ fontSize: 13, color: BRAND.textMuted, marginBottom: 12 }}>
                {isMaterialShipment
                  ? "Untuk material/ambang, qty muatan belum wajib dan akan dicatat dari Faktur Muatan setelah barang dimuat."
                  : `Trip Qty wajib diisi untuk ${order?.cargoCategory === "CANGKANG" ? "cangkang" : "pupuk"}. Sisa: ${remaining != null ? fmtNum(remaining) : "-"} ${order.unit || ""}`}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={isMaterialShipment ? "Qty muatan (opsional)" : `Trip Qty (${order.unit || "QTY"})`}
                  value={tripQty}
                  onChange={(e) => setTripQty(e.target.value)}
                />

                <Select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                >
                  <option value="">
                    Pilih Pengemudi (Aktif)
                  </option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.email}
                    </option>
                  ))}
                </Select>

                {selectedTruck?.driverUserId && (
                  <div style={{ fontSize: 13, color: BRAND.textMuted }}>
                    Pengemudi bawaan truk:{" "}
                    <span style={{ color: BRAND.text, fontWeight: 500 }}>
                      {drivers.find((x) => x.id === selectedTruck.driverUserId)?.name || "Pengemudi yang ditugaskan"}
                    </span>
                    {" "}— dapat diganti untuk perjalanan ini saja.
                  </div>
                )}

                <Input
                  type="datetime-local"
                  value={plannedDepartAt}
                  onChange={(e) => setPlannedDepartAt(e.target.value)}
                />

                {selectedTruckId && (
                  <div style={{ fontSize: 13, color: BRAND.textMuted }}>
                    Selected truck:{" "}
                    <span style={{ color: BRAND.text, fontWeight: 500 }}>
                      {trucks.find((x) => x.id === selectedTruckId)?.plateNumber || "-"}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <Button variant="secondary" onClick={() => setShowAssign(false)} disabled={assigning}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={createTrip}
                  disabled={
                    assigning ||
                    !selectedTruckId ||
                    !selectedDriverId ||
                    (order?.qty != null && !(Number.isFinite(Number(tripQty)) && Number(tripQty) > 0))
                  }
                >
                  {assigning ? "Membuat..." : "Buat Perjalanan"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Modal>
    </div>
  );
}
