// src/pages/TripDetail.jsx
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { api, uploadFiles } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import { openProtectedFile, ProtectedImage } from "../components/ProtectedFile";
import LoadingState from "../components/LoadingState";
import {
  FiActivity,
  FiArrowLeft,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiFlag,
  FiMapPin,
  FiPackage,
  FiPlus,
  FiTruck,
  FiUploadCloud,
  FiUser,
  FiX,
} from "react-icons/fi";
import "./TripDetailRedesign.css";
import "./TripProofFix.css";
import { confirmDialog } from "../ui/dialogService";

//////////////////////
// THEME (match Orders / Maintenance)
//////////////////////
const pageBg = {
  color: "var(--ms-fg)",
};

const container = { width: "100%", margin: 0 };

const panel = {
  background: "transparent",
  borderRadius: 0,
  padding: 0,
  border: 0,
  boxShadow: "none",
};

const headerRow = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const title = {
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: "-0.015em",
  margin: 0,
  lineHeight: 1.3,
};

const subTitle = {
  marginTop: 4,
  fontWeight: 400,
  color: "var(--ms-muted-fg)",
  fontSize: 14,
};

const btnGhost = {
  height: 36,
  padding: "0 14px",
  borderRadius: 6,
  border: "1px solid var(--ms-input)",
  background: "var(--ms-surface)",
  color: "var(--ms-fg)",
  fontWeight: 500,
  cursor: "pointer",
  boxShadow: "var(--ms-shadow-xs)",
};

const btnDanger = {
  ...btnGhost,
  border: "1px solid var(--ms-danger-border)",
  color: "var(--ms-danger-fg)",
};

const divider = {
  height: 1,
  background: "rgba(29,42,71,0.10)",
  marginTop: 14,
};

function materialWeightKg(invoices) {
  const lines = (invoices || []).flatMap((invoice) => invoice.lines || []);
  if (!lines.length) return null;
  let total = 0;
  for (const line of lines) {
    if (line.totalKg != null && Number(line.totalKg) > 0) total += Number(line.totalKg);
    else if (String(line.unit || "").toUpperCase() === "KG" && Number(line.qty) > 0) total += Number(line.qty);
    else if (String(line.unit || "").toUpperCase() === "TON" && Number(line.qty) > 0) total += Number(line.qty) * 1000;
    else return null;
  }
  return total > 0 ? total : null;
}

const badgeBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 22,
  padding: "0 7px",
  borderRadius: 6,
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: 0,
  border: "1px solid transparent",
  background: "var(--ms-muted)",
  color: "var(--ms-fg-2)",
  width: "fit-content",
};

function tripBadgeStyle(status) {
  const s = String(status || "").toUpperCase();
  if (s === "COMPLETED") return { ...badgeBase, background: "var(--ms-success-bg)", color: "var(--ms-success-fg)" };
  if (s === "ARRIVED") return { ...badgeBase, background: "var(--ms-warning-bg)", color: "var(--ms-warning-fg)" };
  if (s === "DISPATCHED") return { ...badgeBase, background: "var(--ms-info-bg)", color: "var(--ms-info-fg)" };
  if (s === "CANCELLED") return { ...badgeBase, background: "var(--ms-muted)", color: "var(--ms-muted-fg)" };
  return { ...badgeBase, background: "var(--ms-neutral-bg)", color: "var(--ms-neutral-fg)" };
}

const STATUS_STEPS = [
  { value: "PLANNED", label: "Direncanakan", icon: FiClock },
  { value: "DISPATCHED", label: "Berangkat", icon: FiTruck },
  { value: "ARRIVED", label: "Tunggu bukti timbangan", icon: FiMapPin },
  { value: "COMPLETED", label: "Selesai", icon: FiFlag },
];

const DELIVERY_PHASES = [
  { value: "TO_PICKUP", label: "Menuju lokasi muat" },
  { value: "AT_PICKUP", label: "Tiba & proses muat" },
  { value: "TO_DESTINATION", label: "Mengantar muatan" },
  { value: "AT_DESTINATION", label: "Tunggu bukti timbangan" },
  { value: "COMPLETED", label: "Selesai" },
];
const DELIVERY_PHASE_LABELS = Object.fromEntries(DELIVERY_PHASES.map((phase) => [phase.value, phase.label]));
DELIVERY_PHASE_LABELS.SERVICE_AT_BASE = "Kembali ke base — perlu tindakan";
const EXPENSE_CATEGORIES = [
  ["PANJAR", "Panjar"],
  ["TRIP_ALLOWANCE", "Uang jalan"],
  ["REMAINING_TRIP_ALLOWANCE", "Sisa uang jalan"],
  ["UNLOADING_FEE", "Uang bongkar"],
  ["FUEL_LOAN", "Pinjaman minyak"],
  ["LOADING_LOAN", "Pinjaman muat"],
  ["DRIVER_SALARY", "Gaji / borongan pengemudi"],
  ["FUEL", "BBM"],
  ["TOLL_PARKING", "Tol & parkir"],
  ["LOADING_UNLOADING", "Biaya muat / bongkar"],
  ["REPAIR_MAINTENANCE", "Perbaikan darurat"],
  ["SPAREPART", "Suku cadang"],
  ["OTHER", "Lainnya"],
];
const EXPENSE_LABELS = Object.fromEntries(EXPENSE_CATEGORIES);

function InfoRow({ label, value, icon: Icon }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "28px minmax(105px, .7fr) 1.4fr", gap: 8, alignItems: "center", minHeight: 38, borderBottom: "1px solid #edf1f6" }}>
      <span style={{ color: "#8391a5", display: "inline-flex" }}>{Icon ? <Icon size={15} /> : null}</span>
      <span style={{ color: "#65758c", fontSize: 13 }}>{label}</span>
      <span style={{ color: "#1a2641", fontSize: 13, fontWeight: 500 }}>{value || "—"}</span>
    </div>
  );
}

