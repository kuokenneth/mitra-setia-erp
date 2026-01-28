// src/pages/OrderDetail.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

//////////////////////
// THEME (match Maintenance / Orders)
//////////////////////
const pageBg = {
  minHeight: "100vh",
  padding: 22,
  color: "#0B2A1F",
};

const container = { maxWidth: 1180, margin: "0 auto" };

const panel = {
  background: "#FFFFFF",
  borderRadius: 22,
  padding: 18,
  border: "1px solid rgba(20, 80, 60, 0.10)",
  boxShadow: "0 18px 55px rgba(10, 40, 30, 0.08)",
};

const headerRow = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const title = {
  fontSize: 38,
  fontWeight: 1000,
  letterSpacing: -1,
  margin: 0,
  lineHeight: 1.05,
};

const subTitle = {
  marginTop: 6,
  fontWeight: 800,
  color: "#2F6B55",
  fontSize: 13,
};

const btnGreen = {
  height: 44,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "linear-gradient(180deg, #16A34A 0%, #0F8A3B 100%)",
  color: "#FFFFFF",
  fontWeight: 1000,
  cursor: "pointer",
  boxShadow: "0 16px 28px rgba(22, 163, 74, 0.25)",
};

const btnGhost = {
  height: 44,
  padding: "0 16px",
  borderRadius: 999,
  border: "1px solid rgba(15, 60, 45, 0.18)",
  background: "#FFFFFF",
  color: "#0B2A1F",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(10, 40, 30, 0.06)",
};

const btnDanger = {
  ...btnGhost,
  border: "1px solid rgba(244,63,94,0.35)",
  color: "#9F1239",
};

const divider = {
  height: 1,
  background: "rgba(20, 80, 60, 0.10)",
  marginTop: 14,
};

const badgeBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 34,
  padding: "0 14px",
  borderRadius: 999,
  fontWeight: 1000,
  fontSize: 12,
  letterSpacing: 0.6,
  border: "1px solid rgba(15, 60, 45, 0.16)",
  background: "#E9FBF1",
  color: "#0B2A1F",
  width: "fit-content",
};

function statusBadgeStyle(status) {
  const s = String(status || "").toUpperCase();
  if (s === "COMPLETED") return { ...badgeBase, background: "#DDFBEA", borderColor: "rgba(16,185,129,0.35)" };
  if (s === "IN_PROGRESS") return { ...badgeBase, background: "#E9FBF1", borderColor: "rgba(34,197,94,0.35)" };
  if (s === "CONFIRMED") return { ...badgeBase, background: "#EAF7FF", borderColor: "rgba(59,130,246,0.25)" };
  if (s === "CANCELLED") return { ...badgeBase, background: "#FFF1F2", borderColor: "rgba(244,63,94,0.25)" };
  return { ...badgeBase, background: "#F1F5F9", borderColor: "rgba(15, 60, 45, 0.12)" };
}

function tripBadgeStyle(status) {
  const s = String(status || "").toUpperCase();
  if (s === "COMPLETED") return { ...badgeBase, background: "#DDFBEA", borderColor: "rgba(16,185,129,0.35)" };
  if (s === "ARRIVED") return { ...badgeBase, background: "#EAF7FF", borderColor: "rgba(59,130,246,0.25)" };
  if (s === "DISPATCHED") return { ...badgeBase, background: "#E9FBF1", borderColor: "rgba(34,197,94,0.35)" };
  if (s === "CANCELLED") return { ...badgeBase, background: "#FFF1F2", borderColor: "rgba(244,63,94,0.25)" };
  return { ...badgeBase, background: "#F1F5F9", borderColor: "rgba(15, 60, 45, 0.12)" };
}

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

async function uploadFiles(fileList) {
  const fd = new FormData();
  for (const f of fileList) fd.append("files", f);

  const res = await fetch(VITE_API_URL + "/api/uploads", {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || "Upload failed");
  return data?.items || [];
}

// ✅ small helper (top-level only)
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
// Modal
//////////////////////
const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 14,
  zIndex: 80,
};

