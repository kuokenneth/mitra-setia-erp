// src/pages/Trucks.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import {
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiTruck,
  FiCalendar,
  FiAlertTriangle,
} from "react-icons/fi";

// Corporate Green Color Palette (matching Landing Page)
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
  error: "#EF4444",
  errorBg: "#FEF2F2",
  blue: "#3B82F6",
  blueBg: "#EFF6FF",
};

export default function Trucks() {
  const { user } = useAuth();
  const role = user?.role || "UNKNOWN";
  const allowed = role === "OWNER" || role === "ADMIN" || role === "STAFF";

  const [items, setItems] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [asgLoading, setAsgLoading] = useState(false);
  const [movErr, setMovErr] = useState("");
  const [movQ, setMovQ] = useState("");
  const [movFrom, setMovFrom] = useState("");
  const [movTo, setMovTo] = useState("");
  const [monthTotal, setMonthTotal] = useState(0);
  const [monthCurrency, setMonthCurrency] = useState("IDR");

  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    plateNumber: "",
    brand: "",
    model: "",
    year: "",
    vin: "",
    stnkExpiry: "",
    status: "READY",
    driverUserId: "",
  });

  const driverOptions = useMemo(() => {
    const base = [{ id: "", name: "Unassigned" }];
    const mapped = (drivers || []).map((d) => ({
      id: d.id,
      name: d.name || d.email,
      email: d.email,
    }));
    return base.concat(mapped);
  }, [drivers]);

  const assignedDriverIds = useMemo(() => {
    const set = new Set();
    for (const t of items) {
      if (t.driverUser?.id) set.add(t.driverUser.id);
    }
    return set;
  }, [items]);

  function optionsForTruck(truck) {
    const base = [{ id: "", name: "Unassigned" }];
    const allowedDrivers = (drivers || []).filter((d) => {
      const id = d.id;
      const isAssignedSomewhere = assignedDriverIds.has(id);
      const isCurrentForThisTruck = truck.driverUser?.id === id;
      return !isAssignedSomewhere || isCurrentForThisTruck;
    });
    return base.concat(
      allowedDrivers.map((d) => ({ id: d.id, name: d.name || d.email, email: d.email }))
    );
  }

  async function load({ resetPage = false } = {}) {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());

      const [t, d] = await Promise.all([
        api(`/trucks?${params.toString()}`),
        api("/drivers"),
      ]);

      const truckList = t.items || [];
      setItems(truckList);
      setDrivers(d.items || []);

      if (selectedTruck?.id) {
        const stillExists = truckList.some((x) => x.id === selectedTruck.id);
        if (!stillExists) {
          setSelectedTruck(null);
          setAssignments([]);
        }
      }

      if (resetPage) setPage(1);
    } catch (e) {
      setErr(e.message || "Failed to load trucks");
    } finally {
      setLoading(false);
    }
  }

  async function loadAssignments(truckId) {
    if (!truckId) return;
    setAsgLoading(true);
    setMovErr("");
    try {
      const params = new URLSearchParams();
      if (movQ.trim()) params.set("q", movQ.trim());
      if (movFrom) params.set("from", movFrom);
      if (movTo) params.set("to", movTo);

      const r = await api(`/trucks/${truckId}/spareparts?${params.toString()}`);
      const rows = r.rows || r.items || [];
      setAssignments(rows);
      setMonthTotal(Number(r.monthTotalCost || 0));
      setMonthCurrency(r.monthCurrency || "IDR");
    } catch (e) {
      setMovErr(e.message || "Failed to load spareparts");
      setAssignments([]);
    } finally {
      setAsgLoading(false);
    }
  }

  useEffect(() => {
    if (!allowed) return;
    load();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setShowAdd(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onSearch(e) {
    e.preventDefault();
    load({ resetPage: true });
  }

  async function onCreate(e) {
    e.preventDefault();
    setCreating(true);
    setErr("");

    try {
      const payload = {
        plateNumber: form.plateNumber,
        brand: form.brand || null,
        model: form.model || null,
        vin: form.vin || null,
        year: form.year ? Number(form.year) : null,
        stnkExpiry: form.stnkExpiry || null,
        status: form.status,
        driverUserId: form.driverUserId || null,
      };

      await api("/trucks", { method: "POST", body: JSON.stringify(payload) });

      setForm({
        plateNumber: "",
        brand: "",
        model: "",
        year: "",
        vin: "",
        stnkExpiry: "",
        status: "READY",
        driverUserId: "",
      });

      setShowAdd(false);
      await load({ resetPage: false });
    } catch (e) {
      setErr(e.message || "Failed to create truck");
    } finally {
      setCreating(false);
    }
  }

  async function onAssign(truckId, driverUserId) {
    try {
      await api(`/trucks/${truckId}/assign`, {
        method: "PUT",
        body: JSON.stringify({ driverUserId: driverUserId || null }),
      });
      await load({ resetPage: false });
    } catch (e) {
      alert(e.message || "Failed to assign driver");
    }
  }

  async function updateStnk(truckId, date) {
    try {
      await api(`/trucks/${truckId}/stnk`, {
        method: "PUT",
        body: JSON.stringify({ stnkExpiry: date || null }),
      });
      await load({ resetPage: false });
    } catch (e) {
      alert(e.message || "Failed to update STNK expiry");
    }
  }

  function onPickTruck(truck) {
    setSelectedTruck(truck);
    setAssignments([]);
    setMovErr("");
    loadAssignments(truck.id);
  }

  const totalPages = useMemo(() => {
    const n = Math.ceil((items.length || 0) / PAGE_SIZE);
    return Math.max(1, n);
  }, [items.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return (items || []).slice(start, start + PAGE_SIZE);
  }, [items, page]);

  if (!allowed) {
    return (
      <div data-testid="trucks-page">
        <div style={s.header}>
          <h1 style={s.title}>Trucks</h1>
          <p style={s.subtitle}>You don't have permission to view this page.</p>
        </div>
        <div style={s.card}>
          <div style={s.alertErr}>Forbidden</div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="trucks-page">
      {/* Header */}
      <div style={s.headerRow}>
        <div>
          <h1 style={s.title}>Trucks</h1>
          <p style={s.subtitle}>Manage fleet and assign drivers</p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setShowAdd(true)} style={s.primaryBtn} data-testid="add-truck-btn">
            <FiPlus size={16} />
            Add Truck
          </button>
          <button onClick={() => load({ resetPage: false })} disabled={loading} style={s.secondaryBtn} data-testid="refresh-btn">
            <FiRefreshCw size={16} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {err && <div style={s.alertErr}>{err}</div>}

      {/* Fleet Card */}
      <div style={s.card}>
        <div style={s.cardHeaderRow}>
          <div>
            <h2 style={s.cardTitle}>Fleet</h2>
            <p style={s.cardSubtitle}>Click a truck row to see sparepart usage.</p>
          </div>

          <form onSubmit={onSearch} style={s.searchRow}>
            <div style={s.inputWrap}>
              <FiSearch size={16} color={BRAND.textMuted} />
              <input
                style={s.searchInput}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search plate/brand/model…"
                data-testid="trucks-search-input"
              />
            </div>
            <button type="submit" disabled={loading} style={s.searchBtn} data-testid="trucks-search-btn">
              Search
            </button>
          </form>
        </div>

        {/* Pagination Bar */}
        <div style={s.paginationBar}>
          <span style={s.paginationText}>
            Showing <strong>{pagedItems.length}</strong> of <strong>{items.length}</strong> trucks
          </span>

          <div style={s.paginationBtns}>
            <button
              style={{ ...s.paginationBtn, opacity: page <= 1 ? 0.5 : 1 }}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="trucks-prev-btn"
            >
              <FiChevronLeft size={16} />
              Prev
            </button>

            <span style={s.pageInfo}>
              Page <strong>{page}</strong> / <strong>{totalPages}</strong>
            </span>

            <button
              style={{ ...s.paginationBtn, opacity: page >= totalPages ? 0.5 : 1 }}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              data-testid="trucks-next-btn"
            >
              Next
              <FiChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Plate</th>
                <th style={s.th}>Vehicle</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Assigned Driver</th>
                <th style={s.th}>STNK Expiry</th>
                <th style={s.th}>Created</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((t) => {
                const active = selectedTruck?.id === t.id;
                return (
                  <tr
                    key={t.id}
                    style={{ ...s.tr, background: active ? BRAND.accent : BRAND.white, cursor: "pointer" }}
                    onClick={() => onPickTruck(t)}
                    data-testid={`truck-row-${t.id}`}
                  >
                    <td style={s.tdStrong}>{t.plateNumber}</td>
                    <td style={s.td}>
                      <div style={{ fontWeight: 600 }}>
                        {[t.brand, t.model].filter(Boolean).join(" ") || "-"}
                      </div>
                      <div style={s.smallMuted}>{t.vin ? `VIN: ${t.vin}` : "—"}</div>
                    </td>
                    <td style={s.td}>
                      <span style={statusPill(t.status || "READY")}>{t.status || "READY"}</span>
                    </td>
                    <td style={s.td} onClick={(e) => e.stopPropagation()}>
                      <select
                        style={{ ...s.driverSelect, opacity: t.status === "INACTIVE" ? 0.55 : 1 }}
                        disabled={t.status === "INACTIVE"}
                        value={t.driverUser?.id || ""}
                        onChange={(e) => onAssign(t.id, e.target.value)}
                        data-testid={`driver-select-${t.id}`}
                      >
                        {optionsForTruck(t).map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <div style={s.smallMuted}>
                        {t.status === "INACTIVE" ? "Inactive truck" : t.driverUser?.email || "No driver"}
                      </div>
                    </td>
                    <td style={s.td} onClick={(e) => e.stopPropagation()}>
                      <div style={s.stnkWrap}>
                        <input
                          type="date"
                          value={t.stnkExpiry ? t.stnkExpiry.slice(0, 10) : ""}
                          onChange={(e) => updateStnk(t.id, e.target.value)}
                          style={{ ...s.dateInput, ...stnkInputStyle(t.stnkExpiry) }}
                          data-testid={`stnk-input-${t.id}`}
                        />
                        {shouldShowStnkWarning(t.stnkExpiry) && (
                          <span style={stnkBadge(t.stnkExpiry)}>
                            <FiAlertTriangle size={10} />
                            {stnkLabel(t.stnkExpiry)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={s.td}>
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                );
              })}

              {!loading && pagedItems.length === 0 && (
                <tr>
                  <td style={s.empty} colSpan={6}>No trucks found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p style={s.footerNote}>Only OWNER/ADMIN/STAFF can manage trucks.</p>
      </div>

      {/* Sparepart Movements Panel */}
      {selectedTruck && (
        <div style={{ ...s.card, marginTop: 24 }}>
          <div style={s.movHeader}>
            <div>
              <h2 style={s.cardTitle}>
                Sparepart Movements — <strong>{selectedTruck.plateNumber}</strong>
              </h2>
              <p style={s.cardSubtitle}>Shows spareparts used/recorded for this truck.</p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button style={s.secondaryBtn} onClick={() => { setSelectedTruck(null); setAssignments([]); }} data-testid="close-movements-btn">
                <FiX size={16} /> Close
              </button>
              <button style={s.primaryBtnSmall} disabled={asgLoading} onClick={() => loadAssignments(selectedTruck.id)} data-testid="refresh-movements-btn">
                {asgLoading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

          <div style={s.movFilters}>
            <div style={s.inputWrap}>
              <FiSearch size={16} color={BRAND.textMuted} />
              <input
                style={s.searchInput}
                value={movQ}
                onChange={(e) => setMovQ(e.target.value)}
                placeholder="Search item name / note…"
              />
            </div>

            <div style={s.movDates}>
              <input type="date" style={s.dateInput} value={movFrom} onChange={(e) => setMovFrom(e.target.value)} />
              <input type="date" style={s.dateInput} value={movTo} onChange={(e) => setMovTo(e.target.value)} />
            </div>

            <button style={s.primaryBtnSmall} disabled={asgLoading} onClick={() => loadAssignments(selectedTruck.id)}>Apply</button>
            <button style={s.ghostBtn} disabled={asgLoading} onClick={() => { setMovQ(""); setMovFrom(""); setMovTo(""); loadAssignments(selectedTruck.id); }}>Reset</button>

            <span style={s.monthBadge}>
              This month: {fmtMoney(monthTotal, monthCurrency)}
            </span>
          </div>

          {movErr && <div style={s.alertErr}>{movErr}</div>}

          <div style={s.tableWrap}>
            <table style={{ ...s.table, minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={s.th}>Installed</th>
                  <th style={s.th}>Removed</th>
                  <th style={s.th}>Item</th>
                  <th style={s.th}>Serial / Barcode</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Note</th>
                </tr>
              </thead>
              <tbody>
                {asgLoading ? (
                  <tr><td style={s.empty} colSpan={6}>Loading spareparts…</td></tr>
                ) : assignments.length === 0 ? (
                  <tr><td style={s.empty} colSpan={6}>No spareparts history for this truck.</td></tr>
                ) : (
                  assignments.map((a) => (
                    <tr key={a.id} style={s.tr}>
                      <td style={s.td}>{fmtDateTime(a.installedAt)}</td>
                      <td style={s.td}>{a.removedAt ? fmtDateTime(a.removedAt) : "-"}</td>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600 }}>{a.stockUnit?.item?.name || "-"}</div>
                        <div style={s.smallMuted}>{a.stockUnit?.item?.sku ? `SKU: ${a.stockUnit.item.sku}` : "—"}</div>
                      </td>
                      <td style={s.td}>
                        <div>{a.stockUnit?.serialNumber || "-"}</div>
                        <div style={s.smallMuted}>{a.stockUnit?.barcode ? `Barcode: ${a.stockUnit.barcode}` : "—"}</div>
                      </td>
                      <td style={s.td}>
                        <span style={a.removedAt ? statusPill("INACTIVE") : statusPill("READY")}>
                          {a.removedAt ? "REMOVED" : "INSTALLED"}
                        </span>
                      </td>
                      <td style={s.td}>
                        <div>{a.note || "-"}</div>
                        <div style={s.smallMuted}>{a.maintenance?.title ? `Maint: ${a.maintenance.title}` : "—"}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Truck Modal */}
      {showAdd && (
        <div style={s.modalOverlay} onClick={() => setShowAdd(false)} data-testid="add-truck-modal">
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>Add Truck</h3>
                <p style={s.modalSubtitle}>Add a new vehicle into the company fleet.</p>
              </div>
              <button style={s.modalClose} onClick={() => setShowAdd(false)} data-testid="close-modal-btn">
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={onCreate} style={s.form}>
              <Field label="Plate Number *">
                <input style={s.input} value={form.plateNumber} onChange={(e) => setForm((f) => ({ ...f, plateNumber: e.target.value }))} placeholder="BK 1234 XX" data-testid="plate-input" />
              </Field>

              <div style={s.twoCol}>
                <Field label="Brand">
                  <input style={s.input} value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder="Hino" />
                </Field>
                <Field label="Model">
                  <input style={s.input} value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="Tronton" />
                </Field>
              </div>

              <div style={s.twoCol}>
                <Field label="Year">
                  <input style={s.input} value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} placeholder="2020" />
                </Field>
                <Field label="Status">
                  <select style={s.select} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="READY">READY</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </Field>
              </div>

              <Field label="VIN (optional)">
                <input style={s.input} value={form.vin} onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))} placeholder="Vehicle identification number" />
              </Field>

              <Field label="STNK Expiry Date">
                <input type="date" style={s.input} value={form.stnkExpiry || ""} onChange={(e) => setForm((f) => ({ ...f, stnkExpiry: e.target.value }))} />
              </Field>

              <Field label="Assign Driver (optional)">
                <select style={s.select} value={form.driverUserId} onChange={(e) => setForm((f) => ({ ...f, driverUserId: e.target.value }))}>
                  {driverOptions.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </Field>

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="submit" disabled={creating} style={{ ...s.primaryBtn, flex: 1, opacity: creating ? 0.7 : 1 }} data-testid="submit-truck-btn">
                  {creating ? "Adding…" : "Add Truck"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} style={s.ghostBtn}>Cancel</button>
              </div>

              <p style={s.tip}>Tip: You can assign a driver later from the fleet table.</p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* Helpers */
function Field({ label, children }) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

function fmtDateTime(str) {
  if (!str) return "-";
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function fmtMoney(n, currency = "IDR") {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `${currency} ${v.toLocaleString()}`;
  }
}

function normalizeDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function stnkDiffDays(date) {
  if (!date) return null;
  const d = normalizeDay(date);
  const now = normalizeDay(new Date());
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}

function stnkLabel(date) {
  const diff = stnkDiffDays(date);
  if (diff === null) return "";
  if (diff < 0) return "Expired";
  return `${diff}d`;
}

function shouldShowStnkWarning(date) {
  const diff = stnkDiffDays(date);
  if (diff === null) return false;
  return diff <= 14;
}

function stnkInputStyle(date) {
  const diff = stnkDiffDays(date);
  if (diff === null) return {};
  if (diff < 0) return { borderColor: `${BRAND.error}60`, color: BRAND.error };
  if (diff <= 14) return { borderColor: `${BRAND.warning}60`, color: BRAND.warning };
  return {};
}

function stnkBadge(date) {
  const diff = stnkDiffDays(date);
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  };
  if (diff < 0) return { ...base, background: BRAND.errorBg, color: BRAND.error };
  return { ...base, background: BRAND.warningBg, color: BRAND.warning };
}

function statusPill(status) {
  const base = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  };
  if (status === "READY") return { ...base, background: BRAND.successBg, color: BRAND.success };
  if (status === "MAINTENANCE") return { ...base, background: BRAND.warningBg, color: BRAND.warning };
  if (status === "DISPATCH") return { ...base, background: BRAND.blueBg, color: BRAND.blue };
  return { ...base, background: "#F3F4F6", color: BRAND.textMuted };
}

/* Styles */
const s = {
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
    flexWrap: "wrap",
  },

  header: { marginBottom: 24 },
  title: { margin: 0, fontSize: 28, fontWeight: 700, color: BRAND.text },
  subtitle: { margin: "8px 0 0", fontSize: 14, color: BRAND.textMuted },

  card: {
    borderRadius: 8,
    background: BRAND.white,
    border: `1px solid ${BRAND.border}`,
    padding: 24,
  },

  cardHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    marginBottom: 16,
    flexWrap: "wrap",
  },

  cardTitle: { margin: 0, fontSize: 18, fontWeight: 600, color: BRAND.text },
  cardSubtitle: { margin: "4px 0 0", fontSize: 14, color: BRAND.textMuted },

  searchRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

  inputWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    background: BRAND.white,
  },

  searchInput: {
    border: "none",
    outline: "none",
    fontSize: 14,
    fontWeight: 500,
    color: BRAND.text,
    width: 180,
    background: "transparent",
  },

  searchBtn: {
    padding: "10px 16px",
    borderRadius: 6,
    border: "none",
    background: BRAND.primary,
    color: BRAND.white,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },

  paginationBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "12px 16px",
    borderRadius: 6,
    background: BRAND.secondary,
    marginBottom: 16,
  },

  paginationText: { fontSize: 14, color: BRAND.textLight },
  paginationBtns: { display: "flex", gap: 10, alignItems: "center" },

  paginationBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "8px 12px",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    background: BRAND.white,
    fontSize: 13,
    fontWeight: 500,
    color: BRAND.textLight,
    cursor: "pointer",
  },

  pageInfo: { fontSize: 13, color: BRAND.textMuted },

  tableWrap: {
    overflowX: "auto",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
  },

  table: { width: "100%", borderCollapse: "collapse", minWidth: 900 },

  th: {
    textAlign: "left",
    fontSize: 12,
    fontWeight: 600,
    color: BRAND.textMuted,
    padding: "12px 16px",
    background: BRAND.secondary,
    borderBottom: `1px solid ${BRAND.border}`,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  tr: { transition: "background 0.2s ease" },

  td: {
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: 500,
    color: BRAND.text,
    borderBottom: `1px solid ${BRAND.border}`,
    verticalAlign: "top",
  },

  tdStrong: {
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: 700,
    color: BRAND.text,
    borderBottom: `1px solid ${BRAND.border}`,
    verticalAlign: "top",
  },

  smallMuted: { marginTop: 4, fontSize: 12, color: BRAND.textMuted },

  driverSelect: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    fontSize: 13,
    fontWeight: 500,
    color: BRAND.text,
    cursor: "pointer",
    outline: "none",
    background: BRAND.white,
  },

  stnkWrap: { display: "flex", flexDirection: "column", gap: 6 },

  dateInput: {
    padding: "8px 12px",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    fontSize: 13,
    fontWeight: 500,
    color: BRAND.text,
    outline: "none",
    background: BRAND.white,
  },

  empty: { padding: 32, textAlign: "center", color: BRAND.textMuted, fontWeight: 500 },
  footerNote: { marginTop: 16, fontSize: 12, color: BRAND.textMuted },

  movHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
  },

  movFilters: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 16,
  },

  movDates: { display: "flex", gap: 8, alignItems: "center" },

  monthBadge: {
    padding: "8px 14px",
    borderRadius: 6,
    background: BRAND.successBg,
    color: BRAND.success,
    fontWeight: 600,
    fontSize: 13,
  },

  alertErr: {
    marginBottom: 16,
    borderRadius: 6,
    border: `1px solid ${BRAND.error}30`,
    background: BRAND.errorBg,
    color: BRAND.error,
    padding: "12px 16px",
    fontWeight: 500,
    fontSize: 14,
  },

  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: "none",
    borderRadius: 6,
    padding: "10px 18px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    color: BRAND.white,
    background: BRAND.primary,
    transition: "all 0.2s ease",
  },

  primaryBtnSmall: {
    border: "none",
    borderRadius: 6,
    padding: "8px 14px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    color: BRAND.white,
    background: BRAND.primary,
  },

  secondaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 6,
    padding: "10px 16px",
    fontWeight: 500,
    fontSize: 14,
    cursor: "pointer",
    color: BRAND.textLight,
    background: BRAND.white,
    border: `1px solid ${BRAND.border}`,
  },

  ghostBtn: {
    borderRadius: 6,
    padding: "8px 14px",
    fontWeight: 500,
    fontSize: 13,
    cursor: "pointer",
    color: BRAND.textMuted,
    background: "transparent",
    border: `1px solid ${BRAND.border}`,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "grid",
    placeItems: "center",
    padding: 20,
    zIndex: 9999,
  },

  modalCard: {
    width: "min(600px, 100%)",
    borderRadius: 8,
    background: BRAND.white,
    border: `1px solid ${BRAND.border}`,
    padding: 24,
    maxHeight: "90vh",
    overflowY: "auto",
  },

  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20,
  },

  modalTitle: { margin: 0, fontSize: 18, fontWeight: 600, color: BRAND.text },
  modalSubtitle: { margin: "4px 0 0", fontSize: 14, color: BRAND.textMuted },

  modalClose: {
    border: `1px solid ${BRAND.border}`,
    background: BRAND.white,
    width: 36,
    height: 36,
    borderRadius: 6,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: BRAND.textMuted,
  },

  form: { display: "grid", gap: 16 },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 500,
    color: BRAND.text,
    marginBottom: 8,
  },

  input: {
    width: "100%",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    background: BRAND.white,
    padding: "12px 14px",
    outline: "none",
    fontWeight: 500,
    fontSize: 14,
    color: BRAND.text,
    boxSizing: "border-box",
  },

  select: {
    width: "100%",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    background: BRAND.white,
    padding: "12px 14px",
    outline: "none",
    fontWeight: 500,
    fontSize: 14,
    color: BRAND.text,
    cursor: "pointer",
  },

  tip: { marginTop: 8, fontSize: 12, color: BRAND.textMuted },
};
