// src/pages/TripDetail.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

//////////////////////
// THEME (match Orders / Maintenance)
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

function tripBadgeStyle(status) {
  const s = String(status || "").toUpperCase();
  if (s === "COMPLETED") return { ...badgeBase, background: "#DDFBEA", borderColor: "rgba(16,185,129,0.35)" };
  if (s === "ARRIVED") return { ...badgeBase, background: "#EAF7FF", borderColor: "rgba(59,130,246,0.25)" };
  if (s === "DISPATCHED") return { ...badgeBase, background: "#E9FBF1", borderColor: "rgba(34,197,94,0.35)" };
  if (s === "CANCELLED") return { ...badgeBase, background: "#FFF1F2", borderColor: "rgba(244,63,94,0.25)" };
  return { ...badgeBase, background: "#F1F5F9", borderColor: "rgba(15, 60, 45, 0.12)" };
}

function fmtDateTime(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("id-ID");
}

export default function TripDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const role = user?.role || "UNKNOWN";

  const canWrite = ["OWNER", "ADMIN", "STAFF"].includes(role);
  const isDriver = role === "DRIVER";

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [trip, setTrip] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const data = await api(`/trips/${id}`);
      setTrip(data);
    } catch (e) {
      setErr(e?.message || "Failed to load trip");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const order = trip?.order || null;
  const truck = trip?.truck || null;
  const driver = trip?.driverUser || null;

  const routeText = useMemo(() => {
    const from = order?.fromText || trip?.fromText || "-";
    const to = order?.toText || trip?.toText || "-";
    return `${from} → ${to}`;
  }, [order?.fromText, order?.toText, trip?.fromText, trip?.toText]);

  const headline = useMemo(() => {
    const plate = truck?.plateNumber || trip?.plateNumberSnap || "-";
    const drv = driver?.name || trip?.driverNameSnap || "-";
    return `${plate} — ${drv}`;
  }, [truck?.plateNumber, trip?.plateNumberSnap, driver?.name, trip?.driverNameSnap]);

  // Driver legal transitions (mirrors backend strict map)
  const driverNextMap = {
    PLANNED: ["DISPATCHED"],
    DISPATCHED: ["ARRIVED"],
    ARRIVED: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: [],
  };

  const allowedNextStatuses = useMemo(() => {
    const cur = String(trip?.status || "PLANNED").toUpperCase();
    if (canWrite) return ["PLANNED", "DISPATCHED", "ARRIVED", "COMPLETED", "CANCELLED"];
    if (isDriver) return driverNextMap[cur] || [];
    return [];
  }, [trip?.status, canWrite, isDriver]);

  async function setStatus(next) {
    try {
      setSaveErr("");
      setSaving(true);
      await api(`/trips/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (e) {
      setSaveErr(e?.message || "Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !trip) {
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
              <button style={btnGhost} onClick={() => nav(-1)}>
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!trip) return null;

  return (
    <div style={pageBg}>
      <div style={container}>
        <div style={panel}>
          {/* Header */}
          <div style={headerRow}>
            <div>
              <h1 style={title}>Trip — {headline}</h1>

              <div style={subTitle}>
                Order:{" "}
                {order?.orderNo ? (
                  <span
                    style={{ textDecoration: "underline", cursor: "pointer" }}
                    onClick={() => nav(`/orders/${order.id}`)}
                    title="Open order"
                  >
                    {order.orderNo}
                  </span>
                ) : (
                  "-"
                )}{" "}
                • {routeText} • Planned: {fmtDateTime(trip.plannedDepartAt)}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={tripBadgeStyle(trip.status)}>{String(trip.status).replaceAll("_", " ")}</span>
                <span style={{ ...badgeBase, background: "#FFFFFF" }}>{role}</span>

                {trip.qtyPlanned != null ? (
                  <span style={{ ...badgeBase, background: "#FFFFFF" }}>
                    Qty: {trip.qtyPlanned} {trip.unitSnap || order?.unit || ""}
                  </span>
                ) : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={btnGhost} onClick={() => nav(-1)}>
                Back
              </button>

              {canWrite || isDriver ? (
                <>
                  {/* Primary “next step” button for drivers */}
                  {isDriver && allowedNextStatuses.length === 1 ? (
                    <button style={btnGreen} onClick={() => setStatus(allowedNextStatuses[0])} disabled={saving}>
                      {saving ? "Saving..." : `Mark ${allowedNextStatuses[0]}`}
                    </button>
                  ) : null}

                  {/* Admin quick actions */}
                  {canWrite ? (
                    <>
                      <button style={btnGhost} onClick={() => setStatus("PLANNED")} disabled={saving}>
                        Set PLANNED
                      </button>
                      <button style={btnGhost} onClick={() => setStatus("DISPATCHED")} disabled={saving}>
                        Set DISPATCHED
                      </button>
                      <button style={btnGhost} onClick={() => setStatus("ARRIVED")} disabled={saving}>
                        Set ARRIVED
                      </button>
                      <button style={btnGhost} onClick={() => setStatus("COMPLETED")} disabled={saving}>
                        Set COMPLETED
                      </button>
                      <button style={btnDanger} onClick={() => setStatus("CANCELLED")} disabled={saving}>
                        Cancel Trip
                      </button>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          <div style={divider} />

          {saveErr ? (
            <div style={{ marginTop: 12, color: "#B42318", fontWeight: 1000, fontSize: 13 }}>{saveErr}</div>
          ) : null}

          {/* Content grid */}
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Trip info */}
            <div style={{ ...panel, boxShadow: "none", borderRadius: 16 }}>
              <div style={{ fontWeight: 1000, marginBottom: 8 }}>Trip Information</div>
              <div style={{ color: "#2F6B55", fontWeight: 900, fontSize: 13, lineHeight: 1.7 }}>
                <div>
                  <b>Status:</b> <span style={tripBadgeStyle(trip.status)}>{String(trip.status).replaceAll("_", " ")}</span>
                </div>
                <div>
                  <b>Planned depart:</b> {fmtDateTime(trip.plannedDepartAt)}
                </div>
                <div>
                  <b>Dispatched at:</b> {fmtDateTime(trip.dispatchedAt)}
                </div>
                <div>
                  <b>Arrived at:</b> {fmtDateTime(trip.arrivedAt)}
                </div>
                <div>
                  <b>Completed at:</b> {fmtDateTime(trip.completedAt)}
                </div>
                <div>
                  <b>Created:</b> {fmtDateTime(trip.createdAt)}
                </div>
              </div>
            </div>

            {/* Truck/Driver/Order */}
            <div style={{ ...panel, boxShadow: "none", borderRadius: 16 }}>
              <div style={{ fontWeight: 1000, marginBottom: 8 }}>Assignment</div>
              <div style={{ color: "#2F6B55", fontWeight: 900, fontSize: 13, lineHeight: 1.7 }}>
                <div>
                  <b>Truck:</b> {truck?.plateNumber || trip.plateNumberSnap || "-"}{" "}
                  <span style={{ opacity: 0.9 }}>
                    {truck?.brand ? `• ${truck.brand}` : ""} {truck?.model ? `• ${truck.model}` : ""}
                  </span>
                </div>
                <div>
                  <b>Driver:</b> {driver?.name || trip.driverNameSnap || "-"}
                </div>
                <div style={{ marginTop: 10 }}>
                  <b>Order:</b> {order?.orderNo || "-"}
                </div>
                <div>
                  <b>Customer:</b> {order?.customer?.name || order?.customerName || "-"}
                </div>
                <div>
                  <b>Route:</b> {routeText}
                </div>

                {trip.dispatchLetter?.pdfUrl ? (
                  <div style={{ marginTop: 10 }}>
                    <b>Dispatch letter:</b>{" "}
                    <a href={trip.dispatchLetter.pdfUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 1000, color: "#0B2A1F" }}>
                      Open PDF
                    </a>{" "}
                    <span style={{ fontSize: 12, opacity: 0.9 }}>({trip.dispatchLetter.number})</span>
                  </div>
                ) : (
                  <div style={{ marginTop: 10, opacity: 0.9 }}>Dispatch letter not generated.</div>
                )}
              </div>
            </div>
          </div>

          {/* Proofs quick view (from order.proofs included in GET /trips/:id) */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 1000, marginBottom: 8 }}>Order Proofs</div>

            {(order?.proofs || []).length === 0 ? (
              <div style={{ color: "#2F6B55", fontWeight: 900 }}>No proofs yet.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {(order?.proofs || []).slice(0, 8).map((p) => {
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
            )}

            {(order?.proofs || []).length > 8 ? (
              <div style={{ marginTop: 10 }}>
                <button style={btnGhost} onClick={() => nav(`/orders/${order.id}`)}>
                  View all proofs in Order
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