const modalCard = {
  width: "min(1120px, 100%)",
  maxHeight: "90vh",
  background: "#FFFFFF",
  borderRadius: 24,
  border: "1px solid rgba(20, 80, 60, 0.14)",
  boxShadow: "0 28px 90px rgba(0,0,0,0.22)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
};

const modalTop = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px",
  borderBottom: "1px solid rgba(20, 80, 60, 0.10)",
  background: "#FFFFFF",
};

const modalHeading = { fontSize: 22, fontWeight: 1000, margin: 0, letterSpacing: -0.4 };
const modalHint = { marginTop: 4, color: "#2F6B55", fontWeight: 900, fontSize: 12 };

const modalBody = {
  padding: 14,
  background: "linear-gradient(180deg, #FFFFFF 0%, #FBFFFD 100%)",
  overflow: "auto",
  boxSizing: "border-box",
};

const innerPanel = {
  borderRadius: 20,
  border: "1px solid rgba(20, 80, 60, 0.12)",
  background: "#FFFFFF",
  boxShadow: "0 14px 36px rgba(10, 40, 30, 0.08)",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
  boxSizing: "border-box",
};

const panelTitle = { fontSize: 18, fontWeight: 1000, margin: 0, letterSpacing: -0.2 };
const panelSub = { marginTop: 4, color: "#2F6B55", fontWeight: 900, fontSize: 12 };

const pillInput = {
  height: 46,
  padding: "0 16px",
  borderRadius: 999,
  border: "1px solid rgba(15, 60, 45, 0.16)",
  outline: "none",
  fontWeight: 900,
  fontSize: 13,
  color: "#0B2A1F",
  background: "#FFFFFF",
  boxShadow: "0 10px 22px rgba(10, 40, 30, 0.06)",
  width: "100%",
  boxSizing: "border-box",
};

const pillSelect = { ...pillInput, appearance: "none" };

const truckListWrap = {
  marginTop: 12,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  overflow: "auto",
  paddingRight: 6,
  minHeight: 0,
  flex: 1,
};

const truckCard = (active) => ({
  borderRadius: 16,
  border: active ? "2px solid rgba(34,197,94,0.55)" : "1px solid rgba(15, 60, 45, 0.12)",
  background: active ? "#ECFDF3" : "linear-gradient(180deg, #FFFFFF 0%, #FBFFFD 100%)",
  boxShadow: "0 10px 20px rgba(10, 40, 30, 0.06)",
  padding: 12,
  cursor: "pointer",
});

const truckPlate = { fontSize: 22, fontWeight: 1000, margin: 0, letterSpacing: -0.4 };
const truckMeta = { marginTop: 4, color: "#2F6B55", fontWeight: 1000, fontSize: 12 };

