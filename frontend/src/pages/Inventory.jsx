// src/pages/Inventory.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

/**
 * ✅ Added feature:
 * - "Use Stock" (CONSUME/OUT) for NON-SERIALIZED items (e.g., Oil)
 *   Example: 100 Ltr -> use 15 Ltr -> becomes 85 Ltr (per selected location)
 *
 * Notes:
 * - This UI calls: POST /inventory/consume
 *   Body: { itemId, locationId, qty, note }
 * - Backend must reduce stock.qty at that location and create a movement row (type: CONSUME or OUT)
 */

//////////////////////
// STYLES
//////////////////////
const pageBg = {
  minHeight: "100vh",
  padding: 22,
  color: "#0B2A1F",
};

const container = {
  maxWidth: 1180,
  margin: "0 auto",
};

const headerTitle = {
  fontSize: 30,
  fontWeight: 900,
  letterSpacing: -0.7,
  margin: 0,
  lineHeight: 1.05,
};

const headerSub = {
  marginTop: 8,
  color: "#2F6B55",
  fontWeight: 700,
  fontSize: 12,
};

const wrapCard = {
  marginTop: 16,
  background: "#FFFFFF",
  borderRadius: 22,
  border: "1px solid rgba(20, 83, 45, 0.12)",
  boxShadow: "0 14px 40px rgba(16, 24, 40, 0.06)",
  padding: 18,
};

const innerCard = {
  background: "#FFFFFF",
  borderRadius: 18,
  border: "1px solid rgba(20, 83, 45, 0.10)",
  boxShadow: "0 8px 24px rgba(16, 24, 40, 0.05)",
  overflow: "hidden",
};

const controlRow = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "space-between",
};

const leftControls = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };
const rightControls = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };

function TruckSearchSelect({ trucks, value, onChange, placeholder = "Search plate number..." }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => {
    return (trucks || []).find((t) => t.id === value) || null;
  }, [trucks, value]);

  // keep input showing selected plate when value changes
  useEffect(() => {
    if (selected) {
      setQuery(selected.plateNumber || "");
    }
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
        style={{ ...inputPill, borderRadius: 14, minWidth: 0, width: "100%", boxSizing: "border-box" }}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          // If user starts typing, clear selection so they must pick again
          if (value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // allow click on options before closing
          setTimeout(() => setOpen(false), 140);
        }}
      />

      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid rgba(20, 83, 45, 0.14)",
            boxShadow: "0 18px 40px rgba(16, 24, 40, 0.12)",
            borderRadius: 14,
            overflow: "hidden",
            zIndex: 50,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: 12, fontWeight: 800, color: "#64748B" }}>
              No trucks found
            </div>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // prevent blur before click
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
                }}
              >
                <div style={{ fontWeight: 900, color: "#0B2A1F" }}>
                  {t.plateNumber || "-"}
                </div>
                <div style={{ marginTop: 2, fontWeight: 800, color: "#2F6B55", fontSize: 12 }}>
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


const pill = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(15,23,42,0.10)",
  background: "rgba(15,23,42,0.04)",
  color: "#334155",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const pillGreen = {
  ...pill,
  background: "rgba(22,163,74,0.10)",
  border: "1px solid rgba(22,163,74,0.25)",
  color: "#0B2A1F",
};

const pillRed = {
  ...pill,
  background: "rgba(239,68,68,0.10)",
  border: "1px solid rgba(239,68,68,0.25)",
  color: "#7F1D1D",
};

const inputPill = {
  height: 46,
  padding: "0 16px",
  borderRadius: 999,
  border: "1px solid rgba(20, 83, 45, 0.14)",
  outline: "none",
  background: "#FFFFFF",
  color: "#0B2A1F",
  fontWeight: 800,
  minWidth: 260,
};

