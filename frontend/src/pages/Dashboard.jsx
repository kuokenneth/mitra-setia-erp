import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle, FiArrowDownRight, FiArrowRight, FiArrowUpRight, FiBox, FiCheck, FiCheckCircle, FiClock,
  FiExternalLink, FiFileText, FiMapPin, FiPackage, FiRadio, FiRefreshCw, FiShoppingCart, FiTool, FiTruck, FiWifiOff,
} from "react-icons/fi";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import LoadingState from "../components/LoadingState";
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
const navigate = (path) => { window.location.href = path; };
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

const todayLabel = () => new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const pct = (value) => `${Math.max(0, Math.min(100, Math.round(number(value))))}%`;

function Panel({ title, subtitle, meta, action, className = "", children, ...rest }) {
  return <section className={`db-panel ${className}`.trim()} {...rest}>
    <header className="db-panel-head">
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {action ? <button type="button" className="db-link" onClick={action.onClick}>{action.label}<FiArrowRight aria-hidden="true" /></button> : meta ? <span className="db-chip">{meta}</span> : null}
    </header>
    {children}
  </section>;
}

function Meter({ value, tone = "" }) {
  return <span className={`db-meter ${tone}`.trim()} aria-hidden="true"><i style={{ width: pct(value) }} /></span>;
}

function Spark({ data }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((item) => item.value));
  const step = data.length > 1 ? 100 / (data.length - 1) : 100;
  const points = data.map((item, index) => `${(index * step).toFixed(2)},${(30 - item.value / max * 26).toFixed(2)}`).join(" ");
  return <svg className="db-spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><polyline points={`0,32 ${points} 100,32`} className="area" /><polyline points={points} className="line" /></svg>;
}

function Kpi({ icon, label, value, detail, tone = "green", onClick, children }) {
  return <button type="button" className={`db-kpi ${tone}`} onClick={onClick}>
    <span className="db-kpi-top"><i aria-hidden="true">{icon}</i>{label}<FiArrowUpRight className="db-kpi-go" aria-hidden="true" /></span>
    <strong>{value}</strong>
    <small>{detail}</small>
    <span className="db-kpi-visual">{children}</span>
  </button>;
}

