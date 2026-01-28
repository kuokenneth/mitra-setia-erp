// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

/**
 * Dashboard v2 (LIVE)
 * - Aggregates real numbers from your existing endpoints (frontend aggregation)
 * - Safe if endpoints return { items: [] } or [] or { data: [] }
 * - Adjust endpoint paths if your backend uses different routes
 */

//////////////////////
// THEME
//////////////////////
const pageBg = {
  minHeight: "100vh",
  padding: 22,
  background: "linear-gradient(180deg, #EAF7F1 0%, #F6FFFB 70%)",
  color: "#0B2A1F",
};

const container = { maxWidth: 1300, margin: "0 auto" };

const panel = {
  background: "#FFFFFF",
  borderRadius: 20,
  padding: 18,
  border: "1px solid rgba(20, 80, 60, 0.10)",
  boxShadow: "0 18px 55px rgba(10, 40, 30, 0.08)",
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const title = { fontSize: 30, fontWeight: 900, letterSpacing: -0.8 };
const subtitle = { marginTop: 6, color: "#2F6B55", fontWeight: 700, fontSize: 13 };

const grid = { display: "grid", gap: 18 };

//////////////////////
// HELPERS
//////////////////////
function safeArr(v) {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.items)) return v.items;
  if (Array.isArray(v?.data)) return v.data;
  if (Array.isArray(v?.rows)) return v.rows;
  return [];
}

function up(v) {
  return String(v || "").toUpperCase();
}

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

// Low-stock heuristic (adjust if your schema differs)
// - item.qtyTotal OR item.totalQty OR item.qty
// - item.reorderPoint OR item.minQty
function isLowStockItem(item) {
  const qty = Number(item?.qtyTotal ?? item?.totalQty ?? item?.qty ?? 0);
  const rp = Number(item?.reorderPoint ?? item?.minQty ?? 0);
  return Number.isFinite(qty) && Number.isFinite(rp) && rp > 0 && qty <= rp;
}

//////////////////////
// SMALL UI COMPONENTS
//////////////////////
function KpiCard({ label, value, sub }) {
  return (
    <div style={panel}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#2F6B55" }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8 }}>{value ?? 0}</div>
      {sub ? <div style={{ marginTop: 6, fontSize: 12, color: "#5E8F7B" }}>{sub}</div> : null}
    </div>
  );
}

