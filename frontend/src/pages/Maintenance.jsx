// src/pages/Maintenance.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

//////////////////////
// THEME (match Inventory page)
//////////////////////
const pageBg = {
  minHeight: "100vh",
  padding: 22,
  color: "#0B2A1F",
};

const container = { maxWidth: 1180, margin: "0 auto" };

const panel = {
  background: "#FFFFFF",
  borderRadius: 18,
  padding: 18,
  border: "1px solid rgba(20, 80, 60, 0.10)",
  boxShadow: "0 14px 40px rgba(10, 40, 30, 0.08)",
};

const headerRow = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const title = {
  fontSize: 34,
  fontWeight: 950,
  letterSpacing: -0.8,
  margin: 0,
  lineHeight: 1.05,
};
const sub = { marginTop: 8, color: "#2F6B55", fontWeight: 700, fontSize: 12 };

//////////////////////
// Inventory pill controls
//////////////////////
const pillsWrap = {
  marginTop: 14,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const pillBase = {
  borderRadius: 999,
  padding: "10px 16px",
  fontWeight: 900,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "#FFFFFF",
  color: "#0B2A1F",
  boxShadow: "0 8px 18px rgba(10, 40, 30, 0.10)",
  cursor: "pointer",
  transition: "transform .08s ease, box-shadow .08s ease",
  userSelect: "none",
};

const btn = (variant = "ghost") => {
  if (variant === "primary") {
    return {
      ...pillBase,
      border: "1px solid rgba(18, 140, 76, 0.25)",
      background: "#16A34A",
      color: "#FFFFFF",
      boxShadow: "0 10px 22px rgba(22, 163, 74, 0.28)",
    };
  }
  if (variant === "danger") {
    return {
      ...pillBase,
      border: "1px solid rgba(239, 68, 68, 0.25)",
      background: "rgba(239, 68, 68, 0.10)",
      color: "#991B1B",
      boxShadow: "0 10px 22px rgba(239, 68, 68, 0.10)",
    };
  }
  if (variant === "neutral") {
    return { ...pillBase, background: "#EEF2F1", boxShadow: "none" };
  }
  if (variant === "ghost") {
    return { ...pillBase, background: "#F3F6F5", color: "#123B2A" };
  }
  return pillBase;
};

const btnSmall = (variant = "ghost") => ({
  ...btn(variant),
  padding: "9px 13px",
  fontWeight: 900,
});

const pillInput = {
  borderRadius: 999,
  padding: "10px 14px",
  fontWeight: 800,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#FFFFFF",
  color: "#0B2A1F",
  outline: "none",
  boxShadow: "0 8px 18px rgba(10, 40, 30, 0.08)",
  minWidth: 240,
  boxSizing: "border-box",
};

const pillSelectWrap = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
};

const pillSelect = {
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  borderRadius: 999,
  padding: "10px 42px 10px 14px",
  fontWeight: 900,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#FFFFFF",
  color: "#0B2A1F",
  boxShadow: "0 8px 18px rgba(10, 40, 30, 0.08)",
  cursor: "pointer",
  outline: "none",
  minWidth: 160,
  boxSizing: "border-box",
};

const selectChevron = {
  position: "absolute",
  right: 14,
  pointerEvents: "none",
  fontSize: 14,
  color: "rgba(11,42,31,0.65)",
};

const divider = { height: 1, background: "rgba(20,80,60,0.10)", marginTop: 14 };

const gridHeader = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "1.4fr 0.5fr 0.5fr 0.4fr",
  gap: 10,
  padding: "0 10px",
  color: "#2F6B55",
  fontWeight: 1000,
  fontSize: 11,
  letterSpacing: 0.6,
  textTransform: "uppercase",
};

const listWrap = { marginTop: 10, display: "flex", flexDirection: "column", gap: 10 };

const cardRow = {
  background: "linear-gradient(180deg,#FFFFFF 0%,#FBFFFD 100%)",
  borderRadius: 18,
  border: "1px solid rgba(20,80,60,0.12)",
  boxShadow: "0 12px 26px rgba(10,40,30,0.06)",
  padding: 12,
};

const rowGrid = {
  display: "grid",
  gridTemplateColumns: "1.4fr 0.5fr 0.5fr 0.4fr",
  gap: 10,
  alignItems: "center",
};

