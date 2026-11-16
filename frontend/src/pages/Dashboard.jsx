import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiActivity, FiAlertTriangle, FiArrowDownRight, FiArrowRight, FiArrowUpRight, FiBox, FiCheck, FiClock, FiExternalLink,
  FiFileText, FiMapPin, FiNavigation, FiPackage, FiPlus, FiRadio, FiRefreshCw, FiShoppingCart, FiTool, FiTruck, FiWifiOff,
} from "react-icons/fi";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import { Badge, Button, Card, EmptyState, IconButton, LoadingSkeleton, Meter, Page, PageHeader, StatCard, StatusBadge, Tabs } from "../ui";
import "./Dashboard.css";

const list = (value) => Array.isArray(value) ? value : value?.items || value?.jobs || value?.data || value?.rows || [];
const number = (value) => Number(value || 0);
const rupiah = (value, compact = false) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
  ...(compact ? { notation: "compact" } : {}),
}).format(number(value));
const stopTime = (minutes) => {
  const total = Math.max(0, number(minutes));
  return total >= 60 ? `${Math.floor(total / 60)} jam ${Math.floor(total % 60)} menit` : `${Math.floor(total)} menit`;
};
const dateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(date);
};
const lastPushTime = (value) => {
  if (!value) return "Belum ada data";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "Waktu tidak tersedia";
  return timestamp.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).replace(" pukul", " ·") + " WIB";
};
const relativeTime = (value) => {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} mnt lalu`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} jam lalu`;
  return `${Math.round(minutes / 1440)} hari lalu`;
};

const todayLabel = () => new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" });

function TrendChart({ data }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  const every = data.length <= 14 ? 1 : data.length <= 31 ? 5 : 15;
  const showValues = data.length <= 14;
  return <div className="dash-chart" role="img" aria-label={`Trip selesai per hari: ${data.map((item) => `${item.label} ${item.value}`).join(", ")}`}>
    <div className="dash-chart-axis" aria-hidden="true"><span>{max}</span><span>{max >= 2 ? Math.round(max / 2) : ""}</span><span>0</span></div>
    <div className={`dash-chart-bars${data.length > 31 ? " is-dense" : ""}`}>
      {data.map((item, index) => <div key={item.key} className={index === data.length - 1 ? "is-today" : ""} title={`${item.label}: ${item.value} trip`}>
        {showValues && <b>{item.value || ""}</b>}
        <i style={{ height: `${Math.max(item.value ? 4 : 1.5, item.value / max * 100)}%` }} />
        <span>{(index % every === 0 || index === data.length - 1) ? item.short : ""}</span>
      </div>)}
    </div>
  </div>;
}

function AlertRow({ truck }) {
  const critical = Boolean(truck.gpsAreaWarning);
  const returnToBase = truck.tripReturnWarning || truck.tripServiceWarning;
  const stopped = Boolean(truck.gpsStopWarning);
  const hasGps = Number.isFinite(Number(truck.lastGpsLatitude)) && Number.isFinite(Number(truck.lastGpsLongitude));
  const kind = critical ? "Area warning" : returnToBase ? "Kembali ke base" : "Berhenti lama";
  return <li className="ui-row dash-alert">
    <span className={`dash-dot ${critical ? "is-danger" : "is-warning"}`} aria-hidden="true" />
    <span className="ui-row__main">
      <span className="ui-row__title">{truck.plateNumber} <Badge tone={critical ? "danger" : "warning"}>{kind}</Badge></span>
      <span className="ui-row__sub"><FiMapPin aria-hidden="true" /> {returnToBase ? `${returnToBase.location} · perlu tindakan` : truck.gpsLocation?.name || "Di luar master lokasi"} · {truck.driverUser?.name || "Tanpa pengemudi"}</span>
      <span className="ui-row__sub">GPS {lastPushTime(truck.lastGpsAt)}{truck.gpsTelemetry?.fresh === false ? " · data tertunda" : ""}</span>
    </span>
    <span className="ui-row__end dash-alert-end">
      <span className="dash-duration"><FiClock aria-hidden="true" />{returnToBase ? stopTime(returnToBase.durationMinutes) : stopped ? stopTime(truck.gpsStopWarning.durationMinutes) : "Di dalam area"}</span>
      {hasGps ? <a className="ui-btn ui-btn--ghost ui-btn--icon ui-btn--sm" aria-label={`Buka lokasi ${truck.plateNumber} di Google Maps`} href={`https://www.google.com/maps?q=${truck.lastGpsLatitude},${truck.lastGpsLongitude}`} target="_blank" rel="noreferrer"><FiExternalLink /></a> : null}
    </span>
  </li>;
}