const selectPill = {
  ...inputPill,
  minWidth: 220,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  paddingRight: 44,
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, #0B2A1F 50%), linear-gradient(135deg, #0B2A1F 50%, transparent 50%)",
  backgroundPosition: "calc(100% - 22px) 19px, calc(100% - 16px) 19px",
  backgroundSize: "6px 6px, 6px 6px",
  backgroundRepeat: "no-repeat",
};

const btn = {
  height: 46,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid rgba(20, 83, 45, 0.14)",
  background: "#FFFFFF",
  color: "#0B2A1F",
  fontWeight: 900,
  cursor: "pointer",
};

const btnPrimary = {
  ...btn,
  background: "#16A34A",
  border: "1px solid rgba(22,163,74,0.45)",
  color: "white",
};

const btnDanger = {
  ...btn,
  background: "rgba(239,68,68,0.10)",
  border: "1px solid rgba(239,68,68,0.25)",
  color: "#7F1D1D",
};

const tabBtn = (active) => ({
  ...btn,
  height: 40,
  padding: "0 14px",
  background: active ? "rgba(22,163,74,0.10)" : "#FFFFFF",
  border: active ? "1px solid rgba(22,163,74,0.30)" : "1px solid rgba(20, 83, 45, 0.12)",
  color: "#0B2A1F",
});

const errorBox = {
  marginTop: 14,
  background: "rgba(239,68,68,0.10)",
  border: "1px solid rgba(239,68,68,0.25)",
  borderRadius: 18,
  padding: 14,
};

const tableWrap = { overflowX: "auto" };

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 900,
};

const th = {
  textAlign: "left",
  padding: 14,
  fontSize: 14,
  color: "#2F6B55",
  background: "rgba(22,163,74,0.05)",
  borderBottom: "1px solid rgba(20, 83, 45, 0.10)",
  fontWeight: 900,
};

const td = {
  padding: 14,
  borderBottom: "1px solid rgba(15,23,42,0.06)",
  verticalAlign: "middle",
  fontWeight: 800,
  color: "#0B2A1F",
};

const tdSoft = {
  ...td,
  fontWeight: 700,
  color: "#2B4C3F",
};

//////////////////////
// HOVER BUTTON SYSTEM
//////////////////////
function shadeColor(hex, amt) {
  let c = String(hex || "").replace("#", "").trim();
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  if (c.length !== 6) return hex;

  const num = parseInt(c, 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;

  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));

  const out = (r << 16) | (g << 8) | b;
  return `#${out.toString(16).padStart(6, "0")}`;
}

function makeHoverStyle(base) {
  const bg = base?.background || "#FFFFFF";
  const isHexBg = typeof bg === "string" && bg.startsWith("#");

  return {
    ...base,
    transform: "translateY(-1px)",
    boxShadow: "0 10px 22px rgba(16,24,40,0.10)",
    background: isHexBg ? shadeColor(bg, -10) : bg,
    filter: "brightness(0.98)",
  };
}

function Btn({ style, disabled, children, ...props }) {
  const [hover, setHover] = useState(false);

  const finalStyle = {
    ...style,
    transition: "transform 120ms ease, box-shadow 120ms ease, filter 120ms ease, background 120ms ease",
    ...(hover && !disabled ? makeHoverStyle(style) : null),
    ...(disabled ? { opacity: 0.55, cursor: "not-allowed", transform: "none", boxShadow: "none" } : null),
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
        background: "rgba(15, 23, 42, 0.35)",
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
          background: "#FFFFFF",
          borderRadius: 22,
          border: "1px solid rgba(20, 83, 45, 0.14)",
          boxShadow: "0 20px 60px rgba(16, 24, 40, 0.18)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid rgba(15,23,42,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0B2A1F" }}>{title}</div>
          <Btn style={btn} onClick={onClose}>
            Close
          </Btn>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
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
    const [serialNumber, barcode, purchasePrice] = line.split(",").map((s) => (s ? s.trim() : ""));
    return {
      serialNumber: serialNumber || undefined,
      barcode: barcode || undefined,
      purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
    };
  });
}

