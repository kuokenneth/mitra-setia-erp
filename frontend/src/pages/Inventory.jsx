// src/pages/Inventory.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";

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

const innerCard = {
  background: BRAND.white,
  borderRadius: 8,
  border: `1px solid ${BRAND.border}`,
  overflow: "hidden",
};

const controlRow = {
  display: "flex",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "space-between",
};

const leftControls = { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" };
const rightControls = { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" };

function TruckSearchSelect({ trucks, value, onChange, placeholder = "Cari nomor polisi..." }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => {
    return (trucks || []).find((t) => t.id === value) || null;
  }, [trucks, value]);

  useEffect(() => {
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
    if (selected) setQuery(`${selected.sku || ""} — ${selected.name || ""}`);
    if (!selected && !value) setQuery("");
  }, [selected, value]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const list = items || [];
    if (!keyword) return list.slice(0, 30);
    return list.filter((item) => `${item.sku || ""} ${item.name || ""} ${item.unit || ""}`.toLowerCase().includes(keyword)).slice(0, 50);
  }, [items, query]);

  return (
    <div style={{ position: "relative", minWidth: 280, flex: "1 1 280px" }}>
      <input
        style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
        value={query}
        placeholder="Cari SKU atau nama item..."
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (value) onChange(""); }}
        onFocus={() => setOpen(true)}
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

