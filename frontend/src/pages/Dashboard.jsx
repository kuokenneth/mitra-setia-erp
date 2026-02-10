// src/pages/Dashboard.jsx - Modern Design
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

// Match Landing Page Colors
const BRAND = {
  green: "#4BCA74",
  green2: "#3BB865",
  greenLight: "#5FD686",
  greenDark: "#2D9F56",
  greenSoft: "rgba(75,202,116,0.15)",
  ink: "#111827",
  ink2: "#1F2937",
};

// Modern Styles
const s = {
  page: {
    minHeight: "100vh",
    color: BRAND.ink,
  },

  container: { maxWidth: 1200, margin: "0 auto" },

  glassCard: {
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: 20,
    padding: 24,
    border: `1px solid ${BRAND.greenSoft}`,
    boxShadow: `0 8px 32px ${BRAND.green}15`,
  },

  grid: { display: "grid", gap: 20 },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },

  title: { fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" },
  subtitle: { marginTop: 6, color: BRAND.ink2, fontSize: 15, opacity: 0.8 },
};

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

function pct(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
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

function isLowStockItem(item) {
  const qty = Number(item?.qtyTotal ?? item?.totalQty ?? item?.qty ?? 0);
  const rp = Number(item?.reorderPoint ?? item?.minQty ?? 0);
  return Number.isFinite(qty) && Number.isFinite(rp) && rp > 0 && qty <= rp;
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

//////////////////////
// UI COMPONENTS
//////////////////////
function KpiCard({ label, value, sub, icon }) {
  return (
    <div style={s.glassCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
          }}
        >
          {icon || "📊"}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink2, opacity: 0.8 }}>{label}</div>
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color: BRAND.green }}>{value ?? 0}</div>
      {sub && (
        <div style={{ marginTop: 8, fontSize: 13, color: BRAND.ink2, opacity: 0.7 }}>{sub}</div>
      )}
    </div>
  );
}

