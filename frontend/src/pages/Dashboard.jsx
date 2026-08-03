// src/pages/Dashboard.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import {
  FiTruck,
  FiTool,
  FiPackage,
  FiCalendar,
  FiAlertTriangle,
  FiUser,
  FiPlus,
  FiArrowRight,
  FiActivity,
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
function KpiCard({ label, value, sub, icon: Icon }) {
  return (
    <div
      style={{
        background: BRAND.white,
        borderRadius: 8,
        padding: 24,
        border: `1px solid ${BRAND.border}`,
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            background: BRAND.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: BRAND.primary,
          }}
        >
          {Icon ? <Icon size={20} /> : <FiActivity size={20} />}
        </div>
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: BRAND.text, marginBottom: 4 }}>{value ?? 0}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: BRAND.textLight }}>{label}</div>
      {sub && (
        <div style={{ marginTop: 8, fontSize: 12, color: BRAND.textMuted }}>{sub}</div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = up(status);
  const map = {
    READY: { bg: BRAND.successBg, fg: BRAND.success, label: "Ready" },
    DISPATCH: { bg: BRAND.accent, fg: BRAND.primary, label: "Dispatch" },
    MAINTENANCE: { bg: BRAND.warningBg, fg: BRAND.warning, label: "Maintenance" },
    OPEN: { bg: BRAND.warningBg, fg: BRAND.warning, label: "Open" },
    DONE: { bg: BRAND.successBg, fg: BRAND.success, label: "Done" },
    CANCELLED: { bg: "#F3F4F6", fg: BRAND.textMuted, label: "Cancelled" },
  };
  const c = map[s] || { bg: "#F3F4F6", fg: BRAND.textMuted, label: s || "—" };

  return (
    <span
      style={{
        padding: "4px 10px",
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

function ProgressRow({ label, value, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          color: BRAND.textLight,
          fontWeight: 500,
          marginBottom: 8,
        }}
      >
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: BRAND.primary }}>{value}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: BRAND.secondary, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${value}%`,
            background: BRAND.primary,
            borderRadius: 4,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      {sub && <div style={{ fontSize: 12, color: BRAND.textMuted, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function ActionBtn({ label, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      data-testid={`action-btn-${label.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "10px 16px",
        borderRadius: 6,
        border: `1px solid ${BRAND.border}`,
        background: BRAND.white,
        fontWeight: 500,
        fontSize: 13,
        cursor: "pointer",
        transition: "all 0.2s ease",
        color: BRAND.textLight,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = BRAND.primary;
        e.currentTarget.style.color = BRAND.primary;
        e.currentTarget.style.background = BRAND.accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = BRAND.border;
        e.currentTarget.style.color = BRAND.textLight;
        e.currentTarget.style.background = BRAND.white;
      }}
    >
      {Icon && <Icon size={14} />}
      {label}
    </button>
  );
}

