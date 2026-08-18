// src/pages/Maintenance.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useRef, useState } from "react";
import { api, apiAssetUrl, uploadFiles } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import { FiTool, FiClock, FiCheck, FiX, FiPlus, FiRefreshCw } from "react-icons/fi";

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
      {selected && <div style={{ marginBottom: 7, fontSize: 12, color: BRAND.primary, fontWeight: 600 }}>Dipilih: {selected.sku} — {selected.name}</div>}
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
            style={{ display: "block", width: "100%", padding: "10px 12px", border: "none", borderBottom: `1px solid ${BRAND.border}`, background: item.id === value ? BRAND.secondary : BRAND.white, color: BRAND.text, textAlign: "left", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13 }}
          >
            <strong>{item.sku}</strong> — {item.name} <span style={{ color: BRAND.textMuted }}>({item.unit || "PCS"})</span>
          </button>
        ))}
      </div>
      {!query && items.length > 100 && <div style={{ marginTop: 6, fontSize: 12, color: BRAND.textMuted }}>Menampilkan 100 item pertama. Ketik SKU atau nama untuk mencari.</div>}
    </div>
  );
}

function ServicePhoto({ photo, alt }) {
  const [src, setSrc] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const url = apiAssetUrl(photo);
    if (/^https?:\/\//i.test(url) && !url.includes("/api/uploads/")) {
      setSrc(url);
      return undefined;
    }

    let active = true;
    let objectUrl = "";
    const token = localStorage.getItem("token");
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
  if (!src) return <div style={{ display: "grid", placeItems: "center", height: "100%", color: BRAND.textMuted, fontSize: 13 }}>Memuat foto...</div>;
  return <img src={src} alt={alt} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />;
}