const badge = (status) => {
  const map = {
    OPEN: { bg: "#FFF3C4", bd: "rgba(160,120,0,0.25)", fg: "#5B4300" },
    DONE: { bg: "#D7F7E4", bd: "rgba(0,120,80,0.20)", fg: "#0B2A1F" },
    CANCELLED: { bg: "#FFE1E1", bd: "rgba(160,0,0,0.20)", fg: "#5B0000" },
    LIVE: { bg: "#E8FBF2", bd: "rgba(0,120,80,0.20)", fg: "#0B2A1F" },
    SELECTED: { bg: "#D7F7E4", bd: "rgba(0,120,80,0.20)", fg: "#0B2A1F" },
  };
  const c = map[status] || { bg: "#eee", bd: "rgba(0,0,0,0.12)", fg: "#0B2A1F" };
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    borderRadius: 999,
    background: c.bg,
    border: `1px solid ${c.bd}`,
    fontWeight: 1000,
    fontSize: 12,
    color: c.fg,
    whiteSpace: "nowrap",
  };
};

function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m ${ss}s`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

function fmtDateTime(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function pressFx(e) {
  e.currentTarget.style.transform = "translateY(1px)";
  e.currentTarget.style.boxShadow = "0 6px 14px rgba(10, 40, 30, 0.08)";
  setTimeout(() => {
    if (!e.currentTarget) return;
    e.currentTarget.style.transform = "translateY(0px)";
    e.currentTarget.style.boxShadow = "";
  }, 120);
}

function Modal({ open, titleText, onClose, children, width = 920 }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 20, 15, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
      onMouseDown={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: width,
          background: "#fff",
          borderRadius: 26,
          border: "1px solid rgba(20,80,60,0.12)",
          boxShadow: "0 22px 80px rgba(10,40,30,0.28)",
          overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 1100, fontSize: 15, letterSpacing: -0.2 }}>{titleText}</div>
          <button onMouseDown={pressFx} onClick={onClose} style={btn("ghost")}>
            Close
          </button>
        </div>

        <div
          style={{
            padding: 16,
            borderTop: "1px solid rgba(20,80,60,0.10)",
            maxHeight: "calc(100vh - 140px)",
            overflow: "auto",
            boxSizing: "border-box",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Maintenance() {
  const { user } = useAuth();
  const role = user?.role || "UNKNOWN";
  const allowed = role === "OWNER" || role === "ADMIN" || role === "STAFF";

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

  // ✅ wheel replacement (installed units on truck)
  const [assignedUnits, setAssignedUnits] = useState([]);
  const [replaceUnitId, setReplaceUnitId] = useState("");
  const [assignedLoading, setAssignedLoading] = useState(false);

  // use non-serialized
  const [useItemId, setUseItemId] = useState("");
  const [useLocationId, setUseLocationId] = useState("");
  const [useQty, setUseQty] = useState("");
  const [useNote, setUseNote] = useState("");
  const [usingStock, setUsingStock] = useState(false);

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
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

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

      // ✅ reset replacement state
      setAssignedUnits([]);
      setReplaceUnitId("");
      setAssignedLoading(false);

      setUseItemId("");
      setUseLocationId("");
      setUseQty("");
      setUseNote("");
    } catch (e) {
      setErr(e.message || "Failed to load detail");
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
    loadTrucks("").catch((e) => setErr(e.message || "Failed to load trucks"));
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

  // ✅ Title is: "PLATE - title"
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
      setErr(e.message || "Failed to create");
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
      setErr(e.message || "Failed to update status");
    }
  }

  async function loadAvailableUnits(itemId) {
    if (!activeJob?.id || !itemId) return;
    const data = await api(`/maintenance/${activeJob.id}/available-units?itemId=${encodeURIComponent(itemId)}`);
    setAvailableUnits(data.units || []);
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
          // ✅ optional replacement unit to be scrapped (backend must handle this)
          replaceStockUnitId: replaceUnitId || undefined,
        }),
      });

      setAssignNote("");
      setUnitPick("");

      // ✅ reset replacement dropdown
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

  // live tick usage
  const _ = tick;

  return (
    <div style={pageBg}>
      <div style={container}>
        <div style={panel}>
          <div style={headerRow}>
            <div>
              <h1 style={title}>Maintenance</h1>
              <div style={sub}>Create jobs, track ongoing time, and record spare parts used</div>
            </div>

            {allowed && (
              <button onMouseDown={pressFx} style={btn("primary")} onClick={startCreate}>
                + New Maintenance
              </button>
            )}
          </div>

          {err ? (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 16,
                background: "#FFECEC",
                border: "1px solid rgba(160,0,0,0.15)",
                fontWeight: 900,
              }}
            >
              {err}
            </div>
          ) : null}

          <div style={pillsWrap}>
            <input
              style={{ ...pillInput, minWidth: 260 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title / truck plate..."
            />

            <div style={pillSelectWrap}>
              <select style={pillSelect} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="OPEN">OPEN</option>
                <option value="DONE">DONE</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
              <span style={selectChevron}>▾</span>
            </div>

            <input style={{ ...pillInput, minWidth: 170 }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input style={{ ...pillInput, minWidth: 170 }} type="date" value={to} onChange={(e) => setTo(e.target.value)} />

            <button onMouseDown={pressFx} style={btn("primary")} onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Apply"}
            </button>
          </div>

          <div style={divider} />

          <div style={gridHeader}>
            <div>Job</div>
            <div>Status</div>
            <div>Duration</div>
            <div style={{ textAlign: "right" }}>Action</div>
          </div>

          <div style={listWrap}>
            {(jobs || []).map((j) => {
              const createdMs = new Date(j.createdAt).getTime();
              const endMs = j.status === "OPEN" ? Date.now() : j.doneAt ? new Date(j.doneAt).getTime() : Date.now();
              const dur = Math.max(0, endMs - createdMs);

              return (
                <div key={j.id} style={cardRow}>
                  <div style={rowGrid}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 1100, letterSpacing: -0.2 }}>{j.title}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#2F6B55", marginTop: 4 }}>
                        {j.truck?.plateNumber || "—"} • {fmtDateTime(j.createdAt)}
                      </div>
                    </div>

                    <div>
                      <span style={badge(j.status)}>{j.status}</span>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, fontWeight: 900, color: "#2F6B55" }}>
                        {j.status === "OPEN" ? <span style={badge("LIVE")}>LIVE</span> : "TOTAL"}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 1100, marginTop: 6 }}>{fmtDuration(dur)}</div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <button onMouseDown={pressFx} style={btnSmall("ghost")} onClick={() => openDetail(j.id)}>
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {!loading && (!jobs || jobs.length === 0) ? (
              <div style={{ padding: 14, color: "#2F6B55", fontWeight: 900 }}>No maintenance jobs found.</div>
            ) : null}
          </div>
        </div>

        {/* CREATE MODAL */}
        <Modal open={showCreate} titleText="Create Maintenance Job" onClose={() => setShowCreate(false)} width={980}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14 }}>
            <div
              style={{
                border: "1px solid rgba(20,80,60,0.12)",
                borderRadius: 22,
                padding: 12,
                boxSizing: "border-box",
                minWidth: 0,
              }}
            >
              <div style={{ fontWeight: 1100, marginBottom: 10 }}>Pick Truck (search by plate)</div>

              <input
                style={{ ...pillInput, borderRadius: 16, width: "100%", maxWidth: "100%", minWidth: 0 }}
                value={truckSearch}
                onChange={(e) => setTruckSearch(e.target.value)}
                placeholder="Search plate number..."
              />

              <div style={{ marginTop: 10, maxHeight: 320, overflow: "auto", paddingRight: 2 }}>
                {trucksLoading ? <div style={{ padding: 10, color: "#2F6B55", fontWeight: 900 }}>Loading trucks...</div> : null}
                {!trucksLoading && (filteredTrucks || []).length === 0 ? (
                  <div style={{ padding: 10, color: "#2F6B55", fontWeight: 900 }}>No trucks found.</div>
                ) : null}

                {(filteredTrucks || []).map((t) => {
                  const selected = createForm.truckId === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setCreateForm((f) => ({ ...f, truckId: t.id }))}
                      style={{
                        padding: 12,
                        borderRadius: 18,
                        border: selected ? "1px solid rgba(0,120,80,0.35)" : "1px solid rgba(20,80,60,0.10)",
                        background: selected ? "linear-gradient(180deg,#E8FBF2 0%,#DDF7EA 100%)" : "#fff",
                        marginTop: 10,
                        cursor: "pointer",
                        fontWeight: 900,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        boxSizing: "border-box",
                        minWidth: 0,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 1100, letterSpacing: -0.2 }}>{t.plateNumber}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#2F6B55", marginTop: 4 }}>
                          {t.brand || "—"} {t.model || ""} • {t.status}
                        </div>
                      </div>
                      {selected ? <div style={badge("SELECTED")}>Selected</div> : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                border: "1px solid rgba(20,80,60,0.12)",
                borderRadius: 22,
                padding: 12,
                boxSizing: "border-box",
                minWidth: 0,
              }}
            >
              <div style={{ fontWeight: 1100, marginBottom: 10 }}>Job Info</div>

              <input
                style={{ ...pillInput, borderRadius: 16, width: "100%", maxWidth: "100%", minWidth: 0, marginBottom: 10 }}
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Title (e.g. Brake service)"
              />

              <input
                style={{ ...pillInput, borderRadius: 16, width: "100%", maxWidth: "100%", minWidth: 0, marginBottom: 10 }}
                value={createForm.odometerKm}
                onChange={(e) => setCreateForm((f) => ({ ...f, odometerKm: e.target.value }))}
                placeholder="Odometer (km) optional"
              />

              <textarea
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.12)",
                  padding: 12,
                  minHeight: 140,
                  outline: "none",
                  background: "#fff",
                  color: "#0B2A1F",
                  fontWeight: 800,
                  fontSize: 13,
                  resize: "none",
                  boxShadow: "0 8px 18px rgba(10, 40, 30, 0.06)",
                }}
                value={createForm.note}
                onChange={(e) => setCreateForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Note (optional)"
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button onMouseDown={pressFx} style={btn("ghost")} onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button
                  onMouseDown={pressFx}
                  style={btn("primary")}
                  onClick={createJob}
                  disabled={creating || !createForm.truckId || !String(createForm.title || "").trim()}
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        </Modal>

        {/* DETAIL MODAL */}
        <Modal open={showDetail} titleText="Maintenance Detail" onClose={() => setShowDetail(false)} width={1040}>
          {detailLoading || !activeJob ? (
            <div style={{ padding: 14, fontWeight: 900, color: "#2F6B55" }}>Loading...</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* LEFT */}
              <div style={{ border: "1px solid rgba(20,80,60,0.12)", borderRadius: 22, padding: 14, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 1100, fontSize: 16, letterSpacing: -0.2 }}>{activeJob.title}</div>
                    <div style={{ fontWeight: 800, color: "#2F6B55", fontSize: 12, marginTop: 4 }}>
                      {activeJob.truck?.plateNumber || "—"} • Created: {fmtDateTime(activeJob.createdAt)}
                    </div>
                  </div>
                  <div style={badge(activeJob.status)}>{activeJob.status}</div>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 18,
                    border: "1px solid rgba(20,80,60,0.10)",
                    background: "linear-gradient(180deg,#F7FFFB 0%,#FFFFFF 100%)",
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 12, color: "#2F6B55" }}>
                    {activeJob.status === "OPEN" ? "Live duration (running)" : "Total duration"}
                  </div>
                  <div style={{ fontWeight: 1200, fontSize: 20, marginTop: 6 }}>
                    {fmtDuration(
                      (activeJob.status === "OPEN"
                        ? Date.now()
                        : activeJob.doneAt
                        ? new Date(activeJob.doneAt).getTime()
                        : Date.now()) - new Date(activeJob.createdAt).getTime()
                    )}
                  </div>
                </div>

                {allowed ? (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                    <button
                      onMouseDown={pressFx}
                      style={btn("primary")}
                      onClick={() => setJobStatus("DONE")}
                      disabled={activeJob.status !== "OPEN"}
                    >
                      Mark DONE
                    </button>
                    <button
                      onMouseDown={pressFx}
                      style={btn("ghost")}
                      onClick={() => setJobStatus("CANCELLED")}
                      disabled={activeJob.status !== "OPEN"}
                    >
                      Cancel
                    </button>
                    <button onMouseDown={pressFx} style={btn("ghost")} onClick={refreshDetail}>
                      Refresh
                    </button>
                  </div>
                ) : null}
              </div>

              {/* RIGHT */}
              <div style={{ border: "1px solid rgba(20,80,60,0.12)", borderRadius: 22, padding: 14, minWidth: 0 }}>
                <div style={{ fontWeight: 1100, marginBottom: 10 }}>Record Spareparts Used</div>

                {/* A) Serialized assign */}
                <div style={{ border: "1px solid rgba(20,80,60,0.10)", borderRadius: 18, padding: 12 }}>
                  <div style={{ fontWeight: 1100, fontSize: 13 }}>A) Assign Serialized Unit</div>

                  {/* ✅ 3 dropdowns: item, new unit, replace installed unit */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                    {/* 1) item */}
                    <div style={pillSelectWrap}>
                      <select
                        style={{ ...pillSelect, minWidth: 0, width: "100%" }}
                        value={assignItemId}
                        onChange={async (e) => {
                          const v = e.target.value;
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
                      >
                        <option value="">Select serialized item</option>
                        {serializedItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.sku} — {it.name}
                          </option>
                        ))}
                      </select>
                      <span style={selectChevron}>▾</span>
                    </div>

                    {/* 2) new unit */}
                    <div style={pillSelectWrap}>
                      <select
                        style={{ ...pillSelect, minWidth: 0, width: "100%" }}
                        value={unitPick}
                        onChange={(e) => setUnitPick(e.target.value)}
                        disabled={!allowed || activeJob.status !== "OPEN" || !assignItemId}
                      >
                        <option value="">Pick stock unit</option>
                        {availableUnits.map((u) => (
                          <option key={u.id} value={u.id}>
                            {(u.serialNumber || u.barcode || u.id.slice(0, 8))} • {u.location?.name || "No location"}
                          </option>
                        ))}
                      </select>
                      <span style={selectChevron}>▾</span>
                    </div>

                    {/* 3) replace installed */}
                    <div style={pillSelectWrap}>
                      <select
                        style={{ ...pillSelect, minWidth: 0, width: "100%" }}
                        value={replaceUnitId}
                        onChange={(e) => setReplaceUnitId(e.target.value)}
                        disabled={!allowed || activeJob.status !== "OPEN" || !assignItemId}
                      >
                        <option value="">
                          {assignedLoading ? "Loading installed..." : "Replace / Scrap installed (optional)"}
                        </option>
                        {(assignedUnits || []).map((u) => (
                          <option key={u.stockUnitId} value={u.stockUnitId}>
                            {(u.stockUnit?.serialNumber || u.stockUnit?.barcode || u.stockUnitId.slice(0, 8))} • Installed{" "}
                            {fmtDateTime(u.installedAt)}
                          </option>
                        ))}
                      </select>
                      <span style={selectChevron}>▾</span>
                    </div>
                  </div>

                  <input
                    style={{ ...pillInput, borderRadius: 16, width: "100%", maxWidth: "100%", minWidth: 0, marginTop: 10 }}
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    placeholder="Note (optional)"
                    disabled={!allowed || activeJob.status !== "OPEN"}
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                    <button
                      onMouseDown={pressFx}
                      style={btn("primary")}
                      onClick={assignUnit}
                      disabled={!allowed || activeJob.status !== "OPEN" || assigning || !unitPick}
                    >
                      {assigning ? "Assigning..." : "Assign Unit"}
                    </button>
                  </div>
                </div>

                {/* B) Non-serialized use */}
                <div style={{ border: "1px solid rgba(20,80,60,0.10)", borderRadius: 18, padding: 12, marginTop: 12 }}>
                  <div style={{ fontWeight: 1100, fontSize: 13 }}>B) Use Non-Serialized Stock (qty)</div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                    <div style={pillSelectWrap}>
                      <select
                        style={{ ...pillSelect, minWidth: 0, width: "100%" }}
                        value={useItemId}
                        onChange={(e) => setUseItemId(e.target.value)}
                        disabled={!allowed || activeJob.status !== "OPEN"}
                      >
                        <option value="">Select non-serialized item</option>
                        {nonSerializedItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.sku} — {it.name} ({it.unit})
                          </option>
                        ))}
                      </select>
                      <span style={selectChevron}>▾</span>
                    </div>

                    <div style={pillSelectWrap}>
                      <select
                        style={{ ...pillSelect, minWidth: 0, width: "100%" }}
                        value={useLocationId}
                        onChange={(e) => setUseLocationId(e.target.value)}
                        disabled={!allowed || activeJob.status !== "OPEN"}
                      >
                        <option value="">Select location</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                      <span style={selectChevron}>▾</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                    <input
                      style={{ ...pillInput, borderRadius: 16, minWidth: 0, width: "100%" }}
                      value={useQty}
                      onChange={(e) => setUseQty(e.target.value)}
                      placeholder="Qty"
                      disabled={!allowed || activeJob.status !== "OPEN"}
                    />
                    <input
                      style={{ ...pillInput, borderRadius: 16, minWidth: 0, width: "100%" }}
                      value={useNote}
                      onChange={(e) => setUseNote(e.target.value)}
                      placeholder="Note (optional)"
                      disabled={!allowed || activeJob.status !== "OPEN"}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                    <button
                      onMouseDown={pressFx}
                      style={btn("danger")}
                      onClick={useStock}
                      disabled={!allowed || activeJob.status !== "OPEN" || usingStock}
                    >
                      {usingStock ? "Saving..." : "Use Stock"}
                    </button>
                  </div>
                </div>
              </div>

              {/* FULL WIDTH TABLES */}
              <div style={{ gridColumn: "1 / -1", border: "1px solid rgba(20,80,60,0.12)", borderRadius: 22, padding: 14 }}>
                <div style={{ fontWeight: 1100, marginBottom: 10 }}>Spareparts used in this maintenance</div>

                <div style={{ fontWeight: 1100, color: "#2F6B55", fontSize: 12 }}>Serialized assignments</div>
                <div style={{ marginTop: 8, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", fontSize: 12, color: "#2F6B55" }}>
                        <th style={{ padding: 8 }}>Installed At</th>
                        <th style={{ padding: 8 }}>Item</th>
                        <th style={{ padding: 8 }}>Unit</th>
                        <th style={{ padding: 8 }}>From</th>
                        <th style={{ padding: 8 }}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeJob.sparePartAssignments || []).map((a) => (
                        <tr key={a.id} style={{ borderTop: "1px solid rgba(20,80,60,0.10)", fontSize: 13, fontWeight: 800 }}>
                          <td style={{ padding: 8 }}>{fmtDateTime(a.installedAt)}</td>
                          <td style={{ padding: 8 }}>
                            {a.stockUnit?.item?.sku} — {a.stockUnit?.item?.name}
                          </td>
                          <td style={{ padding: 8 }}>
                            {a.stockUnit?.serialNumber || a.stockUnit?.barcode || a.stockUnitId.slice(0, 8)}
                          </td>
                          <td style={{ padding: 8 }}>{a.stockUnit?.location?.name || "—"}</td>
                          <td style={{ padding: 8 }}>{a.note || "—"}</td>
                        </tr>
                      ))}
                      {(activeJob.sparePartAssignments || []).length === 0 ? (
                        <tr>
                          <td style={{ padding: 10, color: "#2F6B55", fontWeight: 800 }} colSpan={5}>
                            No serialized spareparts assigned yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 16, fontWeight: 1100, color: "#2F6B55", fontSize: 12 }}>
                  Stock movements linked to this maintenance (includes qty usage)
                </div>
                <div style={{ marginTop: 8, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", fontSize: 12, color: "#2F6B55" }}>
                        <th style={{ padding: 8 }}>Time</th>
                        <th style={{ padding: 8 }}>Type</th>
                        <th style={{ padding: 8 }}>Item</th>
                        <th style={{ padding: 8 }}>Qty</th>
                        <th style={{ padding: 8 }}>From</th>
                        <th style={{ padding: 8 }}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeJob.movements || []).map((m) => (
                        <tr key={m.id} style={{ borderTop: "1px solid rgba(20,80,60,0.10)", fontSize: 13, fontWeight: 800 }}>
                          <td style={{ padding: 8 }}>{fmtDateTime(m.createdAt)}</td>
                          <td style={{ padding: 8 }}>{m.type}</td>
                          <td style={{ padding: 8 }}>
                            {m.item?.sku} — {m.item?.name}
                          </td>
                          <td style={{ padding: 8 }}>{m.qty}</td>
                          <td style={{ padding: 8 }}>{m.fromLocation?.name || "—"}</td>
                          <td style={{ padding: 8 }}>{m.note || "—"}</td>
                        </tr>
                      ))}
                      {(activeJob.movements || []).length === 0 ? (
                        <tr>
                          <td style={{ padding: 10, color: "#2F6B55", fontWeight: 800 }} colSpan={6}>
                            No stock movements recorded yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
