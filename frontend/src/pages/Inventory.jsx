// src/pages/Inventory.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useState } from "react";
import { api, openPrintDocument, uploadFiles } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import LoadingState from "../components/LoadingState";
import { FiArrowDownCircle, FiArrowUpCircle, FiBox, FiFileText, FiMapPin, FiPlus, FiSearch, FiTruck, FiX } from "react-icons/fi";
import "./Inventory.css";

// Corporate Green Color Palette (matching Landing/Dashboard)
const BRAND = {
  primary: "#0D7C3D",
  primaryDark: "#0A6331",
  primaryLight: "#10A050",
  secondary: "#F5F9F7",
  accent: "#D4E8DC",
  text: "#1A1A1A",
  textMuted: "#6B7280",
  white: "#FFFFFF",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  danger: "#DC2626",
  dangerLight: "#FEE2E2",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
};

//////////////////////
// STYLES
//////////////////////
const pageBg = {
  minHeight: "100vh",
  padding: 24,
  background: BRAND.secondary,
  color: BRAND.text,
};

const container = {
  maxWidth: 1280,
  margin: "0 auto",
};

const headerTitle = {
  fontSize: 28,
  fontWeight: 700,
  margin: 0,
  color: BRAND.text,
};

const headerSub = {
  marginTop: 4,
  color: BRAND.textMuted,
  fontSize: 14,
};

const wrapCard = {
  marginTop: 24,
  background: BRAND.white,
  borderRadius: 8,
  border: `1px solid ${BRAND.border}`,
  padding: 24,
};

function TruckSearchSelect({ trucks, value, onChange, placeholder = "Cari nomor polisi..." }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => {
    return (trucks || []).find((t) => t.id === value) || null;
  }, [trucks, value]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selected) setQuery(selected.plateNumber || "");
  }, [selected]);

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    const list = trucks || [];
    if (!q) return list.slice(0, 10);
    return list
      .filter((t) => {
        const text = `${t.plateNumber || ""} ${t.brand || ""} ${t.model || ""}`.toLowerCase();
        return text.includes(q);
      })
      .slice(0, 10);
  }, [trucks, query]);

  return (
    <div style={{ position: "relative" }}>
      <input
        style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 140)}
      />

      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: BRAND.white,
            border: `1px solid ${BRAND.border}`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            borderRadius: 8,
            overflow: "hidden",
            zIndex: 50,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: 12, fontWeight: 500, color: BRAND.textMuted }}>Kendaraan tidak ditemukan</div>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(t.id);
                  setQuery(t.plateNumber || "");
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => e.target.style.background = BRAND.secondary}
                onMouseLeave={(e) => e.target.style.background = "transparent"}
              >
                <div style={{ fontWeight: 600, color: BRAND.text }}>{t.plateNumber || "-"}</div>
                <div style={{ marginTop: 2, color: BRAND.textMuted, fontSize: 12 }}>
                  {t.brand ? `${t.brand}` : ""} {t.model ? `${t.model}` : ""}
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function ItemSearchSelect({ items, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = useMemo(() => (items || []).find((item) => item.id === value) || null, [items, value]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selected) setQuery(`${selected.sku || ""} — ${selected.name || ""}`);
    if (!selected && !value) setQuery("");
  }, [selected, value]);

  const filtered = useMemo(() => {
    const selectedLabel = selected ? `${selected.sku || ""} — ${selected.name || ""}` : "";
    const keyword = query === selectedLabel ? "" : query.trim().toLowerCase();
    const list = items || [];
    if (!keyword) return list.slice(0, 30);
    return list.filter((item) => `${item.sku || ""} ${item.name || ""} ${item.unit || ""}`.toLowerCase().includes(keyword)).slice(0, 50);
  }, [items, query, selected]);

  return (
    <div style={{ position: "relative", minWidth: 280, flex: "1 1 280px" }}>
      <input
        style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
        value={query}
        placeholder="Cari SKU atau nama item..."
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (value) onChange(""); }}
        onFocus={(e) => { setOpen(true); e.target.select(); }}
        onBlur={() => setTimeout(() => setOpen(false), 140)}
      />
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: 300, overflowY: "auto", background: BRAND.white, border: `1px solid ${BRAND.border}`, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", borderRadius: 8, zIndex: 50 }}>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(""); setQuery(""); setOpen(false); }} style={{ width: "100%", textAlign: "left", padding: "10px 12px", border: "none", borderBottom: `1px solid ${BRAND.border}`, background: BRAND.white, color: BRAND.textMuted, cursor: "pointer" }}>Semua item</button>
          {filtered.length ? filtered.map((item) => (
            <button key={item.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(item.id); setQuery(`${item.sku || ""} — ${item.name || ""}`); setOpen(false); }} style={{ width: "100%", textAlign: "left", padding: "10px 12px", border: "none", borderBottom: `1px solid ${BRAND.border}`, background: item.id === value ? BRAND.secondary : BRAND.white, cursor: "pointer" }}>
              <strong>{item.sku || "-"}</strong> — {item.name || "-"} <span style={{ color: BRAND.textMuted }}>({item.unit || "PCS"})</span>
            </button>
          )) : <div style={{ padding: 12, color: BRAND.textMuted }}>Item tidak ditemukan.</div>}
        </div>
      )}
    </div>
  );
}

const pill = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 12px",
  borderRadius: 6,
  border: `1px solid ${BRAND.border}`,
  background: BRAND.secondary,
  color: BRAND.text,
  fontWeight: 500,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const pillGreen = {
  ...pill,
  background: BRAND.accent,
  border: `1px solid ${BRAND.primary}30`,
  color: BRAND.primary,
};

const pillRed = {
  ...pill,
  background: BRAND.dangerLight,
  border: `1px solid ${BRAND.danger}30`,
  color: BRAND.danger,
};

const inputPill = {
  height: 42,
  padding: "0 14px",
  borderRadius: 6,
  border: `1px solid ${BRAND.border}`,
  outline: "none",
  background: BRAND.white,
  color: BRAND.text,
  fontWeight: 500,
  fontSize: 14,
  minWidth: 260,
  transition: "border-color 0.2s ease",
};

const selectPill = {
  ...inputPill,
  minWidth: 200,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  paddingRight: 36,
  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
  backgroundPosition: "right 10px center",
  backgroundSize: "16px",
  backgroundRepeat: "no-repeat",
  cursor: "pointer",
};

const btn = {
  height: 42,
  padding: "0 16px",
  borderRadius: 6,
  border: `1px solid ${BRAND.border}`,
  background: BRAND.white,
  color: BRAND.text,
  fontWeight: 500,
  fontSize: 14,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const btnPrimary = {
  ...btn,
  background: BRAND.primary,
  border: `1px solid ${BRAND.primary}`,
  color: BRAND.white,
};

const btnDanger = {
  ...btn,
  background: BRAND.dangerLight,
  border: `1px solid ${BRAND.danger}30`,
  color: BRAND.danger,
};

const errorBox = {
  marginTop: 16,
  background: BRAND.dangerLight,
  border: `1px solid ${BRAND.danger}30`,
  borderRadius: 6,
  padding: 16,
};

const tableWrap = { overflowX: "auto", borderRadius: 8 };

const table = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  minWidth: 900,
};

const th = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: 12,
  color: BRAND.textMuted,
  background: BRAND.secondary,
  borderBottom: `1px solid ${BRAND.border}`,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const td = {
  padding: "12px 16px",
  borderBottom: `1px solid ${BRAND.borderLight}`,
  verticalAlign: "middle",
  fontWeight: 500,
  fontSize: 14,
  color: BRAND.text,
};

const tdSoft = {
  ...td,
  color: BRAND.textMuted,
};