function TrendChart({ data }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  const every = data.length <= 14 ? 1 : data.length <= 31 ? 5 : 15;
  const showValues = data.length <= 14;
  return <div className="db-chart" role="img" aria-label={`Trip selesai per hari: ${data.map((item) => `${item.label} ${item.value}`).join(", ")}`}>
    <div className="db-chart-grid" aria-hidden="true"><span>{max}</span><span>{Math.round(max / 2)}</span><span>0</span></div>
    <div className={`db-chart-bars${data.length > 31 ? " dense" : ""}`}>
      {data.map((item, index) => <div key={item.key} className={index === data.length - 1 ? "is-today" : ""} title={`${item.label}: ${item.value} trip`}>
        {showValues && <b>{item.value}</b>}
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
  return <article className={`db-alert ${critical ? "critical" : "warning"}`}>
    <i aria-hidden="true"><FiAlertTriangle /></i>
    <div className="db-alert-main">
      <div><strong>{truck.plateNumber}</strong><span className="db-tag">{kind}</span></div>
      <p><FiMapPin aria-hidden="true" /> {returnToBase ? `${returnToBase.location} · perlu tindakan` : truck.gpsLocation?.name || "Di luar master lokasi"}</p>
      <small>{truck.driverUser?.name || "Tanpa pengemudi"} · GPS {lastPushTime(truck.lastGpsAt)}{truck.gpsTelemetry?.fresh === false ? " · data tertunda" : ""}</small>
    </div>
    <div className="db-alert-time"><FiClock aria-hidden="true" />{returnToBase ? stopTime(returnToBase.durationMinutes) : stopped ? stopTime(truck.gpsStopWarning.durationMinutes) : "Di dalam area"}</div>
    {hasGps ? <a className="db-icon-btn" aria-label={`Buka lokasi ${truck.plateNumber} di Google Maps`} href={`https://www.google.com/maps?q=${truck.lastGpsLatitude},${truck.lastGpsLongitude}`} target="_blank" rel="noreferrer"><FiExternalLink /></a> : <span />}
  </article>;
}

function DomainCard({ icon, tone, title, value, caption, onOpen, openLabel, metrics }) {
  return <section className={`db-panel db-domain ${tone}`}>
    <header className="db-domain-head">
      <i aria-hidden="true">{icon}</i>
      <div><h2>{title}</h2><p><strong>{value}</strong> {caption}</p></div>
      <button type="button" className="db-link" onClick={onOpen}>{openLabel}<FiArrowRight aria-hidden="true" /></button>
    </header>
    <dl className="db-domain-metrics">{metrics.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd className={metric.attention ? "attention" : ""}>{metric.value}</dd><small>{metric.note}</small></div>)}</dl>
  </section>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const canViewFinance = ["OWNER", "ADMIN"].includes(user?.role);
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

  return <main className="db-page" data-testid="dashboard-page">
    <header className="db-header">
      <div className="db-header-copy">
        <span className="db-date">{todayLabel()}</span>
        <h1>Selamat datang, {user?.name?.split(" ")[0] || "Pengguna"}</h1>
        <p>{loading ? "Menyiapkan ringkasan operasional…" : attention ? `${attention} hal perlu perhatian Anda hari ini.` : "Operasional berjalan normal. Tidak ada hal mendesak."}</p>
      </div>
      <div className="db-tools">
        <div className="db-segment" role="group" aria-label="Pilih periode analisis">{[7, 30, 90].map((value) => <button type="button" key={value} aria-pressed={period === value} className={period === value ? "active" : ""} onClick={() => { setRefreshing(true); setPeriod(value); }}>{value} hari</button>)}</div>
        <button type="button" className="db-icon-btn db-refresh" aria-label="Perbarui dashboard" onClick={() => { setRefreshing(true); setRevision((value) => value + 1); }} disabled={refreshing}><FiRefreshCw className={refreshing ? "spin" : ""} /></button>
        <div className={`db-live ${connected ? "on" : "off"}`} role="status"><i aria-hidden="true" /><span>{connected ? "Live" : "Terputus"}</span><small>{lastUpdated ? lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "…"}</small></div>
      </div>
    </header>

    <section className="db-kpis" aria-label="Indikator utama">
      <Kpi icon={<FiCheckCircle />} label="Trip selesai" value={show(data.completedTrips)} tone="green" onClick={() => navigate("/trips")}
        detail={<><span className={data.throughputChange >= 0 ? "up" : "down"}>{data.throughputChange >= 0 ? <FiArrowUpRight /> : <FiArrowDownRight />}{Math.abs(data.throughputChange)}%</span> {period} hari terakhir</>}>
        <Spark data={data.trend} />
      </Kpi>
      <Kpi icon={<FiTruck />} label="Armada aktif" value={loading ? "—" : <>{data.active}<em>/{trucks.length}</em></>} tone="green" onClick={() => navigate("/trucks")}
        detail={`${data.status.DISPATCH || 0} sedang berjalan · ${data.utilization}% utilisasi`}>
        <Meter value={data.utilization} />
      </Kpi>
      <Kpi icon={<FiFileText />} label="Order aktif" value={show(orders.length)} tone="info" onClick={() => navigate("/orders")}
        detail={`${data.fulfillment}% kuantitas sudah dialokasikan`}>
        <Meter value={data.fulfillment} tone="info" />
      </Kpi>
      <Kpi icon={<FiAlertTriangle />} label="Exception" value={show(data.warnings.length + data.arrivedTrips.length)} tone={data.warnings.length ? "danger" : "neutral"} onClick={() => navigate("/fleet-map")}
        detail={`${data.warnings.length} warning armada · ${data.arrivedTrips.length} trip tertunda`}>
        <span className="db-kpi-dots" aria-hidden="true">{Array.from({ length: Math.min(12, data.warnings.length + data.arrivedTrips.length) }, (_, index) => <i key={index} className={index < data.warnings.length ? "w" : "a"} />)}</span>
      </Kpi>
    </section>

    <div className="db-layout">
      <div className="db-col">
        <Panel title="Prioritas tindakan" subtitle="Diurutkan dari yang paling mendesak" meta={loading ? undefined : `${attention} agenda`} className="db-priorities">
          {loading ? <div className="db-pad"><LoadingState compact label="Menyusun prioritas" rows={2} /></div> : <ul className="db-priority-list">{priorities.map((item) => <li key={item.title}><button type="button" className={item.level} onClick={() => navigate(item.path)}>
            <i aria-hidden="true">{item.level === "safe" ? <FiCheck /> : item.level === "neutral" ? <FiTool /> : <FiAlertTriangle />}</i>
            <span><strong>{item.title}</strong><small>{item.detail}</small></span>
            <em>{item.action}<FiArrowRight aria-hidden="true" /></em>
          </button></li>)}</ul>}
        </Panel>

        <Panel title="Trip selesai per hari" subtitle={`${data.completedTrips} trip dalam ${period} hari · ${data.throughputChange >= 0 ? "naik" : "turun"} ${Math.abs(data.throughputChange)}% dibanding paruh awal periode`} action={{ label: "Lihat trips", onClick: () => navigate("/trips") }}>
          {loading ? <div className="db-pad"><LoadingState compact label="Memuat throughput" rows={2} /></div> : <TrendChart data={data.trend} />}
        </Panel>

        {data.arrivedTrips.length > 0 && <Panel title="Trip tiba menunggu penyelesaian" subtitle="Selesaikan agar billing dan laporan muatan dapat diproses" meta={`${data.arrivedTrips.length} trip`} className="db-arrived">
          <ul className="db-arrived-list">{data.arrivedTrips.slice(0, 8).map((trip) => <li key={trip.id}><button type="button" onClick={() => navigate(`/trips/${trip.id}`)}>
            <span><strong>{trip.order?.orderNo || trip.tripNo || "Trip"}</strong><small>{trip.truck?.plateNumber || trip.plateNumberSnap || "Tanpa armada"} · {trip.driverUser?.name || trip.driverNameSnap || "Tanpa pengemudi"}</small></span>
            <span><strong>{trip.order?.toText || trip.toText || "Tujuan belum dicatat"}</strong><small>{trip.cargoNameSnap || trip.order?.cargoName || "Muatan"}</small></span>
            <em>Selesaikan<FiArrowRight aria-hidden="true" /></em>
          </button></li>)}</ul>
        </Panel>}

        <Panel title="Warning armada" subtitle="Area warning, berhenti lama, dan kembali ke base" meta={`${data.warnings.length} aktif`} className="db-alerts">
          <div className="db-alert-body"><div className="db-alert-list" data-testid="alerts-list">{loading ? <div className="db-pad"><LoadingState compact label="Memuat monitoring GPS" rows={3} /></div> : data.warnings.length ? data.warnings.map((truck) => <AlertRow key={truck.id} truck={truck} />) : <div className="db-empty"><FiCheck aria-hidden="true" /><strong>Semua armada aman</strong><span>Tidak ada area warning atau berhenti terlalu lama.</span></div>}</div></div>
          <footer className="db-panel-foot"><button type="button" className="db-link" onClick={() => navigate("/fleet-map")}><FiMapPin aria-hidden="true" />Buka peta armada<FiArrowRight aria-hidden="true" /></button></footer>
        </Panel>

      </div>

      <aside className="db-col db-side">
        <Panel title="Kesehatan operasi" subtitle="Skor gabungan utilisasi, GPS, servis, dan exception" className="db-pulse">
          <div className="db-pulse-main">
            <div className={`db-ring ${pulseTone}`} style={{ "--pulse": `${data.pulse * 3.6}deg` }}><div><strong>{show(data.pulse)}</strong><small>/100</small></div></div>
            <div><b className={pulseTone}>{loading ? "Memuat…" : pulseLabel}</b><p>{data.warnings.length} exception · {data.gpsOnline}/{data.gpsMapped} GPS online</p></div>
          </div>
          <ul className="db-factors">
            <li><span>Utilisasi armada</span><b>{data.utilization}%</b><Meter value={data.utilization} /></li>
            <li><span>GPS sehat</span><b>{data.gpsHealth}%</b><Meter value={data.gpsHealth} /></li>
            <li><span>Kesiapan servis</span><b>{data.maintenanceHealth}%</b><Meter value={data.maintenanceHealth} /></li>
            <li><span>Bebas exception</span><b>{data.safetyHealth}%</b><Meter value={data.safetyHealth} tone={data.warnings.length ? "warn" : ""} /></li>
          </ul>
        </Panel>

        {canViewFinance && <section className="db-panel db-finance" aria-label="Ringkasan keuangan">
          <header><span>Keuangan · {month}</span><button type="button" onClick={() => navigate("/fleet-profitability")}>Analisis profit<FiArrowRight aria-hidden="true" /></button></header>
          <small>Laba bersih bulan berjalan</small>
          <strong className={profit < 0 ? "loss" : ""}>{show(rupiah(profit))}</strong>
          <dl>
            <div><dt>Pendapatan</dt><dd>{rupiah(finance.summary?.revenue, true)}</dd></div>
            <div><dt>Margin</dt><dd>{number(finance.summary?.margin).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</dd></div>
            <div><dt>Piutang berjalan</dt><dd>{rupiah(outstanding, true)}</dd></div>
            <div><dt>Lewat tempo</dt><dd className={overdue ? "danger" : ""}>{rupiah(overdue, true)}</dd></div>
          </dl>
        </section>}

        <Panel title="Order ke pengiriman" subtitle="Posisi order dan trip saat ini" className="db-flow-panel">
          <ol className="db-flow">
            <li><span>Order terbuka</span><strong>{orders.length}</strong><small>{number(data.orderStatus.CONFIRMED)} confirmed</small></li>
            <li className="moving"><span>Dalam perjalanan</span><strong>{data.movingTrips}</strong><small>trip aktif</small></li>
            <li className={data.arrivedTrips.length ? "warning" : ""}><span>Sudah tiba</span><strong>{data.arrivedTrips.length}</strong><small>perlu closing</small></li>
          </ol>
          <div className="db-allocation"><div><span>Alokasi order aktif</span><b>{data.fulfillment}%</b></div><Meter value={data.fulfillment} /><small>{number(data.orderStatus.DRAFT)} draft · {number(data.orderStatus.IN_PROGRESS)} dalam proses</small></div>
        </Panel>

        <Panel title="Kesiapan armada" subtitle="GPS, servis, stok, dan dokumen" className="db-health">
          <ul className="db-health-list">
            <li><i className="green" aria-hidden="true"><FiRadio /></i><span>GPS online</span><b>{data.gpsOnline}/{data.gpsMapped}</b><em>{data.gpsHealth}%</em></li>
            <li><i className="green" aria-hidden="true"><FiTruck /></i><span>Armada siap jalan</span><b>{data.status.READY}</b><em>{trucks.length ? Math.round(data.status.READY / trucks.length * 100) : 0}%</em></li>
            <li><i className="warn" aria-hidden="true"><FiTool /></i><span>Servis terbuka</span><b>{data.openMaintenance}</b><em className={data.openMaintenance ? "attention" : ""}>{data.openMaintenance ? "Pantau" : "Aman"}</em></li>
            <li><i className="info" aria-hidden="true"><FiBox /></i><span>Stok kritis</span><b>{data.lowStock}</b><em className={data.lowStock ? "attention" : ""}>{data.lowStock ? "Tindak" : "Aman"}</em></li>
            <li><i className="info" aria-hidden="true"><FiFileText /></i><span>STNK habis ≤ 30 hari</span><b>{data.expiringStnk}</b><em className={data.expiringStnk ? "attention" : ""}>{data.expiringStnk ? "Perpanjang" : "Aman"}</em></li>
          </ul>
          <footer className="db-panel-foot db-health-foot"><span><FiWifiOff aria-hidden="true" /> {data.gpsMissing} belum dipasang GPS</span><span><FiClock aria-hidden="true" /> {data.gpsStale} tidak update &gt; 1 jam</span></footer>
        </Panel>
      </aside>
    </div>

    <section className="db-domains" aria-label="Bengkel, pembelian, dan persediaan">
      <DomainCard icon={<FiTool />} tone="warn" title="Bengkel & servis" value={data.status.MAINTENANCE} caption="armada sedang di bengkel" openLabel="Buka servis" onOpen={() => navigate("/maintenance")} metrics={[
        { label: "Servis terbuka", value: data.openMaintenance, note: "pekerjaan aktif" },
        { label: "Menunggu parts", value: workshop.waitingParts, note: "dari pembelian", attention: workshop.waitingParts },
        { label: "Lebih dari 3 hari", value: workshop.agingJobs, note: "butuh eskalasi", attention: workshop.agingJobs },
      ]} />
      <DomainCard icon={<FiShoppingCart />} tone="info" title="Pembelian & supplier" value={purchasePulse.waitingApproval} caption="permintaan menunggu approval" openLabel="Buka pembelian" onOpen={() => navigate("/purchasing")} metrics={[
        { label: "Belum disetujui", value: purchasePulse.waitingApproval, note: "menunggu approval", attention: purchasePulse.waitingApproval },
        { label: "PO dalam proses", value: purchasePulse.inTransit, note: "belum diterima penuh" },
        { label: "Tagihan terbuka", value: purchasePulse.unpaidBills, note: rupiah(purchasePulse.outstanding, true) },
      ]} />
      <DomainCard icon={<FiPackage />} tone="green" title="Persediaan" value={inventory.length} caption="item persediaan terpantau" openLabel="Buka stok" onOpen={() => navigate("/inventory")} metrics={[
        { label: "Stok minimum", value: data.lowStock, note: "perlu replenishment", attention: data.lowStock },
        { label: "Kebutuhan bengkel", value: workshop.serviceRequests, note: "terkait servis" },
        { label: "Armada siap", value: data.status.READY, note: "unit siap jalan" },
      ]} />
    </section>
  </main>;
}