function Card({ title, children, action }) {
  return (
    <div
      style={{
        background: BRAND.white,
        borderRadius: 8,
        border: `1px solid ${BRAND.border}`,
        overflow: "hidden",
      }}
    >
      {title && (
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${BRAND.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: BRAND.text }}>{title}</div>
          {action}
        </div>
      )}
      <div style={{ padding: 20 }}>{children}</div>
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
    <div data-testid="dashboard-page">
      {/* HEADER */}
      <div
        style={{
          marginBottom: 32,
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
            data-testid="dashboard-welcome"
          >
            Welcome back, {user?.name || "User"}
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              color: BRAND.textMuted,
            }}
          >
            Operations overview for today
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              background: BRAND.white,
              border: `1px solid ${BRAND.border}`,
              fontWeight: 500,
              fontSize: 13,
              color: BRAND.textLight,
            }}
            data-testid="dashboard-date"
          >
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </span>
          <span
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              background: sysOk ? BRAND.successBg : BRAND.warningBg,
              fontWeight: 600,
              fontSize: 13,
              color: sysOk ? BRAND.success : BRAND.warning,
            }}
            data-testid="dashboard-system-status"
          >
            System: {sysOk ? "OK" : "ERROR"}
          </span>
        </div>
      </div>

      {/* KPI ROW */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 20,
          marginBottom: 32,
        }}
        data-testid="kpi-cards"
      >
        <KpiCard label="Trips Today" value={stats.tripsToday} sub="Scheduled / In-progress" icon={FiCalendar} />
        <KpiCard label="Active Trucks" value={stats.activeTrucks} sub="READY + DISPATCH" icon={FiTruck} />
        <KpiCard label="Pending Maintenance" value={stats.pendingMaintenance} sub="OPEN jobs" icon={FiTool} />
        <KpiCard label="Low Stock Items" value={stats.lowStock} sub="Below reorder point" icon={FiPackage} />
      </div>

      {/* MAIN GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 24,
        }}
        className="dashboard-main-grid"
      >
        {/* LEFT COLUMN */}
        <div style={{ display: "grid", gap: 24 }}>
          {/* TODAY TRIPS */}
          <Card
            title="Today's Trips"
            action={
              <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.primary }}>
                {loading ? "Memuat..." : `${todayTrips.length} trip(s)`}
              </span>
            }
          >
            {loading ? (
              <div style={{ color: BRAND.textMuted, fontSize: 14 }}>Memuat perjalanan...</div>
            ) : todayTrips.length === 0 ? (
              <div style={{ color: BRAND.textMuted, fontSize: 14 }}>Belum ada perjalanan terjadwal hari ini</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }} data-testid="trips-table">
                  <thead>
                    <tr style={{ textAlign: "left", color: BRAND.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      <th style={{ padding: "0 12px 12px 0", fontWeight: 600 }}>Perjalanan</th>
                      <th style={{ padding: "0 12px 12px 0", fontWeight: 600 }}>Kendaraan</th>
                      <th style={{ padding: "0 12px 12px 0", fontWeight: 600 }}>Pengemudi</th>
                      <th style={{ padding: "0 12px 12px 0", fontWeight: 600 }}>Rute</th>
                      <th style={{ padding: "0 12px 12px 0", fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayTrips.map((t) => (
                      <tr
                        key={t.id}
                        style={{
                          borderTop: `1px solid ${BRAND.border}`,
                        }}
                      >
                        <td style={{ padding: "14px 12px 14px 0", fontWeight: 600, color: BRAND.text }}>
                          {t.code || t.tripNo || t.id?.slice?.(0, 8) || "—"}
                        </td>
                        <td style={{ padding: "14px 12px 14px 0", fontWeight: 500, color: BRAND.textLight }}>
                          {t.truck?.plateNumber || t.truckPlate || "—"}
                        </td>
                        <td style={{ padding: "14px 12px 14px 0", color: BRAND.textLight }}>
                          {t.driver?.name || t.driverName || truckDriverName(t) || "—"}
                        </td>
                        <td style={{ padding: "14px 12px 14px 0", fontSize: 13, color: BRAND.textMuted }}>
                          {t.fromLocation?.name || t.from || "-"} → {t.toLocation?.name || t.to || "-"}
                        </td>
                        <td style={{ padding: "14px 12px 14px 0" }}>
                          <StatusBadge status={t.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* TOP SPENDING TRUCKS */}
          <Card title="Top Spending Trucks (This Month)">
            {topSpendLoading ? (
              <div style={{ color: BRAND.textMuted, fontSize: 14 }}>Menghitung...</div>
            ) : topSpend.length === 0 ? (
              <div style={{ color: BRAND.textMuted, fontSize: 14 }}>Belum ada pengeluaran tercatat.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }} data-testid="top-spending">
                {topSpend.map((x, idx) => (
                  <div
                    key={x.truckId}
                    style={{
                      padding: 14,
                      borderRadius: 6,
                      background: BRAND.secondary,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 700,
                          fontSize: 13,
                          background: BRAND.primary,
                          color: BRAND.white,
                        }}
                      >
                        {idx + 1}
                      </span>

                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: BRAND.text }}>{x.plateNumber}</div>
                        <div style={{ marginTop: 2, fontSize: 12, color: BRAND.textMuted }}>
                          Spareparts installed
                        </div>
                      </div>
                    </div>

                    <div style={{ fontWeight: 700, color: BRAND.primary, fontSize: 15 }}>
                      {fmtMoney(x.total, x.currency)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT RAIL */}
        <div style={{ display: "grid", gap: 24, alignContent: "start" }}>
          {/* ANALYTICS */}
          <Card title="Analytics">
            <ProgressRow
              label="Fleet Utilization"
              value={pct(trucks.length ? (stats.activeTrucks / trucks.length) * 100 : 0)}
              sub={`${stats.activeTrucks} active of ${trucks.length || 0} kendaraan`}
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
          </Card>

          {/* QUICK ACTIONS */}
          <Card title="Quick Actions">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <ActionBtn label="Buat Perjalanan" onClick={() => (window.location.href = "/trips")} icon={FiPlus} />
              <ActionBtn label="Receive Stock" onClick={() => (window.location.href = "/inventory")} icon={FiPackage} />
              <ActionBtn label="Maintenance" onClick={() => (window.location.href = "/maintenance")} icon={FiTool} />
              <ActionBtn label="Tambah Kendaraan" onClick={() => (window.location.href = "/trucks")} icon={FiTruck} />
            </div>
          </Card>

          {/* ALERTS */}
          <Card title="Alerts">
            {loading ? (
              <div style={{ color: BRAND.textMuted, fontSize: 14 }}>Memeriksa...</div>
            ) : alerts.length === 0 ? (
              <div style={{ color: BRAND.success, fontSize: 14, fontWeight: 500 }}>Tidak ada peringatan</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }} data-testid="alerts-list">
                {alerts.map((a, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 12,
                      borderRadius: 6,
                      background: BRAND.warningBg,
                      border: `1px solid ${BRAND.warning}30`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: BRAND.warning, fontSize: 13 }}>
                      <FiAlertTriangle size={14} />
                      {a.title}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: BRAND.textMuted }}>
                      {a.detail}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* MY ACCOUNT */}
          <Card title="Akun Saya">
            <div style={{ fontSize: 14, lineHeight: 2, color: BRAND.textLight }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FiUser size={14} color={BRAND.textMuted} />
                <span><strong>Name:</strong> {user?.name || "—"}</span>
              </div>
              <div>
                <strong>Email:</strong> {user?.email || "—"}
              </div>
              <div>
                <strong>Role:</strong> <span style={{ color: BRAND.primary, fontWeight: 600 }}>{user?.role || "—"}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 1024px) {
          .dashboard-main-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