//////////////////////
// HOVER BUTTON SYSTEM
//////////////////////
function Btn({ style, disabled, children, ...props }) {
  const [hover, setHover] = useState(false);

  const finalStyle = {
    ...style,
    transition: "all 0.2s ease",
    ...(hover && !disabled ? { transform: "translateY(-1px)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" } : null),
    ...(disabled ? { opacity: 0.5, cursor: "not-allowed" } : null),
  };

  return (
    <button
      {...props}
      disabled={disabled}
      style={finalStyle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
    </button>
  );
}

//////////////////////
// UI HELPERS
//////////////////////
function Pill({ variant = "grey", children }) {
  const style = variant === "green" ? pillGreen : variant === "red" ? pillRed : pill;
  return <span style={style}>{children}</span>;
}

function Modal({ open, title, eyebrow = "INVENTORY", description, tone = "green", onClose, children }) {
  if (!open) return null;
  return (
    <div className="inventory-modal-overlay" onClick={onClose}>
      <div className={`inventory-modal inventory-modal--${tone}`} onClick={(e) => e.stopPropagation()}>
        <div className="inventory-modal-head">
          <div className="inventory-modal-heading">
            <span>{eyebrow}</span>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="inventory-modal-close" onClick={onClose} aria-label="Tutup"><FiX /></button>
        </div>
        <div className="inventory-modal-body">{children}</div>
      </div>
    </div>
  );
}

function EmergencySearchPicker({ label, placeholder, items, value, onChange, itemLabel, itemMeta, icon = FiTruck }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = items.find((item) => item.id === value) || null;
  const normalized = query.trim().toLocaleLowerCase("id-ID");
  const results = items.filter((item) => `${itemLabel(item)} ${itemMeta(item)}`.toLocaleLowerCase("id-ID").includes(normalized)).slice(0, 8);
  const Icon = icon;
  function choose(item) { onChange(item.id); setQuery(""); setOpen(false); }
  return <div className={`emergency-picker ${open ? "is-open" : ""}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}><span>{label}</span>{selected ? <div className="emergency-picker-selected"><i><Icon /></i><div><strong>{itemLabel(selected)}</strong><small>{itemMeta(selected)}</small></div><button type="button" onClick={() => { onChange(""); setQuery(""); setOpen(true); }}><FiX /></button></div> : <div className="emergency-picker-control"><FiSearch/><input value={query} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }}/>{open && <div className="emergency-picker-results">{results.map((item) => <button type="button" key={item.id} onMouseDown={(event) => { event.preventDefault(); choose(item); }} onClick={() => choose(item)}><i><Icon /></i><span><strong>{itemLabel(item)}</strong><small>{itemMeta(item)}</small></span></button>)}{!results.length && <em>Tidak ada hasil yang cocok</em>}</div>}</div>}</div>;
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
}

function buildQuery(paramsObj) {
  const sp = new URLSearchParams();
  Object.entries(paramsObj || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function sumStocks(stocks) {
  return (stocks || []).reduce((a, s) => a + (Number(s.qty) || 0), 0);
}

export default function Inventory() {
  const { user } = useAuth();
  const role = user?.role || "UNKNOWN";
  const allowed = role === "OWNER" || role === "ADMIN" || role === "STAFF" || role === "SPAREPART_ADMIN";
  const isSparepartAdmin = role === "SPAREPART_ADMIN";

  const [tab, setTab] = useState("ITEMS");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState([]);
  const [receiveItems, setReceiveItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [units, setUnits] = useState([]);
  const [movements, setMovements] = useState([]);
  const [batches, setBatches] = useState([]);
  const [emergencyDispatches, setEmergencyDispatches] = useState([]);
  const [openEmergency, setOpenEmergency] = useState(false);
  const [installDispatch, setInstallDispatch] = useState(null);
  const [emergencyProof, setEmergencyProof] = useState(null);
  const [installProof, setInstallProof] = useState(null);
  const [emergencyUnits, setEmergencyUnits] = useState([]);
  const [oldAssignments, setOldAssignments] = useState([]);
  const [emergencyBusy, setEmergencyBusy] = useState(false);
  const [emergencyPreparing, setEmergencyPreparing] = useState(false);
  const [emergencyForm, setEmergencyForm] = useState({ targetTruckId: "", carrierTruckId: "", itemId: "", fromLocationId: "", stockUnitId: "", qty: 1, note: "" });
  const [installForm, setInstallForm] = useState({ oldStockUnitId: "", oldPartDisposition: "SCRAPPED", note: "" });
  const [itemPage, setItemPage] = useState(1);
  const [unitPage, setUnitPage] = useState(1);
  const [itemPagination, setItemPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [unitPagination, setUnitPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [stockReportDate, setStockReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [printMenuOpen, setPrintMenuOpen] = useState(false);

  const [unitStatus, setUnitStatus] = useState("");
  const [unitItemId, setUnitItemId] = useState("");
  const [unitLocationId, setUnitLocationId] = useState("");

  const [openCreateItem, setOpenCreateItem] = useState(false);
  const [createItemError, setCreateItemError] = useState("");
  const [editItemForm, setEditItemForm] = useState(null);
  const [openReceive, setOpenReceive] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
  const [openCreateLocation, setOpenCreateLocation] = useState(false);
  const [openConsume, setOpenConsume] = useState(false);
  const [openBarcode, setOpenBarcode] = useState(false);
  const [barcodeForm, setBarcodeForm] = useState({ unitId: "", barcode: "" });

  const [mvFrom, setMvFrom] = useState("");
  const [mvTo, setMvTo] = useState("");

  const [openScrap, setOpenScrap] = useState(false);
  const [scrapForm, setScrapForm] = useState({ unitId: "", note: "" });
  const [openRetread, setOpenRetread] = useState(false);
  const [openCompleteRetread, setOpenCompleteRetread] = useState(false);
  const [retreadOptions, setRetreadOptions] = useState({ items: [], suppliers: [], locations: [] });
  const [retreadForm, setRetreadForm] = useState({ unitId: "", serialNumber: "", toItemId: "", supplierId: "", cost: "", sentAt: "", notes: "" });
  const [completeRetreadForm, setCompleteRetreadForm] = useState({ unitId: "", serialNumber: "", locationId: "", completedAt: "" });

  const [createItemForm, setCreateItemForm] = useState({
    sku: "",
    name: "",
    unit: "PCS",
    isSerialized: false,
    category: "GENERAL_SPAREPART",
  });

  const [receiveForm, setReceiveForm] = useState({
    itemId: "",
    locationId: "",
    qty: 1,
    note: "",
    unitLines: "",
    unitPurchasePrice: "",
    totalPurchasePrice: "",
  });
  const [receiveUnitRows, setReceiveUnitRows] = useState([{ serialNumber: "", purchasePrice: "" }]);

  const [assignForm, setAssignForm] = useState({
    unitId: "",
    truckId: "",
    installedAt: "",
    note: "",
    maintenanceId: "",
  });

  const [newLocationName, setNewLocationName] = useState("");

  const [consumeForm, setConsumeForm] = useState({
    itemId: "",
    locationId: "",
    qty: 1,
    note: "",
  });

  const serializedItems = useMemo(() => items.filter((x) => x.isSerialized), [items]);
  const selectedReceiveItem = receiveItems.find((x) => x.id === receiveForm.itemId) || items.find((x) => x.id === receiveForm.itemId);
  const nonSerializedItems = useMemo(() => items.filter((x) => !x.isSerialized), [items]);

  const qNorm = (q || "").trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!qNorm) return items;
    return items.filter((it) => {
      const text = `${it.sku || ""} ${it.name || ""} ${it.unit || ""}`.toLowerCase();
      return text.includes(qNorm);
    });
  }, [items, qNorm]);

  const filteredUnits = useMemo(() => {
    if (!qNorm) return units;
    return units.filter((u) => {
      const currentTruck = (u.assignments || [])[0]?.truck;
      const text = `
        ${u.item?.sku || ""} ${u.item?.name || ""}
        ${u.serialNumber || ""} ${u.barcode || ""}
        ${u.status || ""} ${u.location?.name || ""}
        ${currentTruck?.plateNumber || ""}
      `.toLowerCase();
      return text.includes(qNorm);
    });
  }, [units, qNorm]);

  const filteredMovements = useMemo(() => {
    if (!qNorm) return movements;
    return movements.filter((m) => {
      const text = `
        ${m.type || ""}
        ${m.item?.sku || ""} ${m.item?.name || ""}
        ${m.note || ""}
        ${m.fromLocation?.name || ""} ${m.toLocation?.name || ""}
        ${m.stockUnitId || ""}
      `.toLowerCase();
      return text.includes(qNorm);
    });
  }, [movements, qNorm]);

  async function loadLocations() {
    const data = await api("/inventory/locations");
    setLocations(data.locations || []);
  }

  async function loadTrucks() {
    const data = await api("/trucks");
    setTrucks(data.trucks || data.items || []);
  }

  async function loadEmergencyDispatches() {
    const data = await api("/inventory/emergency-dispatches");
    setEmergencyDispatches(data.items || []);
  }

  function openEmergencyForm() {
    setErr("");
    setEmergencyForm({ targetTruckId: "", carrierTruckId: "", itemId: "", fromLocationId: "", stockUnitId: "", qty: 1, note: "" });
    setEmergencyUnits([]); setEmergencyProof(null); setOpenEmergency(true);
    const loaders = [];
    if (!trucks.length) loaders.push(loadTrucks());
    if (!locations.length) loaders.push(loadLocations());
    if (!items.length) loaders.push(loadItems());
    if (loaders.length) {
      setEmergencyPreparing(true);
      Promise.all(loaders).catch((error) => setErr(error.message || "Gagal memuat data pengiriman")).finally(() => setEmergencyPreparing(false));
    }
  }

  async function loadEmergencyUnits(itemId, locationId) {
    if (!itemId || !locationId || !items.find((item) => item.id === itemId)?.isSerialized) return setEmergencyUnits([]);
    const data = await api(`/inventory/units?itemId=${encodeURIComponent(itemId)}&locationId=${encodeURIComponent(locationId)}&status=IN_STOCK&limit=200`);
    setEmergencyUnits(data.units || data.items || []);
  }

  async function createEmergencyDispatch(event) {
    event.preventDefault(); setEmergencyBusy(true); setErr("");
    try {
      if (!emergencyProof) throw new Error("Bukti kerusakan foto atau video wajib dipilih");
      const proof = (await uploadFiles([emergencyProof]))[0];
      await api("/inventory/emergency-dispatches", { method: "POST", body: JSON.stringify({ ...emergencyForm, qty: Number(emergencyForm.qty), damageProofUrl: proof.url, damageProofFileName: proof.fileName, damageProofMimeType: proof.mimeType }) });
      setOpenEmergency(false); await Promise.all([loadEmergencyDispatches(), loadItems(), loadUnits(), loadMovements()]);
    } catch (e) { setErr(e.message || "Gagal membuat pengiriman darurat"); } finally { setEmergencyBusy(false); }
  }

  async function openInstallDispatch(dispatch) {
    setInstallDispatch(dispatch); setInstallProof(null); setInstallForm({ oldStockUnitId: "", oldPartDisposition: "SCRAPPED", note: "" });
    try { const data = await api(`/inventory/trucks/${dispatch.targetTruckId}/spareparts?currentOnly=1`); setOldAssignments(data.rows || []); } catch { setOldAssignments([]); }
  }

  async function confirmEmergencyInstall(event) {
    event.preventDefault(); setEmergencyBusy(true); setErr("");
    try {
      if (!installProof) throw new Error("Bukti pemasangan foto atau video wajib dipilih");
      const proof = (await uploadFiles([installProof]))[0];
      await api(`/inventory/emergency-dispatches/${installDispatch.id}/install`, { method: "POST", body: JSON.stringify({ ...installForm, installProofUrl: proof.url, installProofFileName: proof.fileName, installProofMimeType: proof.mimeType }) });
      setInstallDispatch(null); await Promise.all([loadEmergencyDispatches(), loadUnits(), loadMovements()]);
    } catch (e) { setErr(e.message || "Gagal mengonfirmasi pemasangan"); } finally { setEmergencyBusy(false); }
  }

  async function loadItems(page = itemPage) {
    const qs = buildQuery({ q: q || undefined, page, limit: 20 });
    const data = await api(`/inventory/items${qs}`);
    setItems(data.items || []);
    setItemPagination(data.pagination || { page, limit: 20, total: (data.items || []).length, totalPages: 1 });
  }

  async function loadUnits(page = unitPage) {
    const qs = buildQuery({
      status: unitStatus || undefined,
      itemId: unitItemId || undefined,
      locationId: unitLocationId || undefined,
      q: q || undefined,
      page,
      limit: 20,
    });
    const data = await api(`/inventory/units${qs}`);
    setUnits(data.units || []);
    setUnitPagination(data.pagination || { page, limit: 20, total: (data.units || []).length, totalPages: 1 });
  }

  async function loadMovements() {
    const qs = buildQuery({
      limit: 120,
      itemId: unitItemId || undefined,
      from: mvFrom || undefined,
      to: mvTo || undefined,
      q: q || undefined,
    });
    const data = await api(`/inventory/movements${qs}`);
    setMovements(data.movements || []);
  }

  async function loadBatches() {
    const qs = buildQuery({ itemId: unitItemId || undefined, locationId: unitLocationId || undefined, q: q || undefined });
    const data = await api(`/inventory/batches${qs}`);
    setBatches(data.batches || []);
  }

  async function scrapUnit() {
    setErr("");
    try {
      if (!scrapForm.unitId) throw new Error("Missing unitId");

      await api(`/inventory/units/${scrapForm.unitId}/scrap`, {
        method: "POST",
        body: JSON.stringify({ note: scrapForm.note || undefined }),
      });

      setOpenScrap(false);
      setScrapForm({ unitId: "", note: "" });

      await Promise.all([loadUnits(), loadMovements(), loadItems()]);
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function loadRetreadOptions() {
    const data = await api("/inventory/retread-options");
    const options = { items: data.items || [], suppliers: data.suppliers || [], locations: data.locations || [] };
    setRetreadOptions(options);
    return options;
  }

  // Kept for the retread action flow that is conditionally exposed by unit status.
  // eslint-disable-next-line no-unused-vars
  async function openRetreadUnit(unit) {
    setErr("");
    try {
      const options = await loadRetreadOptions();
      setRetreadForm({
        unitId: unit.id,
        serialNumber: unit.serialNumber || "",
        toItemId: options.items.find((item) => item.id !== unit.itemId && /masak|retread/i.test(item.name || ""))?.id || "",
        supplierId: "",
        cost: "",
        sentAt: "",
        notes: "",
      });
      setOpenRetread(true);
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function sendToRetread() {
    setErr("");
    try {
      if (!retreadForm.toItemId) throw new Error("Pilih item tujuan Ban Masak");
      if (retreadForm.cost === "") throw new Error("Masukkan biaya masak ban");
      await api(`/inventory/units/${retreadForm.unitId}/retread`, {
        method: "POST",
        body: JSON.stringify({
          toItemId: retreadForm.toItemId,
          supplierId: retreadForm.supplierId || undefined,
          cost: Number(retreadForm.cost),
          sentAt: retreadForm.sentAt || undefined,
          notes: retreadForm.notes || undefined,
        }),
      });
      setOpenRetread(false);
      await Promise.all([loadUnits(), loadMovements(), loadItems()]);
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function openCompleteRetreadUnit(unit) {
    setErr("");
    try {
      const options = await loadRetreadOptions();
      setCompleteRetreadForm({ unitId: unit.id, serialNumber: unit.serialNumber || "", locationId: options.locations[0]?.id || "", completedAt: "" });
      setOpenCompleteRetread(true);
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function completeRetread() {
    setErr("");
    try {
      if (!completeRetreadForm.locationId) throw new Error("Pilih lokasi penerimaan");
      await api(`/inventory/units/${completeRetreadForm.unitId}/retread/complete`, {
        method: "POST",
        body: JSON.stringify({ locationId: completeRetreadForm.locationId, completedAt: completeRetreadForm.completedAt || undefined }),
      });
      setOpenCompleteRetread(false);
      await Promise.all([loadUnits(), loadMovements(), loadItems()]);
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function refresh() {
    setLoading(true);
    setErr("");
    try {
      if (tab === "ITEMS") await loadItems();
      if (tab === "UNITS") await loadUnits();
      if (tab === "MOVEMENTS") await loadMovements();
      if (tab === "BATCHES") await loadBatches();
      if (tab === "EMERGENCY") await loadEmergencyDispatches();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function changeItemPage(page) {
    setItemPage(page);
    setLoading(true);
    try { await loadItems(page); } catch (e) { setErr(String(e?.message || e)); } finally { setLoading(false); }
  }

  async function changeUnitPage(page) {
    setUnitPage(page);
    setLoading(true);
    try { await loadUnits(page); } catch (e) { setErr(String(e?.message || e)); } finally { setLoading(false); }
  }
  useLiveRefresh(refresh);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        await Promise.all([loadLocations(), loadTrucks(), loadItems()]);
      } catch (e) {
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  // Bootstrap reference data once access becomes available.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function createItem() {
    setErr("");
    setCreateItemError("");
    try {
      if (!createItemForm.sku.trim() || !createItemForm.name.trim()) {
        throw new Error("SKU and Name are required");
      }

      const sku = createItemForm.sku.trim().toLowerCase();
      const name = createItemForm.name.trim().toLowerCase();
      if (items.some((item) => String(item.sku || "").trim().toLowerCase() === sku)) {
        throw new Error("SKU sudah digunakan");
      }
      if (items.some((item) => String(item.name || "").trim().toLowerCase() === name)) {
        throw new Error("Nama barang sudah digunakan");
      }

      await api("/inventory/items", {
        method: "POST",
        body: JSON.stringify({
          sku: createItemForm.sku.trim(),
          name: createItemForm.name.trim(),
          unit: createItemForm.unit.trim() || "PCS",
          isSerialized: !!createItemForm.isSerialized,
          category: createItemForm.category,
        }),
      });

      setOpenCreateItem(false);
      setCreateItemForm({ sku: "", name: "", unit: "PCS", isSerialized: false, category: "GENERAL_SPAREPART" });
      await loadItems();
    } catch (e) {
      setCreateItemError(String(e?.message || e));
    }
  }

  function openEditItem(item) {
    setErr("");
    setEditItemForm({
      id: item.id,
      sku: item.sku || "",
      name: item.name || "",
      unit: item.unit || "PCS",
      isSerialized: Boolean(item.isSerialized),
      originalSerialized: Boolean(item.isSerialized),
      category: item.category || "GENERAL_SPAREPART",
      totalStock: sumStocks(item.stocks),
    });
  }

  async function updateItem() {
    setErr("");
    try {
      if (!editItemForm?.sku.trim() || !editItemForm?.name.trim() || !editItemForm?.unit.trim()) {
        throw new Error("SKU, nama, dan satuan wajib diisi");
      }
      await api(`/inventory/items/${editItemForm.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          sku: editItemForm.sku.trim(),
          name: editItemForm.name.trim(),
          unit: editItemForm.unit.trim(),
          isSerialized: editItemForm.isSerialized,
          category: editItemForm.category,
        }),
      });
      setEditItemForm(null);
      await loadItems();
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function createLocation() {
    setErr("");
    try {
      const name = newLocationName.trim();
      if (!name) throw new Error("Location name is required");

      const res = await api("/inventory/locations", {
        method: "POST",
        body: JSON.stringify({ name }),
      });

      await loadLocations();
      setOpenCreateLocation(false);
      setNewLocationName("");

      const created = res.location;
      if (created?.id) {
        setReceiveForm((p) => ({ ...p, locationId: created.id }));
        setConsumeForm((p) => ({ ...p, locationId: created.id }));
      }
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function receiveStock() {
    setErr("");
    try {
      const item = receiveItems.find((x) => x.id === receiveForm.itemId) || items.find((x) => x.id === receiveForm.itemId);
      if (!item) throw new Error("Select an item");
      if (!receiveForm.locationId) throw new Error("Select a location");

      const payload = {
        itemId: receiveForm.itemId,
        locationId: receiveForm.locationId,
        note: receiveForm.note || undefined,
      };

      if (item.isSerialized) {
        const unitsPayload = receiveUnitRows
          .map((row) => ({ serialNumber: String(row.serialNumber || "").trim(), purchasePrice: row.purchasePrice === "" ? undefined : Number(row.purchasePrice) }))
          .filter((row) => row.serialNumber || row.purchasePrice != null);

        if (unitsPayload.length === 0) {
          throw new Error("Tambahkan minimal satu nomor seri.");
        }
        if (unitsPayload.some((unit) => !unit.serialNumber)) throw new Error("Nomor seri tidak boleh kosong.");
        const normalizedSerials = unitsPayload.map((unit) => unit.serialNumber.toLocaleLowerCase("id-ID"));
        if (new Set(normalizedSerials).size !== normalizedSerials.length) throw new Error("Nomor seri tidak boleh duplikat.");
        if (unitsPayload.some((unit) => unit.purchasePrice != null && (!Number.isFinite(unit.purchasePrice) || unit.purchasePrice <= 0))) throw new Error("Harga unit harus berupa angka lebih dari nol.");

        const hasAnyUnitPrice = unitsPayload.some(
          (u) => u.purchasePrice != null && Number(u.purchasePrice) > 0
        );

        const totalRaw = receiveForm.totalPurchasePrice;
        const hasTotalPrice =
          totalRaw != null && String(totalRaw).trim() !== "" && Number(totalRaw) > 0;

        if (!hasAnyUnitPrice && !hasTotalPrice) {
          throw new Error("Provide per-unit price OR Total Purchase Price.");
        }

        if (hasAnyUnitPrice && hasTotalPrice) {
          throw new Error("Use either per-unit price OR Total Purchase Price, not both.");
        }
        if (hasAnyUnitPrice && unitsPayload.some((unit) => !(unit.purchasePrice > 0))) throw new Error("Isi harga pada seluruh unit, atau kosongkan semuanya dan gunakan Total Harga Pembelian.");

        payload.units = unitsPayload.map((u) => ({
          serialNumber: u.serialNumber,
          barcode: u.barcode || undefined,
          ...(hasAnyUnitPrice ? { purchasePrice: Number(u.purchasePrice) } : {}),
        }));

        if (hasTotalPrice) payload.totalPurchasePrice = Number(totalRaw);
      } else {
        payload.qty = Number(receiveForm.qty || 0);
        const unitPrice = Number(receiveForm.unitPurchasePrice || 0);
        if (!Number.isFinite(payload.qty) || payload.qty <= 0) throw new Error("Jumlah harus lebih dari nol.");
        if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error("Harga per unit harus lebih dari nol.");
        payload.totalPurchasePrice = Math.round(payload.qty * unitPrice);
      }

      await api("/inventory/receive", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setOpenReceive(false);
      setReceiveForm({
        itemId: "",
        locationId: "",
        qty: 1,
        note: "",
        unitLines: "",
        unitPurchasePrice: "",
        totalPurchasePrice: "",
      });
      setReceiveUnitRows([{ serialNumber: "", purchasePrice: "" }]);

      await Promise.all([loadItems(), loadMovements()]);
      if (tab === "UNITS") await loadUnits();
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function assignUnit() {
    setErr("");
    try {
      if (!assignForm.unitId) throw new Error("Missing unitId");
      if (!assignForm.truckId) throw new Error("Pilih kendaraan");

      await api(`/inventory/units/${assignForm.unitId}/assign`, {
        method: "POST",
        body: JSON.stringify({
          truckId: assignForm.truckId,
          installedAt: assignForm.installedAt || undefined,
          note: assignForm.note || undefined,
          maintenanceId: assignForm.maintenanceId || undefined,
        }),
      });

      setOpenAssign(false);
      setAssignForm({ unitId: "", truckId: "", installedAt: "", note: "", maintenanceId: "" });

      await Promise.all([loadItems(), loadUnits(), loadMovements()]);
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function updateBarcode() {
    setErr("");
    try {
      if (!barcodeForm.unitId) throw new Error("Missing unitId");
      const bc = String(barcodeForm.barcode || "").trim();
      if (!bc) throw new Error("Barcode is required");

      await api(`/inventory/units/${barcodeForm.unitId}`, {
        method: "PATCH",
        body: JSON.stringify({ barcode: bc }),
      });

      setOpenBarcode(false);
      setBarcodeForm({ unitId: "", barcode: "" });

      await loadUnits();
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function consumeStock() {
    setErr("");
    try {
      const item = items.find((x) => x.id === consumeForm.itemId);
      if (!item) throw new Error("Select an item");
      if (item.isSerialized) throw new Error("Consume is only for NON-serialized items.");
      if (!consumeForm.locationId) throw new Error("Select a location");

      const qty = Number(consumeForm.qty);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error("Qty must be more than 0");

      const stockRow = (item.stocks || []).find((s) => s.locationId === consumeForm.locationId);
      const available = Number(stockRow?.qty || 0);
      if (qty > available) {
        throw new Error(`Not enough stock. Available: ${available} ${item.unit || ""}`);
      }

      await api("/inventory/consume", {
        method: "POST",
        body: JSON.stringify({
          itemId: consumeForm.itemId,
          locationId: consumeForm.locationId,
          qty,
          note: consumeForm.note || undefined,
        }),
      });

      setOpenConsume(false);
      setConsumeForm({ itemId: "", locationId: "", qty: 1, note: "" });

      await Promise.all([loadItems(), loadMovements()]);
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  if (!allowed) {
    return (
      <div style={pageBg}>
        <div style={container}>
          <div style={wrapCard}>
            <h1 style={headerTitle}>Persediaan</h1>
            <div style={headerSub}>Anda tidak memiliki akses ke halaman ini.</div>
          </div>
        </div>
      </div>
    );
  }

  const totalItems = itemPagination.total;

  return (
    <div className="inventory-page">
      <div className="inventory-shell">
        {/* Header */}
        <div className="inventory-hero">
          <div className="inventory-hero-copy">
            <span className="inventory-eyebrow">GUDANG & SUKU CADANG</span>
            <h1>Inventory</h1>
            <p>Pantau ketersediaan barang, penerimaan, dan pemakaian stok dalam satu tempat.</p>
            <div className="inventory-hero-meta"><span><FiBox /> {totalItems} jenis barang</span><span><FiMapPin /> {locations.length} lokasi stok</span></div>
          </div>

          <div className="inventory-hero-actions">

            <div style={{ position: "relative", paddingBottom: printMenuOpen ? 8 : 0, marginBottom: printMenuOpen ? -8 : 0 }} onMouseEnter={() => setPrintMenuOpen(true)} onMouseLeave={() => setPrintMenuOpen(false)}>
              <button className="inventory-action inventory-action--soft" type="button" aria-haspopup="menu" aria-expanded={printMenuOpen} onFocus={() => setPrintMenuOpen(true)}>
                <FiFileText /> Cetak Laporan
              </button>
              {printMenuOpen ? <div role="menu" style={{ position: "absolute", top: "100%", right: 0, zIndex: 30, width: 310, padding: 10, borderRadius: 12, border: `1px solid ${BRAND.border}`, background: BRAND.white, boxShadow: "0 18px 45px rgba(17, 24, 39, .14)" }}>
                <button type="button" onClick={() => openPrintDocument("/inventory/reports/stock?scope=overall").catch((e) => setErr(e.message))} style={{ width: "100%", display: "grid", gridTemplateColumns: "38px 1fr", gap: 11, alignItems: "center", padding: 11, border: 0, borderRadius: 9, background: BRAND.secondary, textAlign: "left", cursor: "pointer" }}>
                  <span style={{ width: 38, height: 38, borderRadius: 9, display: "grid", placeItems: "center", background: BRAND.white, color: BRAND.primary, fontSize: 18 }}>▦</span>
                  <span><strong style={{ display: "block", color: BRAND.text, fontSize: 13 }}>Stok Keseluruhan</strong><small style={{ display: "block", marginTop: 3, color: BRAND.textMuted }}>Posisi stok terkini per lokasi</small></span>
                </button>

                <div style={{ marginTop: 9, padding: 11, borderRadius: 9, border: `1px solid ${BRAND.border}` }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 9 }}>
                    <span style={{ width: 38, height: 38, flex: "0 0 auto", borderRadius: 9, display: "grid", placeItems: "center", background: BRAND.secondary, color: BRAND.primary, fontSize: 17 }}>◷</span>
                    <span><strong style={{ display: "block", color: BRAND.text, fontSize: 13 }}>Stok Harian</strong><small style={{ display: "block", marginTop: 3, color: BRAND.textMuted }}>Saldo dan mutasi tanggal pilihan</small></span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 7 }}>
                    <input type="date" value={stockReportDate} onChange={(e) => setStockReportDate(e.target.value)} style={{ ...inputPill, minWidth: 0, width: "100%", height: 36, padding: "0 9px", boxSizing: "border-box" }} />
                    <Btn style={{ ...btnPrimary, height: 36, padding: "0 12px", fontSize: 12 }} onClick={() => openPrintDocument(`/inventory/reports/stock?scope=daily&date=${encodeURIComponent(stockReportDate)}`).catch((e) => setErr(e.message))}>
                      Cetak
                    </Btn>
                  </div>
                </div>
              </div> : null}
            </div>

            <button className="inventory-action inventory-action--soft" onClick={() => { setCreateItemError(""); setOpenCreateItem(true); }}><FiPlus /> Tambah Item</button>

            <button
              className="inventory-action inventory-action--out"
              onClick={async () => {
                try {
                  setErr("");
                  await Promise.all([loadLocations(), loadItems()]);
                  setOpenConsume(true);
                } catch (e) {
                  setErr(String(e?.message || e));
                }
              }}
            >
              <FiArrowUpCircle /> Gunakan Stok
            </button>

            <button
              className="inventory-action inventory-action--in"
              onClick={() => {
                setErr("");
                setReceiveItems(items);
                setOpenReceive(true);
                Promise.all([loadLocations(), api("/inventory/items")])
                  .then(([, data]) => setReceiveItems(data.items || []))
                  .catch((e) => setErr(String(e?.message || e)));
              }}
            >
              <FiArrowDownCircle /> Terima Stok
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="inventory-workspace">
          {/* Tabs + Search */}
          <div className="inventory-toolbar">
            <div className="inventory-tabs">
              <button className={tab === "ITEMS" ? "active" : ""} onClick={() => setTab("ITEMS")}>Daftar Item</button>
              <button className={tab === "UNITS" ? "active" : ""} onClick={() => setTab("UNITS")}>Unit Berseri</button>
              <button className={tab === "MOVEMENTS" ? "active" : ""} onClick={() => setTab("MOVEMENTS")}>Pergerakan</button>
              <button className={tab === "BATCHES" ? "active" : ""} onClick={() => setTab("BATCHES")}>Harga Masuk</button>
              <button className={tab === "EMERGENCY" ? "active" : ""} onClick={() => { setTab("EMERGENCY"); loadEmergencyDispatches(); }}>Pengiriman Darurat</button>
            </div>

            <div className="inventory-search"><FiSearch />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setItemPage(1); setUnitPage(1); }}
                placeholder="Cari berdasarkan nama / SKU / barcode..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") refresh();
                }}
              />
            </div>
          </div>

          {err ? (
            <div style={errorBox}>
              <div style={{ fontWeight: 600, color: BRAND.danger }}>Error</div>
              <div style={{ marginTop: 6, whiteSpace: "pre-wrap", color: BRAND.danger }}>{err}</div>
            </div>
          ) : null}

          <div style={{ marginTop: 16 }}>
            {tab === "ITEMS" ? (
              <>
              <ItemsTable
                items={filteredItems}
                loading={loading}
                onEdit={openEditItem}
                onUse={(itemId) => {
                  const item = items.find((x) => x.id === itemId);
                  if (!item) return;

                  const firstLocWithStock =
                    (item.stocks || []).find((s) => Number(s.qty || 0) > 0)?.locationId || "";
                  setConsumeForm((p) => ({
                    ...p,
                    itemId,
                    locationId: firstLocWithStock || p.locationId || "",
                    qty: 1,
                    note: "",
                  }));
                  setOpenConsume(true);
                }}
              />
              <Pagination pagination={itemPagination} onChange={changeItemPage} />
              </>
            ) : null}

            {tab === "UNITS" ? (
              <>
              <UnitsTable
                units={filteredUnits}
                loading={loading}
                items={serializedItems}
                locations={locations}
                unitStatus={unitStatus}
                setUnitStatus={setUnitStatus}
                unitItemId={unitItemId}
                setUnitItemId={setUnitItemId}
                unitLocationId={unitLocationId}
                setUnitLocationId={setUnitLocationId}
                onAssign={(unit) => {
                  setAssignForm((p) => ({ ...p, unitId: unit.id }));
                  setOpenAssign(true);
                }}
                onBarcode={(unit) => {
                  setBarcodeForm({
                    unitId: unit.id,
                    barcode: unit.barcode || "",
                  });
                  setOpenBarcode(true);
                }}
                onScrap={(unit) => {
                  setScrapForm({ unitId: unit.id, note: "" });
                  setOpenScrap(true);
                }}
                onCompleteRetread={openCompleteRetreadUnit}
                onApplyFilters={loadUnits}
              />
              <Pagination pagination={unitPagination} onChange={changeUnitPage} />
              </>
            ) : null}

            {tab === "MOVEMENTS" ? <MovementsTable movements={filteredMovements} loading={loading} from={mvFrom} to={mvTo} onFromChange={setMvFrom} onToChange={setMvTo} onApply={refresh} /> : null}
            {tab === "BATCHES" ? <BatchesTable batches={batches} loading={loading} /> : null}
            {tab === "EMERGENCY" ? <div className="inventory-emergency"><div className="inventory-emergency-head"><div><h2>Pengiriman Sparepart Darurat</h2><p>Stok keluar saat dikirim dan pemasangan dikonfirmasi saat barang diterima.</p></div><button type="button" onClick={openEmergencyForm}><FiPlus/> Buat Pengiriman</button></div><div className="inventory-emergency-list">{emergencyDispatches.map((dispatch) => <article key={dispatch.id}><span className={dispatch.status.toLowerCase()}>{dispatch.status === "IN_TRANSIT" ? "DALAM PERJALANAN" : "TERPASANG"}</span><h3>{dispatch.item?.name || "Sparepart"} · {dispatch.qty} {dispatch.item?.unit || ""}</h3><p>{dispatch.fromLocation?.name || "Gudang"} → <b>{dispatch.targetTruck?.plateNumber}</b></p><small>Dibawa {dispatch.carrierTruck?.plateNumber || "—"}{dispatch.stockUnit ? ` · Serial ${dispatch.stockUnit.serialNumber || dispatch.stockUnit.barcode}` : ""}</small>{dispatch.status === "IN_TRANSIT" && <button type="button" onClick={() => openInstallDispatch(dispatch)}>Konfirmasi diterima & pasang</button>}</article>)}{!emergencyDispatches.length && <div className="inventory-emergency-empty">Belum ada pengiriman sparepart darurat.</div>}</div></div> : null}
          </div>
        </div>

        {/* MODALS */}
        <Modal open={openEmergency} eyebrow="PENGIRIMAN DARURAT" title="Kirim sparepart ke armada" description="Pilih armada dan barang, lalu sertakan bukti kerusakan sebelum stok dikeluarkan." onClose={() => setOpenEmergency(false)}>
          <form className="inventory-emergency-form redesigned" onSubmit={createEmergencyDispatch}>
            {emergencyPreparing && <div className="emergency-form-loading"><span></span> Menyiapkan data kendaraan dan stok…</div>}
            <section><header><b>01</b><div><strong>Rute pengiriman</strong><small>Tentukan kendaraan penerima dan pembawa barang.</small></div></header><div className="emergency-section-grid">
              <EmergencySearchPicker label="Truk tujuan" placeholder="Cari nomor polisi, merek, atau model..." items={trucks} value={emergencyForm.targetTruckId} onChange={(targetTruckId) => setEmergencyForm((form) => ({ ...form, targetTruckId, carrierTruckId: targetTruckId === form.carrierTruckId ? "" : form.carrierTruckId }))} itemLabel={(truck) => truck.plateNumber} itemMeta={(truck) => [truck.brand, truck.model, truck.currentLocation].filter(Boolean).join(" · ") || "Armada"}/>
              <EmergencySearchPicker label="Truk pembawa" placeholder="Cari armada pembawa..." items={trucks.filter((truck) => truck.id !== emergencyForm.targetTruckId)} value={emergencyForm.carrierTruckId} onChange={(carrierTruckId) => setEmergencyForm((form) => ({ ...form, carrierTruckId }))} itemLabel={(truck) => truck.plateNumber} itemMeta={(truck) => [truck.brand, truck.model, truck.currentLocation].filter(Boolean).join(" · ") || "Armada"}/>
            </div></section>
            <section><header><b>02</b><div><strong>Barang dari Inventory</strong><small>Pilih sparepart dan gudang asal stok.</small></div></header><div className="emergency-section-grid">
              <EmergencySearchPicker label="Sparepart" placeholder="Cari SKU atau nama barang..." items={items} value={emergencyForm.itemId} onChange={(itemId) => { setEmergencyForm((form) => ({ ...form, itemId, stockUnitId: "" })); loadEmergencyUnits(itemId, emergencyForm.fromLocationId); }} itemLabel={(item) => item.name} itemMeta={(item) => `${item.sku} · ${item.isSerialized ? "Berserial" : `${Number(item.qtyTotal || 0).toLocaleString("id-ID")} ${item.unit}`}`} icon={FiBox}/>
              <label>Lokasi stok<select required value={emergencyForm.fromLocationId} onChange={(event) => { const fromLocationId=event.target.value; setEmergencyForm((form) => ({ ...form, fromLocationId, stockUnitId:"" })); loadEmergencyUnits(emergencyForm.itemId, fromLocationId); }}><option value="">Pilih gudang asal</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
              {items.find((item) => item.id === emergencyForm.itemId)?.isSerialized ? <label>Unit serial<select required value={emergencyForm.stockUnitId} onChange={(event) => setEmergencyForm((form) => ({ ...form, stockUnitId:event.target.value, qty:1 }))}><option value="">Pilih serial yang dikirim</option>{emergencyUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.serialNumber || unit.barcode || unit.id}</option>)}</select></label> : <label>Jumlah<input required type="number" min="0.01" step="0.01" value={emergencyForm.qty} onChange={(event) => setEmergencyForm((form) => ({ ...form, qty:event.target.value }))}/></label>}
            </div></section>
            <section><header><b>03</b><div><strong>Bukti dan keterangan</strong><small>Foto atau video kerusakan wajib sebelum barang dikirim.</small></div></header><label className={`emergency-proof-upload ${emergencyProof ? "has-file" : ""}`}><input required type="file" accept="image/*,video/*" onChange={(event) => setEmergencyProof(event.target.files?.[0] || null)}/><FiFileText/><span><strong>{emergencyProof ? emergencyProof.name : "Pilih foto atau video kerusakan"}</strong><small>{emergencyProof ? "Klik untuk mengganti file" : "Ambil dari kamera atau galeri perangkat"}</small></span></label><label className="emergency-note">Catatan tambahan <em>Opsional</em><textarea rows="2" value={emergencyForm.note} onChange={(event) => setEmergencyForm((form) => ({ ...form, note:event.target.value }))} placeholder="Lokasi kendaraan, kondisi barang, atau instruksi penyerahan..."/></label></section>
            <footer><span>Stok berkurang setelah tombol kirim ditekan.</span><button type="button" onClick={() => setOpenEmergency(false)}>Batal</button><button disabled={emergencyPreparing || emergencyBusy || !emergencyForm.targetTruckId || !emergencyForm.carrierTruckId || !emergencyForm.itemId}>{emergencyBusy ? "Mengirim…" : emergencyPreparing ? "Menyiapkan data…" : "Keluarkan stok & kirim"}</button></footer>
          </form>
        </Modal>
        <Modal open={Boolean(installDispatch)} eyebrow="KONFIRMASI PEMASANGAN" title="Barang diterima dan dipasang" description={installDispatch ? `${installDispatch.item?.name} untuk ${installDispatch.targetTruck?.plateNumber}` : ""} onClose={() => setInstallDispatch(null)}><form className="inventory-emergency-form" onSubmit={confirmEmergencyInstall}><label className="wide">Sparepart lama yang diganti (opsional)<select value={installForm.oldStockUnitId} onChange={(e) => setInstallForm((f) => ({ ...f, oldStockUnitId:e.target.value }))}><option value="">Tidak mengganti unit berserial</option>{oldAssignments.map((assignment) => <option key={assignment.stockUnitId || assignment.id} value={assignment.stockUnitId}>{assignment.stockUnit?.item?.name} · {assignment.stockUnit?.serialNumber || assignment.stockUnit?.barcode}</option>)}</select></label>{installForm.oldStockUnitId && <label className="wide">Tindakan unit lama<select value={installForm.oldPartDisposition} onChange={(e) => setInstallForm((f) => ({ ...f, oldPartDisposition:e.target.value }))}><option value="SCRAPPED">Rusak / Scrap</option><option value="REPAIRING">Kirim untuk perbaikan</option><option value="LOST">Hilang / tidak kembali</option></select></label>}<label className="wide">Bukti pemasangan (foto/video)<input required type="file" accept="image/*,video/*" onChange={(e) => setInstallProof(e.target.files?.[0] || null)}/></label><label className="wide">Catatan pemasangan<input value={installForm.note} onChange={(e) => setInstallForm((f) => ({ ...f, note:e.target.value }))}/></label><footer><button type="button" onClick={() => setInstallDispatch(null)}>Batal</button><button disabled={emergencyBusy}>{emergencyBusy ? "Menyimpan…" : "Konfirmasi terpasang"}</button></footer></form></Modal>
        <Modal open={openBarcode} title="Set / Edit Unit Barcode" onClose={() => setOpenBarcode(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <div>
              <Pill variant="green">Unit ID: {barcodeForm.unitId || "-"}</Pill>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Barcode</div>
              <input
                style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                value={barcodeForm.barcode}
                onChange={(e) => setBarcodeForm((p) => ({ ...p, barcode: e.target.value }))}
                placeholder="Pindai / ketik barcode..."
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <Btn style={btn} onClick={() => setOpenBarcode(false)}>
              Cancel
            </Btn>
            <Btn style={btnPrimary} onClick={updateBarcode}>
              Save
            </Btn>
          </div>
        </Modal>

        <Modal open={openScrap} title="Scrap / Retire Unit" onClose={() => setOpenScrap(false)}>
          <div style={{ display: "grid", gap: 12 }}>
            <Pill variant="red">Unit ID: {scrapForm.unitId || "-"}</Pill>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Reason / Note</div>
              <input
                style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                value={scrapForm.note}
                onChange={(e) => setScrapForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="e.g. Broken, punctured, unsafe to use"
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn style={btn} onClick={() => setOpenScrap(false)}>
                Cancel
              </Btn>
              <Btn style={btnDanger} onClick={scrapUnit}>
                Scrap
              </Btn>
            </div>
          </div>
        </Modal>

        <Modal open={openRetread} title="Kirim Ban untuk Dimasak" onClose={() => setOpenRetread(false)}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ padding: 12, borderRadius: 8, background: BRAND.secondary }}>
              <div style={{ fontSize: 12, color: BRAND.textMuted }}>Nomor seri tetap digunakan</div>
              <div style={{ marginTop: 3, fontWeight: 700 }}>{retreadForm.serialNumber || retreadForm.unitId}</div>
            </div>
            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
              Item tujuan (Ban Masak)
              <select style={{ ...selectPill, width: "100%" }} value={retreadForm.toItemId} onChange={(e) => setRetreadForm((p) => ({ ...p, toItemId: e.target.value }))}>
                <option value="">Pilih item Ban Masak</option>
                {retreadOptions.items.map((item) => <option key={item.id} value={item.id}>{item.sku} — {item.name}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
              Vendor masak ban
              <select style={{ ...selectPill, width: "100%" }} value={retreadForm.supplierId} onChange={(e) => setRetreadForm((p) => ({ ...p, supplierId: e.target.value }))}>
                <option value="">Tanpa vendor</option>
                {retreadOptions.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
                Biaya masak (Rp)
                <input type="number" min="0" style={{ ...inputPill, minWidth: 0 }} value={retreadForm.cost} onChange={(e) => setRetreadForm((p) => ({ ...p, cost: e.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
                Tanggal dikirim
                <input type="datetime-local" style={{ ...inputPill, minWidth: 0 }} value={retreadForm.sentAt} onChange={(e) => setRetreadForm((p) => ({ ...p, sentAt: e.target.value }))} />
              </label>
            </div>
            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
              Catatan
              <input style={{ ...inputPill, minWidth: 0 }} value={retreadForm.notes} onChange={(e) => setRetreadForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Kondisi ban atau pekerjaan vendor" />
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}><Btn style={btn} onClick={() => setOpenRetread(false)}>Batal</Btn><Btn style={btnPrimary} onClick={sendToRetread}>Kirim ke Vendor</Btn></div>
          </div>
        </Modal>

        <Modal open={openCompleteRetread} title="Terima Ban Selesai Dimasak" onClose={() => setOpenCompleteRetread(false)}>
          <div style={{ display: "grid", gap: 14 }}>
            <Pill variant="green">Serial: {completeRetreadForm.serialNumber || completeRetreadForm.unitId}</Pill>
            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
              Lokasi penerimaan
              <select style={{ ...selectPill, width: "100%" }} value={completeRetreadForm.locationId} onChange={(e) => setCompleteRetreadForm((p) => ({ ...p, locationId: e.target.value }))}>
                <option value="">Pilih lokasi</option>
                {retreadOptions.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
              Tanggal selesai
              <input type="datetime-local" style={{ ...inputPill, minWidth: 0 }} value={completeRetreadForm.completedAt} onChange={(e) => setCompleteRetreadForm((p) => ({ ...p, completedAt: e.target.value }))} />
            </label>
            <div style={{ padding: 12, borderRadius: 8, background: BRAND.secondary, color: BRAND.textMuted, fontSize: 13 }}>Setelah diterima, unit yang sama masuk stok sebagai item Ban Masak. Nomor seri dan riwayat lama tidak berubah.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}><Btn style={btn} onClick={() => setOpenCompleteRetread(false)}>Batal</Btn><Btn style={btnPrimary} onClick={completeRetread}>Terima Ban</Btn></div>
          </div>
        </Modal>

        <Modal open={openCreateItem} eyebrow="MASTER BARANG" title="Tambah item baru" description="Buat identitas barang agar stok dapat diterima dan dilacak." onClose={() => setOpenCreateItem(false)}>
          {createItemError ? (
            <div style={{ ...errorBox, marginBottom: 14 }}>
              <div style={{ fontWeight: 600, color: BRAND.danger }}>Tidak dapat membuat item</div>
              <div style={{ marginTop: 6, color: BRAND.danger }}>{createItemError}</div>
            </div>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>SKU</div>
              <input
                style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                value={createItemForm.sku}
                onChange={(e) => setCreateItemForm((p) => ({ ...p, sku: e.target.value }))}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Unit</div>
              <input
                style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                value={createItemForm.unit}
                onChange={(e) => setCreateItemForm((p) => ({ ...p, unit: e.target.value }))}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Nama</div>
              <input
                style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                value={createItemForm.name}
                onChange={(e) => setCreateItemForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1", color: BRAND.text, fontWeight: 500 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>Kategori barang</span>
              <select
                style={{ ...selectPill, width: "100%" }}
                value={createItemForm.category}
                onChange={(e) => setCreateItemForm((p) => ({ ...p, category: e.target.value, isSerialized: e.target.value === "TIRE" ? true : e.target.value === "OIL" ? false : p.isSerialized }))}
              >
                <option value="GENERAL_SPAREPART">Sparepart Umum</option>
                <option value="TIRE">Ban</option>
                <option value="BATTERY">Aki/Baterai</option>
                <option value="OIL">Oli</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, gridColumn: "1 / -1", color: BRAND.text, fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={createItemForm.isSerialized}
                onChange={(e) => setCreateItemForm((p) => ({ ...p, isSerialized: e.target.checked }))}
                disabled={createItemForm.category === "TIRE" || createItemForm.category === "OIL"}
              />
              Gunakan nomor seri untuk setiap unit
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <Btn style={btn} onClick={() => setOpenCreateItem(false)}>
              Batal
            </Btn>
            <Btn style={btnPrimary} onClick={createItem}>
              Simpan Item
            </Btn>
          </div>
        </Modal>

        <Modal open={Boolean(editItemForm)} title="Edit Barang" onClose={() => setEditItemForm(null)}>
          {editItemForm ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>SKU</div>
                  <input style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }} value={editItemForm.sku} onChange={(e) => setEditItemForm((p) => ({ ...p, sku: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Satuan</div>
                  <input style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }} value={editItemForm.unit} onChange={(e) => setEditItemForm((p) => ({ ...p, unit: e.target.value }))} placeholder="PCS / SET / LITER" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Nama barang</div>
                  <input
                    style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box", background: isSparepartAdmin ? "#F3F4F6" : undefined }}
                    value={editItemForm.name}
                    onChange={(e) => setEditItemForm((p) => ({ ...p, name: e.target.value }))}
                    disabled={isSparepartAdmin}
                  />
                  {isSparepartAdmin && <div style={{ marginTop: 6, fontSize: 12, color: BRAND.textMuted }}>Nama barang hanya dapat diubah oleh Owner, Admin, atau Staf.</div>}
                </div>
                <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1", color: BRAND.text, fontWeight: 500 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>Kategori barang</span>
                  <select
                    style={{ ...selectPill, width: "100%" }}
                    value={editItemForm.category}
                    onChange={(e) => setEditItemForm((p) => ({ ...p, category: e.target.value, isSerialized: e.target.value === "TIRE" ? true : e.target.value === "OIL" ? false : p.isSerialized }))}
                  >
                    <option value="GENERAL_SPAREPART">Sparepart Umum</option>
                    <option value="TIRE">Ban</option>
                    <option value="BATTERY">Aki/Baterai</option>
                    <option value="OIL">Oli</option>
                    <option value="OTHER">Lainnya</option>
                  </select>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, gridColumn: "1 / -1", color: BRAND.text, fontWeight: 500 }}>
                  <input type="checkbox" checked={editItemForm.isSerialized} disabled={editItemForm.category === "TIRE" || editItemForm.category === "OIL"} onChange={(e) => setEditItemForm((p) => ({ ...p, isSerialized: e.target.checked }))} />
                  Serialized — setiap unit memiliki nomor seri
                </label>
              </div>
              {editItemForm.isSerialized !== editItemForm.originalSerialized && (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 7, background: BRAND.warningLight, color: "#92400E", fontSize: 12, lineHeight: 1.5 }}>
                  Perubahan tipe serialized hanya diperbolehkan jika barang belum memiliki stok atau riwayat pergerakan.
                </div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
                <Btn style={btn} onClick={() => setEditItemForm(null)}>Batal</Btn>
                <Btn style={btnPrimary} onClick={updateItem}>Simpan Perubahan</Btn>
              </div>
            </>
          ) : null}
        </Modal>

        <Modal open={openReceive} eyebrow="STOK MASUK" title="Terima stok" description="Catat barang yang masuk, lokasi penyimpanan, jumlah, dan nilai pembelian." onClose={() => setOpenReceive(false)}>
          {locations.length === 0 ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, color: BRAND.text }}>Lokasi tidak ditemukan</div>
              <div style={{ marginTop: 6, color: BRAND.textMuted }}>
                Buat minimal satu lokasi gudang sebelum menerima stok.
              </div>
              <div style={{ marginTop: 12 }}>
                <Btn style={btnPrimary} onClick={() => setOpenCreateLocation(true)}>
                  + Tambah Lokasi
                </Btn>
              </div>
              <div style={{ marginTop: 12, height: 1, background: BRAND.border }} />
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div className="inventory-receive-field-head">Barang</div>
              <ItemSearchSelect
                items={receiveItems}
                value={receiveForm.itemId}
                onChange={(itemId) => {
                  setReceiveForm((p) => itemId === p.itemId ? p : ({ ...p, itemId, qty: 1, unitPurchasePrice: "", totalPurchasePrice: "", unitLines: "" }));
                  if (itemId !== receiveForm.itemId) setReceiveUnitRows([{ serialNumber: "", purchasePrice: "" }]);
                }}
              />
            </div>

            <div>
              <div className="inventory-receive-field-head">
                Lokasi penyimpanan{" "}
                {locations.length > 0 ? (
                  <Btn
                    style={{ ...btn, height: 28, padding: "0 10px", marginLeft: 8, fontSize: 12 }}
                    type="button"
                    onClick={() => setOpenCreateLocation(true)}
                  >
                    + Baru
                  </Btn>
                ) : null}
              </div>
              <select
                style={{ ...selectPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                value={receiveForm.locationId}
                onChange={(e) => setReceiveForm((p) => ({ ...p, locationId: e.target.value }))}
                disabled={locations.length === 0}
              >
                {locations.length === 0 ? (
                  <option value="">Belum ada lokasi</option>
                ) : (
                  <>
                    <option value="">Pilih lokasi...</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Catatan</div>
              <input
                style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                value={receiveForm.note}
                onChange={(e) => setReceiveForm((p) => ({ ...p, note: e.target.value }))}
              />
            </div>

            {selectedReceiveItem?.isSerialized && <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Jumlah</div>
              <input
                style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                type="number"
                step={selectedReceiveItem?.isSerialized ? "1" : "0.01"}
                min={selectedReceiveItem?.isSerialized ? "1" : "0.01"}
                value={receiveForm.qty}
                onChange={(e) => {
                  const value = e.target.value;
                  setReceiveForm((p) => ({ ...p, qty: value }));
                  if (selectedReceiveItem?.isSerialized && value !== "") {
                    const wanted = Math.max(1, Math.min(500, Math.floor(Number(value) || 1)));
                    setReceiveUnitRows((rows) => Array.from({ length: wanted }, (_, index) => rows[index] || { serialNumber: "", purchasePrice: "" }));
                  }
                }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: BRAND.textMuted }}>
                Untuk barang berseri, jumlah mengikuti daftar nomor seri di bawah.
              </div>
            </div>}

            {(() => {
              const item = receiveItems.find((x) => x.id === receiveForm.itemId) || items.find((x) => x.id === receiveForm.itemId);
              if (!item?.isSerialized) return null;

              return (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>
                    Total harga pembelian (Rp) — opsional
                  </div>
                  <input
                    style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                    type="number"
                    value={receiveForm.totalPurchasePrice || ""}
                    disabled={Boolean(item.isSerialized && receiveUnitRows.some((row) => Number(row.purchasePrice) > 0))}
                    onChange={(e) => setReceiveForm((p) => ({ ...p, totalPurchasePrice: e.target.value }))}
                    placeholder="e.g. 20000000"
                  />
                  <div style={{ marginTop: 6, fontSize: 12, color: BRAND.textMuted }}>
                    {item.isSerialized
                      ? "Gunakan harga per unit pada daftar atau total harga ini—pilih salah satu."
                      : `Harga per ${item.unit || "unit"} dihitung otomatis dari total harga ÷ jumlah.`}
                  </div>
                </div>
              );
            })()}

            {selectedReceiveItem && !selectedReceiveItem.isSerialized ? <div className="inventory-serial-editor inventory-nonserial-editor" style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>Rincian stok non-serialized</div>
              <div className="inventory-serial-help">Masukkan jumlah dan harga satuan. Sistem menghitung total pembelian secara otomatis.</div>
              <div className="inventory-nonserial-table">
                <div className="inventory-nonserial-head"><span>No.</span><span>Jumlah</span><span>Harga/unit (Rp)</span><span>Total (Rp)</span></div>
                <div className="inventory-nonserial-row"><b>1</b><label><input type="number" min="0.01" step="0.01" value={receiveForm.qty} onChange={(e) => setReceiveForm((form) => ({ ...form, qty: e.target.value }))}/><small>{selectedReceiveItem.unit || "unit"}</small></label><input type="number" min="1" value={receiveForm.unitPurchasePrice} onChange={(e) => setReceiveForm((form) => ({ ...form, unitPurchasePrice: e.target.value }))} placeholder="Contoh: 200000"/><strong>{Number(receiveForm.qty) > 0 && Number(receiveForm.unitPurchasePrice) > 0 ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(receiveForm.qty) * Number(receiveForm.unitPurchasePrice)) : "—"}</strong></div>
              </div>
            </div> : null}

            {(() => {
              const item = receiveItems.find((x) => x.id === receiveForm.itemId) || items.find((x) => x.id === receiveForm.itemId);
              if (!item?.isSerialized) return null;
              return <div className="inventory-serial-editor" style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
                Daftar unit berseri (wajib)
              </div>
              <div className="inventory-serial-help">Masukkan satu unit pada setiap baris. Nomor seri diperiksa agar tidak kosong atau duplikat.</div>
              <div className="inventory-serial-table"><div className="inventory-serial-head"><span>No.</span><span>Nomor seri</span><span>Harga/unit (Rp)</span><span/></div>{receiveUnitRows.map((row, index) => <div className="inventory-serial-row" key={index}><b>{index + 1}</b><input value={row.serialNumber} onChange={(e) => setReceiveUnitRows((rows) => rows.map((current, rowIndex) => rowIndex === index ? { ...current, serialNumber: e.target.value } : current))} placeholder="Contoh: SN001"/><input type="number" min="1" value={row.purchasePrice} disabled={String(receiveForm.totalPurchasePrice || "").trim() !== ""} onChange={(e) => setReceiveUnitRows((rows) => rows.map((current, rowIndex) => rowIndex === index ? { ...current, purchasePrice: e.target.value } : current))} placeholder={receiveForm.totalPurchasePrice ? "Pakai total harga" : "Contoh: 2000000"}/><button type="button" aria-label={`Hapus baris ${index + 1}`} disabled={receiveUnitRows.length === 1} onClick={() => { setReceiveUnitRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index)); setReceiveForm((form) => ({ ...form, qty: Math.max(1, receiveUnitRows.length - 1) })); }}><FiX/></button></div>)}</div>
              <button type="button" className="inventory-add-serial" onClick={() => { setReceiveUnitRows((rows) => [...rows, { serialNumber: "", purchasePrice: "" }]); setReceiveForm((form) => ({ ...form, qty: receiveUnitRows.length + 1 })); }}><FiPlus/> Tambah unit</button>
            </div>})()}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <Btn style={btn} onClick={() => setOpenReceive(false)}>
              Batal
            </Btn>
            <Btn style={btnPrimary} onClick={receiveStock} disabled={locations.length === 0}>
              Simpan Stok Masuk
            </Btn>
          </div>
        </Modal>

        <Modal open={openConsume} eyebrow="STOK KELUAR" title="Gunakan stok" description="Pilih barang dan lokasi asal untuk mencatat pemakaian stok." tone="red" onClose={() => setOpenConsume(false)}>
          {locations.length === 0 ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, color: BRAND.text }}>Lokasi tidak ditemukan</div>
              <div style={{ marginTop: 6, color: BRAND.textMuted }}>
                Buat minimal satu lokasi gudang sebelum menggunakan stok.
              </div>
              <div style={{ marginTop: 12 }}>
                <Btn style={btnPrimary} onClick={() => setOpenCreateLocation(true)}>
                  + Tambah Lokasi
                </Btn>
              </div>
              <div style={{ marginTop: 12, height: 1, background: BRAND.border }} />
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Barang tanpa nomor seri</div>
              <select
                style={{ ...selectPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                value={consumeForm.itemId}
                onChange={(e) => {
                  const nextItemId = e.target.value;
                  const item = items.find((x) => x.id === nextItemId);
                  const firstLocWithStock = (item?.stocks || []).find((s) => Number(s.qty || 0) > 0)?.locationId || "";
                  setConsumeForm((p) => ({
                    ...p,
                    itemId: nextItemId,
                    locationId: firstLocWithStock || p.locationId || "",
                  }));
                }}
              >
                <option value="">Pilih barang...</option>
                {nonSerializedItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.sku} — {it.name} ({it.unit || "UNIT"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>
                Lokasi asal{" "}
                <Btn
                  style={{ ...btn, height: 28, padding: "0 10px", marginLeft: 8, fontSize: 12 }}
                  type="button"
                  onClick={() => setOpenCreateLocation(true)}
                >
                  + Baru
                </Btn>
              </div>
              <select
                style={{ ...selectPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                value={consumeForm.locationId}
                onChange={(e) => setConsumeForm((p) => ({ ...p, locationId: e.target.value }))}
                disabled={locations.length === 0}
              >
                <option value="">Pilih lokasi...</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Jumlah yang digunakan</div>
              <input
                style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                type="number"
                step="0.01"
                value={consumeForm.qty}
                onChange={(e) => setConsumeForm((p) => ({ ...p, qty: e.target.value }))}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Catatan</div>
              <input
                style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                value={consumeForm.note}
                onChange={(e) => setConsumeForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Alasan (opsional)"
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <Btn style={btn} onClick={() => setOpenConsume(false)}>
              Batal
            </Btn>
            <Btn style={btnPrimary} onClick={consumeStock} disabled={locations.length === 0}>
              Simpan Stok Keluar
            </Btn>
          </div>
        </Modal>

        <Modal open={openCreateLocation} title="Create Location" onClose={() => setOpenCreateLocation(false)}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Location Name</div>
            <input
              style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              placeholder="e.g. Main Warehouse"
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn style={btn} onClick={() => setOpenCreateLocation(false)}>
              Cancel
            </Btn>
            <Btn style={btnPrimary} onClick={createLocation}>
              Create
            </Btn>
          </div>
        </Modal>

        <Modal open={openAssign} title="Assign Unit to Truck" onClose={() => setOpenAssign(false)}>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <Pill variant="green">Unit ID: {assignForm.unitId || "-"}</Pill>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Select Truck</div>
              <TruckSearchSelect
                trucks={trucks}
                value={assignForm.truckId}
                onChange={(val) => setAssignForm((p) => ({ ...p, truckId: val }))}
                placeholder="Cari nomor polisi..."
              />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Tanggal Pemasangan</div>
              <input
                style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                value={assignForm.installedAt}
                onChange={(e) => setAssignForm((p) => ({ ...p, installedAt: e.target.value }))}
                placeholder="e.g. Front Left Tire"
              />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Catatan</div>
              <input
                style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                value={assignForm.note}
                onChange={(e) => setAssignForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Catatan (opsional)"
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn style={btn} onClick={() => setOpenAssign(false)}>
                Cancel
              </Btn>
              <Btn style={btnPrimary} onClick={assignUnit}>
                Assign
              </Btn>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

//////////////////////
// TABLE COMPONENTS
//////////////////////
function BatchesTable({ batches, loading }) {
  if (loading) return <LoadingState compact label="Memuat harga masuk" note="Menelusuri batch, harga, dan sisa persediaan…" rows={4} />;
  if (!batches.length) return <div style={{ padding: 20, color: BRAND.textMuted }}>Belum ada batch stok yang tercatat.</div>;
  return (
    <div style={tableWrap}>
      <table style={{ ...table, minWidth: 1320 }}>
        <thead><tr>
          <th style={th}>Barang</th><th style={th}>Jenis</th><th style={th}>Supplier</th><th style={th}>PO / GR</th>
          <th style={th}>Tanggal Beli</th><th style={th}>Lokasi Terima</th><th style={th}>Diterima</th>
          <th style={th}>Terpakai</th><th style={th}>Tersisa</th><th style={th}>Harga/Unit</th><th style={th}>Total Masuk</th>
        </tr></thead>
        <tbody>{batches.map((batch) => {
          const po = batch.purchaseOrderItem?.purchaseOrder;
          const receivedQty = Number(batch.receivedQty || 0);
          const remainingQty = Number(batch.remainingQty ?? batch.receivedQty ?? 0);
          const usedQty = Math.max(0, receivedQty - remainingQty);
          const totalValue = batch.unitPrice == null ? null : Math.round(receivedQty * Number(batch.unitPrice));
          return <tr key={batch.id}>
            <td style={td}><div>{batch.item?.name || "-"}</div><div style={{ fontSize: 12, color: BRAND.textMuted }}>{batch.item?.sku || "-"}</div></td>
            <td style={tdSoft}><Pill variant={batch.item?.isSerialized ? "green" : "grey"}>{batch.item?.isSerialized ? "Ban berserial" : "Stok jumlah"}</Pill></td>
            <td style={td}>{po?.supplier?.name || <span style={{ color: BRAND.textMuted }}>Tidak tercatat</span>}</td>
            <td style={td}><div>{po?.number || "Manual"}</div><div style={{ fontSize: 12, color: BRAND.textMuted }}>{batch.goodsReceipt?.number || "Tanpa GR"}</div></td>
            <td style={tdSoft}>{fmtDate(batch.receivedAt)}</td>
            <td style={tdSoft}>{batch.location?.name || "-"}</td>
            <td style={td}>{receivedQty} {batch.item?.unit || ""}</td>
            <td style={tdSoft}>{usedQty} {batch.item?.unit || ""}</td>
            <td style={td}>{batch.remainingQty == null ? <Pill>Belum diketahui</Pill> : <Pill variant={Number(batch.remainingQty) > 0 ? "green" : "grey"}>{batch.remainingQty} {batch.item?.unit || ""}</Pill>}</td>
            <td style={tdSoft}>{batch.unitPrice == null ? "-" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(batch.unitPrice)}</td>
            <td style={{ ...td, fontWeight: 700 }}>{totalValue == null ? "-" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(totalValue)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

function Pagination({ pagination, onChange }) {
  const { page = 1, totalPages = 1, total = 0, limit = 20 } = pagination || {};
  if (totalPages <= 1) return total ? <div style={{ marginTop: 12, color: BRAND.textMuted, fontSize: 12 }}>{total} data</div> : null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
    <div style={{ color: BRAND.textMuted, fontSize: 12 }}>Menampilkan {from}–{to} dari {total} data</div>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <Btn style={{ ...btn, height: 32, padding: "0 12px", opacity: page <= 1 ? 0.5 : 1 }} disabled={page <= 1} onClick={() => onChange(page - 1)}>← Sebelumnya</Btn>
      <span style={{ color: BRAND.textMuted, fontSize: 12 }}>Halaman {page} / {totalPages}</span>
      <Btn style={{ ...btn, height: 32, padding: "0 12px", opacity: page >= totalPages ? 0.5 : 1 }} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Berikutnya →</Btn>
    </div>
  </div>;
}

function ItemsTable({ items, loading, onUse, onEdit }) {
  if (loading) {
    return <LoadingState compact label="Memuat detail barang" note="Mengambil stok, unit, dan riwayat pergerakan…" rows={5} />;
  }

  if (items.length === 0) {
    return <div style={{ padding: 20, color: BRAND.textMuted }}>Barang tidak ditemukan.</div>;
  }

  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>SKU</th>
            <th style={th}>Nama</th>
            <th style={th}>Unit</th>
            <th style={th}>Kategori</th>
            <th style={th}>Serialized</th>
            <th style={th}>Total Stok</th>
            <th style={th}>Tindakan</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td style={td}>{it.sku || "-"}</td>
              <td style={td}>{it.name || "-"}</td>
              <td style={tdSoft}>{it.unit || "-"}</td>
              <td style={tdSoft}>{({ GENERAL_SPAREPART: "Sparepart Umum", TIRE: "Ban", BATTERY: "Aki/Baterai", OIL: "Oli", OTHER: "Lainnya" })[it.category] || "Sparepart Umum"}</td>
              <td style={tdSoft}>{it.isSerialized ? "Yes" : "No"}</td>
              <td style={td}>{sumStocks(it.stocks)}</td>
              <td style={td}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <Btn style={{ ...btn, height: 32, padding: "0 12px", fontSize: 12 }} onClick={() => onEdit(it)}>
                    Edit
                  </Btn>
                {!it.isSerialized ? (
                  <Btn
                    style={{ ...btn, height: 32, padding: "0 12px", fontSize: 12 }}
                    onClick={() => onUse(it.id)}
                  >
                    Use
                  </Btn>
                ) : (
                  null
                )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UnitsTable({
  units,
  loading,
  items,
  locations,
  unitStatus,
  setUnitStatus,
  unitItemId,
  setUnitItemId,
  unitLocationId,
  setUnitLocationId,
  onAssign,
  onBarcode,
  onScrap,
  onCompleteRetread,
  onApplyFilters,
}) {
  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <select
          style={{ ...selectPill, minWidth: 140 }}
          value={unitStatus}
          onChange={(e) => setUnitStatus(e.target.value)}
        >
          <option value="">Semua Status</option>
          <option value="IN_STOCK">IN_STOCK</option>
          <option value="ASSIGNED">ASSIGNED</option>
          <option value="RETREADING">RETREADING</option>
          <option value="SCRAPPED">SCRAPPED</option>
        </select>

        <ItemSearchSelect items={items} value={unitItemId} onChange={setUnitItemId} />

        <select
          style={{ ...selectPill, minWidth: 160 }}
          value={unitLocationId}
          onChange={(e) => setUnitLocationId(e.target.value)}
        >
          <option value="">All Locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <Btn style={btn} onClick={onApplyFilters}>
          Apply
        </Btn>
      </div>

      {loading ? (
        <LoadingState compact label="Memuat unit stok" note="Mengambil serial dan status pemasangan…" rows={5} />
      ) : units.length === 0 ? (
        <div style={{ padding: 20, color: BRAND.textMuted }}>Unit tidak ditemukan.</div>
      ) : (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Serial</th>
                <th style={th}>Barang</th>
                <th style={th}>Barcode</th>
                <th style={th}>Status</th>
                <th style={th}>Location</th>
                <th style={th}>Asal Pembelian</th>
                <th style={th}>Kendaraan</th>
                <th style={th}>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const currentAssign = (u.assignments || [])[0];
                const truck = currentAssign?.truck;
                const originPo = u.inventoryBatch?.purchaseOrderItem?.purchaseOrder;
                const latestRetread = (u.tireRetreads || [])[0];
                return (
                  <tr key={u.id}>
                    <td style={td}>{u.serialNumber || "-"}</td>
                    <td style={td}>{u.item?.sku || "-"} — {u.item?.name || ""}</td>
                    <td style={tdSoft}>{u.barcode || "-"}</td>
                    <td style={td}>
                      <Pill variant={u.status === "IN_STOCK" ? "green" : u.status === "SCRAPPED" ? "red" : u.status === "RETREADING" ? "yellow" : "grey"}>
                        {u.status || "-"}
                      </Pill>
                    </td>
                    <td style={tdSoft}>{u.location?.name || "-"}</td>
                    <td style={tdSoft}>
                      <div>{originPo?.supplier?.name || "Tidak tercatat"}</div>
                      <div style={{ fontSize: 12 }}>{originPo?.number || "-"}{u.inventoryBatch?.goodsReceipt?.number ? ` / ${u.inventoryBatch.goodsReceipt.number}` : ""}</div>
                      {u.retreadCount > 0 || latestRetread ? <div style={{ fontSize: 12, marginTop: 4, color: BRAND.primary }}>Masak {u.retreadCount || 0}×{latestRetread?.supplier?.name ? ` · ${latestRetread.supplier.name}` : ""}</div> : null}
                    </td>
                    <td style={tdSoft}>{truck?.plateNumber || "-"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {u.status === "IN_STOCK" ? (
                          <Btn
                            style={{ ...btn, height: 28, padding: "0 10px", fontSize: 11 }}
                            onClick={() => onAssign(u)}
                          >
                            Assign
                          </Btn>
                        ) : null}
                        {u.status === "RETREADING" ? (
                          <Btn style={{ ...btnPrimary, height: 28, padding: "0 10px", fontSize: 11 }} onClick={() => onCompleteRetread(u)}>
                            Selesai Masak
                          </Btn>
                        ) : null}
                        <Btn
                          style={{ ...btn, height: 28, padding: "0 10px", fontSize: 11 }}
                          onClick={() => onBarcode(u)}
                        >
                          Barcode
                        </Btn>
                        {u.status !== "SCRAPPED" && u.status !== "RETREADING" ? (
                          <Btn
                            style={{ ...btnDanger, height: 28, padding: "0 10px", fontSize: 11 }}
                            onClick={() => onScrap(u)}
                          >
                            {u.status === "ASSIGNED" ? "Lepas & Scrap" : "Scrap"}
                          </Btn>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MovementsTable({ movements, loading, from, to, onFromChange, onToChange, onApply }) {
  const filters = (
    <div className="inventory-movement-filters" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, alignItems: "end" }}>
      <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
        Dari tanggal
        <span className={`date-placeholder-wrap ${from ? "has-value" : ""}`} data-placeholder="Pilih tanggal awal"><input className="tablet-date-input" aria-label="Tanggal awal pergerakan" type="date" value={from} onChange={(e) => onFromChange(e.target.value)} style={{ ...inputPill, minWidth: 180 }} /></span>
      </label>
      <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
        Sampai tanggal
        <span className={`date-placeholder-wrap ${to ? "has-value" : ""}`} data-placeholder="Pilih tanggal akhir"><input className="tablet-date-input" aria-label="Tanggal akhir pergerakan" type="date" value={to} onChange={(e) => onToChange(e.target.value)} style={{ ...inputPill, minWidth: 180 }} /></span>
      </label>
      <Btn style={btn} onClick={onApply}>Terapkan</Btn>
      {(from || to) && <Btn style={btn} onClick={() => { onFromChange(""); onToChange(""); setTimeout(onApply, 0); }}>Reset</Btn>}
    </div>
  );

  if (loading) {
    return <>{filters}<LoadingState compact label="Memuat mutasi stok" note="Menelusuri penerimaan dan penggunaan barang…" rows={5} /></>;
  }

  if (movements.length === 0) {
    return <>{filters}<div style={{ padding: 20, color: BRAND.textMuted }}>Mutasi stok tidak ditemukan.</div></>;
  }

  return (
    <>
      {filters}
      <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Jenis</th>
            <th style={th}>Barang</th>
            <th style={th}>Jumlah</th>
            <th style={th}>Dari</th>
            <th style={th}>Ke</th>
            <th style={th}>Catatan</th>
            <th style={th}>Tanggal</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id}>
              <td style={td}>
                <Pill variant={m.type === "IN" ? "green" : m.type === "OUT" ? "red" : "grey"}>
                  {m.type || "-"}
                </Pill>
              </td>
              <td style={td}>{m.item?.sku || "-"} — {m.item?.name || ""}</td>
              <td style={td}>{m.qty ?? "-"}</td>
              <td style={tdSoft}>{m.fromLocation?.name || "-"}</td>
              <td style={tdSoft}>{m.toLocation?.name || "-"}</td>
              <td style={tdSoft}>{m.note || "-"}</td>
              <td style={tdSoft}>{fmtDate(m.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
