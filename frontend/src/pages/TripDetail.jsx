// src/pages/TripDetail.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, uploadFiles } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import { openProtectedFile, ProtectedImage } from "../components/ProtectedFile";
import {
  FiActivity,
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiFileText,
  FiFlag,
  FiMapPin,
  FiPackage,
  FiTruck,
  FiUploadCloud,
  FiUser,
  FiX,
} from "react-icons/fi";
import "./TripDetailRedesign.css";

//////////////////////
// THEME (match Orders / Maintenance)
//////////////////////
const pageBg = {
  minHeight: "100vh",
  color: "#17211C",
};

const container = { maxWidth: 1180, margin: "0 auto" };

const panel = {
  background: "#FFFFFF",
  borderRadius: 14,
  padding: 24,
  border: "1px solid #E2EAE5",
  boxShadow: "0 8px 30px rgba(18, 56, 39, 0.06)",
};

const headerRow = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const title = {
  fontSize: 30,
  fontWeight: 700,
  letterSpacing: -0.6,
  margin: 0,
  lineHeight: 1.05,
};

const subTitle = {
  marginTop: 10,
  fontWeight: 400,
  color: "#68756E",
  fontSize: 14,
};

const btnGhost = {
  height: 40,
  padding: "0 16px",
  borderRadius: 999,
  border: "1px solid rgba(15, 60, 45, 0.18)",
  background: "#FFFFFF",
  color: "#0B2A1F",
  fontWeight: 600,
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
  height: 30,
  padding: "0 12px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: 0.4,
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

const STATUS_STEPS = [
  { value: "PLANNED", label: "Direncanakan", icon: FiClock },
  { value: "DISPATCHED", label: "Berangkat", icon: FiTruck },
  { value: "ARRIVED", label: "Tiba", icon: FiMapPin },
  { value: "COMPLETED", label: "Selesai", icon: FiFlag },
];

const DELIVERY_PHASES = [
  { value: "TO_PICKUP", label: "Menuju lokasi muat" },
  { value: "AT_PICKUP", label: "Tiba & proses muat" },
  { value: "TO_DESTINATION", label: "Mengantar muatan" },
  { value: "AT_DESTINATION", label: "Tiba di tujuan" },
  { value: "COMPLETED", label: "Selesai" },
];
const DELIVERY_PHASE_LABELS = Object.fromEntries(DELIVERY_PHASES.map((phase) => [phase.value, phase.label]));
DELIVERY_PHASE_LABELS.SERVICE_AT_BASE = "Servis darurat di base";

function InfoRow({ label, value, icon: Icon }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "28px minmax(105px, .7fr) 1.4fr", gap: 8, alignItems: "center", minHeight: 38, borderBottom: "1px solid #F0F3F1" }}>
      <span style={{ color: "#88A095", display: "inline-flex" }}>{Icon ? <Icon size={15} /> : null}</span>
      <span style={{ color: "#718078", fontSize: 13 }}>{label}</span>
      <span style={{ color: "#213A2F", fontSize: 13, fontWeight: 500 }}>{value || "—"}</span>
    </div>
  );
}