function Pill({ children }) {
  return (
    <span
      style={{
        padding: "8px 16px",
        borderRadius: 999,
        background: BRAND.greenSoft,
        border: `1px solid ${BRAND.green}30`,
        fontWeight: 700,
        fontSize: 13,
        color: BRAND.green,
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
        padding: "10px 16px",
        borderRadius: 12,
        border: `1px solid ${BRAND.greenSoft}`,
        background: "#ffffff",
        fontWeight: 700,
        fontSize: 14,
        cursor: "pointer",
        transition: "all 0.3s ease",
        color: BRAND.green,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = BRAND.greenSoft;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#ffffff";
      }}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }) {
  const s = up(status);
  const map = {
    READY: { bg: BRAND.greenSoft, fg: BRAND.green, bd: `${BRAND.green}40` },
    DISPATCH: { bg: BRAND.greenSoft, fg: BRAND.green, bd: `${BRAND.green}40` },
    MAINTENANCE: { bg: "#fff2e0", fg: "#9a4b0f", bd: "rgba(154,75,15,.3)" },
    OPEN: { bg: "#fff2e0", fg: "#9a4b0f", bd: "rgba(154,75,15,.3)" },
    DONE: { bg: "#e2f5ed", fg: "#136f4a", bd: "rgba(19,111,74,.3)" },
    CANCELLED: { bg: "#f1f5f9", fg: "#475569", bd: "rgba(71,85,105,.3)" },
  };
  const c = map[s] || { bg: "#f1f5f9", fg: "#475569", bd: "rgba(71,85,105,.3)" };

  return (
    <span
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`,
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      {s || "—"}
    </span>
  );
}

function ProgressRow({ label, value, sub }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          color: BRAND.ink2,
          fontWeight: 700,
        }}
      >
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: BRAND.greenSoft, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${value}%`,
            background: `linear-gradient(90deg, ${BRAND.green}, ${BRAND.green2})`,
            boxShadow: `0 2px 8px ${BRAND.green}50`,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      {sub && <div style={{ fontSize: 12, color: BRAND.ink2, opacity: 0.7 }}>{sub}</div>}
    </div>
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
  const [inventoryCount, setInventoryCount] = useState(0);

  const [todayTrips, setTodayTrips] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [topSpend, setTopSpend] = useState([]);
  const [topSpendLoading, setTopSpendLoading] = useState(false);

  const truckDriverName = (trip) => {
    const plate = trip?.truck?.plateNumber || trip?.truckPlate;
    const truckId = trip?.truckId || trip?.truck?.id;

    const match =
      (truckId && trucks.find((x) => x.id === truckId)) ||
      (plate && trucks.find((x) => x.plateNumber === plate));

    return match?.driver?.name || match?.driverName || match?.driverUser?.name || "—";
  };

  const endpoints = useMemo(
    () => ({
      trucks: "/trucks",
      maintenance: "/maintenance",
      inventoryItems: "/inventory/items",
      tripsToday: `/trips?from=${encodeURIComponent(startOfTodayISO())}&to=${encodeURIComponent(
        endOfTodayISO()
      )}`,
    }),
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const [trucksRes, maintRes, invRes, tripsRes] = await Promise.all([
          api(endpoints.trucks).catch(() => null),
          api(endpoints.maintenance).catch(() => null),
          api(endpoints.inventoryItems).catch(() => null),
          api(endpoints.tripsToday).catch(() => null),
        ]);

        const fetchedTrucks = safeArr(trucksRes);
        const maint = safeArr(maintRes);
        const items = safeArr(invRes);
        const trips = safeArr(tripsRes);

        if (cancelled) return;

        setTrucks(fetchedTrucks);
        setInventoryCount(items.length);

        const activeTrucks = fetchedTrucks.filter((t) =>
          ["READY", "DISPATCH"].includes(up(t?.status))
        ).length;
        const pendingMaintenance = maint.filter((m) => up(m?.status) === "OPEN").length;
        const lowStock = items.filter(isLowStockItem).length;
        const tripsToday = trips.length;

        setStats({ tripsToday, activeTrucks, pendingMaintenance, lowStock });
        setTodayTrips(trips);

        // Alerts
        const a = [];
        const now = new Date();
        const in14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const stnkSoon = fetchedTrucks
          .filter((t) => t?.stnkExpiry)
          .filter((t) => {
            const d = new Date(t.stnkExpiry);
            return d >= now && d <= in14;
          })
          .slice(0, 5);

        if (stnkSoon.length) {
          a.push({
            title: "STNK expiring soon",
            detail: `${stnkSoon.length} truck(s) within 14 days`,
          });
        }

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

        // Top Spending Trucks
        setTopSpendLoading(true);
        try {
          const limit = 6;
          const queue = [...fetchedTrucks];
          const results = [];

          async function worker() {
            while (queue.length && !cancelled) {
              const t = queue.shift();
              if (!t?.id) continue;

              try {
                const r = await api(`/trucks/${t.id}/spareparts`);
                results.push({
                  truckId: t.id,
                  plateNumber: t.plateNumber || "—",
                  total: Number(r?.monthTotalCost || 0),
                  currency: r?.monthCurrency || "IDR",
                });
              } catch {
                results.push({
                  truckId: t.id,
                  plateNumber: t.plateNumber || "—",
                  total: 0,
                  currency: "IDR",
                });
              }
            }
          }

          await Promise.all(
            Array.from({ length: Math.min(limit, fetchedTrucks.length) }, () => worker())
          );

          if (cancelled) return;

          results.sort((a, b) => b.total - a.total);
          setTopSpend(results.slice(0, 5));
        } finally {
          if (!cancelled) setTopSpendLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setSysOk(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [endpoints]);

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* HEADER */}
        <div style={{ ...s.glassCard, marginBottom: 20 }}>
          <div style={s.headerRow}>
            <div>
              <div style={s.title}>Welcome back, {user?.name || "User"} 👋</div>
              <div style={s.subtitle}>Operations overview for today</div>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Pill>{new Date().toLocaleDateString()}</Pill>
              <span
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: sysOk ? BRAND.greenSoft : "#fde8e8",
                  fontWeight: 700,
                  fontSize: 13,
                  color: sysOk ? BRAND.green : "#b42318",
                  border: `1px solid ${sysOk ? `${BRAND.green}40` : "rgba(180,35,24,.3)"}`,
                }}
              >
                System: {sysOk ? "OK ✓" : "ERROR"}
              </span>
            </div>
          </div>
        </div>

        {/* KPI ROW */}
        <div
          style={{
            ...s.grid,
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            marginBottom: 20,
          }}
        >
          <KpiCard label="Trips Today" value={stats.tripsToday} sub="Scheduled / In-progress" icon="🚚" />
          <KpiCard label="Active Trucks" value={stats.activeTrucks} sub="READY + DISPATCH" icon="✅" />
          <KpiCard label="Pending Maintenance" value={stats.pendingMaintenance} sub="OPEN jobs" icon="🔧" />
          <KpiCard label="Low Stock Items" value={stats.lowStock} sub="Below reorder point" icon="📦" />
        </div>

        {/* MAIN GRID */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: window.innerWidth > 900 ? "1fr 340px" : "1fr",
            gap: 20,
          }}
        >
          {/* LEFT COLUMN */}
          <div style={s.grid}>
            {/* TODAY TRIPS */}
            <div style={s.glassCard}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>Today's Trips</div>
                <Pill>{loading ? "Loading..." : `${todayTrips.length} trip(s)`}</Pill>
              </div>

              <div>
                {loading ? (
                  <div style={{ color: BRAND.ink2, opacity: 0.7 }}>Loading trips...</div>
                ) : todayTrips.length === 0 ? (
                  <div style={{ color: BRAND.ink2, opacity: 0.7 }}>No trips scheduled for today</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" }}>
                      <thead>
                        <tr style={{ textAlign: "left", fontSize: 13, color: BRAND.ink2 }}>
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
                              background: BRAND.greenSoft,
                              borderRadius: 12,
                            }}
                          >
                            <td style={{ padding: "12px 10px", fontWeight: 700 }}>
                              {t.code || t.tripNo || t.id?.slice?.(0, 8) || "—"}
                            </td>
                            <td style={{ padding: "12px 10px", fontWeight: 700 }}>
                              {t.truck?.plateNumber || t.truckPlate || "—"}
                            </td>
                            <td style={{ padding: "12px 10px", fontWeight: 700 }}>
                              {t.driver?.name || t.driverName || truckDriverName(t) || "—"}
                            </td>
                            <td style={{ padding: "12px 10px", fontSize: 13, color: BRAND.ink2 }}>
                              {t.fromLocation?.name || t.from || "-"} → {t.toLocation?.name || t.to || "-"}
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

            {/* TOP SPENDING TRUCKS */}
            <div style={s.glassCard}>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
                Top Spending Trucks (This Month)
              </div>

              {topSpendLoading ? (
                <div style={{ color: BRAND.ink2, opacity: 0.7 }}>Calculating...</div>
              ) : topSpend.length === 0 ? (
                <div style={{ color: BRAND.ink2, opacity: 0.7 }}>No spending recorded yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {topSpend.map((x, idx) => (
                    <div
                      key={x.truckId}
                      style={{
                        padding: 16,
                        borderRadius: 14,
                        background: BRAND.greenSoft,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 999,
                            display: "grid",
                            placeItems: "center",
                            fontWeight: 800,
                            background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.green2})`,
                            color: "#fff",
                          }}
                        >
                          {idx + 1}
                        </span>

                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>{x.plateNumber}</div>
                          <div style={{ marginTop: 2, fontSize: 13, color: BRAND.ink2, opacity: 0.7 }}>
                            Spareparts installed
                          </div>
                        </div>
                      </div>

                      <div style={{ fontWeight: 800, color: BRAND.green, fontSize: 18 }}>
                        {fmtMoney(x.total, x.currency)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT RAIL */}
          <div style={s.grid}>
            {/* ANALYTICS */}
            <div style={s.glassCard}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Analytics</div>
              <div style={{ display: "grid", gap: 16 }}>
                <ProgressRow
                  label="Fleet Utilization"
                  value={pct(trucks.length ? (stats.activeTrucks / trucks.length) * 100 : 0)}
                  sub={`${stats.activeTrucks} active of ${trucks.length || 0} trucks`}
                />
                <ProgressRow
                  label="Maintenance Load"
                  value={pct(trucks.length ? (stats.pendingMaintenance / trucks.length) * 100 : 0)}
                  sub={`${stats.pendingMaintenance} open maintenance jobs`}
                />
                <ProgressRow
                  label="Inventory Health"
                  value={pct(inventoryCount ? 100 - (stats.lowStock / inventoryCount) * 100 : 100)}
                  sub={`${stats.lowStock} low stock of ${inventoryCount} items`}
                />
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div style={s.glassCard}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Quick Actions</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <ActionBtn label="+ Create Trip" onClick={() => (window.location.href = "/trips")} />
                <ActionBtn label="+ Receive Stock" onClick={() => (window.location.href = "/inventory")} />
                <ActionBtn label="+ Maintenance" onClick={() => (window.location.href = "/maintenance")} />
                <ActionBtn label="+ Add Truck" onClick={() => (window.location.href = "/trucks")} />
              </div>
            </div>

            {/* ALERTS */}
            <div style={s.glassCard}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Alerts</div>
              {loading ? (
                <div style={{ color: BRAND.ink2, opacity: 0.7 }}>Checking...</div>
              ) : alerts.length === 0 ? (
                <div style={{ color: BRAND.ink2, opacity: 0.7 }}>No alerts ✓</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {alerts.map((a, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: "#fff2e0",
                        border: "1px solid rgba(154,75,15,.3)",
                      }}
                    >
                      <div style={{ fontWeight: 800, color: "#9a4b0f" }}>⚠️ {a.title}</div>
                      <div style={{ marginTop: 4, fontSize: 13, color: "#9a4b0f", opacity: 0.8 }}>
                        {a.detail}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MY ACCOUNT */}
            <div style={s.glassCard}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>My Account</div>
              <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                <div>
                  <strong>Name:</strong> {user?.name || "—"}
                </div>
                <div>
                  <strong>Email:</strong> {user?.email || "—"}
                </div>
                <div>
                  <strong>Role:</strong> {user?.role || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
