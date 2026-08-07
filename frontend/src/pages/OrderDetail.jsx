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
        boxSizing: "border-box",
      }}
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
        cursor: props.disabled ? "not-allowed" : "pointer",
        boxSizing: "border-box",
        opacity: props.disabled ? 0.7 : 1,
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

  const trips = order?.trips || [];
  const proofs = order?.proofs || [];
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

  async function loadDrivers() {
    const data = await api(`/users`);
    const items = data?.items || data || [];
    const only = items.filter((u) => u.role === "DRIVER" && u.status === "ACTIVE");
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
    if (order?.qty == null) return null;
    const rem = Number(order.qty) - usedPlanned;
    return Number.isFinite(rem) ? Math.max(0, rem) : null;
  }, [order?.qty, usedPlanned]);

  async function createTrip() {
    try {
      setAssignErr("");
      setAssigning(true);

      const truck = trucks.find((t) => t.id === selectedTruckId);

      if (!selectedTruckId) throw new Error("Please select a truck");
      if (!selectedDriverId) throw new Error("Please select a driver");

      if (truck?.driverUserId && selectedDriverId !== truck.driverUserId) {
        throw new Error("This truck already has an assigned driver. Please use the matched driver.");
      }

      const needsQty = order?.qty != null;
      const qNum = tripQty ? Number(tripQty) : null;

      if (needsQty) {
        if (!Number.isFinite(qNum) || qNum <= 0) throw new Error("Please input Trip Qty");
      }

      await api(`/orders/${id}/trips`, {
        method: "POST",
        body: JSON.stringify({
          truckId: selectedTruckId,
          driverUserId: selectedDriverId,
          plannedDepartAt: plannedDepartAt ? new Date(plannedDepartAt).toISOString() : null,
          qtyPlanned: needsQty ? qNum : Number.isFinite(qNum) ? qNum : null,
        }),
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
  const cargo = `${order.cargoName || "-"}${order.qty != null ? ` • ${order.qty} ${order.unit || ""}` : ""}`;
  const route = `${order.fromText || "-"} → ${order.toText || "-"}`;
  const completedQty = trips
    .filter((t) => String(t.status || "").toUpperCase() === "COMPLETED")
    .reduce((sum, t) => sum + Number(t.qtyActual ?? t.qtyPlanned ?? 0), 0);
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
            {order.qty != null && (
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
        </div>

        {/* Tab Content */}
        <div style={{ padding: 20 }}>
          {tab === "INFO" && (
            <div>
              <div style={{ padding: isNarrow ? 18 : 22, borderRadius: 12, background: "linear-gradient(135deg, #F5FAF7 0%, #EDF6F1 100%)", border: "1px solid #DFEBE4" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ color: BRAND.primary, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>RINGKASAN PESANAN</div>
                    <div style={{ color: BRAND.text, fontSize: 20, fontWeight: 650, marginTop: 7 }}>{order.cargoName || "Muatan belum diisi"}</div>
                    <div style={{ color: BRAND.textMuted, fontSize: 13, marginTop: 5 }}>{route}</div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                {order.qty != null ? (
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
                ) : null}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
                <InfoTile icon={FiUser} label="Pelanggan" value={customerName} sub={order.customer?.phone || undefined} />
                <InfoTile icon={FiPackage} label="Muatan" value={cargo} sub={order.orderType ? String(order.orderType).replaceAll("_", " ") : undefined} />
                <InfoTile icon={FiMapPin} label="Rute" value={route} sub="Lokasi asal dan tujuan" />
                <InfoTile icon={FiCalendar} label="Jadwal" value={fmtDate(order.plannedAt)} sub="Deadline selesai pengiriman" />
                <InfoTile icon={FiActivity} label="Perjalanan" value={`${trips.length} trip`} sub={`${fmtNum(completedQty)} ${order.unit || ""} selesai diangkut`} />
                <InfoTile icon={FiClock} label="Dibuat" value={fmtDateTime(order.createdAt)} sub="Waktu pesanan dicatat" />
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
                {order?.qty != null
                  ? `Trip Qty is required. Remaining: ${fmtNum(remaining)} ${order.unit || ""}`
                  : "Choose driver, trip qty (optional), and depart time (optional)"}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Trip Qty (${order.unit || "QTY"})`}
                  value={tripQty}
                  onChange={(e) => setTripQty(e.target.value)}
                />

                <Select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  disabled={!!selectedTruck?.driverUserId}
                >
                  <option value="">
                    {selectedTruck?.driverUserId ? "Pengemudi mengikuti kendaraan" : "Pilih Pengemudi (Aktif)"}
                  </option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.email}
                    </option>
                  ))}
                </Select>

                {selectedTruck?.driverUserId && (
                  <div style={{ fontSize: 13, color: BRAND.textMuted }}>
                    This truck is assigned to:{" "}
                    <span style={{ color: BRAND.text, fontWeight: 500 }}>
                      {drivers.find((x) => x.id === selectedTruck.driverUserId)?.name || "Pengemudi yang ditugaskan"}
                    </span>
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