function StatusStep({ step, index, currentIndex, currentStatus, enabled, saving, onClick }) {
  const Icon = step.icon;
  const done = currentStatus !== "CANCELLED" && index < currentIndex;
  const active = currentStatus !== "CANCELLED" && index === currentIndex;
  const actionable = enabled && !active && !saving;
  const color = done || active ? "#0d7c48" : "#8290a4";
  const background = active ? "#ebeff5" : done ? "#f6f8fa" : "#FFFFFF";

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
        border: `1px solid ${active ? "#85cbaa" : "#d8dfe9"}`,
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
        e.currentTarget.style.boxShadow = "0 8px 20px rgba(16,121,72,.12)";
        e.currentTarget.style.borderColor = "#70c29c";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = active ? "#85cbaa" : "#d8dfe9";
      }}
    >
      <span style={{ width: 32, height: 32, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", background: done || active ? "#d7f4e6" : "#f0f3f7" }}>
        {done ? <FiCheck size={16} /> : <Icon size={16} />}
      </span>
      <span>
        <span style={{ display: "block", fontSize: 11, color: "#78879d", marginBottom: 2 }}>Tahap {index + 1}</span>
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

function elapsedTime(from, to) {
  if (!from || !to) return null;
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return [
    days ? `${days} hari` : "",
    hours ? `${hours} jam` : "",
    `${minutes} menit`,
  ].filter(Boolean).join(" ");
}

function money(value) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function TripDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const role = user?.role || "UNKNOWN";

  const canWrite = ["OWNER", "ADMIN", "STAFF"].includes(role);
  const isDriver = role === "DRIVER";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [trip, setTrip] = useState(null);
  const [allocationBusy, setAllocationBusy] = useState(false);
  const [singleLoadForm, setSingleLoadForm] = useState({ sackCount: "", kgPerSack: "50" });
  const [operationalLocations, setOperationalLocations] = useState([]);
  const [singleMaterialOpen, setSingleMaterialOpen] = useState(false);
  const [singleMaterialBusy, setSingleMaterialBusy] = useState(false);
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const [materialCustomers, setMaterialCustomers] = useState([]);
  const [materialAvailable, setMaterialAvailable] = useState([]);
  const [singleMaterialForm, setSingleMaterialForm] = useState({ customerId: "", selected: {}, destinationLocationId: "", stopSequence: 1, notes: "" });

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [uploadingArrivalProofs, setUploadingArrivalProofs] = useState(false);
  const [arrivalProofErr, setArrivalProofErr] = useState("");
  const [arrivalEntry, setArrivalEntry] = useState(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [expenseErr, setExpenseErr] = useState("");
  const [expenseForm, setExpenseForm] = useState({ expenseDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), category: "TRIP_ALLOWANCE", reason: "", amount: "", paymentMethod: "BANK_TRANSFER", bankName: "", accountName: "", accountNumber: "", notes: "" });

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const [data, locationData, customerData] = await Promise.all([
        api(`/trips/${id}`),
        api("/operational-locations").catch(() => ({ items: [] })),
        canWrite ? api("/customers").catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
      ]);
      setTrip(data);
      if (data.purpose === "SINGLE_TRIP") setSingleLoadForm({ sackCount: data.sackCount == null ? "" : String(data.sackCount), kgPerSack: data.kgPerSack == null ? "50" : String(data.kgPerSack) });
      setOperationalLocations((locationData?.items || []).filter((location) => location.isActive));
      setMaterialCustomers(customerData?.items || []);
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

  async function generateDispatchLetter() {
    setDispatchBusy(true);
    setErr("");
    try {
      await api(`/dispatch/trips/${id}`, {
        method: "POST",
        body: JSON.stringify({
          city: "Medan",
          companyName: "CV. MITRA SETIA",
          companyAddress: "JLN. CEMARA NO. 40 TELP. (061) 6642646. FAX. (061) 6642647\nDs. Sampali Kec. Percut Sei Tuan Kab. Deli Serdang",
          companyPhone: "Telp. (061) 6642646",
        }),
      });
      await load();
    } catch (e) {
      setErr(e?.message || "Gagal membuat surat jalan");
    } finally {
      setDispatchBusy(false);
    }
  }

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
  const activeOrderStop = (trip?.orderAllocations || []).find((allocation) => !allocation.destinationCompletedAt);
  const activeMaterialStop = (trip?.materialInvoices || []).find((invoice) => invoice.destinationLocationId && !invoice.destinationCompletedAt);
  const activeDestinationArrived = Boolean(activeOrderStop?.destinationArrivedAt || activeMaterialStop?.destinationArrivedAt);
  const canMarkDestinationArrival = currentStatus === "DISPATCHED" && !activeDestinationArrived;
  const plannedWeight = trip?.purpose === "SINGLE_TRIP" && trip?.cargoCategorySnap === "MATERIAL" ? null : trip?.qtyPlanned == null ? null : Number(trip.qtyPlanned);
  const materialKg = (trip?.cargoCategorySnap === "MATERIAL" || order?.cargoCategory === "MATERIAL") ? materialWeightKg(trip?.materialInvoices) : null;
  const materialWeight = materialKg == null ? null : String(trip?.unitSnap || "TON").toUpperCase() === "KG" ? materialKg : materialKg / 1000;
  const arrivalWeight = materialWeight ?? (trip?.qtyActual == null ? null : Number(trip.qtyActual));
  const cargoDifference = plannedWeight == null || arrivalWeight == null ? null : Math.max(0, plannedWeight - arrivalWeight);
  const weightUnit = trip?.unitSnap || order?.unit || "TON";
  const loadingProofs = (trip?.arrivalProofs || []).filter((proof) => proof.proofType === "LOADING");
  const arrivalProofs = (trip?.arrivalProofs || []).filter((proof) => proof.proofType !== "LOADING");

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

  async function startDeliveryManually() {
    if (!(await confirmDialog({ title: "Ubah tahap perjalanan", message: "Langsung ubah tahap menjadi Mengantar muatan? Gunakan hanya jika mobil sudah selesai muat dan sedang berjalan ke tujuan.", confirmLabel: "Ya, mengantar muatan" }))) return;
    try {
      setSaveErr("");
      setSaving(true);
      await api(`/trips/${id}/start-delivery`, {
        method: "POST",
        body: JSON.stringify({ ownerOverride: true }),
      });
      await load();
    } catch (e) {
      setSaveErr(e?.message || "Gagal memulai pengiriman secara manual");
    } finally {
      setSaving(false);
    }
  }

  async function arriveAtPickupManually() {
    if (!(await confirmDialog({ title: "Tiba di lokasi muat", message: "Tandai kendaraan sudah tiba dan sedang proses muat?", confirmLabel: "Ya, tandai tiba" }))) return;
    try {
      setSaveErr("");
      setSaving(true);
      await api(`/trips/${id}/arrive-pickup`, { method: "POST", body: JSON.stringify({}) });
      await load();
    } catch (e) {
      setSaveErr(e?.message || "Gagal menandai tiba di lokasi muat");
    } finally {
      setSaving(false);
    }
  }

  async function arriveAtDestinationManually() {
    const skipsEarlierPhase = ["TO_PICKUP", "AT_PICKUP", "SERVICE_AT_BASE"].includes(currentPhase);
    const message = skipsEarlierPhase
      ? "Tahap perjalanan sebelumnya belum diperbarui. Tetap tandai kendaraan sudah tiba di tujuan aktif? Gunakan jika karyawan terlambat memperbarui trip."
      : "Tandai kendaraan sudah tiba di tujuan aktif? Gunakan jika GPS belum mendeteksi kedatangan.";
    if (!(await confirmDialog({ title: "Tiba di tujuan", message }))) return;
    try {
      setSaveErr("");
      setSaving(true);
      await api(`/trips/${id}/arrive-destination`, { method: "POST", body: JSON.stringify({}) });
      await load();
    } catch (e) {
      setSaveErr(e?.message || "Gagal menandai tiba di tujuan");
    } finally {
      setSaving(false);
    }
  }

  function setStatus(next) {
    const hasMaterialWeight = (trip?.cargoCategorySnap === "MATERIAL" || order?.cargoCategory === "MATERIAL") && materialWeightKg(trip?.materialInvoices) != null;
    const needsWeight = trip?.purpose === "DELIVERY" && !hasMaterialWeight && (next === "ARRIVED" || (next === "COMPLETED" && trip.qtyActual == null));
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

  async function saveExpense(event) {
    event.preventDefault();
    setExpenseBusy(true); setExpenseErr("");
    try {
      await api("/expenses", {
        method: "POST",
        body: JSON.stringify({ ...expenseForm, tripId: id, amount: Number(expenseForm.amount), currency: "IDR" }),
      });
      setExpenseForm({ expenseDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), category: "TRIP_ALLOWANCE", reason: "", amount: "", paymentMethod: "BANK_TRANSFER", bankName: "", accountName: "", accountNumber: "", notes: "" });
      setExpenseOpen(false);
      await load();
    } catch (e) {
      setExpenseErr(e?.message || "Gagal menambahkan pengeluaran trip");
    } finally {
      setExpenseBusy(false);
    }
  }

  async function saveSingleLoad(event) {
    event.preventDefault();
    try {
      setAllocationBusy(true); setSaveErr("");
      await api(`/trips/${id}/load`, { method: "PATCH", body: JSON.stringify(singleLoadForm) });
      await load();
    } catch (e) { setSaveErr(e?.message || "Gagal mencatat muatan trip"); }
    finally { setAllocationBusy(false); }
  }

  async function completeMaterialStop(invoiceId) {
    try {
      setSaveErr(""); setSaving(true);
      await api(`/trips/${id}/material-stops/${invoiceId}/complete`, { method: "PATCH" });
      await load();
    } catch (e) { setSaveErr(e?.message || "Gagal menyelesaikan tujuan"); }
    finally { setSaving(false); }
  }

  async function completeOrderStop(allocationId) {
    try {
      setSaveErr(""); setSaving(true);
      await api(`/trips/${id}/order-stops/${allocationId}/complete`, { method: "PATCH" });
      await load();
    } catch (e) { setSaveErr(e.message || "Gagal menyelesaikan bongkar order"); }
    finally { setSaving(false); }
  }

  async function createSingleMaterialInvoice(event) {
    event.preventDefault();
    try {
      setSingleMaterialBusy(true); setSaveErr("");
      const selectedStocks = materialAvailable.filter((item) => singleMaterialForm.selected[item.key]?.checked);
      if (!selectedStocks.length) throw new Error("Pilih minimal satu material");
      const lines = selectedStocks.map((stock) => ({ itemName: stock.itemName, unit: stock.unit, locationId: stock.locationId, qty: Number(singleMaterialForm.selected[stock.key]?.qty) }));
      if (lines.some((line) => !(line.qty > 0))) throw new Error("Jumlah setiap material terpilih wajib diisi");
      await api("/material-stock/allocate", { method: "POST", body: JSON.stringify({
        customerId: singleMaterialForm.customerId,
        tripId: id,
        destinationLocationId: singleMaterialForm.destinationLocationId,
        stopSequence: singleMaterialForm.stopSequence,
        notes: singleMaterialForm.notes,
        lines,
      }) });
      setSingleMaterialForm({ customerId: "", selected: {}, destinationLocationId: "", stopSequence: (trip?.materialInvoices?.length || 0) + 2, notes: "" });
      setMaterialAvailable([]);
      setSingleMaterialOpen(false);
      await load();
    } catch (e) { setSaveErr(e.message || "Gagal membuat Faktur Muatan"); }
    finally { setSingleMaterialBusy(false); }
  }

  async function selectMaterialCustomer(customerId) {
    setSingleMaterialForm((form) => ({ ...form, customerId, selected: {} }));
    setMaterialAvailable([]);
    if (!customerId) return;
    try {
      const result = await api("/material-stock/available/" + customerId);
      setMaterialAvailable(result?.groups || []);
    } catch (e) {
      setSaveErr(e.message || "Gagal memuat material customer");
    }
  }

  function openSingleMaterialInvoice() {
    setSaveErr("");
    setMaterialAvailable([]);
    setSingleMaterialForm({ customerId: "", selected: {}, destinationLocationId: "", stopSequence: (trip?.materialInvoices?.length || 0) + 1, notes: "" });
    setSingleMaterialOpen(true);
  }

  function toggleMaterial(stock, checked) {
    setSingleMaterialForm((form) => ({
      ...form,
      selected: {
        ...form.selected,
        [stock.key]: { checked, qty: checked ? (form.selected[stock.key]?.qty || "") : "" },
      },
    }));
  }

  function updateMaterialQty(stockKey, qty) {
    setSingleMaterialForm((form) => ({
      ...form,
      selected: { ...form.selected, [stockKey]: { checked: true, qty } },
    }));
  }

  async function uploadTripProof(event, proofType) {
    try {
      setArrivalProofErr("");
      const files = Array.from(event.target.files || []);
      if (!files.length) return;
      setUploadingArrivalProofs(true);
      const uploaded = await uploadFiles(files);
      await api(`/trips/${id}/arrival-proofs`, { method: "POST", body: JSON.stringify({ proofs: uploaded, proofType }) });
      event.target.value = "";
      await load();
    } catch (error) {
      setArrivalProofErr(error?.message || "Gagal mengunggah bukti timbangan");
    } finally {
      setUploadingArrivalProofs(false);
    }
  }

  if (loading && !trip) {
    return (
      <div style={pageBg}>
        <div style={container}>
          <LoadingState label="Menyiapkan detail perjalanan" note="Menyinkronkan tahap GPS, muatan, dan dokumen…" rows={5} />
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

  if (!trip) {
    return (
      <div style={pageBg}>
        <div style={container}>
          <LoadingState label="Menyiapkan detail perjalanan" note="Mengambil data trip dan muatan…" rows={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="trip-detail-v3" style={pageBg}>
      <div className="trip-detail-v3-container" style={container}>
        <div className="trip-detail-v3-shell" style={panel}>
          {/* Header */}
          <div className="trip-detail-v3-head" style={headerRow}>
            <div style={{ minWidth: 0 }}>
              <div className="trip-detail-v3-eyebrow" style={{ color: "var(--ms-muted-fg)", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Trip control</div>
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
                  trip.purpose === "EMPTY_RETURN" ? "Perjalanan operasional · tanpa muatan" : trip.purpose === "SINGLE_TRIP" ? `${trip.tripNo || "Trip tanpa pesanan"} · tanpa pesanan` : "-"
                )}{" "}
                • {routeText} • Planned: {fmtDateTime(trip.plannedDepartAt)}
              </div>

              <div className="trip-detail-v3-badges" style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={tripBadgeStyle(trip.status)}>{String(trip.status).replaceAll("_", " ")}</span>
                {trip.purpose === "EMPTY_RETURN" && <span style={{ ...badgeBase, background: "#FFF7ED", color: "#C2410C" }}>Kembali kosong · pendapatan RP0</span>}
                {trip.purpose === "SINGLE_TRIP" && <span style={{ ...badgeBase, background: "#EEF7FF", color: "#1769AA" }}>{trip.tripNo || "TRIP TANPA PESANAN"} · BERAT DI TAGIHAN</span>}
                <span style={{ ...badgeBase, background: "var(--ms-surface)", borderColor: "var(--ms-border)" }}>{role}</span>

                {trip.qtyPlanned != null ? (
                  <span style={{ ...badgeBase, background: "var(--ms-surface)", borderColor: "var(--ms-border)" }}>
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
            <section className="trip-detail-v3-progress" style={{ marginTop: 20, padding: 18, background: "#f8f9fb", border: "1px solid #dfe5ed", borderRadius: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 13, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 650, color: "#1b2743" }}>Progress perjalanan</div>
                  <div style={{ fontSize: 12, color: "#6c7d95", marginTop: 3 }}>Keberangkatan dan kedatangan diperbarui otomatis dari GPS. Penyelesaian trip tetap dikonfirmasi manual.</div>
                </div>
                {canWrite ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      style={{ ...btnDanger, height: 36, display: "inline-flex", alignItems: "center", gap: 7, boxShadow: "none", fontSize: 12 }}
                      onClick={async () => { if (await confirmDialog({ title: "Batalkan trip", message: "Batalkan trip ini?", confirmLabel: "Batalkan trip", cancelLabel: "Kembali", destructive: true })) setStatus("CANCELLED"); }}
                      disabled={saving}
                    >
                      <FiX size={14} /> Batalkan trip
                    </button>
                  </div>
                ) : null}
              </div>
              {trip.purpose !== "EMPTY_RETURN" && (
                <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, border: "1px solid #dbe2eb", background: "#FFFFFF" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                    <div><strong style={{ display: "block", fontSize: 13 }}>Tahap perjalanan</strong><span style={{ color: "#6c7d95", fontSize: 11 }}>Satu trip · perjalanan kosong dan pengiriman tercatat dalam satu rangkaian.</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {currentPhase === "AT_PICKUP" && <span style={{ padding: "8px 11px", borderRadius: 8, background: "#ecf0f5", color: "#107345", fontSize: 11, fontWeight: 700 }}>Menunggu GPS keluar radius lokasi muat</span>}
                      {role === "OWNER" && ((currentStatus === "PLANNED" && currentPhase === "PLANNED") || (currentStatus === "DISPATCHED" && currentPhase === "TO_PICKUP")) && <button type="button" style={{ ...btnGhost, height: 34, display: "inline-flex", alignItems: "center", gap: 7, borderColor: "#b8c0cc", background: "#FFFFFF", color: "#11804c", boxShadow: "none", fontSize: 11 }} onClick={arriveAtPickupManually} disabled={saving}><FiMapPin size={14}/> Tiba & proses muat</button>}
                      {role === "OWNER" && currentStatus === "DISPATCHED" && ["TO_PICKUP", "AT_PICKUP"].includes(currentPhase) && <button type="button" style={{ ...btnGhost, height: 34, display: "inline-flex", alignItems: "center", gap: 7, borderColor: "#44e69a", background: "#ecf0f5", color: "#107345", boxShadow: "none", fontSize: 11 }} onClick={startDeliveryManually} disabled={saving}><FiTruck size={14}/> Langsung mengantar muatan</button>}
                      {(canWrite || isDriver) && canMarkDestinationArrival && <button type="button" style={{ ...btnGhost, height: 34, display: "inline-flex", alignItems: "center", gap: 7, borderColor: "#44e69a", background: "#ecf0f5", color: "#107345", boxShadow: "none", fontSize: 11 }} onClick={arriveAtDestinationManually} disabled={saving}><FiMapPin size={14}/> Tiba di tujuan</button>}
                      {currentStatus === "DISPATCHED" && currentPhase === "TO_DESTINATION" && activeDestinationArrived && <span style={{ padding: "8px 11px", borderRadius: 8, background: "#ecf0f5", color: "#107345", fontSize: 11, fontWeight: 700 }}>Tujuan aktif sudah tiba · menunggu selesai bongkar</span>}
                    </div>
                  </div>
                  {currentPhase === "SERVICE_AT_BASE" && <div style={{ marginBottom: 12, padding: "11px 12px", borderRadius: 9, background: "#FFF4E8", border: "1px solid #F2D6B5", color: "#9A541B", fontSize: 12 }}><strong>Kendaraan kembali ke base dan memerlukan tindakan.</strong><span style={{ display: "block", marginTop: 3 }}>Periksa penyebabnya, misalnya servis darurat, menunggu uang jalan, dokumen, atau instruksi. Trip, muatan, dan tujuan tetap sama; perjalanan otomatis berlanjut ketika kendaraan keluar dari radius base.</span></div>}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(105px, 1fr))", gap: 7, overflowX: "auto", paddingBottom: 2 }}>
                    {DELIVERY_PHASES.map((phase, index) => {
                      const done = currentPhase === "COMPLETED" || (currentPhaseIndex >= 0 && index < currentPhaseIndex);
                      const active = phase.value === currentPhase;
                      return <div key={phase.value} style={{ minWidth: 105, padding: "10px 9px", borderRadius: 9, border: `1px solid ${active ? "#1ede84" : done ? "#c4eeda" : "#e1e7ee"}`, background: active ? "#ecf0f5" : done ? "#f4f7fa" : "#fafbfc", color: active || done ? "#176c44" : "#7e8da1" }}><span style={{ display: "grid", placeItems: "center", width: 20, height: 20, marginBottom: 6, borderRadius: 999, background: active || done ? "#1b8b57" : "#d8dfe9", color: "white", fontSize: 10, fontWeight: 800 }}>{done ? "✓" : index + 1}</span><strong style={{ fontSize: 10, lineHeight: 1.25, display: "block" }}>{phase.label}</strong></div>;
                    })}
                  </div>
                  {currentPhase === "TO_PICKUP" && <div style={{ marginTop: 10, color: "#637288", fontSize: 11 }}>GPS akan otomatis menandai tiba ketika mobil masuk radius {trip.fromText || "lokasi muat"}.</div>}
                  {currentPhase === "AT_PICKUP" && <div style={{ marginTop: 10, color: "#637288", fontSize: 11 }}>Setelah proses muat, sistem otomatis memulai pengiriman ketika mobil bergerak keluar dari radius lokasi muat.</div>}
                  {currentPhase === "TO_DESTINATION" && <div style={{ marginTop: 10, color: "#637288", fontSize: 11 }}>Muatan sedang dikirim. GPS tetap otomatis menandai tiba di {trip.toText || "tujuan"}; tombol manual tersedia jika lokasi belum terdeteksi.</div>}
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
              {trip.purpose !== "EMPTY_RETURN" && <InfoRow label="Tahap aktif" icon={FiActivity} value={DELIVERY_PHASE_LABELS[currentPhase] || "Direncanakan"} />}
              {trip.purpose === "SINGLE_TRIP" ? <><InfoRow label="Customer tagihan" icon={FiUser} value={trip.billingCustomerName || "Belum dicatat"} /><InfoRow label="Jenis muatan" icon={FiPackage} value={{ FERTILIZER: "Pupuk", CANGKANG: "Cangkang", AMBANG: "Ambang / Material", MATERIAL: "Ambang / Material" }[trip.cargoCategorySnap] || trip.cargoCategorySnap || "-"} /><InfoRow label="Nama muatan" icon={FiPackage} value={trip.cargoNameSnap || trip.operationalReason || "-"} /><InfoRow label="Jumlah rencana" icon={FiPackage} value={plannedWeight == null ? "Diisi setelah proses muat" : `${plannedWeight.toLocaleString("id-ID", { maximumFractionDigits: 3 })} ${weightUnit}`} /><InfoRow label="Jumlah aktual" icon={FiCheckCircle} value={trip.qtyActual == null ? "Belum tiba" : `${Number(trip.qtyActual).toLocaleString("id-ID", { maximumFractionDigits: 3 })} ${weightUnit}`} /></> : <>
                <InfoRow label="Muatan rencana" icon={FiPackage} value={plannedWeight == null ? "Belum diisi" : `${plannedWeight.toLocaleString("id-ID", { maximumFractionDigits: 3 })} ${weightUnit}`} />
                <InfoRow label="Berat tiba" icon={FiPackage} value={arrivalWeight == null ? "Belum dicatat" : `${arrivalWeight.toLocaleString("id-ID", { maximumFractionDigits: 3 })} ${weightUnit}`} />
                <InfoRow label="Selisih muatan" icon={FiActivity} value={cargoDifference == null ? "Menunggu berat tiba" : <span style={{ color: cargoDifference > 0 ? "#B45309" : "#107948", fontWeight: 700 }}>{cargoDifference.toLocaleString("id-ID", { maximumFractionDigits: 3 })} {weightUnit}{cargoDifference > 0 ? " · kehilangan tercatat" : " · sesuai"}</span>} />
              </>}
              <InfoRow label="Direncanakan" icon={FiClock} value={fmtDateTime(trip.plannedDepartAt)} />
              <InfoRow label="Berangkat" icon={FiTruck} value={fmtDateTime(trip.dispatchedAt)} />
              {trip.purpose !== "EMPTY_RETURN" && <InfoRow label="Tiba lokasi muat" icon={FiMapPin} value={fmtDateTime(trip.pickupArrivedAt)} />}
              {trip.purpose !== "EMPTY_RETURN" && <InfoRow label="Mulai pengiriman" icon={FiTruck} value={fmtDateTime(trip.loadedAt)} />}
              {(trip.serviceStops || []).map((stop, index) => <InfoRow key={stop.id} label={`Servis${(trip.serviceStops || []).length > 1 ? ` ${index + 1}` : ""}`} icon={FiActivity} value={`${stop.location?.name || "Base"} · ${fmtDateTime(stop.startedAt)}${stop.endedAt ? ` — ${fmtDateTime(stop.endedAt)}` : " · masih berlangsung"}`} />)}
              <InfoRow label="Tiba" icon={FiMapPin} value={fmtDateTime(trip.arrivedAt)} />
              <InfoRow label="Selesai" icon={FiCheck} value={fmtDateTime(trip.completedAt)} />
              {trip.status === "COMPLETED" && <InfoRow label="Total waktu trip" icon={FiClock} value={elapsedTime(trip.dispatchedAt, trip.completedAt) || "Waktu berangkat belum tercatat"} />}
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
                value={<span className="trip-dispatch-actions">{(trip.dispatchDocuments || []).length ? (trip.dispatchDocuments || []).map((document) => <button key={document.id} type="button" className="trip-dispatch-link" onClick={() => openProtectedFile(document.pdfUrl).catch((e) => setErr(e.message))}>{document.number} · {document.recipientName || document.destination || "Muatan"}</button>) : <span>Belum dibuat</span>}{canWrite && trip.purpose === "SINGLE_TRIP" && currentStatus !== "CANCELLED" && <button type="button" className="trip-dispatch-create" disabled={dispatchBusy} onClick={generateDispatchLetter}>{dispatchBusy ? "Membuat…" : (trip.dispatchDocuments || []).length ? "Buat ulang" : "Buat surat jalan"}</button>}</span>}
              />
            </div>
          </div>

          {trip.purpose === "SINGLE_TRIP" && trip.cargoCategorySnap !== "MATERIAL" && canWrite && !["COMPLETED", "CANCELLED"].includes(currentStatus) && <section className="trip-allocation-card">
            <header className="trip-allocation-head"><div><span>Catat muatan</span><h2>Jumlah sak dan berat per sak</h2><p>Total berat trip dihitung otomatis dalam kilogram.</p></div></header>
            <form onSubmit={saveSingleLoad} style={{ display: "flex", alignItems: "end", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
              <label style={{ display: "grid", gap: 5, flex: "1 1 170px", color: "#465974", fontSize: 11, fontWeight: 700 }}>Jumlah sak<input required type="number" min="1" step="1" value={singleLoadForm.sackCount} onChange={(e) => setSingleLoadForm((form) => ({ ...form, sackCount: e.target.value }))} style={{ height: 40, border: "1px solid #d8dfe9", borderRadius: 8, padding: "0 10px" }}/></label>
              <label style={{ display: "grid", gap: 5, flex: "1 1 170px", color: "#465974", fontSize: 11, fontWeight: 700 }}>Berat per sak (kg)<input required type="number" min="0.01" step="any" value={singleLoadForm.kgPerSack} onChange={(e) => setSingleLoadForm((form) => ({ ...form, kgPerSack: e.target.value }))} style={{ height: 40, border: "1px solid #d8dfe9", borderRadius: 8, padding: "0 10px" }}/></label>
              <div style={{ flex: "1 1 190px", padding: "10px 12px", borderRadius: 8, background: "#eef1f6", color: "#107244", fontSize: 12 }}><strong>{(Number(singleLoadForm.sackCount || 0) * Number(singleLoadForm.kgPerSack || 0)).toLocaleString("id-ID")} kg</strong><span style={{ display: "block", marginTop: 2 }}>{(Number(singleLoadForm.sackCount || 0) * Number(singleLoadForm.kgPerSack || 0) / 1000).toLocaleString("id-ID")} ton</span></div>
              <button disabled={allocationBusy} style={{ ...btnGhost, height: 40, background: "#107948", color: "white" }}>{allocationBusy ? "Menyimpan…" : trip.plannedWeightKg ? "Perbarui Muatan" : "Simpan Muatan"}</button>
            </form>
          </section>}

          {trip.purpose === "DELIVERY" && <section className="trip-allocation-card">
            <header className="trip-allocation-head"><div><span>Muatan terbagi</span><h2>Alokasi Order dalam Trip</h2><p>Beberapa customer memakai kendaraan dan GPS yang sama, tetapi tonase, tujuan, dan tagihannya tetap terpisah.</p></div></header>
            <div className="trip-allocation-list">
              {(trip.orderAllocations || []).map((allocation) => <article className={`trip-allocation-row ${allocation.destinationCompletedAt ? "completed" : ""}`} key={allocation.id}>
                <b>{allocation.stopSequence || 1}</b>
                <div><strong>{allocation.order?.orderNo}</strong><span> · DO {allocation.order?.deliveryOrderNo || "-"} · {allocation.order?.customer?.name || allocation.order?.customerName || "Tanpa customer"}</span><small>{allocation.order?.cargoName || "Muatan"} · tujuan {allocation.order?.destinationLocation?.name || allocation.order?.toText || "-"}{allocation.isPrimary ? " · order utama" : " · order tambahan"}</small></div>
                <div className="trip-allocation-value"><strong>{allocation.plannedWeightKg ? `${Number(allocation.plannedWeightKg).toLocaleString("id-ID")} kg` : "Muatan belum dicatat"}</strong>{allocation.sackCount ? <span>{Number(allocation.sackCount).toLocaleString("id-ID")} sak × {Number(allocation.kgPerSack).toLocaleString("id-ID")} kg</span> : null}{allocation.order?.cargoCategory === "MATERIAL" ? <span>Mengikuti Faktur Muatan</span> : allocation.destinationCompletedAt ? <span className="completed">Selesai</span> : allocation.destinationArrivedAt ? <button type="button" disabled={saving} onClick={() => completeOrderStop(allocation.id)}>Selesai bongkar</button> : <span>Menunggu tiba</span>}</div>
              </article>)}
            </div>
          </section>}

          {trip.purpose !== "EMPTY_RETURN" && <section className="trip-material-destinations-panel">
            <header><div><span>Muatan material</span><h2>Tujuan Faktur Muatan</h2><p>Tujuan material dicatat terpisah untuk pengiriman dan penagihan, serta tidak menahan penyelesaian Trip.</p></div>{canWrite && !["COMPLETED", "CANCELLED"].includes(currentStatus) && <button type="button" onClick={openSingleMaterialInvoice}><FiPlus /> Tambah Material</button>}</header>
            <div className="trip-material-destination-list">
              {!(trip.materialInvoices || []).length && <div className="trip-material-destination-empty"><FiPackage/><strong>Belum ada Faktur Muatan</strong><span>Tambahkan customer yang ditagih dan tujuan bongkar.</span></div>}
              {(trip.materialInvoices || []).map((invoice) => {
                const invoiceLines = invoice.lines?.length ? invoice.lines : [{ itemName: invoice.materialName, qty: invoice.qty, unit: invoice.unit }];
                return <article key={invoice.id}><b>{invoice.stopSequence || 1}</b><div><strong>{invoice.destinationLocation?.name || "Tujuan belum tersedia"}</strong><small>{invoice.billingCustomerName || "Customer material"}</small><div className="trip-material-line-summary">{invoiceLines.map((line) => <span key={line.id || `${line.itemName}-${line.unit}`}><em>{line.itemName}</em><b>{Number(line.qty || 0).toLocaleString("id-ID")} {line.unit || ""}</b></span>)}</div></div><div className="trip-material-destination-status">{invoice.destinationCompletedAt ? <strong>Selesai</strong> : invoice.destinationArrivedAt ? <button type="button" disabled={saving} onClick={() => completeMaterialStop(invoice.id)}>Selesai bongkar</button> : <span>Menunggu tiba</span>}</div></article>;
              })}
            </div>
          </section>}

          {singleMaterialOpen && <div className="ms-dialog-overlay trip-material-overlay" onMouseDown={() => setSingleMaterialOpen(false)}><form className="ms-dialog trip-material-modal" onSubmit={createSingleMaterialInvoice} onMouseDown={(e) => e.stopPropagation()}>
            <header><div><span>Faktur muatan · muatan material</span><h2>Pilih material yang akan diangkut</h2><p>Material dapat menjadi muatan utama atau tambahan bersama pupuk/cangkang.</p></div><button type="button" onClick={() => setSingleMaterialOpen(false)}><FiX /></button></header>
            <div className="trip-material-form">
              <label className="wide">Customer pemilik &amp; yang ditagih<select required value={singleMaterialForm.customerId} onChange={(e) => selectMaterialCustomer(e.target.value)}><option value="">Pilih dari Master Customer</option>{materialCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
              <div className="wide trip-material-picker">
                <div className="trip-material-picker-head"><span>Material tersedia</span><small>{materialAvailable.filter((item) => singleMaterialForm.selected[item.key]?.checked).length} dipilih</small></div>
                {!singleMaterialForm.customerId ? <div className="trip-material-picker-empty">Pilih customer terlebih dahulu.</div> : !materialAvailable.length ? <div className="trip-material-picker-empty">Customer ini belum memiliki saldo material.</div> :
                  <div className="trip-material-picker-table">
                    <div className="trip-material-picker-row heading"><span></span><span>Material</span><span>Tersedia</span><span>Jumlah diangkut</span></div>
                    {materialAvailable.map((item) => {
                      const chosen = Boolean(singleMaterialForm.selected[item.key]?.checked);
                      return <label className={"trip-material-picker-row " + (chosen ? "selected" : "")} key={item.key}>
                        <input type="checkbox" checked={chosen} onChange={(e) => toggleMaterial(item, e.target.checked)} />
                        <span><strong>{item.itemName}</strong><small>{item.location?.name || "Tanpa lokasi"}</small></span>
                        <b>{Number(item.availableQty).toLocaleString("id-ID")} {item.unit}</b>
                        <input aria-label={"Jumlah " + item.itemName} disabled={!chosen} required={chosen} type="number" min="0.01" step="any" max={item.availableQty} value={singleMaterialForm.selected[item.key]?.qty || ""} onChange={(e) => updateMaterialQty(item.key, e.target.value)} placeholder="0" />
                      </label>;
                    })}
                  </div>}
              </div>
              <label>Tujuan bongkar<select required value={singleMaterialForm.destinationLocationId} onChange={(e) => setSingleMaterialForm((form) => ({ ...form, destinationLocationId: e.target.value }))}><option value="">Pilih dari Master Lokasi</option>{operationalLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
              <label>Urutan tujuan<input required type="number" min="1" value={singleMaterialForm.stopSequence} onChange={(e) => setSingleMaterialForm((form) => ({ ...form, stopSequence: e.target.value }))} /></label>
              <label className="wide">Catatan <small>Opsional</small><textarea rows="2" value={singleMaterialForm.notes} onChange={(e) => setSingleMaterialForm((form) => ({ ...form, notes: e.target.value }))} /></label>
            </div>
            <footer><button type="button" className="secondary" onClick={() => setSingleMaterialOpen(false)}>Batal</button><button disabled={singleMaterialBusy || !Object.values(singleMaterialForm.selected).some((item) => item.checked)}>{singleMaterialBusy ? "Menyimpan…" : "Masukkan ke Trip"}</button></footer>
          </form></div>}

          <section className="trip-expense-panel">
            <header>
              <div><span>Biaya perjalanan</span><h2>Pengeluaran Trip</h2><p>Semua biaya di bawah ini langsung terhubung dengan trip dan armada.</p></div>
              <div className="trip-expense-head-actions"><strong>{money((trip.expenses || []).reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong>{canWrite && !["COMPLETED", "CANCELLED"].includes(currentStatus) && <button type="button" onClick={() => { setExpenseErr(""); setExpenseOpen(true); }}><FiPlus/> Tambah pengeluaran</button>}</div>
            </header>
            <div className="trip-expense-list">
              {(trip.expenses || []).map((item) => <article key={item.id}>
                <i><FiDollarSign/></i>
                <div><strong>{item.reason}</strong><span>{EXPENSE_LABELS[item.category] || item.category} · {fmtDateTime(item.createdAt)}</span>{item.paymentMethod === "BANK_TRANSFER" && <small>{item.bankName || "Bank belum diisi"} · {item.accountNumber || "No. rekening belum diisi"}{item.accountName ? ` · a.n. ${item.accountName}` : ""}</small>}<small>{item.notes || `Dibuat oleh ${item.createdBy?.name || "Sistem"}`}</small></div>
                <div className="trip-expense-value"><strong>{money(item.amount)}</strong><span className={String(item.status).toLowerCase()}>{item.status === "SUBMITTED" ? "Menunggu persetujuan" : item.status === "APPROVED" ? "Disetujui" : "Dibayar"}</span></div>
              </article>)}
              {!(trip.expenses || []).length && <div className="trip-expense-empty"><FiDollarSign/><strong>Belum ada pengeluaran</strong><span>Panjar, borongan, BBM, dan biaya perjalanan akan tampil di sini.</span></div>}
            </div>
            {["COMPLETED", "CANCELLED"].includes(currentStatus) && <footer>Trip sudah ditutup. Pengeluaran baru tidak dapat ditambahkan.</footer>}
          </section>

          <div className="trip-detail-v3-proof trip-loading-proof" style={{ marginTop: 14 }}>
            <div className="trip-proof-heading"><span>Bukti muatan</span><h2>Bukti Timbangan Muat</h2><p>Unggah foto atau PDF timbangan dari lokasi muat.</p></div>
            {(canWrite || isDriver) && ["DISPATCHED", "ARRIVED", "COMPLETED"].includes(currentStatus) && <label className="trip-proof-upload">
              <span><FiUploadCloud size={20}/></span><span><strong>{uploadingArrivalProofs ? "Sedang mengunggah..." : "Tambah bukti timbangan muat"}</strong><small>Foto atau PDF · maksimal 15 MB per file</small></span>
              <input type="file" multiple accept="image/*,application/pdf" disabled={uploadingArrivalProofs} onChange={(event) => uploadTripProof(event, "LOADING")}/>
            </label>}
            {currentStatus === "PLANNED" && <div className="trip-proof-locked">Upload tersedia setelah kendaraan tiba di lokasi muat.</div>}
            {!loadingProofs.length ? <div className="trip-proof-empty">Belum ada bukti timbangan muat.</div> : <div className="trip-proof-grid">{loadingProofs.map((proof) => {
              const isPdf = String(proof.mimeType || "").toLowerCase().includes("pdf") || String(proof.url || "").toLowerCase().includes(".pdf");
              return <article key={proof.id}>{isPdf ? <button type="button" onClick={() => openProtectedFile(proof.url).catch((error) => setErr(error.message))}><FiFileText/> Buka PDF</button> : <ProtectedImage url={proof.url} alt={proof.fileName || "Bukti timbang muat"} style={{display:"block",width:"100%",height:105,objectFit:"cover",borderRadius:8}}/>}<strong>{proof.fileName || "Bukti timbang muat"}</strong><small>{fmtDateTime(proof.createdAt)}</small></article>;
            })}</div>}
          </div>

          {/* Trip-specific proof that the goods reached destination. */}
          <div className="trip-detail-v3-proof" style={{ marginTop: 14 }}>
            <div className="trip-proof-heading"><span>Bukti kedatangan</span><h2>Bukti Timbangan Sampai</h2><p>Unggah foto atau PDF timbangan dari lokasi tujuan.</p></div>

            {(canWrite || isDriver) && ["DISPATCHED", "ARRIVED", "COMPLETED"].includes(currentStatus) ? (
              <label className="trip-proof-upload" style={{ cursor: uploadingArrivalProofs ? "not-allowed" : "pointer" }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", color: "#107948", background: "#FFFFFF", boxShadow: "0 3px 10px rgba(16,121,72,.10)" }}><FiUploadCloud size={20}/></span>
                <span><strong style={{ display: "block", color: "#18223a", fontSize: 14 }}>{uploadingArrivalProofs ? "Sedang mengunggah..." : "Tambah bukti timbangan"}</strong><span style={{ color: "#65758c", fontSize: 12 }}>Gambar atau PDF · maksimal 15 MB per file</span></span>
                <input type="file" multiple accept="image/*,application/pdf" disabled={uploadingArrivalProofs} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} onChange={async (e) => {
                  try {
                    setArrivalProofErr("");
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    setUploadingArrivalProofs(true);
                    const uploaded = await uploadFiles(files);
                    await api(`/trips/${id}/arrival-proofs`, { method: "POST", body: JSON.stringify({ proofs: uploaded, proofType: "ARRIVAL" }) });
                    e.target.value = "";
                    await load();
                  } catch (error) {
                    setArrivalProofErr(error?.message || "Gagal mengunggah bukti timbangan");
                  } finally {
                    setUploadingArrivalProofs(false);
                  }
                }}/>
              </label>
            ) : currentStatus === "PLANNED" ? <div className="trip-proof-locked">Upload tersedia setelah kendaraan tiba di tujuan.</div> : null}
            {arrivalProofErr ? <div style={{ marginBottom: 12, color: "#DC2626", fontSize: 13, fontWeight: 600 }}>{arrivalProofErr}</div> : null}

            {arrivalProofs.length === 0 ? (
              <div className="trip-proof-empty">Belum ada bukti timbangan sampai.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {arrivalProofs.map((p) => {
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
                        border: "1px solid rgba(22,31,53,0.12)",
                        background: "linear-gradient(180deg, #FFFFFF 0%, #fcfefd 100%)",
                        boxShadow: "0 12px 26px rgba(15,21,36,0.06)",
                        padding: 10,
                      }}
                    >
                      {isPdf ? (
                        <div style={{ height: 112, display: "grid", placeItems: "center", borderRadius: 9, background: "#f0f4f8" }}>
                          <button type="button" onClick={() => openProtectedFile(p.url).catch((e) => setErr(e.message))} style={{ border: 0, background: "transparent", cursor: "pointer", fontWeight: 600, color: "#0f1626" }}>Buka PDF</button>
                        </div>
                      ) : (
                        <ProtectedImage url={p.url} alt={p.fileName || "Bukti timbangan"} style={{ display: "block", width: "100%", height: 112, objectFit: "cover", borderRadius: 9 }} />
                      )}

                      <div title={p.fileName || "Bukti timbangan"} style={{ marginTop: 8, fontWeight: 700, fontSize: 12, color: "#128851", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.fileName || "Bukti timbangan"}</div>
                      <div style={{ marginTop: 3, fontSize: 11, color: "#65758c" }}>{fmtDateTime(p.createdAt)}</div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
          {expenseOpen && (
            <div className="ms-dialog-overlay trip-expense-overlay" onMouseDown={(event) => event.target === event.currentTarget && !expenseBusy && setExpenseOpen(false)}>
              <form className="ms-dialog trip-expense-modal" onSubmit={saveExpense}>
                <header><div><span>Pengeluaran trip</span><h2>Tambah biaya perjalanan</h2><p>{truck?.plateNumber || trip.plateNumberSnap} · {order?.orderNo || "Trip operasional"}</p></div><button type="button" disabled={expenseBusy} onClick={() => setExpenseOpen(false)}><FiX/></button></header>
                <div className="trip-expense-form">
                  <label><span>Tanggal pengeluaran</span><input required type="date" value={expenseForm.expenseDate} onChange={(event) => setExpenseForm((form) => ({ ...form, expenseDate: event.target.value }))}/></label>
                  <label><span>Jenis pengeluaran</span><select value={expenseForm.category} onChange={(event) => setExpenseForm((form) => ({ ...form, category: event.target.value }))}>{EXPENSE_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span>Metode pembayaran</span><select value={expenseForm.paymentMethod} onChange={(event) => setExpenseForm((form) => ({ ...form, paymentMethod: event.target.value, ...(event.target.value === "BANK_TRANSFER" ? {} : { bankName: "", accountName: "", accountNumber: "" }) }))}><option value="BANK_TRANSFER">Transfer bank</option><option value="CASH">Tunai</option><option value="OTHER">Lainnya</option></select></label>
                  {expenseForm.paymentMethod === "BANK_TRANSFER" && <><label><span>Nama bank</span><input required value={expenseForm.bankName} onChange={(event) => setExpenseForm((form) => ({ ...form, bankName: event.target.value }))} placeholder="Contoh: BCA"/></label><label><span>Nama pemilik rekening</span><input required value={expenseForm.accountName} onChange={(event) => setExpenseForm((form) => ({ ...form, accountName: event.target.value }))} placeholder="Nama sesuai rekening"/></label><label className="wide"><span>Nomor rekening</span><input required inputMode="numeric" value={expenseForm.accountNumber} onChange={(event) => setExpenseForm((form) => ({ ...form, accountNumber: event.target.value }))} placeholder="Masukkan nomor rekening"/></label></>}
                  <label className="wide"><span>Pengeluaran untuk apa</span><input required value={expenseForm.reason} onChange={(event) => setExpenseForm((form) => ({ ...form, reason: event.target.value }))} placeholder="Contoh: Panjar borongan pengiriman ke Palmaris"/></label>
                  <label className="wide"><span>Nominal</span><div className="trip-expense-money"><b>Rp</b><input required min="1" type="number" value={expenseForm.amount} onChange={(event) => setExpenseForm((form) => ({ ...form, amount: event.target.value }))} placeholder="0"/></div></label>
                  <label className="wide"><span>Catatan <small>opsional</small></span><textarea rows="3" value={expenseForm.notes} onChange={(event) => setExpenseForm((form) => ({ ...form, notes: event.target.value }))} placeholder="Keterangan tambahan atau penerima dana…"/></label>
                  {expenseErr && <div className="trip-expense-error wide">{expenseErr}</div>}
                </div>
                <footer><button type="button" className="secondary" disabled={expenseBusy} onClick={() => setExpenseOpen(false)}>Batal</button><button disabled={expenseBusy}>{expenseBusy ? "Menyimpan…" : "Simpan pengeluaran"}</button></footer>
              </form>
            </div>
          )}
          {arrivalEntry && createPortal(
            <div className="ms-dialog-overlay trip-arrival-overlay" onMouseDown={(event) => event.target === event.currentTarget && !saving && setArrivalEntry(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 18, background: "rgba(15,21,36,.58)" }}>
              <form className="ms-dialog trip-arrival-modal" role="dialog" aria-modal="true" aria-labelledby="trip-arrival-title" onSubmit={saveArrivalWeight}>
                <header className="ms-dialog-head">
                  <div><div style={{ color: "#107948", fontSize: 11, fontWeight: 800, letterSpacing: 1.2 }}>Barang tiba</div><h2 id="trip-arrival-title" style={{ margin: "5px 0", fontSize: 22 }}>Masukkan Berat Tiba</h2><p style={{ margin: 0, color: "#65758c", fontSize: 13 }}>{truck?.plateNumber || trip.plateNumberSnap} · Muatan rencana {trip.qtyPlanned ?? "—"} {trip.unitSnap || order?.unit || ""}</p></div>
                  <button type="button" onClick={() => setArrivalEntry(null)} disabled={saving} aria-label="Tutup" style={{ ...btnGhost, width: 36, height: 36, padding: 0 }}><FiX/></button>
                </header>
                <div className="ms-dialog-body trip-arrival-body">
                <label style={{ display: "grid", gap: 7, marginTop: 0, color: "#36455b", fontSize: 13, fontWeight: 650 }}>Berat aktual di tujuan
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid #c9d3e0", borderRadius: 9, overflow: "hidden" }}><input autoFocus required type="number" min="0.001" step="0.001" value={arrivalEntry.qtyActual} onChange={(event) => setArrivalEntry((value) => ({ ...value, qtyActual: event.target.value }))} inputMode="decimal" placeholder={trip.unitSnap === "KG" ? "Contoh: 30000" : "Masukkan berat tiba"} style={{ flex: 1, minWidth: 0, border: 0, outline: 0, padding: "12px 13px", font: "inherit" }}/><span style={{ padding: "12px 13px", background: "#f3f6f9", color: "#506786" }}>{trip.unitSnap || order?.unit || "TON"}</span></div>
                </label>
                {arrivalEntry.qtyActual && trip.qtyPlanned != null && Number(arrivalEntry.qtyActual) < Number(trip.qtyPlanned) && <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "#FFF7E6", color: "#9A5B00", fontSize: 13 }}><strong>Selisih muatan: {(Number(trip.qtyPlanned) - Number(arrivalEntry.qtyActual)).toLocaleString("id-ID", { maximumFractionDigits: 3 })} {trip.unitSnap || order?.unit || ""}</strong><span style={{ display: "block", marginTop: 4 }}>Dicatat sebagai kehilangan pada tagihan/laporan. Order tetap dipenuhi berdasarkan muatan rencana.</span></div>}
                {saveErr && <div style={{ marginTop: 12, color: "#B42318", fontSize: 13 }}>{saveErr}</div>}
                </div>
                <footer className="ms-dialog-foot"><button type="button" style={btnGhost} disabled={saving} onClick={() => setArrivalEntry(null)}>Batal</button><button disabled={saving} style={{ ...btnGhost, border: 0, borderRadius: 9, background: "#107948", color: "white" }}>{saving ? "Menyimpan…" : arrivalEntry.nextStatus === "COMPLETED" ? "Simpan & Selesaikan" : "Simpan & Tandai Tiba"}</button></footer>
              </form>
            </div>, document.body
          )}
        </div>
      </div>
    </div>
  );
}