function Modal({ open, title, onClose, children, width = 900 }) {
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
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: BRAND.text }}>{title}</h3>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
        <div
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
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

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

  // items/locations
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);

  // assign serialized
  const [assignItemId, setAssignItemId] = useState("");
  const [availableUnits, setAvailableUnits] = useState([]);
  const [unitPick, setUnitPick] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [assigning, setAssigning] = useState(false);

  // wheel replacement (installed units on truck)
  const [assignedUnits, setAssignedUnits] = useState([]);
  const [replaceUnitId, setReplaceUnitId] = useState("");
  const [assignedLoading, setAssignedLoading] = useState(false);

  // use non-serialized
  const [useItemId, setUseItemId] = useState("");
  const [useLocationId, setUseLocationId] = useState("");
  const [useQty, setUseQty] = useState("");
  const [useNote, setUseNote] = useState("");
  const [usingStock, setUsingStock] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [tireAction, setTireAction] = useState(null);
  const [retreadOptions, setRetreadOptions] = useState({ items: [], suppliers: [] });
  const [retreadForm, setRetreadForm] = useState({ toItemId: "", supplierId: "", cost: "", sentAt: "", notes: "" });
  const [tireActionSaving, setTireActionSaving] = useState(false);

  const truckSearchTimer = useRef(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const data = await api("/maintenance?" + params.toString());
      setJobs(data.jobs || []);
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
    setActiveId(id);
    setActiveJob(null);
    setDetailLoading(true);
    try {
      const data = await api("/maintenance/" + id);
      setActiveJob(data.job);

      setAssignItemId("");
      setAvailableUnits([]);
      setUnitPick("");
      setAssignNote("");

      setAssignedUnits([]);
      setReplaceUnitId("");
      setAssignedLoading(false);

      setUseItemId("");
      setUseLocationId("");
      setUseQty("");
      setUseNote("");
      setPhotoError("");
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
    } catch {}
  }

  useEffect(() => {
    load();
    loadItemsAndLocations().catch(() => {});
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
    setUnitPick(units[0]?.id || "");
  }

  async function loadAssignedUnits(itemId) {
    if (!activeJob?.id || !itemId) return;
    try {
      setAssignedLoading(true);
      const res = await api(`/maintenance/${activeJob.id}/assigned-units?itemId=${encodeURIComponent(itemId)}`);
      setAssignedUnits(res.units || []);
    } finally {
      setAssignedLoading(false);
    }
  }

  async function assignUnit() {
    if (!activeJob?.id) return;
    if (!unitPick) return setErr("Pick a stock unit first");

    setAssigning(true);
    setErr("");
    try {
      await api(`/maintenance/${activeJob.id}/assign-unit`, {
        method: "POST",
        body: JSON.stringify({
          stockUnitId: unitPick,
          note: assignNote || undefined,
          replaceStockUnitId: replaceUnitId || undefined,
        }),
      });

      setAssignNote("");
      setUnitPick("");
      setReplaceUnitId("");

      await refreshDetail();
      await load();

      if (assignItemId) {
        await loadAvailableUnits(assignItemId);
        await loadAssignedUnits(assignItemId);
      }
    } catch (e) {
      setErr(e.message || "Failed to assign unit");
    } finally {
      setAssigning(false);
    }
  }

  async function useStock() {
    if (!activeJob?.id) return;
    const qty = Number(useQty);

    if (!useItemId) return setErr("Select item");
    if (!useLocationId) return setErr("Select location");
    if (!Number.isFinite(qty) || qty <= 0) return setErr("Qty must be > 0");

    setUsingStock(true);
    setErr("");
    try {
      await api(`/maintenance/${activeJob.id}/use-stock`, {
        method: "POST",
        body: JSON.stringify({ itemId: useItemId, locationId: useLocationId, qty, note: useNote || undefined }),
      });
      setUseQty("");
      setUseNote("");
      await refreshDetail();
      await load();
    } catch (e) {
      setErr(e.message || "Failed to use stock");
    } finally {
      setUsingStock(false);
    }
  }

  async function startTireAction(assignment, type) {
    setErr("");
    setTireAction({ type, assignment });
    setRetreadForm({ toItemId: "", supplierId: "", cost: "", sentAt: "", notes: "" });
    if (type === "RETREAD") {
      try {
        const data = await api("/inventory/retread-options");
        const options = { items: data.items || [], suppliers: data.suppliers || [] };
        setRetreadOptions(options);
        const currentItemId = assignment.stockUnit?.itemId;
        setRetreadForm((form) => ({
          ...form,
          toItemId: options.items.find((item) => item.id !== currentItemId && /masak|retread/i.test(item.name || ""))?.id || "",
        }));
      } catch (e) {
        setTireAction(null);
        setErr(e.message || "Gagal memuat pilihan ban masak");
      }
    }
  }

  async function submitTireAction() {
    const unit = tireAction?.assignment?.stockUnit;
    if (!unit?.id || !activeJob?.id) return;
    setTireActionSaving(true);
    setErr("");
    try {
      if (tireAction.type === "RETREAD") {
        if (!retreadForm.toItemId) throw new Error("Pilih item tujuan Ban Masak");
        if (retreadForm.cost === "") throw new Error("Masukkan biaya masak ban");
        await api(`/inventory/units/${unit.id}/retread`, {
          method: "POST",
          body: JSON.stringify({
            ...retreadForm,
            cost: Number(retreadForm.cost),
            supplierId: retreadForm.supplierId || undefined,
            sentAt: retreadForm.sentAt || undefined,
            notes: retreadForm.notes || undefined,
            maintenanceId: activeJob.id,
          }),
        });
      } else {
        await api(`/inventory/units/${unit.id}/scrap`, {
          method: "POST",
          body: JSON.stringify({ note: retreadForm.notes || `Dilepas dan scrap saat servis ${activeJob.title}` }),
        });
      }
      setTireAction(null);
      await refreshDetail();
      await load();
    } catch (e) {
      setErr(e.message || "Gagal memproses ban");
    } finally {
      setTireActionSaving(false);
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

  return (
    <div data-testid="maintenance-page">
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
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              color: BRAND.text,
            }}
            data-testid="maintenance-title"
          >
            Maintenance
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: BRAND.textMuted }}>
            Create jobs, track ongoing time, and record spare parts used
          </p>
        </div>

        {allowed && (
          <Button variant="primary" icon={FiPlus} onClick={startCreate} data-testid="new-maintenance-btn">
            New Maintenance
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

      {/* Filters Card */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <div style={{ flex: "1 1 260px", minWidth: 200 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
                Search
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
                From Date
              </label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="from-date" />
            </div>

            <div style={{ flex: "0 0 150px" }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
                To Date
              </label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="to-date" />
            </div>

            <Button variant="primary" onClick={load} disabled={loading} data-testid="apply-filter-btn">
              {loading ? "Memuat..." : "Apply"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Jobs List */}
      <Card>
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
          <div>Job</div>
          <div>Status</div>
          <div>Duration</div>
          <div style={{ textAlign: "right" }}>Tindakan</div>
        </div>

        {/* Job Rows */}
        <div style={{ padding: "8px 12px" }}>
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
                data-testid={`job-row-${j.id}`}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: BRAND.text }}>{j.title}</div>
                  <div style={{ fontSize: 13, color: BRAND.textMuted, marginTop: 4 }}>
                    {j.truck?.plateNumber || "—"} • {fmtDateTime(j.createdAt)}
                  </div>
                </div>

                <div>
                  <StatusBadge status={j.status} />
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: BRAND.textMuted, marginBottom: 4 }}>
                    {j.status === "OPEN" ? <StatusBadge status="LIVE" /> : "TOTAL"}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: BRAND.text }}>{fmtDuration(dur)}</div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <Button variant="secondary" onClick={() => openDetail(j.id)} data-testid={`open-job-${j.id}`}>
                    Open
                  </Button>
                </div>
              </div>
            );
          })}

          {!loading && (!jobs || jobs.length === 0) && (
            <div style={{ padding: 24, textAlign: "center", color: BRAND.textMuted, fontSize: 14 }}>
              Tidak ada maintenance jobs ditemukan.
            </div>
          )}
        </div>
      </Card>

      {/* CREATE MODAL */}
      <Modal open={showCreate} title="Create Maintenance Job" onClose={() => setShowCreate(false)} width={960}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 20 }}>
          {/* Truck Picker */}
          <Card>
            <div style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12, color: BRAND.text }}>Pilih Kendaraan</div>
              <Input
                value={truckSearch}
                onChange={(e) => setTruckSearch(e.target.value)}
                placeholder="Cari nomor polisi..."
                data-testid="truck-search"
              />

              <div style={{ marginTop: 12, maxHeight: 300, overflow: "auto" }}>
                {trucksLoading && (
                  <div style={{ padding: 12, color: BRAND.textMuted, fontSize: 14 }}>Memuat kendaraan...</div>
                )}
                {!trucksLoading && (filteredTrucks || []).length === 0 && (
                  <div style={{ padding: 12, color: BRAND.textMuted, fontSize: 14 }}>Tidak ada kendaraan ditemukan.</div>
                )}

                {(filteredTrucks || []).map((t) => {
                  const selected = createForm.truckId === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setCreateForm((f) => ({ ...f, truckId: t.id }))}
                      style={{
                        padding: 14,
                        borderRadius: 6,
                        border: `1px solid ${selected ? BRAND.primary : BRAND.border}`,
                        background: selected ? BRAND.accent : BRAND.white,
                        marginTop: 8,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "all 0.15s ease",
                      }}
                      data-testid={`truck-option-${t.id}`}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: BRAND.text }}>{t.plateNumber}</div>
                        <div style={{ fontSize: 13, color: BRAND.textMuted, marginTop: 2 }}>
                          {t.brand || "—"} {t.model || ""} • {t.status}
                        </div>
                      </div>
                      {selected && <StatusBadge status="SELECTED" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Job Info */}
          <Card>
            <div style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12, color: BRAND.text }}>Job Info</div>

              <div style={{ display: "grid", gap: 12 }}>
                <Input
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Title (e.g. Brake service)"
                  data-testid="job-title-input"
                />

                <Input
                  value={createForm.odometerKm}
                  onChange={(e) => setCreateForm((f) => ({ ...f, odometerKm: e.target.value }))}
                  placeholder="Odometer (km) optional"
                  data-testid="odometer-input"
                />

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
                  placeholder="Note (optional)"
                  data-testid="job-note-input"
                />

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                  <Button variant="secondary" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={createJob}
                    disabled={creating || !createForm.truckId || !String(createForm.title || "").trim()}
                    data-testid="create-job-btn"
                  >
                    {creating ? "Membuat..." : "Create"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </Modal>

      {/* DETAIL MODAL */}
      <Modal open={showDetail} title="Maintenance Detail" onClose={() => setShowDetail(false)} width={1280}>
        {detailLoading || !activeJob ? (
          <div style={{ padding: 20, color: BRAND.textMuted, fontSize: 14 }}>Memuat...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 0.8fr) minmax(620px, 1.6fr)", gap: 20 }}>
            {/* LEFT - Job Info */}
            <Card>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: BRAND.text }}>{activeJob.title}</div>
                    <div style={{ fontSize: 13, color: BRAND.textMuted, marginTop: 4 }}>
                      {activeJob.truck?.plateNumber || "—"} • Created: {fmtDateTime(activeJob.createdAt)}
                    </div>
                  </div>
                  <StatusBadge status={activeJob.status} />
                </div>

                {/* Duration Card */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 6,
                    background: BRAND.secondary,
                    border: `1px solid ${BRAND.border}`,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500, color: BRAND.textMuted, marginBottom: 6 }}>
                    {activeJob.status === "OPEN" ? "Live duration (running)" : "Total duration"}
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
                    Total parts cost (serialized)
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
                      disabled={activeJob.status !== "OPEN"}
                      data-testid="mark-done-btn"
                    >
                      Mark DONE
                    </Button>
                    <Button
                      variant="secondary"
                      icon={FiX}
                      onClick={() => setJobStatus("CANCELLED")}
                      disabled={activeJob.status !== "OPEN"}
                      data-testid="cancel-job-btn"
                    >
                      Cancel
                    </Button>
                    <Button variant="secondary" icon={FiRefreshCw} onClick={refreshDetail} data-testid="refresh-btn">
                      Refresh
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            <Card style={{ gridColumn: "1 / -1", gridRow: "2" }}>
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, color: BRAND.text }}>Foto kondisi & servis</div>
                <div style={{ marginTop: 5, marginBottom: 14, fontSize: 13, color: BRAND.textMuted }}>Unggah foto sparepart yang dipasang, komponen rusak, atau hasil pekerjaan. Maksimal 10 foto.</div>
                {allowed && (
                  <label style={{ display: "inline-flex", padding: "10px 14px", borderRadius: 6, background: BRAND.secondary, border: `1px solid ${BRAND.border}`, color: BRAND.primary, cursor: uploadingPhotos ? "wait" : "pointer", fontWeight: 600, fontSize: 14 }}>
                    <input type="file" accept="image/*" multiple hidden disabled={uploadingPhotos} onChange={(e) => { uploadMaintenancePhotos(e.target.files); e.target.value = ""; }} />
                    {uploadingPhotos ? "Mengunggah foto..." : "+ Tambah foto"}
                  </label>
                )}
                {photoError && <div style={{ marginTop: 10, color: BRAND.danger, fontSize: 13 }}>{photoError}</div>}
                {(activeJob.photos || []).length ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginTop: 16 }}>
                    {(activeJob.photos || []).map((photo, index) => (
                      <div key={photo} style={{ position: "relative", height: 240, borderRadius: 8, overflow: "hidden", border: `1px solid ${BRAND.border}`, background: BRAND.secondary }}>
                        <a href={apiAssetUrl(photo)} target="_blank" rel="noreferrer" style={{ display: "block", height: "100%" }}><ServicePhoto photo={photo} alt={`Dokumentasi servis ${index + 1}`} /></a>
                        {allowed && <button type="button" onClick={() => updatePhotos((activeJob.photos || []).filter((_, photoIndex) => photoIndex !== index)).catch((e) => setPhotoError(e.message || "Gagal menghapus foto"))} style={{ position: "absolute", top: 6, right: 6, border: "none", borderRadius: 4, background: "rgba(255,255,255,0.92)", color: BRAND.danger, cursor: "pointer", padding: "4px 7px", fontWeight: 700 }}>×</button>}
                      </div>
                    ))}
                  </div>
                ) : <div style={{ marginTop: 14, color: BRAND.textMuted, fontSize: 13 }}>Belum ada foto dokumentasi.</div>}
              </div>
            </Card>

            {/* RIGHT - Spare Parts */}
            <Card style={{ gridColumn: "2", gridRow: "1" }}>
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 16, color: BRAND.text }}>Record Spareparts Used</div>

                {/* A) Serialized assign */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 6,
                    border: `1px solid ${BRAND.border}`,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: BRAND.text, marginBottom: 12 }}>
                    A) Assign Serialized Unit
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1.4fr) 1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <SearchableItemPicker
                      items={serializedItems}
                      value={assignItemId}
                      onChange={async (v) => {
                        setAssignItemId(v);
                        setUnitPick("");
                        setReplaceUnitId("");
                        setAvailableUnits([]);
                        setAssignedUnits([]);
                        if (!v) return;
                        await loadAvailableUnits(v);
                        await loadAssignedUnits(v);
                      }}
                      disabled={!allowed || activeJob.status !== "OPEN"}
                      placeholder="Cari SKU / nama item serialized..."
                      testId="serialized-item-search"
                    />

                    <Select
                      value={unitPick}
                      onChange={(e) => setUnitPick(e.target.value)}
                      disabled
                      data-testid="stock-unit-select"
                    >
                      <option value="">Unit FIFO akan dipilih otomatis</option>
                      {availableUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.serialNumber || u.barcode || u.id.slice(0, 8)} • {u.location?.name || "No location"}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={replaceUnitId}
                      onChange={(e) => setReplaceUnitId(e.target.value)}
                      disabled={!allowed || activeJob.status !== "OPEN" || !assignItemId}
                      data-testid="replace-unit-select"
                    >
                      <option value="">
                        {assignedLoading ? "Loading installed..." : "Replace installed (optional)"}
                      </option>
                      {(assignedUnits || []).map((u) => (
                        <option key={u.stockUnitId} value={u.stockUnitId}>
                          {u.stockUnit?.serialNumber || u.stockUnit?.barcode || u.stockUnitId.slice(0, 8)} • Installed{" "}
                          {fmtDateTime(u.installedAt)}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div style={{ marginTop: -2, marginBottom: 10, fontSize: 12, color: BRAND.textMuted }}>
                    FIFO aktif: sistem otomatis menggunakan unit stok yang paling lama diterima.
                  </div>

                  <Input
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    placeholder="Note (optional)"
                    disabled={!allowed || activeJob.status !== "OPEN"}
                    style={{ marginBottom: 10 }}
                    data-testid="assign-note-input"
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      variant="primary"
                      onClick={assignUnit}
                      disabled={!allowed || activeJob.status !== "OPEN" || assigning || !unitPick}
                      data-testid="assign-unit-btn"
                    >
                      {assigning ? "Assigning..." : "Assign Unit"}
                    </Button>
                  </div>
                </div>

                {/* B) Non-serialized use */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 6,
                    border: `1px solid ${BRAND.border}`,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: BRAND.text, marginBottom: 12 }}>
                    B) Use Non-Serialized Stock (qty)
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1.4fr) 1fr", gap: 10, marginBottom: 10 }}>
                    <SearchableItemPicker
                      items={nonSerializedItems}
                      value={useItemId}
                      onChange={setUseItemId}
                      disabled={!allowed || activeJob.status !== "OPEN"}
                      placeholder="Cari SKU / nama sparepart..."
                      testId="non-serialized-item-search"
                    />

                    <Select
                      value={useLocationId}
                      onChange={(e) => setUseLocationId(e.target.value)}
                      disabled={!allowed || activeJob.status !== "OPEN"}
                      data-testid="location-select"
                    >
                      <option value="">Select location</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <Input
                      value={useQty}
                      onChange={(e) => setUseQty(e.target.value)}
                      placeholder="Qty"
                      disabled={!allowed || activeJob.status !== "OPEN"}
                      data-testid="qty-input"
                    />
                    <Input
                      value={useNote}
                      onChange={(e) => setUseNote(e.target.value)}
                      placeholder="Note (optional)"
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
                      {usingStock ? "Menyimpan..." : "Use Stock"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* FULL WIDTH TABLES */}
            <Card style={{ gridColumn: "1 / -1" }}>
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 16, color: BRAND.text }}>
                  Spareparts used in this maintenance
                </div>

                {/* Serialized Table */}
                <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.textMuted, marginBottom: 8 }}>
                  Serialized assignments
                </div>
                <div style={{ overflow: "auto", marginBottom: 20 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ textAlign: "left", fontSize: 12, color: BRAND.textMuted, borderBottom: `1px solid ${BRAND.border}` }}>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Tanggal Pemasangan</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Barang</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Unit</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Dari</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Catatan</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Tindakan Ban</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeJob.sparePartAssignments || []).map((a) => (
                        <tr key={a.id} style={{ borderBottom: `1px solid ${BRAND.border}` }}>
                          <td style={{ padding: "12px 8px", color: BRAND.textLight }}>{fmtDateTime(a.installedAt)}</td>
                          <td style={{ padding: "12px 8px", fontWeight: 500, color: BRAND.text }}>
                            {a.stockUnit?.item?.sku} — {a.stockUnit?.item?.name}
                          </td>
                          <td style={{ padding: "12px 8px", color: BRAND.textLight }}>
                            {a.stockUnit?.serialNumber || a.stockUnit?.barcode || a.stockUnitId.slice(0, 8)}
                          </td>
                          <td style={{ padding: "12px 8px", color: BRAND.textLight }}>{a.stockUnit?.location?.name || "—"}</td>
                          <td style={{ padding: "12px 8px", color: BRAND.textMuted }}>{a.note || "—"}</td>
                          <td style={{ padding: "12px 8px" }}>
                            {!a.removedAt && a.stockUnit?.status === "ASSIGNED" && activeJob.status === "OPEN" ? (
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <Button variant="secondary" onClick={() => startTireAction(a, "RETREAD")}>Lepas & Masak</Button>
                                <Button variant="danger" onClick={() => startTireAction(a, "SCRAP")}>Lepas & Scrap</Button>
                              </div>
                            ) : (
                              <span style={{ color: BRAND.textMuted }}>{a.removedAt ? "Sudah dilepas" : "—"}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {(activeJob.sparePartAssignments || []).length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: 16, color: BRAND.textMuted, textAlign: "center" }}>
                            No serialized spareparts assigned yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Movements Table */}
                <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.textMuted, marginBottom: 8 }}>
                  Stock movements linked to this maintenance (includes qty usage)
                </div>
                <div style={{ overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ textAlign: "left", fontSize: 12, color: BRAND.textMuted, borderBottom: `1px solid ${BRAND.border}` }}>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Waktu</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Jenis</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Barang</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Jumlah</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Dari</th>
                        <th style={{ padding: "10px 8px", fontWeight: 600 }}>Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeJob.movements || []).map((m) => (
                        <tr key={m.id} style={{ borderBottom: `1px solid ${BRAND.border}` }}>
                          <td style={{ padding: "12px 8px", color: BRAND.textLight }}>{fmtDateTime(m.createdAt)}</td>
                          <td style={{ padding: "12px 8px", fontWeight: 500, color: BRAND.text }}>{m.type}</td>
                          <td style={{ padding: "12px 8px", color: BRAND.textLight }}>
                            {m.item?.sku} — {m.item?.name}
                          </td>
                          <td style={{ padding: "12px 8px", fontWeight: 600, color: BRAND.text }}>{m.qty}</td>
                          <td style={{ padding: "12px 8px", color: BRAND.textLight }}>{m.fromLocation?.name || "—"}</td>
                          <td style={{ padding: "12px 8px", color: BRAND.textMuted }}>{m.note || "—"}</td>
                        </tr>
                      ))}
                      {(activeJob.movements || []).length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: 16, color: BRAND.textMuted, textAlign: "center" }}>
                            No stock movements recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(tireAction)}
        title={tireAction?.type === "RETREAD" ? "Lepas & Kirim Masak Ban" : "Lepas & Scrap Ban"}
        onClose={() => !tireActionSaving && setTireAction(null)}
        width={620}
      >
        {tireAction ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ padding: 14, borderRadius: 6, background: BRAND.secondary, border: `1px solid ${BRAND.border}` }}>
              <div style={{ fontSize: 12, color: BRAND.textMuted }}>Ban pada {activeJob?.truck?.plateNumber || "truk"}</div>
              <div style={{ marginTop: 4, fontWeight: 700, color: BRAND.text }}>
                {tireAction.assignment.stockUnit?.item?.name} · Serial {tireAction.assignment.stockUnit?.serialNumber || tireAction.assignment.stockUnitId}
              </div>
            </div>

            {tireAction.type === "RETREAD" ? (
              <>
                <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
                  Item tujuan setelah selesai dimasak
                  <Select value={retreadForm.toItemId} onChange={(e) => setRetreadForm((form) => ({ ...form, toItemId: e.target.value }))}>
                    <option value="">Pilih item Ban Masak</option>
                    {retreadOptions.items.map((item) => <option key={item.id} value={item.id}>{item.sku} — {item.name}</option>)}
                  </Select>
                </label>
                <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
                  Vendor masak ban
                  <Select value={retreadForm.supplierId} onChange={(e) => setRetreadForm((form) => ({ ...form, supplierId: e.target.value }))}>
                    <option value="">Tanpa vendor</option>
                    {retreadOptions.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                  </Select>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>Biaya masak (Rp)<Input type="number" min="0" value={retreadForm.cost} onChange={(e) => setRetreadForm((form) => ({ ...form, cost: e.target.value }))} /></label>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>Tanggal dilepas/dikirim<Input type="datetime-local" value={retreadForm.sentAt} onChange={(e) => setRetreadForm((form) => ({ ...form, sentAt: e.target.value }))} /></label>
                </div>
              </>
            ) : (
              <div style={{ padding: 14, borderRadius: 6, background: BRAND.dangerBg, color: BRAND.danger, fontSize: 13 }}>
                Ban akan dilepas dari truk dan dikeluarkan permanen dari stok. Tindakan ini digunakan untuk ban rusak berat yang tidak layak dimasak.
              </div>
            )}

            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
              Catatan kondisi ban
              <Input value={retreadForm.notes} onChange={(e) => setRetreadForm((form) => ({ ...form, notes: e.target.value }))} placeholder="Contoh: tapak tipis tetapi casing masih layak" />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button variant="secondary" disabled={tireActionSaving} onClick={() => setTireAction(null)}>Batal</Button>
              <Button variant={tireAction.type === "RETREAD" ? "primary" : "danger"} disabled={tireActionSaving} onClick={submitTireAction}>
                {tireActionSaving ? "Memproses..." : tireAction.type === "RETREAD" ? "Lepas & Kirim" : "Lepas & Scrap"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