const modalFooterRight = {
  marginTop: 12,
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const bigBtnGreen = {
  ...btnGreen,
  height: 46,
  padding: "0 18px",
  fontSize: 14,
};

const bigBtnGhost = {
  ...btnGhost,
  height: 46,
  padding: "0 16px",
  fontSize: 14,
  boxShadow: "0 10px 22px rgba(10, 40, 30, 0.06)",
};

function fmtNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x % 1 === 0 ? String(x) : x.toFixed(2);
}

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

  // ✅ NEW: trip qty planned
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ✅ remaining calc (client-side)
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

      // ✅ If truck has assigned driver, enforce match
      if (truck?.driverUserId && selectedDriverId !== truck.driverUserId) {
        throw new Error("This truck already has an assigned driver. Please use the matched driver.");
      }

      // ✅ If order has contract qty, require tripQty
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
          qtyPlanned: needsQty ? qNum : (Number.isFinite(qNum) ? qNum : null),
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
      <div style={pageBg}>
        <div style={container}>
          <div style={panel}>Loading...</div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div style={pageBg}>
        <div style={container}>
          <div style={panel}>
            <div style={{ fontWeight: 1000, color: "#B42318" }}>{err}</div>
            <div style={{ marginTop: 12 }}>
              <button style={btnGhost} onClick={() => nav("/orders")}>
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const customerName = order.customer?.name || order.customerName || "-";
  const cargo = `${order.cargoName || "-"}${order.qty != null ? ` • ${order.qty} ${order.unit || ""}` : ""}`;
  const route = `${order.fromText || "-"} → ${order.toText || "-"}`;

  const linkedBackhauls = order.backhaulOrders || [];
  const backhaulOf = order.backhaulOfOrder;

  const tabBtn = (key, label) => (
    <button
      style={{
        ...btnGhost,
        height: 40,
        boxShadow: "none",
        border: key === tab ? "1px solid rgba(34,197,94,0.45)" : "1px solid rgba(15, 60, 45, 0.18)",
        background: key === tab ? "#E9FBF1" : "#FFFFFF",
      }}
      onClick={() => setTab(key)}
    >
      {label}
    </button>
  );

  return (
    <div style={pageBg}>
      <div style={container}>
        <div style={panel}>
          {/* Header */}
          <div style={headerRow}>
            <div>
              <h1 style={title}>
                {order.orderNo} — {customerName}
              </h1>

              <div style={subTitle}>
                {route} • {cargo} • Planned: {fmtDate(order.plannedAt)}
                {order.qty != null ? (
                  <span style={{ marginLeft: 10, fontWeight: 1000 }}>
                    • Remaining: {fmtNum(remaining)} {order.unit || ""}
                  </span>
                ) : null}
              </div>

              <div style={{ marginTop: 10 }}>
                <span style={statusBadgeStyle(order.status)}>{String(order.status).replaceAll("_", " ")}</span>
                {order.orderType ? (
                  <span style={{ ...badgeBase, marginLeft: 10, background: "#FFFFFF" }}>
                    {String(order.orderType).replaceAll("_", " ")}
                  </span>
                ) : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={btnGhost} onClick={() => nav("/orders")}>
                Back
              </button>

              {canWrite ? (
                <>
                  <button style={btnGreen} onClick={openAssignModal} disabled={order.status === "CANCELLED"}>
                    + Assign Trip
                  </button>

                  {order.status === "CANCELLED" ? (
                    <button style={btnGreen} onClick={() => patchOrderStatus("DRAFT")} title="Reopen order">
                      Reopen
                    </button>
                  ) : (
                    <>
                      <button
                        style={btnGhost}
                        onClick={() => patchOrderStatus("CONFIRMED")}
                        disabled={order.status === "CONFIRMED" || order.status === "COMPLETED"}
                      >
                        Confirm
                      </button>

                      <button
                        style={btnDanger}
                        onClick={() => patchOrderStatus("CANCELLED")}
                        disabled={order.status === "COMPLETED"}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div style={{ ...badgeBase, background: "#FFFFFF" }}>{role}</div>
              )}
            </div>
          </div>

          <div style={divider} />

          {/* Tabs */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            {tabBtn("INFO", "Info")}
            {tabBtn("PROOFS", `Proofs (${proofs.length})`)}
            {tabBtn("TRIPS", `Trips (${trips.length})`)}
            {tabBtn("BACKHAUL", "Backhaul")}
          </div>

          {/* Content */}
          <div style={{ marginTop: 14 }}>
            {tab === "INFO" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ ...panel, boxShadow: "none", borderRadius: 16 }}>
                  <div style={{ fontWeight: 1000, marginBottom: 8 }}>Order Information</div>
                  <div style={{ color: "#2F6B55", fontWeight: 900, fontSize: 13, lineHeight: 1.6 }}>
                    <div>
                      <b>Customer:</b> {customerName}
                    </div>
                    <div>
                      <b>Cargo:</b> {cargo}
                    </div>
                    <div>
                      <b>Route:</b> {route}
                    </div>
                    <div>
                      <b>Planned:</b> {fmtDate(order.plannedAt)}
                    </div>
                    {order.qty != null ? (
                      <div>
                        <b>Remaining:</b> {fmtNum(remaining)} {order.unit || ""}
                      </div>
                    ) : null}
                    <div>
                      <b>Notes:</b> {order.notes || "-"}
                    </div>
                    <div>
                      <b>Created:</b> {fmtDateTime(order.createdAt)}
                    </div>
                  </div>
                </div>

                <div style={{ ...panel, boxShadow: "none", borderRadius: 16 }}>
                  <div style={{ fontWeight: 1000, marginBottom: 8 }}>Timeline</div>
                  <div style={{ color: "#2F6B55", fontWeight: 900, fontSize: 13, lineHeight: 1.8 }}>
                    <div>• DRAFT → CONFIRMED → IN_PROGRESS → COMPLETED</div>
                    <div style={{ marginTop: 10, opacity: 0.9 }}>
                      Current:{" "}
                      <span style={statusBadgeStyle(order.status)}>{String(order.status).replaceAll("_", " ")}</span>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
                      Trip updates will automatically push the order into IN_PROGRESS and COMPLETED.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "PROOFS" ? (
              <div>
                {canWrite ? (
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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
                        borderRadius: 999,
                        border: "1px solid rgba(15, 60, 45, 0.18)",
                        fontWeight: 800,
                        width: 360,
                        boxShadow: "0 10px 22px rgba(10, 40, 30, 0.06)",
                        background: "#FFFFFF",
                        color: "#0B2A1F",
                      }}
                    />

                    <div style={{ color: "#2F6B55", fontWeight: 900, fontSize: 12 }}>
                      {uploadingProofs ? "Uploading..." : "Select multiple images / PDFs"}
                    </div>

                    {uploadProofErr ? <div style={{ color: "#B42318", fontWeight: 900 }}>{uploadProofErr}</div> : null}
                  </div>
                ) : (
                  <div style={{ color: "#2F6B55", fontWeight: 900 }}>Driver view: read-only proofs.</div>
                )}

                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {proofs.map((p) => {
                    const isPdf =
                      String(p.mimeType || "").toLowerCase().includes("pdf") ||
                      String(p.url || "").toLowerCase().includes(".pdf");

                    return (
                      <div
                        key={p.id}
                        style={{
                          borderRadius: 16,
                          border: "1px solid rgba(15, 60, 45, 0.12)",
                          background: "linear-gradient(180deg, #FFFFFF 0%, #FBFFFD 100%)",
                          boxShadow: "0 12px 26px rgba(10, 40, 30, 0.06)",
                          padding: 10,
                        }}
                      >
                        <div style={{ fontWeight: 1000, fontSize: 12, color: "#2F6B55" }}>{fmtDateTime(p.createdAt)}</div>

                        {isPdf ? (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontWeight: 1000 }}>PDF</div>
                            <a href={p.url} target="_blank" rel="noreferrer" style={{ fontWeight: 900, color: "#0B2A1F" }}>
                              Open PDF
                            </a>
                          </div>
                        ) : (
                          <a href={p.url} target="_blank" rel="noreferrer">
                            <img
                              src={p.url}
                              alt="proof"
                              style={{ marginTop: 8, width: "100%", height: 150, objectFit: "cover", borderRadius: 12 }}
                            />
                          </a>
                        )}

                        <div style={{ marginTop: 8, fontWeight: 900, fontSize: 12, color: "#2F6B55" }}>{p.fileName || ""}</div>
                      </div>
                    );
                  })}
                </div>

                {proofs.length === 0 ? (
                  <div style={{ marginTop: 12, color: "#2F6B55", fontWeight: 900 }}>No proofs yet.</div>
                ) : null}
              </div>
            ) : null}

            {tab === "TRIPS" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {trips.length === 0 ? (
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      border: "1px dashed rgba(15, 60, 45, 0.20)",
                      color: "#2F6B55",
                      fontWeight: 900,
                    }}
                  >
                    No trips yet. Click “Assign Trip” to create execution.
                  </div>
                ) : null}

                {trips.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      borderRadius: 18,
                      border: "1px solid rgba(15, 60, 45, 0.12)",
                      background: "linear-gradient(180deg, #FFFFFF 0%, #FBFFFD 100%)",
                      boxShadow: "0 12px 26px rgba(10, 40, 30, 0.06)",
                      padding: 14,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 1000, fontSize: 16 }}>
                        {t.truck?.plateNumber || t.plateNumberSnap || "-"} — {t.driverUser?.name || t.driverNameSnap || "-"}
                      </div>

                      <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={tripBadgeStyle(t.status)}>{String(t.status).replaceAll("_", " ")}</span>

                        {t.qtyPlanned != null ? (
                          <span style={{ color: "#2F6B55", fontWeight: 900, fontSize: 12 }}>
                            Qty: {fmtNum(t.qtyPlanned)} {t.unitSnap || order.unit || ""}
                          </span>
                        ) : null}

                        <span style={{ color: "#2F6B55", fontWeight: 900, fontSize: 12 }}>
                          Planned: {fmtDateTime(t.plannedDepartAt)}
                        </span>

                        {t.dispatchedAt ? (
                          <span style={{ color: "#2F6B55", fontWeight: 900, fontSize: 12 }}>
                            Dispatched: {fmtDateTime(t.dispatchedAt)}
                          </span>
                        ) : null}
                      </div>

                      {t.dispatchLetter?.pdfUrl ? (
                        <div style={{ marginTop: 8, fontWeight: 900, color: "#0B2A1F", fontSize: 13 }}>
                          Dispatch:{" "}
                          <a href={t.dispatchLetter.pdfUrl} target="_blank" rel="noreferrer">
                            Open PDF
                          </a>{" "}
                          <span style={{ color: "#2F6B55", fontWeight: 900, fontSize: 12 }}>({t.dispatchLetter.number})</span>
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, color: "#2F6B55", fontWeight: 900, fontSize: 12 }}>Dispatch letter not generated.</div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <button style={btnGhost} onClick={() => nav(`/trips/${t.id}`)} title="Open trip detail (optional page)">
                        Open Trip
                      </button>

                      {canWrite ? (
                        <button style={btnGreen} onClick={() => generateDispatch(t.id)}>
                          {t.dispatchLetter ? "Regenerate Dispatch" : "Generate Dispatch"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === "BACKHAUL" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ ...panel, boxShadow: "none", borderRadius: 16 }}>
                  <div style={{ fontWeight: 1000, marginBottom: 8 }}>Return / Backhaul</div>
                  <div style={{ color: "#2F6B55", fontWeight: 900, fontSize: 13, lineHeight: 1.6 }}>
                    <div>Use this when the truck returns with load from destination back to warehouse.</div>
                    <div style={{ marginTop: 10 }}>
                      <b>Current order type:</b> {order.orderType ? String(order.orderType) : "-"}
                    </div>

                    {backhaulOf ? (
                      <div style={{ marginTop: 10 }}>
                        <b>This order is a backhaul of:</b>{" "}
                        <button
                          style={{ ...btnGhost, height: 36, padding: "0 12px", boxShadow: "none" }}
                          onClick={() => nav(`/orders/${backhaulOf.id}`)}
                        >
                          {backhaulOf.orderNo || "Open"}
                        </button>
                      </div>
                    ) : null}

                    {canWrite && !backhaulOf ? (
                      <div style={{ marginTop: 14 }}>
                        <button style={btnGreen} onClick={createBackhaul}>
                          Create Return Order
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ ...panel, boxShadow: "none", borderRadius: 16 }}>
                  <div style={{ fontWeight: 1000, marginBottom: 8 }}>Linked Return Orders</div>
                  {linkedBackhauls.length === 0 ? (
                    <div style={{ color: "#2F6B55", fontWeight: 900, fontSize: 13 }}>No linked return orders yet.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {linkedBackhauls.map((b) => (
                        <div
                          key={b.id}
                          style={{
                            borderRadius: 16,
                            border: "1px solid rgba(15, 60, 45, 0.12)",
                            padding: 12,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 1000 }}>{b.orderNo}</div>
                            <div style={{ color: "#2F6B55", fontWeight: 900, fontSize: 12 }}>
                              {b.fromText || "-"} → {b.toText || "-"} • Planned {fmtDate(b.plannedAt)}
                            </div>
                          </div>
                          <button style={btnGhost} onClick={() => nav(`/orders/${b.id}`)}>
                            Open
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Assign Trip Modal */}
      {showAssign ? (
        <div style={modalOverlay} onMouseDown={() => setShowAssign(false)}>
          <div style={modalCard} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalTop}>
              <div>
                <h3 style={modalHeading}>Assign Truck & Driver</h3>
                <div style={modalHint}>Truck must be READY. Driver must be ACTIVE and not on another active trip.</div>
              </div>
              <button style={btnGhost} onClick={() => setShowAssign(false)}>
                Close
              </button>
            </div>

            <div style={modalBody}>
              {assignErr ? (
                <div style={{ marginBottom: 10, color: "#B42318", fontWeight: 1000, fontSize: 13 }}>{assignErr}</div>
              ) : null}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isNarrow ? "1fr" : "1.15fr 0.85fr",
                  gap: 14,
                  alignItems: "stretch",
                  minWidth: 0,
                }}
              >
                {/* LEFT */}
                <div style={{ ...innerPanel, height: isNarrow ? "auto" : "62vh" }}>
                  <div>
                    <h4 style={panelTitle}>Pick Truck (search by plate)</h4>
                    <div style={panelSub}>Only READY trucks can be selected</div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <input
                      style={pillInput}
                      placeholder="Search plate number..."
                      value={truckQ}
                      onChange={(e) => setTruckQ(e.target.value)}
                    />
                  </div>

                  <div style={truckListWrap}>
                    {filteredTrucks.map((t) => {
                      const active = selectedTruckId === t.id;
                      return (
                        <div
                          key={t.id}
                          style={truckCard(active)}
                          onClick={() => {
                            setSelectedTruckId(t.id);

                            // ✅ if truck already paired to a driver, force that driver
                            if (t.driverUserId) setSelectedDriverId(t.driverUserId);
                          }}
                        >
                          <p style={truckPlate}>{t.plateNumber}</p>
                          <div style={truckMeta}>
                            {t.brand || "-"} {t.model ? `• ${t.model}` : ""} • {t.status}
                          </div>
                        </div>
                      );
                    })}

                    {filteredTrucks.length === 0 ? (
                      <div style={{ color: "#2F6B55", fontWeight: 900, padding: 8, fontSize: 13 }}>No READY trucks found.</div>
                    ) : null}
                  </div>
                </div>

                {/* RIGHT */}
                <div style={{ ...innerPanel, height: isNarrow ? "auto" : "62vh" }}>
                  <div>
                    <h4 style={panelTitle}>Trip Info</h4>
                    <div style={panelSub}>
                      {order?.qty != null
                        ? `Trip Qty is required. Remaining: ${fmtNum(remaining)} ${order.unit || ""}`
                        : "Choose driver, trip qty (optional), and depart time (optional)"}
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* ✅ NEW: Trip qty */}
                    <input
                      style={pillInput}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={`Trip Qty (${order.unit || "QTY"})`}
                      value={tripQty}
                      onChange={(e) => setTripQty(e.target.value)}
                    />

                    <select
                      style={{
                        ...pillSelect,
                        opacity: selectedTruck?.driverUserId ? 0.75 : 1,
                        cursor: selectedTruck?.driverUserId ? "not-allowed" : "pointer",
                      }}
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
                    </select>

                    {selectedTruck?.driverUserId ? (
                      <div style={{ color: "#2F6B55", fontWeight: 900, fontSize: 12 }}>
                        This truck is assigned to:{" "}
                        <span style={{ color: "#0B2A1F" }}>
                          {drivers.find((x) => x.id === selectedTruck.driverUserId)?.name || "Assigned driver"}
                        </span>
                      </div>
                    ) : null}

                    <input
                      style={pillInput}
                      type="datetime-local"
                      value={plannedDepartAt}
                      onChange={(e) => setPlannedDepartAt(e.target.value)}
                    />

                    {selectedTruckId ? (
                      <div style={{ marginTop: 4, color: "#2F6B55", fontWeight: 900, fontSize: 12 }}>
                        Selected truck:{" "}
                        <span style={{ color: "#0B2A1F" }}>
                          {trucks.find((x) => x.id === selectedTruckId)?.plateNumber || "-"}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div style={{ flex: 1 }} />

                  <div style={modalFooterRight}>
                    <button style={bigBtnGhost} onClick={() => setShowAssign(false)} disabled={assigning}>
                      Cancel
                    </button>

                    <button
                      style={bigBtnGreen}
                      onClick={createTrip}
                      disabled={
                        assigning ||
                        !selectedTruckId ||
                        !selectedDriverId ||
                        (order?.qty != null && !(Number.isFinite(Number(tripQty)) && Number(tripQty) > 0))
                      }
                    >
                      {assigning ? "Creating..." : "Create Trip"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