// helper: safe sum
function sumStocks(stocks) {
  return (stocks || []).reduce((a, s) => a + (Number(s.qty) || 0), 0);
}

export default function Inventory() {
  const { user } = useAuth();
  const role = user?.role || "UNKNOWN";
  const allowed = role === "OWNER" || role === "ADMIN" || role === "STAFF";

  const [tab, setTab] = useState("ITEMS"); // ITEMS | UNITS | MOVEMENTS
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [units, setUnits] = useState([]);
  const [movements, setMovements] = useState([]);

  // unit filters
  const [unitStatus, setUnitStatus] = useState("IN_STOCK");
  const [unitItemId, setUnitItemId] = useState("");
  const [unitLocationId, setUnitLocationId] = useState("");

  // modals
  const [openCreateItem, setOpenCreateItem] = useState(false);
  const [openReceive, setOpenReceive] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
  const [openCreateLocation, setOpenCreateLocation] = useState(false);

  // consume/use stock modal
  const [openConsume, setOpenConsume] = useState(false);

  // edit barcode modal
  const [openBarcode, setOpenBarcode] = useState(false);
  const [barcodeForm, setBarcodeForm] = useState({ unitId: "", barcode: "" });

  // movement date filters
  const [mvFrom, setMvFrom] = useState("");
  const [mvTo, setMvTo] = useState("");

  const [openScrap, setOpenScrap] = useState(false);
  const [scrapForm, setScrapForm] = useState({ unitId: "", note: "" });

  // forms
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

  // client-side search
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

  async function loadItems() {
    const qs = buildQuery({ q: q || undefined });
    const data = await api(`/inventory/items${qs}`);
    setItems(data.items || []);
  }

  async function loadUnits() {
    const qs = buildQuery({
      status: unitStatus || undefined,
      itemId: unitItemId || undefined,
      locationId: unitLocationId || undefined,
      q: q || undefined,
    });
    const data = await api(`/inventory/units${qs}`);
    setUnits(data.units || []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function createItem() {
    setErr("");
    try {
      if (!createItemForm.sku.trim() || !createItemForm.name.trim()) {
        throw new Error("SKU and Name are required");
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
        if (unitsPayload.length > 0) payload.units = unitsPayload;
        else payload.qty = Number(receiveForm.qty || 0);
      } else {
        payload.qty = Number(receiveForm.qty || 0);
      }

      await api("/inventory/receive", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setOpenReceive(false);
      setReceiveForm({ itemId: "", locationId: "", qty: 1, note: "", unitLines: "" });

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
      if (!assignForm.truckId) throw new Error("Select a truck");

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
            <h1 style={headerTitle}>Inventory</h1>
            <div style={headerSub}>You don’t have access to this page.</div>
          </div>
        </div>
      </div>
    );
  }

  const totalItems = items.length;

  return (
    <div style={pageBg}>
      <div style={container}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={headerTitle}>Inventory</h1>
            <div style={headerSub}>Spareparts master data, stock, units, and movements</div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Pill variant="grey">{totalItems} items</Pill>

            <Btn style={btn} onClick={() => setOpenCreateItem(true)}>
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

        {/* main card */}
        <div style={wrapCard}>
          {/* tabs + search */}
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
                style={{ ...inputPill, minWidth: 420 }}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name / SKU / barcode..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") refresh();
                }}
              />
              {/**
              <Btn style={btnPrimary} onClick={refresh}>
                {loading ? "Loading..." : "Search"}
              </Btn>
               */}

            </div>
          </div>

          {err ? (
            <div style={errorBox}>
              <div style={{ fontWeight: 900, color: "#7F1D1D" }}>Error</div>
              <div style={{ marginTop: 6, whiteSpace: "pre-wrap", color: "#7F1D1D", fontWeight: 700 }}>{err}</div>
            </div>
          ) : null}

          <div style={{ marginTop: 14 }}>
            {tab === "ITEMS" ? (
              <ItemsTable
                items={filteredItems}
                loading={loading}
                onUse={(itemId) => {
                  const item = items.find((x) => x.id === itemId);
                  if (!item) return;

                  const firstLocWithStock = (item.stocks || []).find((s) => Number(s.qty || 0) > 0)?.locationId || "";
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
            ) : null}

            {tab === "UNITS" ? (
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
            ) : null}

            {tab === "MOVEMENTS" ? <MovementsTable movements={filteredMovements} loading={loading} /> : null}
          </div>
        </div>

        {/* MODALS */}
        <Modal open={openBarcode} title="Set / Edit Unit Barcode" onClose={() => setOpenBarcode(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <div>
              <Pill variant="green">Unit ID: {barcodeForm.unitId || "-"}</Pill>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>Barcode</div>
              <input
                style={{ ...inputPill, borderRadius: 14, minWidth: 0, width: "100%", boxSizing: "border-box" }}
                value={barcodeForm.barcode}
                onChange={(e) => setBarcodeForm((p) => ({ ...p, barcode: e.target.value }))}
                placeholder="Scan / type barcode..."
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
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
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>Reason / Note</div>
              <input
                style={{ ...inputPill, borderRadius: 14, minWidth: 0, width: "100%", boxSizing: "border-box" }}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>SKU</div>
              <input
                style={{ ...inputPill, borderRadius: 14, minWidth: 0 }}
                value={createItemForm.sku}
                onChange={(e) => setCreateItemForm((p) => ({ ...p, sku: e.target.value }))}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>Unit</div>
              <input
                style={{ ...inputPill, borderRadius: 14, minWidth: 0 }}
                value={createItemForm.unit}
                onChange={(e) => setCreateItemForm((p) => ({ ...p, unit: e.target.value }))}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>Name</div>
              <input
                style={{ ...inputPill, borderRadius: 14, minWidth: 0 }}
                value={createItemForm.name}
                onChange={(e) => setCreateItemForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, gridColumn: "1 / -1", color: "#2B4C3F", fontWeight: 900 }}>
              <input
                type="checkbox"
                checked={createItemForm.isSerialized}
                onChange={(e) => setCreateItemForm((p) => ({ ...p, isSerialized: e.target.checked }))}
              />
              Serialized (unit-level tracking, disappears when assigned)
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
            <Btn style={btn} onClick={() => setOpenCreateItem(false)}>
              Cancel
            </Btn>
            <Btn style={btnPrimary} onClick={createItem}>
              Create
            </Btn>
          </div>
        </Modal>

        <Modal open={openReceive} title="Receive Stock (IN)" onClose={() => setOpenReceive(false)}>
          {locations.length === 0 ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 900, color: "#0B2A1F" }}>No location found</div>
              <div style={{ marginTop: 6, color: "#2F6B55", fontWeight: 800 }}>
                You must create at least one location (e.g. Main Warehouse) before receiving stock.
              </div>
              <div style={{ marginTop: 12 }}>
                <Btn style={btnPrimary} onClick={() => setOpenCreateLocation(true)}>
                  + Create Location
                </Btn>
              </div>
              <div style={{ marginTop: 12, height: 1, background: "rgba(15,23,42,0.06)" }} />
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>Item</div>
              <select
                style={{ ...selectPill, borderRadius: 14, minWidth: 0 }}
                value={receiveForm.itemId}
                onChange={(e) => setReceiveForm((p) => ({ ...p, itemId: e.target.value }))}
              >
                <option value="">Select item...</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.sku} — {it.name} {it.isSerialized ? "(serialized)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>
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
                style={{ ...selectPill, borderRadius: 14, minWidth: 0 }}
                value={receiveForm.locationId}
                onChange={(e) => setReceiveForm((p) => ({ ...p, locationId: e.target.value }))}
                disabled={locations.length === 0}
              >
                {locations.length === 0 ? (
                  <option value="">No locations yet — create one first</option>
                ) : (
                  <>
                    <option value="">Select location...</option>
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
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>Note</div>
              <input
                style={{ ...inputPill, borderRadius: 14, minWidth: 0 }}
                value={receiveForm.note}
                onChange={(e) => setReceiveForm((p) => ({ ...p, note: e.target.value }))}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>Qty</div>
              <input
                style={{ ...inputPill, borderRadius: 14, minWidth: 0 }}
                type="number"
                step="0.01"
                value={receiveForm.qty}
                onChange={(e) => setReceiveForm((p) => ({ ...p, qty: e.target.value }))}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55" }}>Serialized Units (optional)</div>
              <div style={{ fontSize: 12, color: "#2B4C3F", opacity: 0.75, marginTop: 4, fontWeight: 700 }}>
                One per line: <code>serial,barcode,price</code>. If empty, system uses Qty.
              </div>
              <textarea
                style={{
                  width: "100%",
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(20, 83, 45, 0.14)",
                  outline: "none",
                  background: "#FFFFFF",
                  color: "#0B2A1F",
                  height: 140,
                  resize: "vertical",
                  fontWeight: 700,
                }}
                value={receiveForm.unitLines}
                onChange={(e) => setReceiveForm((p) => ({ ...p, unitLines: e.target.value }))}
                placeholder={`Example:\nSN001,BC001,1500000\nSN002,BC002,1500000`}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
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
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 900, color: "#0B2A1F" }}>No location found</div>
              <div style={{ marginTop: 6, color: "#2F6B55", fontWeight: 800 }}>
                You must create at least one location before using stock.
              </div>
              <div style={{ marginTop: 12 }}>
                <Btn style={btnPrimary} onClick={() => setOpenCreateLocation(true)}>
                  + Create Location
                </Btn>
              </div>
              <div style={{ marginTop: 12, height: 1, background: "rgba(15,23,42,0.06)" }} />
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>Item (non-serialized)</div>
              <select
                style={{ ...selectPill, borderRadius: 14, minWidth: 0 }}
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
                <option value="">Select item...</option>
                {nonSerializedItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.sku} — {it.name} ({it.unit || "UNIT"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>
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
                style={{ ...selectPill, borderRadius: 14, minWidth: 0 }}
                value={consumeForm.locationId}
                onChange={(e) => setConsumeForm((p) => ({ ...p, locationId: e.target.value }))}
                disabled={locations.length === 0}
              >
                <option value="">Select location...</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              {(() => {
                const item = items.find((x) => x.id === consumeForm.itemId);
                if (!item) return <div style={{ color: "#64748B", fontWeight: 800 }}>Select an item to see available stock.</div>;

                const totalQty = sumStocks(item.stocks);
                const locQty = Number((item.stocks || []).find((s) => s.locationId === consumeForm.locationId)?.qty || 0);

                return (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <Pill>
                      Total: {totalQty} {item.unit || ""}
                    </Pill>
                    <Pill variant={consumeForm.locationId ? "green" : "grey"}>
                      This location: {consumeForm.locationId ? `${locQty} ${item.unit || ""}` : "—"}
                    </Pill>
                    {item.isSerialized ? <Pill variant="red">Serialized item (not allowed here)</Pill> : null}
                  </div>
                );
              })()}
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>Qty Used</div>
              <input
                style={{ ...inputPill, borderRadius: 14, minWidth: 0 }}
                type="number"
                step="0.01"
                value={consumeForm.qty}
                onChange={(e) => setConsumeForm((p) => ({ ...p, qty: e.target.value }))}
                placeholder="e.g. 15"
              />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>Note (optional)</div>
              <input
                style={{ ...inputPill, borderRadius: 14, minWidth: 0 }}
                value={consumeForm.note}
                onChange={(e) => setConsumeForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="e.g. Oil refill for Truck B1234"
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
            <Btn style={btn} onClick={() => setOpenConsume(false)}>
              Cancel
            </Btn>
            <Btn style={btnDanger} onClick={consumeStock} disabled={locations.length === 0}>
              Use / Reduce Stock
            </Btn>
          </div>

          <div style={{ marginTop: 12, color: "#2F6B55", fontWeight: 800, fontSize: 12 }}>
            This will reduce stock at the selected location and record a movement (audit trail).
          </div>
        </Modal>

        <Modal open={openCreateLocation} title="Create Location" onClose={() => setOpenCreateLocation(false)}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>
              Location Name (e.g. Main Warehouse)
            </div>
            <input
              style={{ ...inputPill, borderRadius: 14, minWidth: 0, width: "100%" }}
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
            <Btn style={btn} onClick={() => setOpenCreateLocation(false)}>
              Cancel
            </Btn>
            <Btn style={btnPrimary} onClick={createLocation}>
              Create
            </Btn>
          </div>
        </Modal>

        <Modal open={openAssign} title="Assign Unit to Truck (OUT)" onClose={() => setOpenAssign(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <Pill variant="green">Unit ID: {assignForm.unitId || "-"}</Pill>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>Truck</div>
              <TruckSearchSelect
                trucks={trucks}
                value={assignForm.truckId}
                onChange={(truckId) => setAssignForm((p) => ({ ...p, truckId }))}
                placeholder="Search plate number..."
              />

            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>Installed At (optional)</div>
              <input
                style={{ ...inputPill, borderRadius: 14, minWidth: 0 }}
                value={assignForm.installedAt}
                onChange={(e) => setAssignForm((p) => ({ ...p, installedAt: e.target.value }))}
                placeholder="Leave empty = now"
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>Note</div>
              <input
                style={{ ...inputPill, borderRadius: 14, minWidth: 0 }}
                value={assignForm.note}
                onChange={(e) => setAssignForm((p) => ({ ...p, note: e.target.value }))}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2F6B55", marginBottom: 6 }}>Maintenance ID (optional)</div>
              <input
                style={{ ...inputPill, borderRadius: 14, minWidth: 0 }}
                value={assignForm.maintenanceId}
                onChange={(e) => setAssignForm((p) => ({ ...p, maintenanceId: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
            <Btn style={btn} onClick={() => setOpenAssign(false)}>
              Cancel
            </Btn>
            <Btn style={btnPrimary} onClick={assignUnit}>
              Assign
            </Btn>
          </div>
        </Modal>
      </div>
    </div>
  );
}

function ItemsTable({ items, loading, onUse }) {
  const total = items.length;

  return (
    <div style={innerCard}>
      <div style={{ padding: 16, borderBottom: "1px solid rgba(15,23,42,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0B2A1F" }}>Items</div>
          <div style={{ marginTop: 4, color: "#2F6B55", fontWeight: 800, fontSize: 18 }}>Sparepart master + stock totals</div>
        </div>
        <Pill variant="grey">{loading ? "Loading…" : `${total} items`}</Pill>
      </div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>SKU</th>
              <th style={th}>Name</th>
              <th style={th}>Unit</th>
              <th style={th}>Serialized</th>
              <th style={th}>Total Qty</th>
              <th style={th}>By Location</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const totalQty = sumStocks(it.stocks);
              const canUse = !it.isSerialized && totalQty > 0;

              return (
                <tr key={it.id}>
                  <td style={{ ...td, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{it.sku}</td>
                  <td style={td}>{it.name}</td>
                  <td style={tdSoft}>{it.unit}</td>
                  <td style={tdSoft}>{it.isSerialized ? <Pill variant="green">Yes</Pill> : <Pill>No</Pill>}</td>
                  <td style={td}>{totalQty}</td>
                  <td style={tdSoft}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {(it.stocks || []).length === 0 ? (
                        <span style={{ color: "#64748B", fontWeight: 800 }}>—</span>
                      ) : (
                        it.stocks.map((s) => (
                          <Pill key={s.id}>
                            {s.location?.name || "Unknown"}: {s.qty}
                          </Pill>
                        ))
                      )}
                    </div>
                  </td>
                  <td style={tdSoft}>
                    <Btn
                      style={canUse ? btnDanger : { ...btnDanger, opacity: 0.55, cursor: "not-allowed" }}
                      disabled={!canUse}
                      onClick={() => onUse(it.id)}
                      title={!canUse ? "No stock to use" : "Reduce non-serialized stock"}
                    >
                      Use
                    </Btn>
                  </td>
                </tr>
              );
            })}

            {items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 18, color: "#64748B", fontWeight: 900 }}>
                  No items yet. Create sparepart master with “New Item”.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
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
    <div style={innerCard}>
      <div style={{ padding: 16, borderBottom: "1px solid rgba(15,23,42,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0B2A1F" }}>Units</div>
          <div style={{ marginTop: 4, color: "#2F6B55", fontWeight: 800, fontSize: 18 }}>Serialized unit tracking. IN_STOCK can be assigned.</div>
        </div>
        <Pill variant="grey">{loading ? "Loading…" : `${units.length} units`}</Pill>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#2F6B55", marginBottom: 8 }}>Status</div>
            <select style={selectPill} value={unitStatus} onChange={(e) => setUnitStatus(e.target.value)}>
              <option value="">All</option>
              <option value="IN_STOCK">IN_STOCK</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="SCRAPPED">SCRAPPED</option>
              <option value="LOST">LOST</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#2F6B55", marginBottom: 8 }}>Item</div>
            <select style={selectPill} value={unitItemId} onChange={(e) => setUnitItemId(e.target.value)}>
              <option value="">All serialized items</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.sku} — {it.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#2F6B55", marginBottom: 8 }}>Location</div>
            <select style={selectPill} value={unitLocationId} onChange={(e) => setUnitLocationId(e.target.value)}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "end" }}>
            <Btn style={btnPrimary} onClick={onApplyFilters}>
              Apply
            </Btn>
          </div>
        </div>
      </div>

      <div style={tableWrap}>
        <table style={{ ...table, minWidth: 1100 }}>
          <thead>
            <tr>
              <th style={th}>Item</th>
              <th style={th}>Serial</th>
              <th style={th}>Barcode</th>
              <th style={th}>Status</th>
              <th style={th}>Location</th>
              <th style={th}>Currently Used By</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => {
              const currentTruck = (u.assignments || [])[0]?.truck;
              const canAssign = u.status === "IN_STOCK";

              return (
                <tr key={u.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 900 }}>{u.item?.name || "-"}</div>
                    <div style={{ marginTop: 2, fontWeight: 800, color: "#2F6B55", fontSize: 13 }}>{u.item?.sku || ""}</div>
                  </td>
                  <td style={{ ...tdSoft, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{u.serialNumber || "—"}</td>
                  <td style={{ ...tdSoft, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{u.barcode || "—"}</td>
                  <td style={tdSoft}>
                    <Pill variant={u.status === "IN_STOCK" ? "green" : "grey"}>{u.status}</Pill>
                  </td>
                  <td style={tdSoft}>{u.location?.name || "—"}</td>
                  <td style={tdSoft}>
                    {currentTruck ? <Pill variant="green">{currentTruck.plateNumber}</Pill> : <span style={{ color: "#64748B", fontWeight: 800 }}>—</span>}
                  </td>
                  <td style={tdSoft}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Btn style={btn} onClick={() => onBarcode(u)}>
                        Barcode
                      </Btn>
                      <Btn style={btnDanger} onClick={() => onScrap(u)}>
                        Scrap
                      </Btn>
                      <Btn style={btnPrimary} onClick={() => onAssign(u)} disabled={!canAssign}>
                        Assign
                      </Btn>
                    </div>
                  </td>
                </tr>
              );
            })}

            {units.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 18, color: "#64748B", fontWeight: 900 }}>
                  No units found. Receive stock for a serialized item first.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MovementsTable({ movements, loading }) {
  const MV_PAGE_SIZE = 10;
  const [mvPage, setMvPage] = useState(1);

  const btnSmall = {
    ...btn,
    height: 38,
    padding: "0 12px",
    fontSize: 13,
  };

  const mvTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil((movements?.length || 0) / MV_PAGE_SIZE));
  }, [movements]);

  const mvPageItems = useMemo(() => {
    const start = (mvPage - 1) * MV_PAGE_SIZE;
    return (movements || []).slice(start, start + MV_PAGE_SIZE);
  }, [movements, mvPage]);

  useEffect(() => {
    setMvPage((p) => Math.min(Math.max(1, p), mvTotalPages));
  }, [mvTotalPages]);

  return (
    <div style={innerCard}>
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid rgba(15,23,42,0.06)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0B2A1F" }}>Movements</div>
          <div style={{ marginTop: 4, color: "#2F6B55", fontWeight: 800, fontSize: 18 }}>Audit trail</div>
        </div>
        <Pill variant="grey">{loading ? "Loading…" : `${movements.length} rows`}</Pill>
      </div>

      <div style={tableWrap}>
        <table style={{ ...table, minWidth: 1200 }}>
          <thead>
            <tr>
              <th style={th}>Time</th>
              <th style={th}>Type</th>
              <th style={th}>Item</th>
              <th style={th}>Qty</th>
              <th style={th}>From</th>
              <th style={th}>To</th>
              <th style={th}>Unit</th>
              <th style={th}>Note</th>
              <th style={th}>Processed By</th>
            </tr>
          </thead>

          <tbody>
            {mvPageItems.map((m) => (
              <tr key={m.id}>
                <td style={tdSoft}>{fmtDate(m.createdAt)}</td>

                <td style={tdSoft}>
                  <Pill variant={m.type === "IN" ? "green" : m.type === "OUT" ? "red" : "grey"}>{m.type}</Pill>
                </td>

                <td style={td}>
                  <div style={{ fontWeight: 900 }}>{m.item?.name || "-"}</div>
                  <div style={{ marginTop: 2, fontWeight: 800, color: "#2F6B55", fontSize: 13 }}>{m.item?.sku || ""}</div>
                </td>

                <td style={td}>{m.qty}</td>
                <td style={tdSoft}>{m.fromLocation?.name || "—"}</td>
                <td style={tdSoft}>{m.toLocation?.name || "—"}</td>

                <td style={{ ...tdSoft, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {m.stockUnit?.serialNumber || m.stockUnit?.barcode || "—"}
                </td>

                <td style={tdSoft}>{m.note || "—"}</td>
                <td style={tdSoft}>{m.createdBy?.name || m.createdBy?.email || "—"}</td>
              </tr>
            ))}

            {movements.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 18, color: "#64748B", fontWeight: 900 }}>
                  No movements yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {movements.length > 0 ? (
        <div
          style={{
            padding: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            borderTop: "1px solid rgba(15,23,42,0.06)",
          }}
        >
          <div style={{ fontSize: 12, color: "#2F6B55", fontWeight: 800 }}>
            Page {mvPage} of {mvTotalPages} • Showing {(mvPage - 1) * MV_PAGE_SIZE + 1}–
            {Math.min(mvPage * MV_PAGE_SIZE, movements.length)} of {movements.length}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Btn style={btnSmall} onClick={() => setMvPage(1)} disabled={mvPage === 1}>
              First
            </Btn>
            <Btn style={btnSmall} onClick={() => setMvPage((p) => Math.max(1, p - 1))} disabled={mvPage === 1}>
              Prev
            </Btn>
            <Btn style={btnSmall} onClick={() => setMvPage((p) => Math.min(mvTotalPages, p + 1))} disabled={mvPage === mvTotalPages}>
              Next
            </Btn>
            <Btn style={btnSmall} onClick={() => setMvPage(mvTotalPages)} disabled={mvPage === mvTotalPages}>
              Last
            </Btn>
          </div>
        </div>
      ) : null}
    </div>
  );
}