function MetricList({ items }) {
  return <dl className="dash-metrics">{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd className={item.attention ? "is-attention" : ""}>{item.value}</dd>{item.note ? <small>{item.note}</small> : null}</div>)}</dl>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canViewFinance = ["OWNER", "ADMIN", "STAFF"].includes(user?.role);
  const [period, setPeriod] = useState(7);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [referenceTime, setReferenceTime] = useState(() => Date.now());
  const [trucks, setTrucks] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [maintenanceSummary, setMaintenanceSummary] = useState({});
  const [inventory, setInventory] = useState([]);
  const [purchasing, setPurchasing] = useState({ requests: [], orders: [], bills: [] });
  const [trips, setTrips] = useState([]);
  const [orders, setOrders] = useState([]);
  const [finance, setFinance] = useState({ summary: {} });
  const [receivables, setReceivables] = useState({ stats: {} });
  useLiveRefresh(() => setRevision((value) => value + 1));

  const month = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const end = new Date();
    const start = new Date(end.getTime() - (period - 1) * 86400000);
    const requests = [
      ["trucks", api("/trucks")],
      ["maintenance", api("/maintenance")],
      ["inventory", api("/inventory/items")],
      ["purchasing", api("/purchasing/overview")],
      ["trips", api(`/trips?dateFrom=${start.toISOString()}&dateTo=${end.toISOString()}`)],
      ["orders", api("/orders?statuses=DRAFT,CONFIRMED,IN_PROGRESS")],
      ["finance", canViewFinance ? api(`/fleet-profitability?month=${month}`) : Promise.resolve({ summary: {} })],
      ["receivables", canViewFinance ? api("/receivables/overview") : Promise.resolve({ stats: {} })],
    ];
    Promise.allSettled(requests.map(([, request]) => request)).then((results) => {
      if (cancelled) return;
      const values = Object.fromEntries(results.map((result, index) => [requests[index][0], result.status === "fulfilled" ? result.value : null]));
      if (values.trucks) setTrucks(list(values.trucks));
      if (values.maintenance) { setMaintenance(list(values.maintenance)); setMaintenanceSummary(values.maintenance.summary || {}); }
      if (values.inventory) setInventory(list(values.inventory));
      if (values.purchasing) setPurchasing(values.purchasing);
      if (values.trips) setTrips(list(values.trips));
      if (values.orders) setOrders(list(values.orders));
      if (values.finance) setFinance(values.finance?.summary ? values.finance : { summary: {} });
      if (values.receivables) setReceivables(values.receivables);
      setConnected(Boolean(values.trucks && values.trips));
      setLastUpdated(new Date());
      setReferenceTime(Date.now());
    }).finally(() => { if (!cancelled) { setLoading(false); setRefreshing(false); } });
    return () => { cancelled = true; };
  }, [canViewFinance, month, period, revision]);

  const data = useMemo(() => {
    const now = referenceTime;
    const status = { READY: 0, PLANNED: 0, DISPATCH: 0, MAINTENANCE: 0, INACTIVE: 0 };
    trucks.forEach((truck) => { const key = String(truck.status || "INACTIVE").toUpperCase(); status[key] = (status[key] || 0) + 1; });
    const active = status.READY + status.PLANNED + status.DISPATCH;
    const warnings = trucks.filter((truck) => truck.tripReturnWarning || truck.tripServiceWarning || truck.gpsStopWarning || truck.gpsAreaWarning).sort((a, b) => Number(Boolean(b.gpsAreaWarning)) - Number(Boolean(a.gpsAreaWarning)) || number(b.gpsStopWarning?.durationMinutes) - number(a.gpsStopWarning?.durationMinutes));
    const gpsMapped = trucks.filter((truck) => truck.gpsImei || truck.gpsDeviceId);
    const gpsOnline = gpsMapped.filter((truck) => truck.lastGpsAt && new Date(truck.lastGpsAt).getTime() >= now - 3600000).length;
    const openMaintenance = number(maintenanceSummary.open) || maintenance.filter((job) => ["OPEN", "IN_PROGRESS"].includes(String(job.status || "").toUpperCase())).length;
    const lowStock = inventory.filter((item) => { const qty = number(item.qtyTotal ?? item.totalQty ?? item.qty); const minimum = number(item.reorderPoint ?? item.minQty); return minimum > 0 && qty <= minimum; }).length;
    const expiringStnk = trucks.filter((truck) => { const diff = new Date(truck.stnkExpiry).getTime() - now; return truck.stnkExpiry && diff >= 0 && diff <= 30 * 86400000; }).length;
    const tripStatus = trips.reduce((acc, trip) => { const key = String(trip.status || "OTHER").toUpperCase(); acc[key] = (acc[key] || 0) + 1; return acc; }, {});
    const completedTrips = number(tripStatus.COMPLETED);
    const movingTrips = number(tripStatus.DISPATCH) + number(tripStatus.IN_TRANSIT) + number(tripStatus.LOADING);
    const arrivedTrips = trips.filter((trip) => String(trip.status).toUpperCase() === "ARRIVED");
    const orderStatus = orders.reduce((acc, order) => { const key = String(order.status || "DRAFT").toUpperCase(); acc[key] = (acc[key] || 0) + 1; return acc; }, {});
    const allocatedQty = orders.reduce((sum, order) => sum + number(order.qtyTripped), 0);
    const orderQty = orders.reduce((sum, order) => sum + number(order.qty), 0);
    const fulfillment = orderQty ? Math.min(100, Math.round(allocatedQty / orderQty * 100)) : 0;
    const trend = Array.from({ length: period }, (_, index) => {
      const day = new Date(now - (period - 1 - index) * 86400000);
      const key = dateKey(day);
      const value = trips.filter((trip) => String(trip.status).toUpperCase() === "COMPLETED" && dateKey(trip.completedAt || trip.arrivedAt || trip.updatedAt || trip.createdAt) === key).length;
      return { key, value, label: day.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" }), short: period <= 7 ? day.toLocaleDateString("id-ID", { weekday: "short" }).slice(0, 3) : String(day.getDate()) };
    });
    const prev = trend.slice(0, Math.floor(trend.length / 2)).reduce((sum, item) => sum + item.value, 0);
    const recent = trend.slice(Math.floor(trend.length / 2)).reduce((sum, item) => sum + item.value, 0);
    const throughputChange = prev ? Math.round((recent - prev) / prev * 100) : recent ? 100 : 0;
    const utilization = trucks.length ? Math.round(active / trucks.length * 100) : 0;
    const gpsHealth = gpsMapped.length ? Math.round(gpsOnline / gpsMapped.length * 100) : 0;
    const maintenanceHealth = trucks.length ? Math.max(0, Math.round(100 - openMaintenance / trucks.length * 100)) : 100;
    const safetyHealth = trucks.length ? Math.max(0, Math.round(100 - warnings.length / trucks.length * 100)) : 100;
    const pulse = Math.round(utilization * .35 + gpsHealth * .25 + maintenanceHealth * .2 + safetyHealth * .2);
    return { status, active, warnings, gpsMapped: gpsMapped.length, gpsOnline, gpsStale: gpsMapped.length - gpsOnline, gpsMissing: trucks.length - gpsMapped.length, openMaintenance, lowStock, expiringStnk, completedTrips, movingTrips, arrivedTrips, orderStatus, fulfillment, trend, throughputChange, utilization, gpsHealth, maintenanceHealth, safetyHealth, pulse };
  }, [trucks, maintenance, maintenanceSummary, inventory, trips, orders, period, referenceTime]);

  const priorities = useMemo(() => [
    data.warnings.length && { level: "critical", title: `${data.warnings.length} warning armada aktif`, detail: "Periksa posisi, durasi berhenti, dan instruksi pengemudi.", path: "/fleet-map", action: "Buka live map" },
    data.arrivedTrips.length && { level: "warning", title: `${data.arrivedTrips.length} trip tiba belum diselesaikan`, detail: "Penyelesaian trip membuka proses billing dan laporan muatan.", path: "/trips", action: "Selesaikan trip" },
    (purchasing.requests || []).filter((request) => request.status === "WAITING_APPROVAL").length > 0 && { level: "warning", title: `${(purchasing.requests || []).filter((request) => request.status === "WAITING_APPROVAL").length} permintaan pembelian menunggu approval`, detail: "Approval diperlukan agar kebutuhan bengkel dan operasional dapat diproses.", path: "/purchasing", action: "Review pembelian" },
    data.lowStock && { level: "warning", title: `${data.lowStock} item mencapai reorder point`, detail: "Risiko menghambat servis dan kesiapan armada.", path: "/inventory", action: "Cek persediaan" },
    data.openMaintenance && { level: "neutral", title: `${data.openMaintenance} pekerjaan servis masih terbuka`, detail: "Pastikan target selesai dan kebutuhan sparepart terkonfirmasi.", path: "/maintenance", action: "Lihat maintenance" },
    !data.warnings.length && !data.arrivedTrips.length && !data.lowStock && { level: "safe", title: "Operasional dalam kondisi terkendali", detail: "Tidak ada exception kritis yang memerlukan eskalasi saat ini.", path: "/trips", action: "Lihat aktivitas" },
  ].filter(Boolean).slice(0, 4), [data, purchasing]);

  const profit = number(finance.summary?.profit);
  const receivableStats = receivables?.stats || {};
  const outstanding = number(receivableStats.outstanding);
  const overdue = number(receivableStats.overdue);
  const workshop = useMemo(() => {
    const openJobs = maintenance.filter((job) => String(job.status).toUpperCase() === "OPEN");
    const agingJobs = openJobs.filter((job) => referenceTime - new Date(job.createdAt).getTime() >= 3 * 86400000).length;
    const serviceRequests = (purchasing.requests || []).filter((request) => request.maintenance && !["REJECTED", "CANCELLED"].includes(request.status));
    const waitingParts = serviceRequests.filter((request) => request.status === "WAITING_APPROVAL" || (request.status === "APPROVED" && !(purchasing.orders || []).some((order) => order.requestId === request.id && order.status !== "CANCELLED"))).length;
    return { agingJobs, waitingParts, serviceRequests: serviceRequests.length };
  }, [maintenance, purchasing, referenceTime]);
  const purchasePulse = useMemo(() => {
    const requests = purchasing.requests || [];
    const purchaseOrders = purchasing.orders || [];
    const bills = purchasing.bills || [];
    const waitingApproval = requests.filter((request) => request.status === "WAITING_APPROVAL").length;
    const inTransit = purchaseOrders.filter((order) => ["SENT_TO_SUPPLIER", "PARTIALLY_RECEIVED"].includes(order.status)).length;
    const unpaidBills = bills.filter((bill) => bill.status !== "PAID");
    const outstanding = unpaidBills.reduce((sum, bill) => sum + Math.max(0, number(bill.amount) - (bill.payments || []).filter((payment) => payment.status === "PAID").reduce((paid, payment) => paid + number(payment.amount), 0)), 0);
    return { waitingApproval, inTransit, unpaidBills: unpaidBills.length, outstanding };
  }, [purchasing]);

  const attention = priorities.filter((item) => item.level !== "safe").length;
  const pulseLabel = data.pulse >= 85 ? "Operasi sehat" : data.pulse >= 65 ? "Perlu perhatian" : "Butuh intervensi";
  const pulseTone = data.pulse >= 85 ? "good" : data.pulse >= 65 ? "watch" : "bad";
  const show = (value) => loading ? "—" : value;

  const todayKey = dateKey(referenceTime);
  const todayTrips = useMemo(() => trips.filter((trip) => String(trip.status).toUpperCase() !== "CANCELLED" && dateKey(trip.plannedDepartAt || trip.dispatchedAt || trip.createdAt) === todayKey), [trips, todayKey]);
  const recentTrips = useMemo(() => [...trips].sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()).slice(0, 6), [trips]);
  const greeting = user?.name?.split(" ")[0] || "Pengguna";
  const periodTabs = [7, 30, 90].map((value) => ({ value, label: `${value} hari` }));

  return <Page className="dash" data-testid="dashboard-page">
    <PageHeader
      title={`Selamat datang, ${greeting}`}
      description={<>{todayLabel()} · {loading ? "menyiapkan ringkasan operasional…" : attention ? `${attention} hal perlu perhatian Anda hari ini.` : "operasional berjalan normal."}</>}
      actions={<>
        <Tabs label="Pilih periode analisis" items={periodTabs} value={period} onChange={(value) => { setRefreshing(true); setPeriod(value); }} />
        <IconButton variant="outline" label="Perbarui dashboard" icon={<FiRefreshCw className={refreshing ? "ui-spin" : ""} />} onClick={() => { setRefreshing(true); setRevision((value) => value + 1); }} disabled={refreshing} />
        <span className={`dash-sync ${connected ? "is-on" : "is-off"}`} role="status"><i aria-hidden="true" />{connected ? "Terhubung" : "Terputus"}{lastUpdated ? ` · ${lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
      </>}
    />

    <section className="ui-stats dash-kpis" aria-label="Indikator utama">
      <StatCard label="Perjalanan hari ini" icon={<FiNavigation />} tone="info" value={show(todayTrips.length)} sub={`${data.movingTrips} sedang berjalan · ${data.arrivedTrips.length} tiba`} onClick={() => navigate("/trips")} />
      <StatCard label="Armada beroperasi" icon={<FiTruck />} value={loading ? "—" : <>{number(data.status.DISPATCH)}<em> / {trucks.length}</em></>} sub={`${data.utilization}% utilisasi armada`} onClick={() => navigate("/trucks")}><Meter value={data.utilization} label="Utilisasi armada" /></StatCard>
      <StatCard label="Armada tersedia" icon={<FiCheck />} tone="success" value={show(data.status.READY)} sub={`${number(data.status.PLANNED)} direncanakan`} onClick={() => navigate("/trucks")} />
      <StatCard label="Servis aktif" icon={<FiTool />} tone={data.openMaintenance ? "warning" : "default"} value={show(data.openMaintenance)} sub={`${number(data.status.MAINTENANCE)} armada di bengkel`} onClick={() => navigate("/maintenance")} />
      <StatCard label="Stok menipis" icon={<FiBox />} tone={data.lowStock ? "warning" : "default"} value={show(data.lowStock)} sub={`dari ${inventory.length} item terpantau`} onClick={() => navigate("/inventory")} />
      <StatCard label="Exception" icon={<FiAlertTriangle />} tone={data.warnings.length ? "danger" : "default"} value={show(data.warnings.length + data.arrivedTrips.length)} sub={`${data.warnings.length} warning · ${data.arrivedTrips.length} trip tertunda`} onClick={() => navigate("/fleet-map")} />
    </section>

    <div className="dash-grid">
      <div className="dash-main">
        <Card className="dash-o-chart" title="Trip selesai per hari" subtitle={<>{data.completedTrips} trip dalam {period} hari · <span className={data.throughputChange >= 0 ? "dash-up" : "dash-down"}>{data.throughputChange >= 0 ? <FiArrowUpRight aria-hidden="true" /> : <FiArrowDownRight aria-hidden="true" />}{Math.abs(data.throughputChange)}%</span> dibanding paruh awal periode</>}
          action={<Button variant="link" size="sm" onClick={() => navigate("/trips")}>Lihat perjalanan <FiArrowRight aria-hidden="true" /></Button>}>
          {loading ? <LoadingSkeleton rows={3} label="Memuat throughput" /> : <TrendChart data={data.trend} />}
        </Card>

        <Card className="dash-o-priority" title="Prioritas tindakan" subtitle="Diurutkan dari yang paling mendesak" flush action={loading ? null : <Badge tone={attention ? "warning" : "success"}>{attention} agenda</Badge>}>
          {loading ? <LoadingSkeleton rows={2} label="Menyusun prioritas" /> : <ul className="ui-rows">{priorities.map((item) => <li key={item.title}><button type="button" className={`ui-row dash-priority is-${item.level}`} onClick={() => navigate(item.path)}>
            <span className="dash-priority-icon" aria-hidden="true">{item.level === "safe" ? <FiCheck /> : item.level === "neutral" ? <FiTool /> : <FiAlertTriangle />}</span>
            <span className="ui-row__main"><span className="ui-row__title">{item.title}</span><span className="ui-row__sub dash-wrap">{item.detail}</span></span>
            <span className="ui-row__end dash-link">{item.action}<FiArrowRight aria-hidden="true" /></span>
          </button></li>)}</ul>}
        </Card>

        {data.arrivedTrips.length > 0 && <Card className="dash-o-arrived" title="Trip tiba menunggu penyelesaian" subtitle="Selesaikan agar billing dan laporan muatan dapat diproses" flush action={<Badge tone="warning">{data.arrivedTrips.length} trip</Badge>}>
          <ul className="ui-rows">{data.arrivedTrips.slice(0, 8).map((trip) => <li key={trip.id}><button type="button" className="ui-row" onClick={() => navigate(`/trips/${trip.id}`)}>
            <span className="ui-row__main"><span className="ui-row__title">{trip.order?.orderNo || trip.tripNo || "Trip"} · {trip.order?.toText || trip.toText || "Tujuan belum dicatat"}</span><span className="ui-row__sub">{trip.truck?.plateNumber || trip.plateNumberSnap || "Tanpa armada"} · {trip.driverUser?.name || trip.driverNameSnap || "Tanpa pengemudi"} · {trip.cargoNameSnap || trip.order?.cargoName || "Muatan"}</span></span>
            <span className="ui-row__end dash-link">Selesaikan<FiArrowRight aria-hidden="true" /></span>
          </button></li>)}</ul>
        </Card>}

        <Card className="dash-o-alerts" title="Warning armada" subtitle="Area warning, berhenti lama, dan kembali ke base" flush action={<Badge tone={data.warnings.length ? "danger" : "success"}>{data.warnings.length} aktif</Badge>}
          footer={<Button variant="link" size="sm" onClick={() => navigate("/fleet-map")}><FiMapPin aria-hidden="true" /> Buka peta armada <FiArrowRight aria-hidden="true" /></Button>}>
          <div data-testid="alerts-list">{loading ? <LoadingSkeleton rows={3} label="Memuat monitoring GPS" /> : data.warnings.length ? <ul className="ui-rows">{data.warnings.map((truck) => <AlertRow key={truck.id} truck={truck} />)}</ul> : <EmptyState icon={<FiCheck />} title="Semua armada aman" description="Tidak ada area warning atau berhenti terlalu lama." />}</div>
        </Card>

        <Card className="dash-o-recent" title="Aktivitas terbaru" subtitle="Perjalanan yang terakhir diperbarui" flush action={<Button variant="link" size="sm" onClick={() => navigate("/trips")}>Semua <FiArrowRight aria-hidden="true" /></Button>}>
          {loading ? <LoadingSkeleton rows={4} label="Memuat aktivitas" /> : recentTrips.length ? <ul className="ui-rows">{recentTrips.map((trip) => <li key={trip.id}><button type="button" className="ui-row" onClick={() => navigate(`/trips/${trip.id}`)}>
            <span className="ui-row__main"><span className="ui-row__title">{trip.truck?.plateNumber || trip.plateNumberSnap || "Tanpa armada"} · {trip.order?.toText || trip.toText || "Tujuan belum dicatat"}</span><span className="ui-row__sub">{trip.order?.orderNo || trip.tripNo || "Trip"} · {trip.driverUser?.name || trip.driverNameSnap || "Tanpa pengemudi"} · {relativeTime(trip.updatedAt || trip.createdAt)}</span></span>
            <span className="ui-row__end"><StatusBadge status={trip.status} /></span>
          </button></li>)}</ul> : <EmptyState icon={<FiActivity />} title="Belum ada aktivitas" description={`Tidak ada perjalanan dalam ${period} hari terakhir.`} />}
        </Card>
      </div>

      <aside className="dash-side">
        <Card title="Aksi cepat" className="dash-quick">
          <div className="dash-quick-grid">
            <Button icon={<FiPlus />} onClick={() => navigate("/orders/new")}>Pesanan baru</Button>
            <Button icon={<FiNavigation />} onClick={() => navigate("/trips")}>Kelola trip</Button>
            <Button icon={<FiTool />} onClick={() => navigate("/maintenance")}>Servis</Button>
            <Button icon={<FiPackage />} onClick={() => navigate("/inventory")}>Persediaan</Button>
          </div>
        </Card>

        <Card className="dash-o-pulse" title="Kesehatan operasi" subtitle="Skor gabungan utilisasi, GPS, servis, dan exception">
          <div className="dash-pulse">
            <div className={`dash-ring is-${pulseTone}`} style={{ "--pulse": `${data.pulse * 3.6}deg` }}><div><strong>{show(data.pulse)}</strong><small>/100</small></div></div>
            <div><Badge tone={pulseTone === "good" ? "success" : pulseTone === "watch" ? "warning" : "danger"}>{loading ? "Memuat…" : pulseLabel}</Badge><p>{data.warnings.length} exception · {data.gpsOnline}/{data.gpsMapped} GPS online</p></div>
          </div>
          <ul className="dash-factors">
            <li><span>Utilisasi armada</span><b>{data.utilization}%</b><Meter value={data.utilization} label="Utilisasi armada" /></li>
            <li><span>GPS sehat</span><b>{data.gpsHealth}%</b><Meter value={data.gpsHealth} label="GPS sehat" /></li>
            <li><span>Kesiapan servis</span><b>{data.maintenanceHealth}%</b><Meter value={data.maintenanceHealth} label="Kesiapan servis" /></li>
            <li><span>Bebas exception</span><b>{data.safetyHealth}%</b><Meter value={data.safetyHealth} tone={data.warnings.length ? "warning" : undefined} label="Bebas exception" /></li>
          </ul>
        </Card>

        {canViewFinance && <Card className="dash-o-finance" title={`Keuangan · ${month}`} action={<Button variant="link" size="sm" onClick={() => navigate("/fleet-profitability")}>Profit armada <FiArrowRight aria-hidden="true" /></Button>}>
          <div className="dash-profit"><small>Laba bersih bulan berjalan</small><strong className={profit < 0 ? "is-loss" : ""}>{show(rupiah(profit))}</strong></div>
          <MetricList items={[
            { label: "Pendapatan", value: rupiah(finance.summary?.revenue, true) },
            { label: "Margin", value: `${number(finance.summary?.margin).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` },
            { label: "Piutang berjalan", value: rupiah(outstanding, true) },
            { label: "Lewat tempo", value: rupiah(overdue, true), attention: overdue },
          ]} />
        </Card>}

        <Card className="dash-o-flow" title="Order ke pengiriman" subtitle="Posisi order dan trip saat ini" action={<Button variant="link" size="sm" onClick={() => navigate("/orders")}>Lihat pesanan <FiArrowRight aria-hidden="true" /></Button>}>
          <MetricList items={[
            { label: "Order terbuka", value: orders.length, note: `${number(data.orderStatus.CONFIRMED)} confirmed` },
            { label: "Dalam perjalanan", value: data.movingTrips, note: "trip aktif" },
            { label: "Sudah tiba", value: data.arrivedTrips.length, note: "perlu closing", attention: data.arrivedTrips.length },
          ]} />
          <div className="dash-allocation"><div><span>Alokasi order aktif</span><b>{data.fulfillment}%</b></div><Meter value={data.fulfillment} label="Alokasi order aktif" /><small>{number(data.orderStatus.DRAFT)} draft · {number(data.orderStatus.IN_PROGRESS)} dalam proses</small></div>
        </Card>

        <Card className="dash-o-health" title="Kesiapan armada" subtitle="GPS, servis, stok, dan dokumen" flush
          footer={<><span><FiWifiOff aria-hidden="true" /> {data.gpsMissing} tanpa GPS</span><span><FiClock aria-hidden="true" /> {data.gpsStale} tidak update &gt; 1 jam</span></>}>
          <ul className="ui-rows dash-health">
            <li className="ui-row"><span className="ui-row__main"><span className="ui-row__title"><FiRadio aria-hidden="true" /> GPS online</span></span><span className="ui-row__end"><b>{data.gpsOnline}/{data.gpsMapped}</b> <Badge tone="success">{data.gpsHealth}%</Badge></span></li>
            <li className="ui-row"><span className="ui-row__main"><span className="ui-row__title"><FiTruck aria-hidden="true" /> Armada siap jalan</span></span><span className="ui-row__end"><b>{data.status.READY}</b> <Badge tone="success">{trucks.length ? Math.round(data.status.READY / trucks.length * 100) : 0}%</Badge></span></li>
            <li className="ui-row"><span className="ui-row__main"><span className="ui-row__title"><FiTool aria-hidden="true" /> Servis terbuka</span></span><span className="ui-row__end"><b>{data.openMaintenance}</b> <Badge tone={data.openMaintenance ? "warning" : "success"}>{data.openMaintenance ? "Pantau" : "Aman"}</Badge></span></li>
            <li className="ui-row"><span className="ui-row__main"><span className="ui-row__title"><FiBox aria-hidden="true" /> Stok kritis</span></span><span className="ui-row__end"><b>{data.lowStock}</b> <Badge tone={data.lowStock ? "warning" : "success"}>{data.lowStock ? "Tindak" : "Aman"}</Badge></span></li>
            <li className="ui-row"><span className="ui-row__main"><span className="ui-row__title"><FiFileText aria-hidden="true" /> STNK habis ≤ 30 hari</span></span><span className="ui-row__end"><b>{data.expiringStnk}</b> <Badge tone={data.expiringStnk ? "warning" : "success"}>{data.expiringStnk ? "Perpanjang" : "Aman"}</Badge></span></li>
          </ul>
        </Card>
      </aside>
    </div>

    <section className="dash-domains" aria-label="Bengkel, pembelian, dan persediaan">
      <Card title="Bengkel & servis" subtitle={`${data.status.MAINTENANCE} armada sedang di bengkel`} action={<Button variant="link" size="sm" onClick={() => navigate("/maintenance")}>Buka servis <FiArrowRight aria-hidden="true" /></Button>}>
        <MetricList items={[
          { label: "Servis terbuka", value: data.openMaintenance, note: "pekerjaan aktif" },
          { label: "Menunggu parts", value: workshop.waitingParts, note: "dari pembelian", attention: workshop.waitingParts },
          { label: "Lebih dari 3 hari", value: workshop.agingJobs, note: "butuh eskalasi", attention: workshop.agingJobs },
        ]} />
      </Card>
      <Card title="Pembelian & supplier" subtitle={`${purchasePulse.waitingApproval} permintaan menunggu approval`} action={<Button variant="link" size="sm" onClick={() => navigate("/purchasing")}>Buka pembelian <FiArrowRight aria-hidden="true" /></Button>}>
        <MetricList items={[
          { label: "Belum disetujui", value: purchasePulse.waitingApproval, note: "menunggu approval", attention: purchasePulse.waitingApproval },
          { label: "PO dalam proses", value: purchasePulse.inTransit, note: "belum diterima penuh" },
          { label: "Tagihan terbuka", value: purchasePulse.unpaidBills, note: rupiah(purchasePulse.outstanding, true) },
        ]} />
      </Card>
      <Card title="Persediaan" subtitle={`${inventory.length} item persediaan terpantau`} action={<Button variant="link" size="sm" onClick={() => navigate("/inventory")}>Buka stok <FiArrowRight aria-hidden="true" /></Button>}>
        <MetricList items={[
          { label: "Stok minimum", value: data.lowStock, note: "perlu replenishment", attention: data.lowStock },
          { label: "Kebutuhan bengkel", value: workshop.serviceRequests, note: "terkait servis" },
          { label: "Armada siap", value: data.status.READY, note: "unit siap jalan" },
        ]} />
      </Card>
    </section>
  </Page>;
}