function Pill({ children }) {
  return (
    <span
      style={{
        padding: "5px 10px",
        borderRadius: 999,
        background: "#F1FFF9",
        border: "1px solid rgba(20,80,60,.18)",
        fontWeight: 900,
        fontSize: 12,
        color: "#1E6F50",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function ActionBtn({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: "1px solid rgba(20,80,60,.25)",
        background: "#F6FFFB",
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }) {
  const s = up(status);
  const map = {
    READY: { bg: "#E7F8EF", fg: "#1E6F50", bd: "rgba(30,111,80,.22)" },
    DISPATCH: { bg: "#EAF2FF", fg: "#2456A6", bd: "rgba(36,86,166,.22)" },
    MAINTENANCE: { bg: "#FFF3E6", fg: "#A15A12", bd: "rgba(161,90,18,.22)" },
    OPEN: { bg: "#FFF3E6", fg: "#A15A12", bd: "rgba(161,90,18,.22)" },
    DONE: { bg: "#E7F8EF", fg: "#1E6F50", bd: "rgba(30,111,80,.22)" },
    CANCELLED: { bg: "#F5F6F7", fg: "#46525B", bd: "rgba(70,82,91,.18)" },
  };
  const c = map[s] || { bg: "#F5F6F7", fg: "#46525B", bd: "rgba(70,82,91,.18)" };

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`,
        fontWeight: 900,
        fontSize: 12,
      }}
    >
      {s || "—"}
    </span>
  );
}

//////////////////////
// MAIN
//////////////////////
export default function Dashboard() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [sysOk, setSysOk] = useState(true);

  const [stats, setStats] = useState({
    tripsToday: 0,
    activeTrucks: 0,
    pendingMaintenance: 0,
    lowStock: 0,
  });

  const [todayTrips, setTodayTrips] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [trucks, setTrucks] = useState([]);

  const truckDriverName = (trip) => {
    const plate = trip?.truck?.plateNumber || trip?.truckPlate;
    const truckId = trip?.truckId || trip?.truck?.id;

    const match =
      (truckId && trucks.find((x) => x.id === truckId)) ||
      (plate && trucks.find((x) => x.plateNumber === plate));

    return match?.driver?.name || match?.driverName || match?.driverUser?.name || "—";
  };


  // ✅ Change these paths if your backend uses different routes
  const endpoints = useMemo(
    () => ({
      trucks: "/trucks",
      maintenance: "/maintenance",
      // if your inventory list is a different route, change it here:
      inventoryItems: "/inventory/items",
      // if you don’t have trips yet, keep it but it will safely fallback:
      tripsToday: `/trips?from=${encodeURIComponent(startOfTodayISO())}&to=${encodeURIComponent(
        endOfTodayISO()
      )}`,
    }),
    []
  );

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const [trucksRes, maintRes, invRes, tripsRes] = await Promise.all([
          api(endpoints.trucks).catch(() => null),
          api(endpoints.maintenance).catch(() => null),
          api(endpoints.inventoryItems).catch(() => null),
          api(endpoints.tripsToday).catch(() => null),
        ]);

        const trucks = safeArr(trucksRes);
        const maint = safeArr(maintRes);
        const items = safeArr(invRes);
        const trips = safeArr(tripsRes);

        // KPI calculations
        const activeTrucks = trucks.filter((t) => ["READY", "DISPATCH"].includes(up(t?.status))).length;

        const pendingMaintenance = maint.filter((m) => up(m?.status) === "OPEN").length;

        const lowStock = items.filter(isLowStockItem).length;

        const tripsToday = trips.length;

        setStats({ tripsToday, activeTrucks, pendingMaintenance, lowStock });
        setTodayTrips(trips);

        // Alerts (simple examples — you can expand later)
        const a = [];

        // STNK expiry soon (if you have stnkExpiry on truck)
        const now = new Date();
        const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const stnkSoon = trucks
          .filter((t) => t?.stnkExpiry)
          .filter((t) => {
            const d = new Date(t.stnkExpiry);
            return d >= now && d <= in30;
          })
          .slice(0, 5);
        if (stnkSoon.length) {
          a.push({
            title: "STNK expiring soon",
            detail: `${stnkSoon.length} truck(s) within 14 days`,
          });
        }

        // Maintenance open too long (if you store createdAt)
        const openLong = maint
          .filter((m) => up(m?.status) === "OPEN" && m?.createdAt)
          .filter((m) => {
            const days = (Date.now() - new Date(m.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            return days >= 7;
          })
          .slice(0, 5);
        if (openLong.length) {
          a.push({
            title: "Maintenance backlog",
            detail: `${openLong.length} OPEN job(s) older than 7 days`,
          });
        }

        if (lowStock > 0) {
          a.push({
            title: "Low stock items",
            detail: `${lowStock} item(s) at/below reorder point`,
          });
        }

        setAlerts(a);
        setSysOk(true);
      } catch (e) {
        console.error(e);
        setSysOk(false);
      } finally {
        setLoading(false);
      }
    }

    load();
    setTrucks(trucks);
  }, [endpoints]);

  return (
    <div style={pageBg}>
      <div style={container}>
        {/* HEADER */}
        <div style={{ ...panel, marginBottom: 18 }}>
          <div style={headerRow}>
            <div>
              <div style={title}>Welcome back, {user?.name || "User"} 👋</div>
              <div style={subtitle}>Operations overview for today</div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Pill>{new Date().toLocaleDateString()}</Pill>
              <span
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: sysOk ? "#E7F8EF" : "#FFF1F1",
                  fontWeight: 900,
                  fontSize: 12,
                  color: sysOk ? "#1E6F50" : "#B42318",
                  border: `1px solid ${sysOk ? "rgba(30,111,80,.22)" : "rgba(180,35,24,.22)"}`,
                }}
              >
                System: {sysOk ? "OK" : "ERROR"}
              </span>
            </div>
          </div>
        </div>

        {/* KPI ROW */}
        <div
          style={{
            ...grid,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            marginBottom: 18,
          }}
        >
          <KpiCard label="Trips Today" value={stats.tripsToday} sub="Scheduled / In-progress / Done" />
          <KpiCard label="Active Trucks" value={stats.activeTrucks} sub="READY + DISPATCH" />
          <KpiCard label="Pending Maintenance" value={stats.pendingMaintenance} sub="OPEN jobs" />
          <KpiCard label="Low Stock Items" value={stats.lowStock} sub="Below reorder point" />
        </div>

        {/* MAIN GRID */}
        <div style={{ ...grid, gridTemplateColumns: "2fr 1fr" }}>
          {/* TODAY TRIPS */}
          <div style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>Today’s Trips</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {loading ? <Pill>Loading…</Pill> : <Pill>{todayTrips.length} trip(s)</Pill>}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {loading ? (
                <div style={{ color: "#6C9A88", fontWeight: 800 }}>Loading trips…</div>
              ) : todayTrips.length === 0 ? (
                <div style={{ color: "#6C9A88", fontWeight: 800 }}>No trips scheduled for today</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" }}>
                    <thead>
                      <tr style={{ textAlign: "left", fontSize: 12, color: "#2F6B55" }}>
                        <th style={{ paddingLeft: 10 }}>Trip</th>
                        <th>Truck</th>
                        <th>Driver</th>
                        <th>Route</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayTrips.map((t) => (
                        <tr
                          key={t.id}
                          style={{
                            background: "#F8FFFC",
                            border: "1px solid rgba(20,80,60,.10)",
                            boxShadow: "0 10px 25px rgba(10,40,30,.06)",
                          }}
                        >
                          <td style={{ padding: "12px 10px", fontWeight: 900 }}>
                            {t.code || t.tripNo || t.id?.slice?.(0, 8) || "—"}
                          </td>
                          <td style={{ padding: "12px 10px", fontWeight: 800 }}>
                            {t.truck?.plateNumber || t.truckPlate || "—"}
                          </td>
                          <td style={{ padding: "12px 10px", fontWeight: 800 }}>
                            {t.driver?.name ||
                              t.driverName ||
                              truckDriverName(t) ||
                              "—"}
                          </td>

                          <td style={{ padding: "12px 10px", fontWeight: 800, color: "#2F6B55" }}>
                            {t.fromLocation?.name || t.from || "—"} → {t.toLocation?.name || t.to || "—"}
                          </td>
                          <td style={{ padding: "12px 10px" }}>
                            <StatusBadge status={t.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div style={{ ...grid }}>
            {/* QUICK ACTIONS */}
            <div style={panel}>
              <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>Quick Actions</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <ActionBtn label="+ Create Trip" onClick={() => (window.location.href = "/trips")} />
                <ActionBtn label="+ Receive Stock" onClick={() => (window.location.href = "/inventory")} />
                <ActionBtn label="+ Maintenance Job" onClick={() => (window.location.href = "/maintenance")} />
                <ActionBtn label="+ Add Truck" onClick={() => (window.location.href = "/trucks")} />
                <ActionBtn label="+ Add Driver" onClick={() => (window.location.href = "/users")} />
              </div>
            </div>

            {/* ALERTS */}
            <div style={panel}>
              <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>Alerts</div>
              {loading ? (
                <div style={{ color: "#6C9A88", fontWeight: 800 }}>Checking…</div>
              ) : alerts.length === 0 ? (
                <div style={{ color: "#6C9A88", fontWeight: 800 }}>No alerts 🎉</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {alerts.map((a, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        borderRadius: 16,
                        background: "#F8FFFC",
                        border: "1px solid rgba(20,80,60,.10)",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>{a.title}</div>
                      <div style={{ marginTop: 4, color: "#2F6B55", fontWeight: 800, fontSize: 12 }}>
                        {a.detail}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MY ACCOUNT */}
            <div style={panel}>
              <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>My Account</div>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div>
                  <b>Name:</b> {user?.name || "—"}
                </div>
                <div>
                  <b>Email:</b> {user?.email || "—"}
                </div>
                <div>
                  <b>Role:</b> {user?.role || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 30 }} />
      </div>
    </div>
  );
}
