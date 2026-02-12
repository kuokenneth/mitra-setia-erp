// src/pages/OrderDetail.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { FiArrowLeft, FiPlus, FiCheck, FiX, FiRefreshCw, FiExternalLink, FiFile } from "react-icons/fi";

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

async function uploadFiles(fileList) {
  const fd = new FormData();
  for (const f of fileList) fd.append("files", f);

  const res = await fetch(import.meta.env.VITE_API_URL + "/api/uploads", {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || "Upload failed");
  return data?.items || [];
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
      setErr(e?.message || "Failed to load order");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function loadDrivers() {
    const data = await api(`/users`);
    const items = data?.items || data || [];
    const only = items.filter((u) => u.role === "DRIVER" && u.status === "ACTIVE");
    setDrivers(only);
  }

  async function loadTrucks(q) {
    const data = await api(`/trucks${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    const items = data?.items || data || [];
    const ready = items.filter((t) => t.status === "READY");
    setTrucks(ready);
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
      setAssignErr(e?.message || "Failed to load drivers/trucks");
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
      setAssignErr(e?.message || "Failed to create trip");
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

  async function createBackhaul() {
    try {
      const toText = prompt("Backhaul destination (warehouse). Example: Gudang Cemara");
      if (!toText) return;

      const data = await api(`/orders/${id}/backhaul`, {
        method: "POST",
        body: JSON.stringify({ toText }),
      });

      nav(`/orders/${data.id}`);
    } catch (e) {
      alert(e?.message || "Failed to create backhaul order");
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
      alert(e?.message || "Failed to update order");
    }
  }

  if (loading && !order) {
    return (
      <div data-testid="order-detail-loading">
        <Card style={{ padding: 24 }}>
          <div style={{ color: BRAND.textMuted }}>Loading...</div>
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
  const linkedBackhauls = order.backhaulOrders || [];
  const backhaulOf = order.backhaulOfOrder;

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
            Proofs ({proofs.length})
          </TabButton>
          <TabButton active={tab === "TRIPS"} onClick={() => setTab("TRIPS")}>
            Trips ({trips.length})
          </TabButton>
          <TabButton active={tab === "BACKHAUL"} onClick={() => setTab("BACKHAUL")}>
            Backhaul
          </TabButton>
        </div>

        {/* Tab Content */}
        <div style={{ padding: 20 }}>
          {tab === "INFO" && (
            <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr", gap: 20 }}>
              <div style={{ padding: 20, background: BRAND.secondary, borderRadius: 6 }}>
                <div style={{ fontWeight: 600, marginBottom: 12, color: BRAND.text }}>Order Information</div>
                <div style={{ fontSize: 14, color: BRAND.textLight, lineHeight: 1.8 }}>
                  <div><strong>Customer:</strong> {customerName}</div>
                  <div><strong>Cargo:</strong> {cargo}</div>
                  <div><strong>Route:</strong> {route}</div>
                  <div><strong>Planned:</strong> {fmtDate(order.plannedAt)}</div>
                  {order.qty != null && <div><strong>Remaining:</strong> {fmtNum(remaining)} {order.unit || ""}</div>}
                  <div><strong>Notes:</strong> {order.notes || "-"}</div>
                  <div><strong>Created:</strong> {fmtDateTime(order.createdAt)}</div>
                </div>
              </div>

              <div style={{ padding: 20, background: BRAND.secondary, borderRadius: 6 }}>
                <div style={{ fontWeight: 600, marginBottom: 12, color: BRAND.text }}>Timeline</div>
                <div style={{ fontSize: 14, color: BRAND.textLight, lineHeight: 1.8 }}>
                  <div>• DRAFT → CONFIRMED → IN_PROGRESS → COMPLETED</div>
                  <div style={{ marginTop: 12 }}>
                    Current: <StatusBadge status={order.status} />
                  </div>
                  <div style={{ marginTop: 12, fontSize: 13, color: BRAND.textMuted }}>
                    Trip updates will automatically push the order into IN_PROGRESS and COMPLETED.
                  </div>
                </div>
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
                          setUploadProofErr(err?.message || "Upload failed");
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
                      {uploadingProofs ? "Uploading..." : "Select multiple images / PDFs"}
                    </span>
                  </div>
                  {uploadProofErr && <div style={{ marginTop: 10, color: BRAND.danger, fontWeight: 500 }}>{uploadProofErr}</div>}
                </div>
              )}

              {proofs.length === 0 ? (
                <div style={{ color: BRAND.textMuted, fontSize: 14 }}>No proofs yet.</div>
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
                            <a href={p.url} target="_blank" rel="noreferrer" style={{ color: BRAND.primary, fontWeight: 500 }}>
                              Open PDF
                            </a>
                          </div>
                        ) : (
                          <a href={p.url} target="_blank" rel="noreferrer">
                            <img src={p.url} alt="proof" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 4 }} />
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
                  No trips yet. Click "Assign Trip" to create execution.
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
                        <div style={{ marginTop: 8, fontSize: 13, color: BRAND.textMuted }}>Dispatch letter not generated.</div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <Button variant="secondary" size="small" icon={FiExternalLink} onClick={() => nav(`/trips/${t.id}`)}>
                        Open Trip
                      </Button>
                      {canWrite && (
                        <Button variant="primary" size="small" onClick={() => generateDispatch(t.id)}>
                          {t.dispatchLetter ? "Regenerate" : "Generate"} Dispatch
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "BACKHAUL" && (
            <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr", gap: 20 }}>
              <div style={{ padding: 20, background: BRAND.secondary, borderRadius: 6 }}>
                <div style={{ fontWeight: 600, marginBottom: 12, color: BRAND.text }}>Return / Backhaul</div>
                <div style={{ fontSize: 14, color: BRAND.textLight, lineHeight: 1.8 }}>
                  <div>Use this when the truck returns with load from destination back to warehouse.</div>
                  <div style={{ marginTop: 12 }}>
                    <strong>Current order type:</strong> {order.orderType ? String(order.orderType) : "-"}
                  </div>

                  {backhaulOf && (
                    <div style={{ marginTop: 12 }}>
                      <strong>This order is a backhaul of:</strong>{" "}
                      <Button variant="secondary" size="small" onClick={() => nav(`/orders/${backhaulOf.id}`)}>
                        {backhaulOf.orderNo || "Open"}
                      </Button>
                    </div>
                  )}

                  {canWrite && !backhaulOf && (
                    <div style={{ marginTop: 16 }}>
                      <Button variant="primary" icon={FiPlus} onClick={createBackhaul}>
                        Create Return Order
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: 20, background: BRAND.secondary, borderRadius: 6 }}>
                <div style={{ fontWeight: 600, marginBottom: 12, color: BRAND.text }}>Linked Return Orders</div>
                {linkedBackhauls.length === 0 ? (
                  <div style={{ fontSize: 14, color: BRAND.textMuted }}>No linked return orders yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {linkedBackhauls.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          padding: 12,
                          borderRadius: 6,
                          border: `1px solid ${BRAND.border}`,
                          background: BRAND.white,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: BRAND.text }}>{b.orderNo}</div>
                          <div style={{ fontSize: 13, color: BRAND.textMuted }}>
                            {b.fromText || "-"} → {b.toText || "-"} • Planned {fmtDate(b.plannedAt)}
                          </div>
                        </div>
                        <Button variant="secondary" size="small" onClick={() => nav(`/orders/${b.id}`)}>
                          Open
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
              <div style={{ fontWeight: 600, marginBottom: 8, color: BRAND.text }}>Pick Truck</div>
              <div style={{ fontSize: 13, color: BRAND.textMuted, marginBottom: 12 }}>Only READY trucks can be selected</div>

              <Input placeholder="Search plate number..." value={truckQ} onChange={(e) => setTruckQ(e.target.value)} />

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
                    </div>
                  );
                })}

                {filteredTrucks.length === 0 && (
                  <div style={{ padding: 12, color: BRAND.textMuted, fontSize: 14 }}>No READY trucks found.</div>
                )}
              </div>
            </div>
          </Card>

          {/* RIGHT - Trip Info */}
          <Card>
            <div style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: BRAND.text }}>Trip Info</div>
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
                    {selectedTruck?.driverUserId ? "Driver locked to truck" : "Select Driver (ACTIVE)"}
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
                      {drivers.find((x) => x.id === selectedTruck.driverUserId)?.name || "Assigned driver"}
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
                  {assigning ? "Creating..." : "Create Trip"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Modal>
    </div>
  );
}