function StatusStep({ step, index, currentIndex, currentStatus, enabled, saving, onClick }) {
  const Icon = step.icon;
  const done = currentStatus !== "CANCELLED" && index < currentIndex;
  const active = currentStatus !== "CANCELLED" && index === currentIndex;
  const actionable = enabled && !active && !saving;
  const color = done || active ? "#0D7C3D" : "#8C9A93";
  const background = active ? "#EAF6EF" : done ? "#F5FBF7" : "#FFFFFF";

  return (
    <button
      className={`trip-detail-step ${done ? "done" : ""} ${active ? "active" : ""}`}
      type="button"
      disabled={!actionable}
      onClick={() => onClick(step.value)}
      style={{
        position: "relative",
        zIndex: 1,
        flex: "1 1 150px",
        minWidth: 135,
        border: `1px solid ${active ? "#8AC6A3" : "#DCE5E0"}`,
        borderRadius: 12,
        background,
        padding: "13px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        textAlign: "left",
        color,
        cursor: actionable ? "pointer" : "default",
        opacity: saving && !active ? 0.62 : 1,
        transition: "transform .16s ease, box-shadow .16s ease, border-color .16s ease",
      }}
      onMouseEnter={(e) => {
        if (!actionable) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 20px rgba(13,124,61,.12)";
        e.currentTarget.style.borderColor = "#78BA94";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = active ? "#8AC6A3" : "#DCE5E0";
      }}
    >
      <span style={{ width: 32, height: 32, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", background: done || active ? "#DCEFE4" : "#F2F5F3" }}>
        {done ? <FiCheck size={16} /> : <Icon size={16} />}
      </span>
      <span>
        <span style={{ display: "block", fontSize: 11, color: "#849189", marginBottom: 2 }}>Tahap {index + 1}</span>
        <span style={{ display: "block", fontSize: 13, fontWeight: active ? 650 : 550 }}>{saving && enabled ? "Memproses…" : step.label}</span>
      </span>
    </button>
  );
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
  const [uploadingArrivalProofs, setUploadingArrivalProofs] = useState(false);
  const [arrivalProofErr, setArrivalProofErr] = useState("");
  const [arrivalEntry, setArrivalEntry] = useState(null);

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const data = await api(`/trips/${id}`);
      setTrip(data);
    } catch (e) {
      setErr(e?.message || "Gagal memuat trip");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useLiveRefresh(load);

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

  const allowedNextStatuses = useMemo(() => {
    const cur = String(trip?.status || "PLANNED").toUpperCase();
    if (canWrite) return ["PLANNED", "DISPATCHED", "ARRIVED", "COMPLETED", "CANCELLED"];
    if (isDriver) {
      const next = { PLANNED: "DISPATCHED", DISPATCHED: "ARRIVED", ARRIVED: "COMPLETED" }[cur];
      return next ? [next] : [];
    }
    return [];
  }, [trip?.status, canWrite, isDriver]);

  const currentStatus = String(trip?.status || "PLANNED").toUpperCase();
  const currentPhase = String(trip?.phase || "PLANNED").toUpperCase();
  const currentPhaseIndex = currentPhase === "SERVICE_AT_BASE" ? 2 : DELIVERY_PHASES.findIndex((phase) => phase.value === currentPhase);
  const currentStepIndex = Math.max(0, STATUS_STEPS.findIndex((step) => step.value === currentStatus));
  const plannedWeight = trip?.qtyPlanned == null ? null : Number(trip.qtyPlanned);
  const arrivalWeight = trip?.qtyActual == null ? null : Number(trip.qtyActual);
  const cargoDifference = plannedWeight == null || arrivalWeight == null ? null : Math.max(0, plannedWeight - arrivalWeight);
  const weightUnit = trip?.unitSnap || order?.unit || "TON";

  async function updateStatus(next, qtyActual = null) {
    try {
      setSaveErr("");
      setSaving(true);
      await api(`/trips/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next, ...(qtyActual !== null ? { qtyActual } : {}) }),
      });
      await load();
      return true;
    } catch (e) {
      setSaveErr(e?.message || "Gagal memperbarui status");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function setStatus(next) {
    const needsWeight = trip?.purpose === "DELIVERY" && (next === "ARRIVED" || (next === "COMPLETED" && trip.qtyActual == null));
    if (needsWeight) {
      setSaveErr("");
      setArrivalEntry({ nextStatus: next, qtyActual: trip.qtyActual == null ? "" : String(trip.qtyActual) });
      return;
    }
    updateStatus(next);
  }

  async function saveArrivalWeight(event) {
    event.preventDefault();
    const qtyActual = Number(arrivalEntry?.qtyActual);
    if (!Number.isFinite(qtyActual) || qtyActual <= 0) return setSaveErr("Berat tiba harus lebih dari nol");
    const saved = await updateStatus(arrivalEntry.nextStatus, qtyActual);
    if (saved) setArrivalEntry(null);
  }

  if (loading && !trip) {
    return (
      <div style={pageBg}>
        <div style={container}>
          <div style={panel}>Memuat...</div>
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
    <div className="trip-detail-v3" style={pageBg}>
      <div className="trip-detail-v3-container" style={container}>
        <div className="trip-detail-v3-shell" style={panel}>
          {/* Header */}
          <div className="trip-detail-v3-head" style={headerRow}>
            <div style={{ minWidth: 0 }}>
              <div className="trip-detail-v3-eyebrow" style={{ color: "#0D7C3D", fontSize: 12, fontWeight: 650, letterSpacing: 1, marginBottom: 7 }}>TRIP CONTROL</div>
              <h1 style={title}>{headline}</h1>

              <div className="trip-detail-v3-subtitle" style={subTitle}>
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
                  trip.purpose === "EMPTY_RETURN" ? "Perjalanan operasional · tanpa muatan" : "-"
                )}{" "}
                • {routeText} • Planned: {fmtDateTime(trip.plannedDepartAt)}
              </div>

              <div className="trip-detail-v3-badges" style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={tripBadgeStyle(trip.status)}>{String(trip.status).replaceAll("_", " ")}</span>
                {trip.purpose === "EMPTY_RETURN" && <span style={{ ...badgeBase, background: "#FFF7ED", color: "#C2410C" }}>KEMBALI KOSONG · PENDAPATAN RP0</span>}
                <span style={{ ...badgeBase, background: "#FFFFFF" }}>{role}</span>

                {trip.qtyPlanned != null ? (
                  <span style={{ ...badgeBase, background: "#FFFFFF" }}>
                    Qty: {trip.qtyPlanned} {trip.unitSnap || order?.unit || ""}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="trip-detail-v3-nav" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="trip-detail-v3-back" style={{ ...btnGhost, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={() => nav(-1)}>
                <FiArrowLeft size={15} /> Kembali
              </button>
            </div>
          </div>

          <div className="trip-detail-v3-divider" style={divider} />

          {saveErr ? (
            <div style={{ marginTop: 14, padding: "11px 13px", borderRadius: 9, background: "#FFF1F2", color: "#B42318", fontWeight: 500, fontSize: 13 }}>{saveErr}</div>
          ) : null}

          {(canWrite || isDriver) && currentStatus !== "CANCELLED" ? (
            <section className="trip-detail-v3-progress" style={{ marginTop: 20, padding: 18, background: "#F8FBF9", border: "1px solid #E2EAE5", borderRadius: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 13, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 650, color: "#243A30" }}>Progress perjalanan</div>
                  <div style={{ fontSize: 12, color: "#7A8780", marginTop: 3 }}>Keberangkatan dan kedatangan diperbarui otomatis dari GPS. Penyelesaian trip tetap dikonfirmasi manual.</div>
                </div>
                {canWrite ? (
                  <button
                    style={{ ...btnDanger, height: 36, display: "inline-flex", alignItems: "center", gap: 7, boxShadow: "none", fontSize: 12 }}
                    onClick={() => window.confirm("Batalkan trip ini?") && setStatus("CANCELLED")}
                    disabled={saving}
                  >
                    <FiX size={14} /> Batalkan trip
                  </button>
                ) : null}
              </div>
              {trip.purpose === "DELIVERY" && (
                <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, border: "1px solid #DDE9E1", background: "#FFFFFF" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                    <div><strong style={{ display: "block", fontSize: 13 }}>Tahap perjalanan</strong><span style={{ color: "#7A8780", fontSize: 11 }}>Satu trip · perjalanan kosong dan pengiriman tercatat dalam satu rangkaian.</span></div>
                    {currentPhase === "AT_PICKUP" && <span style={{ padding: "8px 11px", borderRadius: 8, background: "#EAF7EF", color: "#176C40", fontSize: 11, fontWeight: 700 }}>Menunggu GPS keluar radius lokasi muat</span>}
                  </div>
                  {currentPhase === "SERVICE_AT_BASE" && <div style={{ marginBottom: 12, padding: "11px 12px", borderRadius: 9, background: "#FFF4E8", border: "1px solid #F2D6B5", color: "#9A541B", fontSize: 12 }}><strong>Pengiriman berhenti sementara untuk servis di base.</strong><span style={{ display: "block", marginTop: 3 }}>Trip, muatan, uang jalan, dan tujuan tetap sama. GPS akan otomatis melanjutkan pengiriman ketika mobil keluar dari radius base.</span></div>}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(105px, 1fr))", gap: 7, overflowX: "auto", paddingBottom: 2 }}>
                    {DELIVERY_PHASES.map((phase, index) => {
                      const done = currentPhase === "COMPLETED" || (currentPhaseIndex >= 0 && index < currentPhaseIndex);
                      const active = phase.value === currentPhase;
                      return <div key={phase.value} style={{ minWidth: 105, padding: "10px 9px", borderRadius: 9, border: `1px solid ${active ? "#55A778" : done ? "#CDE5D6" : "#E4EBE6"}`, background: active ? "#EAF7EF" : done ? "#F4FAF6" : "#FAFCFB", color: active || done ? "#176C40" : "#8A958F" }}><span style={{ display: "grid", placeItems: "center", width: 20, height: 20, marginBottom: 6, borderRadius: 999, background: active || done ? "#1B8B50" : "#DCE5DF", color: "white", fontSize: 10, fontWeight: 800 }}>{done ? "✓" : index + 1}</span><strong style={{ fontSize: 10, lineHeight: 1.25, display: "block" }}>{phase.label}</strong></div>;
                    })}
                  </div>
                  {currentPhase === "TO_PICKUP" && <div style={{ marginTop: 10, color: "#6E7D74", fontSize: 11 }}>GPS akan otomatis menandai tiba ketika mobil masuk radius {trip.fromText || "lokasi muat"}.</div>}
                  {currentPhase === "AT_PICKUP" && <div style={{ marginTop: 10, color: "#6E7D74", fontSize: 11 }}>Setelah proses muat, sistem otomatis memulai pengiriman ketika mobil bergerak keluar dari radius lokasi muat.</div>}
                  {currentPhase === "TO_DESTINATION" && <div style={{ marginTop: 10, color: "#6E7D74", fontSize: 11 }}>Muatan sedang dikirim. GPS akan otomatis menandai tiba di {trip.toText || "tujuan"}.</div>}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {STATUS_STEPS.map((step, index) => (
                  <StatusStep
                    key={step.value}
                    step={step}
                    index={index}
                    currentIndex={currentStepIndex}
                    currentStatus={currentStatus}
                    enabled={step.value === "COMPLETED" && currentStatus === "ARRIVED" && allowedNextStatuses.includes(step.value)}
                    saving={saving}
                    onClick={setStatus}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* Content grid */}
          <div className="trip-detail-v3-grid" style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 14 }}>
            {/* Trip info */}
            <div className="trip-detail-v3-card" style={{ ...panel, boxShadow: "none", borderRadius: 13, padding: 20 }}>
              <div style={{ fontWeight: 650, marginBottom: 10, fontSize: 16 }}>Informasi Perjalanan</div>
              <InfoRow label="Status" icon={FiFlag} value={<span style={tripBadgeStyle(trip.status)}>{String(trip.status).replaceAll("_", " ")}</span>} />
              {trip.purpose === "DELIVERY" && <InfoRow label="Tahap aktif" icon={FiActivity} value={DELIVERY_PHASE_LABELS[currentPhase] || "Direncanakan"} />}
              <InfoRow label="Muatan rencana" icon={FiPackage} value={plannedWeight == null ? "Belum diisi" : `${plannedWeight.toLocaleString("id-ID", { maximumFractionDigits: 3 })} ${weightUnit}`} />
              <InfoRow label="Berat tiba" icon={FiPackage} value={arrivalWeight == null ? "Belum dicatat" : `${arrivalWeight.toLocaleString("id-ID", { maximumFractionDigits: 3 })} ${weightUnit}`} />
              <InfoRow label="Selisih muatan" icon={FiActivity} value={cargoDifference == null ? "Menunggu berat tiba" : <span style={{ color: cargoDifference > 0 ? "#B45309" : "#0D7C3D", fontWeight: 700 }}>{cargoDifference.toLocaleString("id-ID", { maximumFractionDigits: 3 })} {weightUnit}{cargoDifference > 0 ? " · kehilangan tercatat" : " · sesuai"}</span>} />
              <InfoRow label="Direncanakan" icon={FiClock} value={fmtDateTime(trip.plannedDepartAt)} />
              <InfoRow label="Berangkat" icon={FiTruck} value={fmtDateTime(trip.dispatchedAt)} />
              {trip.purpose === "DELIVERY" && <InfoRow label="Tiba lokasi muat" icon={FiMapPin} value={fmtDateTime(trip.pickupArrivedAt)} />}
              {trip.purpose === "DELIVERY" && <InfoRow label="Mulai pengiriman" icon={FiTruck} value={fmtDateTime(trip.loadedAt)} />}
              {(trip.serviceStops || []).map((stop, index) => <InfoRow key={stop.id} label={`Servis${(trip.serviceStops || []).length > 1 ? ` ${index + 1}` : ""}`} icon={FiActivity} value={`${stop.location?.name || "Base"} · ${fmtDateTime(stop.startedAt)}${stop.endedAt ? ` — ${fmtDateTime(stop.endedAt)}` : " · masih berlangsung"}`} />)}
              <InfoRow label="Tiba" icon={FiMapPin} value={fmtDateTime(trip.arrivedAt)} />
              <InfoRow label="Selesai" icon={FiCheck} value={fmtDateTime(trip.completedAt)} />
              <InfoRow label="Dibuat" icon={FiClock} value={fmtDateTime(trip.createdAt)} />
            </div>

            {/* Truck/Driver/Order */}
            <div className="trip-detail-v3-card" style={{ ...panel, boxShadow: "none", borderRadius: 13, padding: 20 }}>
              <div style={{ fontWeight: 650, marginBottom: 10, fontSize: 16 }}>Penugasan</div>
              <InfoRow label="Kendaraan" icon={FiTruck} value={`${truck?.plateNumber || trip.plateNumberSnap || "-"}${truck?.brand ? ` · ${truck.brand}` : ""}${truck?.model ? ` · ${truck.model}` : ""}`} />
              <InfoRow label="Pengemudi" icon={FiUser} value={driver?.name || trip.driverNameSnap || "-"} />
              <InfoRow label="Order" icon={FiFileText} value={order?.orderNo || "-"} />
              <InfoRow label="Pelanggan" icon={FiUser} value={order?.customer?.name || order?.customerName || "-"} />
              <InfoRow label="Rute" icon={FiMapPin} value={routeText} />
              <InfoRow
                label="Surat jalan"
                icon={FiFileText}
                value={trip.dispatchLetter?.pdfUrl ? (
                  <button type="button" onClick={() => openProtectedFile(trip.dispatchLetter.pdfUrl).catch((e) => setErr(e.message))} style={{ border: 0, padding: 0, background: "transparent", cursor: "pointer", fontWeight: 600, color: "#0D7C3D" }}>{trip.dispatchLetter.number || "Buka PDF"}</button>
                ) : "Belum dibuat"}
              />
            </div>
          </div>

          {/* Trip-specific proof that the goods reached destination. */}
          <div className="trip-detail-v3-proof" style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 650, marginBottom: 4, fontSize: 16 }}>Bukti Timbangan / Barang Tiba</div>
            <div style={{ color: "#718078", fontSize: 13, marginBottom: 12 }}>Unggah surat timbang atau dokumen penerimaan dari lokasi tujuan.</div>

            {(canWrite || isDriver) && ["DISPATCHED", "ARRIVED", "COMPLETED"].includes(currentStatus) ? (
              <label style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 16px", marginBottom: 14, borderRadius: 12, border: `1.5px dashed ${uploadingArrivalProofs ? "#0D7C3D" : "#A9D2BA"}`, background: "linear-gradient(135deg, #F7FBF8 0%, #EEF7F1 100%)", cursor: uploadingArrivalProofs ? "not-allowed" : "pointer" }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", color: "#0D7C3D", background: "#FFFFFF", boxShadow: "0 3px 10px rgba(13,124,61,.10)" }}><FiUploadCloud size={20}/></span>
                <span><strong style={{ display: "block", color: "#173B2D", fontSize: 14 }}>{uploadingArrivalProofs ? "Sedang mengunggah..." : "Tambah bukti timbangan"}</strong><span style={{ color: "#718078", fontSize: 12 }}>Gambar atau PDF · maksimal 15 MB per file</span></span>
                <input type="file" multiple accept="image/*,application/pdf" disabled={uploadingArrivalProofs} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} onChange={async (e) => {
                  try {
                    setArrivalProofErr("");
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    setUploadingArrivalProofs(true);
                    const uploaded = await uploadFiles(files);
                    await api(`/trips/${id}/arrival-proofs`, { method: "POST", body: JSON.stringify({ proofs: uploaded }) });
                    e.target.value = "";
                    await load();
                  } catch (error) {
                    setArrivalProofErr(error?.message || "Gagal mengunggah bukti timbangan");
                  } finally {
                    setUploadingArrivalProofs(false);
                  }
                }}/>
              </label>
            ) : currentStatus === "PLANNED" ? <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 10, background: "#F4F7F5", color: "#718078", fontSize: 12 }}>Upload tersedia setelah kendaraan berangkat.</div> : null}
            {arrivalProofErr ? <div style={{ marginBottom: 12, color: "#DC2626", fontSize: 13, fontWeight: 600 }}>{arrivalProofErr}</div> : null}

            {(trip.arrivalProofs || []).length === 0 ? (
              <div style={{ color: "#7A8780", fontWeight: 400, fontSize: 13, padding: "12px 0" }}>Belum ada bukti barang tiba yang diunggah.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {(trip.arrivalProofs || []).map((p) => {
                  const isPdf =
                    String(p.mimeType || "").toLowerCase().includes("pdf") ||
                    String(p.url || "").toLowerCase().includes(".pdf");

                  return (
                    <div
                      key={p.id}
                      style={{
                        width: 190,
                        maxWidth: "100%",
                        boxSizing: "border-box",
                        overflow: "hidden",
                        borderRadius: 12,
                        border: "1px solid rgba(15, 60, 45, 0.12)",
                        background: "linear-gradient(180deg, #FFFFFF 0%, #FBFFFD 100%)",
                        boxShadow: "0 12px 26px rgba(10, 40, 30, 0.06)",
                        padding: 10,
                      }}
                    >
                      {isPdf ? (
                        <div style={{ height: 112, display: "grid", placeItems: "center", borderRadius: 9, background: "#F1F7F3" }}>
                          <button type="button" onClick={() => openProtectedFile(p.url).catch((e) => setErr(e.message))} style={{ border: 0, background: "transparent", cursor: "pointer", fontWeight: 600, color: "#0B2A1F" }}>Buka PDF</button>
                        </div>
                      ) : (
                        <ProtectedImage url={p.url} alt={p.fileName || "Bukti timbangan"} style={{ display: "block", width: "100%", height: 112, objectFit: "cover", borderRadius: 9 }} />
                      )}

                      <div title={p.fileName || "Bukti timbangan"} style={{ marginTop: 8, fontWeight: 700, fontSize: 12, color: "#2F6B55", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.fileName || "Bukti timbangan"}</div>
                      <div style={{ marginTop: 3, fontSize: 11, color: "#718078" }}>{fmtDateTime(p.createdAt)}</div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
          {arrivalEntry && (
            <div onMouseDown={(event) => event.target === event.currentTarget && !saving && setArrivalEntry(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 18, background: "rgba(10,30,20,.58)" }}>
              <form onSubmit={saveArrivalWeight} style={{ width: "min(460px, 100%)", boxSizing: "border-box", padding: 24, borderRadius: 16, background: "#FFFFFF", boxShadow: "0 25px 70px rgba(0,0,0,.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                  <div><div style={{ color: "#0D7C3D", fontSize: 11, fontWeight: 800, letterSpacing: 1.2 }}>BARANG TIBA</div><h2 style={{ margin: "5px 0", fontSize: 22 }}>Masukkan Berat Tiba</h2><p style={{ margin: 0, color: "#718078", fontSize: 13 }}>{truck?.plateNumber || trip.plateNumberSnap} · Muatan rencana {trip.qtyPlanned ?? "—"} {trip.unitSnap || order?.unit || ""}</p></div>
                  <button type="button" onClick={() => setArrivalEntry(null)} disabled={saving} style={{ ...btnGhost, width: 36, height: 36, padding: 0 }}><FiX/></button>
                </div>
                <label style={{ display: "grid", gap: 7, marginTop: 22, color: "#405148", fontSize: 13, fontWeight: 650 }}>Berat aktual di tujuan
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid #CEDBD3", borderRadius: 9, overflow: "hidden" }}><input autoFocus required type="number" min="0.001" step="0.001" value={arrivalEntry.qtyActual} onChange={(event) => setArrivalEntry((value) => ({ ...value, qtyActual: event.target.value }))} placeholder="Contoh: 29.5" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, padding: "12px 13px", font: "inherit" }}/><span style={{ padding: "12px 13px", background: "#F4F8F5", color: "#647269" }}>{trip.unitSnap || order?.unit || "TON"}</span></div>
                </label>
                {arrivalEntry.qtyActual && trip.qtyPlanned != null && Number(arrivalEntry.qtyActual) < Number(trip.qtyPlanned) && <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "#FFF7E6", color: "#9A5B00", fontSize: 13 }}><strong>Selisih muatan: {(Number(trip.qtyPlanned) - Number(arrivalEntry.qtyActual)).toLocaleString("id-ID", { maximumFractionDigits: 3 })} {trip.unitSnap || order?.unit || ""}</strong><span style={{ display: "block", marginTop: 4 }}>Dicatat sebagai kehilangan pada tagihan/laporan. Order tetap dipenuhi berdasarkan muatan rencana.</span></div>}
                {saveErr && <div style={{ marginTop: 12, color: "#B42318", fontSize: 13 }}>{saveErr}</div>}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}><button type="button" style={btnGhost} disabled={saving} onClick={() => setArrivalEntry(null)}>Batal</button><button disabled={saving} style={{ ...btnGhost, border: 0, borderRadius: 9, background: "#0D7C3D", color: "white" }}>{saving ? "Menyimpan…" : arrivalEntry.nextStatus === "COMPLETED" ? "Simpan & Selesaikan" : "Simpan & Tandai Tiba"}</button></div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