const tabBtn = (active) => ({
  ...btn,
  height: 38,
  padding: "0 14px",
  background: active ? BRAND.primary : BRAND.white,
  border: active ? `1px solid ${BRAND.primary}` : `1px solid ${BRAND.border}`,
  color: active ? BRAND.white : BRAND.text,
  fontWeight: 500,
});

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

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, 100%)",
          background: BRAND.white,
          borderRadius: 8,
          border: `1px solid ${BRAND.border}`,
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: `1px solid ${BRAND.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, color: BRAND.text }}>{title}</div>
          <Btn style={btn} onClick={onClose}>
            Close
          </Btn>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
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

function parseUnitLines(text) {
  const lines = String(text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const [serialNumber, purchasePrice] = line
      .split(",")
      .map((s) => (s ? s.trim() : ""));

    return {
      serialNumber: serialNumber || undefined,
      purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
    };
  });
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
  const [locations, setLocations] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [units, setUnits] = useState([]);
  const [movements, setMovements] = useState([]);
  const [itemPage, setItemPage] = useState(1);
  const [unitPage, setUnitPage] = useState(1);
  const [itemPagination, setItemPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [unitPagination, setUnitPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

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

  const [createItemForm, setCreateItemForm] = useState({
    sku: "",
    name: "",
    unit: "PCS",
    isSerialized: false,
  });

  const [receiveForm, setReceiveForm] = useState({
    itemId: "",
    locationId: "",
    qty: 1,
    note: "",
    unitLines: "",
    totalPurchasePrice: "",
  });

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

  async function refresh() {
    setLoading(true);
    setErr("");
    try {
      if (tab === "ITEMS") await loadItems();
      if (tab === "UNITS") await loadUnits();
      if (tab === "MOVEMENTS") await loadMovements();
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
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    refresh();
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
        }),
      });

      setOpenCreateItem(false);
      setCreateItemForm({ sku: "", name: "", unit: "PCS", isSerialized: false });
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
      const item = items.find((x) => x.id === receiveForm.itemId);
      if (!item) throw new Error("Select an item");
      if (!receiveForm.locationId) throw new Error("Select a location");

      const payload = {
        itemId: receiveForm.itemId,
        locationId: receiveForm.locationId,
        note: receiveForm.note || undefined,
      };

      if (item.isSerialized) {
        const unitsPayload = parseUnitLines(receiveForm.unitLines);

        if (unitsPayload.length === 0) {
          throw new Error("Serialized item requires unit lines (serial required).");
        }

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

        payload.units = unitsPayload.map((u) => ({
          serialNumber: u.serialNumber,
          barcode: u.barcode || undefined,
          ...(hasAnyUnitPrice ? { purchasePrice: Number(u.purchasePrice) } : {}),
        }));

        if (hasTotalPrice) payload.totalPurchasePrice = Number(totalRaw);
      } else {
        payload.qty = Number(receiveForm.qty || 0);
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
        totalPurchasePrice: "",
      });

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
    <div style={pageBg}>
      <div style={container}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={headerTitle}>Persediaan</h1>
            <div style={headerSub}>Kelola suku cadang, stok, unit, dan mutasi</div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Pill variant="grey">{totalItems} items</Pill>

            <Btn style={btn} onClick={() => { setCreateItemError(""); setOpenCreateItem(true); }}>
              + New Item
            </Btn>

            <Btn
              style={btnDanger}
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
              Use Stock
            </Btn>

            <Btn
              style={btnPrimary}
              onClick={async () => {
                try {
                  setErr("");
                  await loadLocations();
                  await loadItems();
                  setOpenReceive(true);
                } catch (e) {
                  setErr(String(e?.message || e));
                }
              }}
            >
              Receive Stock
            </Btn>
          </div>
        </div>

        {/* Main Card */}
        <div style={wrapCard}>
          {/* Tabs + Search */}
          <div style={controlRow}>
            <div style={leftControls}>
              <Btn style={tabBtn(tab === "ITEMS")} onClick={() => setTab("ITEMS")}>
                Items
              </Btn>
              <Btn style={tabBtn(tab === "UNITS")} onClick={() => setTab("UNITS")}>
                Units
              </Btn>
              <Btn style={tabBtn(tab === "MOVEMENTS")} onClick={() => setTab("MOVEMENTS")}>
                Movements
              </Btn>
            </div>

            <div style={rightControls}>
              <input
                style={{ ...inputPill, minWidth: 320 }}
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
                onApplyFilters={loadUnits}
              />
              <Pagination pagination={unitPagination} onChange={changeUnitPage} />
              </>
            ) : null}

            {tab === "MOVEMENTS" ? <MovementsTable movements={filteredMovements} loading={loading} from={mvFrom} to={mvTo} onFromChange={setMvFrom} onToChange={setMvTo} onApply={refresh} /> : null}
          </div>
        </div>

        {/* MODALS */}
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

        <Modal open={openCreateItem} title="Create Item (Sparepart Master)" onClose={() => setOpenCreateItem(false)}>
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

            <label style={{ display: "flex", alignItems: "center", gap: 10, gridColumn: "1 / -1", color: BRAND.text, fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={createItemForm.isSerialized}
                onChange={(e) => setCreateItemForm((p) => ({ ...p, isSerialized: e.target.checked }))}
              />
              Serialized (unit-level tracking)
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <Btn style={btn} onClick={() => setOpenCreateItem(false)}>
              Cancel
            </Btn>
            <Btn style={btnPrimary} onClick={createItem}>
              Create
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
                <label style={{ display: "flex", alignItems: "center", gap: 10, gridColumn: "1 / -1", color: BRAND.text, fontWeight: 500 }}>
                  <input type="checkbox" checked={editItemForm.isSerialized} onChange={(e) => setEditItemForm((p) => ({ ...p, isSerialized: e.target.checked }))} />
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

        <Modal open={openReceive} title="Receive Stock (IN)" onClose={() => setOpenReceive(false)}>
          {locations.length === 0 ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, color: BRAND.text }}>Lokasi tidak ditemukan</div>
              <div style={{ marginTop: 6, color: BRAND.textMuted }}>
                Create at least one location (e.g. Main Warehouse) before receiving stock.
              </div>
              <div style={{ marginTop: 12 }}>
                <Btn style={btnPrimary} onClick={() => setOpenCreateLocation(true)}>
                  + Create Location
                </Btn>
              </div>
              <div style={{ marginTop: 12, height: 1, background: BRAND.border }} />
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Barang</div>
              <select
                style={{ ...selectPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                value={receiveForm.itemId}
                onChange={(e) => setReceiveForm((p) => ({ ...p, itemId: e.target.value }))}
              >
                <option value="">Pilih barang...</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.sku} — {it.name} {it.isSerialized ? "(serialized)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>
                Location{" "}
                {locations.length > 0 ? (
                  <Btn
                    style={{ ...btn, height: 28, padding: "0 10px", marginLeft: 8, fontSize: 12 }}
                    type="button"
                    onClick={() => setOpenCreateLocation(true)}
                  >
                    + New
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

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Jumlah</div>
              <input
                style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                type="number"
                step="0.01"
                value={receiveForm.qty}
                onChange={(e) => setReceiveForm((p) => ({ ...p, qty: e.target.value }))}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: BRAND.textMuted }}>
                For serialized items, Qty is ignored (units list required).
              </div>
            </div>

            {(() => {
              const item = items.find((x) => x.id === receiveForm.itemId);
              if (!item?.isSerialized) return null;

              return (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>
                    Total Purchase Price (IDR) — optional
                  </div>
                  <input
                    style={{ ...inputPill, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                    type="number"
                    value={receiveForm.totalPurchasePrice || ""}
                    onChange={(e) => setReceiveForm((p) => ({ ...p, totalPurchasePrice: e.target.value }))}
                    placeholder="e.g. 20000000"
                  />
                  <div style={{ marginTop: 6, fontSize: 12, color: BRAND.textMuted }}>
                    Use either per-unit price in lines OR this total price (not both).
                  </div>
                </div>
              );
            })()}

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
                Serialized Units {(() => {
                  const item = items.find((x) => x.id === receiveForm.itemId);
                  return item?.isSerialized ? "(required)" : "(optional)";
                })()}
              </div>

              <div style={{ fontSize: 12, color: BRAND.textMuted, marginTop: 4 }}>
                One per line: <code>serial,price</code>. Price can be blank if you fill Total Purchase Price.
              </div>

              <textarea
                style={{
                  width: "100%",
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 6,
                  border: `1px solid ${BRAND.border}`,
                  outline: "none",
                  background: BRAND.white,
                  color: BRAND.text,
                  height: 120,
                  resize: "vertical",
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                  fontSize: 13,
                }}
                value={receiveForm.unitLines}
                onChange={(e) => setReceiveForm((p) => ({ ...p, unitLines: e.target.value }))}
                placeholder={`Example:\nSN001,2000000\nSN002,2000000`}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <Btn style={btn} onClick={() => setOpenReceive(false)}>
              Cancel
            </Btn>
            <Btn style={btnPrimary} onClick={receiveStock} disabled={locations.length === 0}>
              Receive
            </Btn>
          </div>
        </Modal>

        <Modal open={openConsume} title="Use Stock (Consume / OUT)" onClose={() => setOpenConsume(false)}>
          {locations.length === 0 ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, color: BRAND.text }}>Lokasi tidak ditemukan</div>
              <div style={{ marginTop: 6, color: BRAND.textMuted }}>
                Create at least one location before using stock.
              </div>
              <div style={{ marginTop: 12 }}>
                <Btn style={btnPrimary} onClick={() => setOpenCreateLocation(true)}>
                  + Create Location
                </Btn>
              </div>
              <div style={{ marginTop: 12, height: 1, background: BRAND.border }} />
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.textMuted, marginBottom: 6 }}>Item (non-serialized)</div>
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
                Location{" "}
                <Btn
                  style={{ ...btn, height: 28, padding: "0 10px", marginLeft: 8, fontSize: 12 }}
                  type="button"
                  onClick={() => setOpenCreateLocation(true)}
                >
                  + New
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
              Cancel
            </Btn>
            <Btn style={btnPrimary} onClick={consumeStock} disabled={locations.length === 0}>
              Use Stock
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
    return <div style={{ padding: 20, color: BRAND.textMuted }}>Memuat...</div>;
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
        <div style={{ padding: 20, color: BRAND.textMuted }}>Memuat...</div>
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
                <th style={th}>Kendaraan</th>
                <th style={th}>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const currentAssign = (u.assignments || [])[0];
                const truck = currentAssign?.truck;
                return (
                  <tr key={u.id}>
                    <td style={td}>{u.serialNumber || "-"}</td>
                    <td style={td}>{u.item?.sku || "-"} — {u.item?.name || ""}</td>
                    <td style={tdSoft}>{u.barcode || "-"}</td>
                    <td style={td}>
                      <Pill variant={u.status === "IN_STOCK" ? "green" : u.status === "SCRAPPED" ? "red" : "grey"}>
                        {u.status || "-"}
                      </Pill>
                    </td>
                    <td style={tdSoft}>{u.location?.name || "-"}</td>
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
                        <Btn
                          style={{ ...btn, height: 28, padding: "0 10px", fontSize: 11 }}
                          onClick={() => onBarcode(u)}
                        >
                          Barcode
                        </Btn>
                        {u.status !== "SCRAPPED" ? (
                          <Btn
                            style={{ ...btnDanger, height: 28, padding: "0 10px", fontSize: 11 }}
                            onClick={() => onScrap(u)}
                          >
                            Scrap
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
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, alignItems: "end" }}>
      <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
        Dari tanggal
        <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} style={{ ...inputPill, minWidth: 180 }} />
      </label>
      <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: BRAND.textMuted }}>
        Sampai tanggal
        <input type="date" value={to} onChange={(e) => onToChange(e.target.value)} style={{ ...inputPill, minWidth: 180 }} />
      </label>
      <Btn style={btn} onClick={onApply}>Terapkan</Btn>
      {(from || to) && <Btn style={btn} onClick={() => { onFromChange(""); onToChange(""); setTimeout(onApply, 0); }}>Reset</Btn>}
    </div>
  );

  if (loading) {
    return <>{filters}<div style={{ padding: 20, color: BRAND.textMuted }}>Memuat...</div></>;
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
