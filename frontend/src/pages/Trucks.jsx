// src/pages/Trucks.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Trucks() {
  const { user } = useAuth();
  const role = user?.role || "UNKNOWN";
  const allowed = role === "OWNER" || role === "ADMIN" || role === "STAFF";

  const [items, setItems] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Modal
  const [showAdd, setShowAdd] = useState(false);

  // ✅ Selected truck for movements
  const [selectedTruck, setSelectedTruck] = useState(null);

  // ✅ Movements state
  const [assignments, setAssignments] = useState([]);
  const [asgLoading, setAsgLoading] = useState(false);
  const [movErr, setMovErr] = useState("");

  // ✅ Movements filters
  const [movQ, setMovQ] = useState("");
  const [movFrom, setMovFrom] = useState("");
  const [movTo, setMovTo] = useState("");

  // create form
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
      id: d.id, // user.id
      name: d.name || d.email,
      email: d.email,
    }));
    return base.concat(mapped);
  }, [drivers]);

  // Build a set of userIds that are already assigned to trucks
  const assignedDriverIds = useMemo(() => {
    const set = new Set();
    for (const t of items) {
      if (t.driverUser?.id) set.add(t.driverUser.id);
    }
    return set;
  }, [items]);

  function optionsForTruck(truck) {
    // show "Unassigned" always
    const base = [{ id: "", name: "Unassigned" }];

    // allow:
    // - drivers not assigned to any truck
    // - OR the driver currently assigned to THIS truck
    const allowedDrivers = (drivers || []).filter((d) => {
      const id = d.id;
      const isAssignedSomewhere = assignedDriverIds.has(id);
      const isCurrentForThisTruck = truck.driverUser?.id === id;
      return !isAssignedSomewhere || isCurrentForThisTruck;
    });

    return base.concat(
      allowedDrivers.map((d) => ({
        id: d.id,
        name: d.name || d.email,
        email: d.email,
      }))
    );
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());

      const [t, d] = await Promise.all([api(`/trucks?${params.toString()}`), api("/drivers")]);

      const truckList = t.items || [];
      setItems(truckList);
      setDrivers(d.items || []);

      // ✅ if selected truck got deleted / filtered out, clear selection
      if (selectedTruck?.id) {
        const stillExists = truckList.some((x) => x.id === selectedTruck.id);
        if (!stillExists) {
          setSelectedTruck(null);
          setAssignments([]);
        }
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close modal on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setShowAdd(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onSearch(e) {
    e.preventDefault();
    load();
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
      await load();
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
      await load();
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
      await load();
    } catch (e) {
      alert(e.message || "Failed to update STNK expiry");
    }
  }

  // ✅ click truck row
  function onPickTruck(truck) {
    setSelectedTruck(truck);
    setAssignments([]);
    setMovErr("");
    loadAssignments(truck.id);
  }

  if (!allowed) {
    return (
      <div style={s.page}>
        <div style={s.headerRow}>
          <div>
            <div style={s.hTitle}>Trucks</div>
            <div style={s.hSub}>You don’t have permission to view this page.</div>
          </div>
        </div>
        <div style={s.card}>
          <div style={s.alertErr}>Forbidden</div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.headerRow}>
        <div>
          <div style={s.hTitle}>Trucks</div>
          <div style={s.hSub}>Manage fleet and assign drivers</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setShowAdd(true)} style={s.primaryBtn}>
            + Add Truck
          </button>

          <button onClick={load} disabled={loading} style={s.secondaryBtn}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {err ? <div style={s.alertErr}>{err}</div> : null}

      {/* Fleet ONLY */}
      <div style={s.card}>
        <div style={s.listHeader}>
          <div>
            <div style={s.cardTitle}>Fleet</div>
            <div style={s.cardSub}>Click a truck row to see sparepart usage.</div>
          </div>

          <form onSubmit={onSearch} style={s.searchRow}>
            <input
              style={s.inputSmall}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search plate/brand/model…"
            />
            <button disabled={loading} style={{ ...s.primaryBtnSmall, opacity: loading ? 0.7 : 1 }}>
              {loading ? "…" : "Search"}
            </button>
          </form>
        </div>

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
              {items.map((t) => {
                const active = selectedTruck?.id === t.id;

                return (
                  <tr
                    key={t.id}
                    style={{
                      ...s.tr,
                      cursor: "pointer",
                      background: active ? "rgba(34,197,94,0.06)" : "white",
                    }}
                    onClick={() => onPickTruck(t)}
                    title="Click to view sparepart movements"
                  >
                    <td style={s.tdStrong}>{t.plateNumber}</td>

                    <td style={s.td}>
                      <div style={{ fontWeight: 1000 }}>
                        {[t.brand, t.model].filter(Boolean).join(" ") || "-"}
                      </div>
                      <div style={s.smallMuted}>{t.vin ? `VIN: ${t.vin}` : "—"}</div>
                    </td>

                    {/* ✅ STATUS IS NOW DISPLAY ONLY (NO DROPDOWN) */}
                    <td style={s.td}>
                      <span style={statusPill(t.status || "READY")}>{t.status || "READY"}</span>
                    </td>

                    {/* ✅ prevent row click when interacting with dropdown */}
                    <td
                      style={s.td}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <div style={s.selectWrap}>
                        <select
                          style={{ ...s.selectAssign, opacity: t.status === "INACTIVE" ? 0.55 : 1 }}
                          disabled={t.status === "INACTIVE"}
                          value={t.driverUser?.id || ""}
                          onChange={(e) => onAssign(t.id, e.target.value)}
                        >
                          {optionsForTruck(t).map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                        <div style={s.selectArrow}>▾</div>
                      </div>

                      <div style={s.smallMuted}>
                        {t.status === "INACTIVE"
                          ? "Inactive truck (cannot assign driver)"
                          : t.driverUser?.email || "No driver assigned"}
                      </div>
                    </td>

                    {/* ✅ prevent row click when interacting with date input */}
                    <td
                      style={s.td}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <div style={s.stnkWrap}>
                        <input
                          type="date"
                          value={t.stnkExpiry ? t.stnkExpiry.slice(0, 10) : ""}
                          onChange={(e) => updateStnk(t.id, e.target.value)}
                          style={{
                            ...s.stnkInput,
                            ...stnkInputStyle(t.stnkExpiry),
                          }}
                        />

                        {/* show ONLY if expired or within 14 days */}
                        {shouldShowStnkWarning(t.stnkExpiry) ? (
                          <span style={stnkBadge(t.stnkExpiry)}>{stnkLabel(t.stnkExpiry)}</span>
                        ) : null}
                      </div>
                    </td>

                    <td style={s.td}>
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                );
              })}

              {!loading && items.length === 0 ? (
                <tr>
                  <td style={s.empty} colSpan={6}>
                    No trucks found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={s.footerNote}>Only OWNER/ADMIN/STAFF can manage trucks.</div>
      </div>

      {/* ✅ Sparepart Movements Panel */}
      {selectedTruck && (
        <div style={{ ...s.card, marginTop: 14 }}>
          <div style={s.movHeader}>
            <div>
              <div style={s.cardTitle}>
                Sparepart Movements —{" "}
                <span style={{ fontWeight: 1000 }}>{selectedTruck.plateNumber}</span>
              </div>
              <div style={s.cardSub}>Shows spareparts used/recorded for this truck.</div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                style={s.secondaryBtn}
                onClick={() => {
                  setSelectedTruck(null);
                  setAssignments([]);
                }}
              >
                Close
              </button>

              <button
                style={s.primaryBtnSmall}
                disabled={asgLoading}
                onClick={() => loadAssignments(selectedTruck.id)}
              >
                {asgLoading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

          <div style={s.movFilters}>
            <input
              style={{ ...s.input, borderRadius: 999 }}
              value={movQ}
              onChange={(e) => setMovQ(e.target.value)}
              placeholder="Search item name / note…"
            />

            <div style={s.movDates}>
              <input
                type="date"
                style={{ ...s.input, borderRadius: 999 }}
                value={movFrom}
                onChange={(e) => setMovFrom(e.target.value)}
              />
              <input
                type="date"
                style={{ ...s.input, borderRadius: 999 }}
                value={movTo}
                onChange={(e) => setMovTo(e.target.value)}
              />
            </div>

            <button
              style={s.primaryBtnSmall}
              disabled={asgLoading}
              onClick={() => loadAssignments(selectedTruck.id)}
            >
              Apply
            </button>

            <button
              style={s.ghostBtn}
              disabled={asgLoading}
              onClick={() => {
                setMovQ("");
                setMovFrom("");
                setMovTo("");
                loadAssignments(selectedTruck.id);
              }}
            >
              Reset
            </button>
          </div>

          {movErr ? <div style={s.alertErr}>{movErr}</div> : null}

          <div style={s.tableWrap}>
            <table style={{ ...s.table, minWidth: 980 }}>
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
                  <tr>
                    <td style={s.empty} colSpan={6}>
                      Loading spareparts…
                    </td>
                  </tr>
                ) : assignments.length === 0 ? (
                  <tr>
                    <td style={s.empty} colSpan={6}>
                      No spareparts history for this truck.
                    </td>
                  </tr>
                ) : (
                  assignments.map((a) => (
                    <tr key={a.id} style={s.tr}>
                      <td style={s.td}>{fmtDateTime(a.installedAt)}</td>
                      <td style={s.td}>{a.removedAt ? fmtDateTime(a.removedAt) : "-"}</td>

                      <td style={s.td}>
                        <div style={{ fontWeight: 1000 }}>{a.stockUnit?.item?.name || "-"}</div>
                        <div style={s.smallMuted}>
                          {a.stockUnit?.item?.sku ? `SKU: ${a.stockUnit.item.sku}` : "—"}
                        </div>
                      </td>

                      <td style={s.td}>
                        <div>{a.stockUnit?.serialNumber || "-"}</div>
                        <div style={s.smallMuted}>
                          {a.stockUnit?.barcode ? `Barcode: ${a.stockUnit.barcode}` : "—"}
                        </div>
                      </td>

                      <td style={s.td}>
                        <span style={a.removedAt ? statusPill("INACTIVE") : statusPill("READY")}>
                          {a.removedAt ? "REMOVED" : "INSTALLED"}
                        </span>
                      </td>

                      <td style={s.td}>
                        <div>{a.note || "-"}</div>
                        <div style={s.smallMuted}>
                          {a.maintenance?.title ? `Maint: ${a.maintenance.title}` : "—"}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={s.footerNote}>
            Data comes from <b>TruckSparePartAssignment</b> (install/remove history). If empty, make sure
            you create assignments when spareparts are installed to a truck.
          </div>
        </div>
      )}

      {/* Add Truck Modal */}
      {showAdd && (
        <div style={s.modalOverlay} onClick={() => setShowAdd(false)}>
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <div style={s.modalTitle}>Add Truck</div>
                <div style={s.modalSub}>Add a new vehicle into the company fleet.</div>
              </div>

              <button style={s.modalClose} onClick={() => setShowAdd(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={onCreate} style={s.form}>
              <Field label="Plate Number *">
                <input
                  style={s.input}
                  value={form.plateNumber}
                  onChange={(e) => setForm((f) => ({ ...f, plateNumber: e.target.value }))}
                  placeholder="BK 1234 XX"
                />
              </Field>

              <div style={s.twoCol}>
                <Field label="Brand">
                  <input
                    style={s.input}
                    value={form.brand}
                    onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                    placeholder="Hino"
                  />
                </Field>

                <Field label="Model">
                  <input
                    style={s.input}
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    placeholder="Tronton"
                  />
                </Field>
              </div>

              <div style={s.twoCol}>
                <Field label="Year">
                  <input
                    style={s.input}
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                    placeholder="2020"
                  />
                </Field>

                <Field label="Status">
                  <div style={s.selectWrap}>
                    <select
                      style={s.selectPill}
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    >
                      <option value="READY">READY</option>
                      <option value="MAINTENANCE">MAINTENANCE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                    <div style={s.selectArrow}>▾</div>
                  </div>
                </Field>
              </div>

              <Field label="VIN (optional)">
                <input
                  style={s.input}
                  value={form.vin}
                  onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))}
                  placeholder="Vehicle identification number"
                />
              </Field>

              <Field label="STNK Expiry Date">
                <input
                  type="date"
                  style={s.input}
                  value={form.stnkExpiry || ""}
                  onChange={(e) => setForm((f) => ({ ...f, stnkExpiry: e.target.value }))}
                />
              </Field>

              <Field label="Assign Driver (optional)">
                <div style={s.selectWrap}>
                  <select
                    style={s.selectPill}
                    value={form.driverUserId}
                    onChange={(e) => setForm((f) => ({ ...f, driverUserId: e.target.value }))}
                  >
                    {driverOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <div style={s.selectArrow}>▾</div>
                </div>
              </Field>

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button
                  disabled={creating}
                  style={{ ...s.primaryBtn, flex: 1, opacity: creating ? 0.7 : 1 }}
                >
                  {creating ? "Adding…" : "Add Truck"}
                </button>

                <button type="button" onClick={() => setShowAdd(false)} style={s.ghostBtn}>
                  Cancel
                </button>
              </div>

              <div style={s.tip}>Tip: You can assign later from the fleet table.</div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- helpers ---------------- */

function Field({ label, children }) {
  return (
    <div>
      <div style={s.label}>{label}</div>
      {children}
    </div>
  );
}

function fmtDateTime(s) {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
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
  return `Expiring in ${diff}d`;
}

function shouldShowStnkWarning(date) {
  const diff = stnkDiffDays(date);
  if (diff === null) return false;
  return diff <= 14; // expired OR expiring soon
}

function stnkInputStyle(date) {
  const diff = stnkDiffDays(date);
  if (diff === null) return {};

  if (diff < 0) {
    return { borderColor: "rgba(239,68,68,0.40)", color: "#991b1b" };
  }
  if (diff <= 14) {
    return { borderColor: "rgba(245,158,11,0.45)", color: "#92400e" };
  }
  return {};
}

function stnkBadge(date) {
  const diff = stnkDiffDays(date);

  if (diff < 0) {
    return {
      display: "inline-flex",
      alignItems: "center",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 1000,
      background: "rgba(239,68,68,0.12)",
      color: "#991b1b",
      border: "1px solid rgba(239,68,68,0.25)",
      whiteSpace: "nowrap",
    };
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 1000,
    background: "rgba(245,158,11,0.14)",
    color: "#92400e",
    border: "1px solid rgba(245,158,11,0.26)",
    whiteSpace: "nowrap",
  };
}

function statusPill(status) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 14px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: 0.3,
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  };

  if (status === "READY") {
    return {
      ...base,
      color: "#065f46",
      background: "rgba(34,197,94,0.14)",
      border: "1px solid rgba(34,197,94,0.28)",
    };
  }

  if (status === "MAINTENANCE") {
    return {
      ...base,
      color: "#92400e",
      background: "rgba(245,158,11,0.14)",
      border: "1px solid rgba(245,158,11,0.28)",
    };
  }

  if (status === "DISPATCH") {
    return {
      ...base,
      color: "#1d4ed8",
      background: "rgba(59,130,246,0.14)",
      border: "1px solid rgba(59,130,246,0.28)",
    };
  }

  return {
    ...base,
    color: "#374151",
    background: "rgba(107,114,128,0.12)",
    border: "1px solid rgba(107,114,128,0.25)",
  };
}

/* ---------------- styles ---------------- */

const s = {
  page: { padding: 6 },

  headerRow: {
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  hTitle: { fontWeight: 1000, fontSize: 18, color: "#053a2f" },
  hSub: { marginTop: 4, fontSize: 12, color: "rgba(4,120,87,0.85)", fontWeight: 700 },

  card: {
    borderRadius: 18,
    background: "linear-gradient(180deg, #fff 0%, #fbfffd 100%)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
    border: "1px solid rgba(6,95,70,0.08)",
    padding: 18,
    minWidth: 0,
  },

  cardTitle: { fontWeight: 1000, fontSize: 14, color: "#053a2f" },
  cardSub: { marginTop: 4, fontSize: 12, color: "rgba(4,120,87,0.78)", fontWeight: 700 },

  form: { marginTop: 14, display: "grid", gap: 12 },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },

  label: { fontSize: 12, fontWeight: 900, color: "rgba(4,120,87,0.85)", marginBottom: 6 },

  input: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(6,95,70,0.12)",
    background: "white",
    padding: "11px 12px",
    outline: "none",
    fontWeight: 800,
    color: "#053a2f",
    boxSizing: "border-box",
  },

  inputSmall: {
    width: 300,
    borderRadius: 14,
    border: "1px solid rgba(6,95,70,0.12)",
    background: "white",
    padding: "10px 12px",
    outline: "none",
    fontWeight: 800,
    color: "#053a2f",
    boxSizing: "border-box",
  },

  // pill select
  selectWrap: { position: "relative", display: "inline-flex", alignItems: "center", width: "100%" },
  selectPill: {
    width: "100%",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    borderRadius: 999,
    border: "1px solid rgba(6,95,70,0.18)",
    background: "linear-gradient(180deg, #ffffff 0%, #f6fffb 100%)",
    padding: "10px 42px 10px 16px",
    fontSize: 13,
    fontWeight: 1000,
    color: "#053a2f",
    cursor: "pointer",
    outline: "none",
    boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
  },
  selectAssign: {
    width: "100%",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    borderRadius: 999,
    border: "1px solid rgba(6,95,70,0.18)",
    background: "linear-gradient(180deg, #ffffff 0%, #f6fffb 100%)",
    padding: "9px 42px 9px 14px",
    fontSize: 13,
    fontWeight: 1000,
    color: "#053a2f",
    cursor: "pointer",
    outline: "none",
  },
  selectArrow: {
    position: "absolute",
    right: 14,
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    fontSize: 12,
    fontWeight: 1000,
    color: "rgba(4,120,87,0.85)",
  },

  primaryBtn: {
    border: "none",
    borderRadius: 14,
    padding: "11px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    color: "white",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    boxShadow: "0 14px 30px rgba(34,197,94,0.22)",
  },
  primaryBtnSmall: {
    border: "none",
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    color: "white",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    boxShadow: "0 14px 30px rgba(34,197,94,0.20)",
  },
  secondaryBtn: {
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    color: "#065f46",
    background: "rgba(34,197,94,0.10)",
    border: "1px solid rgba(34,197,94,0.18)",
  },

  ghostBtn: {
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    color: "#065f46",
    background: "rgba(6,95,70,0.06)",
    border: "1px solid rgba(6,95,70,0.10)",
  },

  alertErr: {
    marginBottom: 12,
    borderRadius: 14,
    border: "1px solid rgba(239,68,68,0.28)",
    background: "rgba(239,68,68,0.10)",
    color: "rgba(153,27,27,0.95)",
    padding: "10px 12px",
    fontWeight: 800,
    fontSize: 12,
  },

  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "end",
  },
  searchRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

  tableWrap: {
    marginTop: 14,
    overflowX: "auto",
    borderRadius: 14,
    border: "1px solid rgba(6,95,70,0.08)",
  },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 980 },
  th: {
    textAlign: "left",
    fontSize: 12,
    letterSpacing: 0.3,
    fontWeight: 1000,
    color: "rgba(4,120,87,0.75)",
    padding: "12px 12px",
    background: "rgba(6,95,70,0.03)",
    borderBottom: "1px solid rgba(6,95,70,0.08)",
  },
  tr: { background: "white" },
  td: {
    padding: "12px 12px",
    fontSize: 13,
    fontWeight: 800,
    color: "#053a2f",
    borderBottom: "1px solid rgba(6,95,70,0.06)",
    verticalAlign: "top",
  },
  tdStrong: {
    padding: "12px 12px",
    fontSize: 13,
    fontWeight: 1000,
    color: "#053a2f",
    borderBottom: "1px solid rgba(6,95,70,0.06)",
    verticalAlign: "top",
  },
  smallMuted: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(4,120,87,0.65)",
  },

  // STNK
  stnkWrap: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 },
  stnkInput: {
    width: "180px",
    borderRadius: 999,
    border: "1px solid rgba(6,95,70,0.18)",
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 900,
    background: "linear-gradient(180deg, #ffffff 0%, #f6fffb 100%)",
    outline: "none",
    cursor: "pointer",
  },

  empty: { padding: 18, textAlign: "center", color: "rgba(4,120,87,0.75)", fontWeight: 900 },

  footerNote: { marginTop: 12, fontSize: 11, fontWeight: 800, color: "rgba(4,120,87,0.70)" },
  tip: { marginTop: 8, fontSize: 11, fontWeight: 800, color: "rgba(4,120,87,0.70)" },

  // ✅ movement panel styles
  movHeader: {
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  movFilters: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 10,
    marginBottom: 12,
  },
  movDates: { display: "flex", gap: 10, alignItems: "center" },

  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(3, 20, 14, 0.45)",
    backdropFilter: "blur(6px)",
    display: "grid",
    placeItems: "center",
    padding: 18,
    zIndex: 9999,
  },
  modalCard: {
    width: "min(720px, 100%)",
    borderRadius: 20,
    background: "linear-gradient(180deg, #ffffff 0%, #fbfffd 100%)",
    border: "1px solid rgba(6,95,70,0.10)",
    boxShadow: "0 30px 80px rgba(0,0,0,0.22)",
    padding: 18,
  },
  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  modalTitle: { fontWeight: 1000, fontSize: 16, color: "#053a2f" },
  modalSub: { marginTop: 4, fontSize: 12, fontWeight: 700, color: "rgba(4,120,87,0.78)" },
  modalClose: {
    border: "none",
    background: "rgba(6,95,70,0.06)",
    color: "#065f46",
    width: 36,
    height: 36,
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 1000,
  },
};
