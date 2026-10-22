import { useEffect, useMemo, useState } from "react";
import {
  FiActivity, FiAlertTriangle, FiArrowRight, FiArrowUpRight, FiBox, FiCheck,
  FiClock, FiDollarSign, FiExternalLink, FiLayers, FiMapPin, FiRadio,
  FiPackage, FiRefreshCw, FiShoppingCart, FiTarget, FiTool, FiTrendingUp, FiTruck, FiWifiOff,
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

function SectionTitle({ eyebrow, title, meta, icon: Icon }) {
  return <div className="d4-section-title"><div><span>{eyebrow}</span><h2>{title}</h2></div>{meta ? <b>{meta}</b> : Icon ? <Icon /> : null}</div>;
}

function AlertRow({ truck }) {
  const critical = Boolean(truck.gpsAreaWarning);
  const returnToBase = truck.tripReturnWarning || truck.tripServiceWarning;
  const stopped = Boolean(truck.gpsStopWarning);
  const hasGps = Number.isFinite(Number(truck.lastGpsLatitude)) && Number.isFinite(Number(truck.lastGpsLongitude));
  return <article className={`d4-alert ${critical ? "critical" : "stopped"}`}>
    <i><FiAlertTriangle /></i>
    <div className="d4-alert-main"><div><strong>{truck.plateNumber}</strong><b>{critical ? "AREA WARNING" : returnToBase ? "KEMBALI KE BASE" : "BERHENTI LAMA"}</b></div><p><FiMapPin /> {returnToBase ? `${returnToBase.location} · perlu tindakan` : truck.gpsLocation?.name || "Di luar master lokasi"}</p></div>
    <div className="d4-alert-meta"><span>{returnToBase ? stopTime(returnToBase.durationMinutes) : stopped ? stopTime(truck.gpsStopWarning.durationMinutes) : "Sedang berada di area"}</span><small>Push GPS: {lastPushTime(truck.lastGpsAt)}{truck.gpsTelemetry?.fresh === false ? " · data tertunda" : ""}</small><small>{truck.driverUser?.name || "Tanpa pengemudi"}</small></div>
    {hasGps && <a aria-label={`Buka lokasi ${truck.plateNumber}`} href={`https://www.google.com/maps?q=${truck.lastGpsLatitude},${truck.lastGpsLongitude}`} target="_blank" rel="noreferrer"><FiExternalLink /></a>}
  </article>;
}

function Stat({ label, value, detail, trend, tone = "neutral", onClick }) {
  const Tag = onClick ? "button" : "div";
  return <Tag className={`d4-stat ${tone}`} onClick={onClick}><span>{label}</span><strong>{value}</strong><small>{detail}</small>{trend && <em><FiTrendingUp />{trend}</em>}</Tag>;
}

function MiniBars({ data }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return <div className="d4-bars" aria-label="Grafik trip selesai per hari">{data.map((item) => <div key={item.key} title={`${item.label}: ${item.value} trip`}><i style={{ height: `${Math.max(7, item.value / max * 100)}%` }} /><span>{item.short}</span></div>)}</div>;
}

function FlowStep({ label, value, note, tone }) {
  return <div className={`d4-flow-step ${tone || ""}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
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
    return { status, active, warnings, gpsMapped: gpsMapped.length, gpsOnline, gpsStale: gpsMapped.length - gpsOnline, gpsMissing: trucks.length - gpsMapped.length, openMaintenance, lowStock, expiringStnk, completedTrips, movingTrips, arrivedTrips, orderStatus, fulfillment, trend, throughputChange, utilization, gpsHealth, pulse };
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
    const urgent = requests.filter((request) => request.urgency === "URGENT" && !["REJECTED", "CANCELLED"].includes(request.status)).length;
    const inTransit = purchaseOrders.filter((order) => ["SENT_TO_SUPPLIER", "PARTIALLY_RECEIVED"].includes(order.status)).length;
    const unpaidBills = bills.filter((bill) => bill.status !== "PAID");
    const outstanding = unpaidBills.reduce((sum, bill) => sum + Math.max(0, number(bill.amount) - (bill.payments || []).filter((payment) => payment.status === "PAID").reduce((paid, payment) => paid + number(payment.amount), 0)), 0);
    return { waitingApproval, urgent, inTransit, unpaidBills: unpaidBills.length, outstanding };
  }, [purchasing]);

  return <main className="d4-page" data-testid="dashboard-page">
    <header className="d4-header">
      <div><span>OPERATIONS INTELLIGENCE</span><h1>Selamat datang, {user?.name?.split(" ")[0] || "Pengguna"}</h1><p>Command center untuk melihat ritme operasi, risiko, dan keputusan hari ini.</p></div>
      <div className="d4-header-tools">
        <div className="d4-period" aria-label="Pilih periode analisis">{[7, 30, 90].map((value) => <button key={value} className={period === value ? "active" : ""} onClick={() => { setRefreshing(true); setPeriod(value); }}>{value} hari</button>)}</div>
        <button className="d4-refresh" aria-label="Perbarui dashboard" onClick={() => { setRefreshing(true); setRevision((value) => value + 1); }} disabled={refreshing}><FiRefreshCw className={refreshing ? "spin" : ""} /></button>
        <div className={`d4-live ${connected ? "connected" : "disconnected"}`}><i /> <span>{connected ? "Live" : "Terputus"}<small>{lastUpdated ? `Diperbarui ${lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : "Menghubungkan data"}</small></span></div>
      </div>
    </header>

    <section className="d4-executive">
      <div className="d4-pulse-card">
        <div className="d4-pulse-top"><span>OPERATIONAL PULSE</span><FiActivity /></div>
        <div className="d4-pulse-main"><div className="d4-pulse-ring" style={{ "--pulse": `${data.pulse * 3.6}deg` }}><div><strong>{loading ? "—" : data.pulse}</strong><small>/100</small></div></div><div><b>{data.pulse >= 85 ? "Operasi sehat" : data.pulse >= 65 ? "Perlu perhatian" : "Butuh intervensi"}</b><p>Skor gabungan utilisasi, GPS, maintenance, dan exception armada.</p></div></div>
        <div className="d4-pulse-factors"><span>Utilisasi <b>{data.utilization}%</b></span><span>GPS sehat <b>{data.gpsHealth}%</b></span><span>Exception <b>{data.warnings.length}</b></span></div>
      </div>
      <div className="d4-stat-grid">
        <Stat label="TRIP SELESAI" value={loading ? "—" : data.completedTrips} detail={`${period} hari terakhir`} trend={`${data.throughputChange >= 0 ? "+" : ""}${data.throughputChange}% vs paruh awal`} tone="green" onClick={() => navigate("/trips")} />
        <Stat label="ARMADA AKTIF" value={loading ? "—" : `${data.active}/${trucks.length}`} detail={`${data.status.DISPATCH || 0} sedang berjalan`} tone="blue" onClick={() => navigate("/trucks")} />
        <Stat label="ORDER AKTIF" value={loading ? "—" : orders.length} detail={`${data.fulfillment}% sudah dialokasikan`} tone="amber" onClick={() => navigate("/orders")} />
        <Stat label="EXCEPTION" value={loading ? "—" : data.warnings.length + data.arrivedTrips.length} detail="warning + trip tertunda" tone={data.warnings.length ? "red" : "neutral"} onClick={() => navigate("/fleet-map")} />
      </div>
      {canViewFinance && <div className="d4-finance-card">
        <div className="d4-finance-head"><span>FINANCIAL PULSE · {month}</span><FiDollarSign /></div>
        <small>Laba bersih bulan berjalan</small><strong className={profit < 0 ? "loss" : "gain"}>{loading ? "—" : rupiah(profit)}</strong>
        <div className="d4-finance-row"><span>Pendapatan<b>{rupiah(finance.summary?.revenue, true)}</b></span><span>Margin<b>{number(finance.summary?.margin).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</b></span></div>
        <div className="d4-finance-row receivable"><span>Piutang berjalan<b>{rupiah(outstanding, true)}</b></span><span>Lewat tempo<b className={overdue ? "danger" : ""}>{rupiah(overdue, true)}</b></span></div>
        <button onClick={() => navigate("/fleet-profitability")}>Buka analisis profit <FiArrowRight /></button>
      </div>}
    </section>

    <section className="d4-analytics-grid">
      <article className="d4-card d4-throughput">
        <SectionTitle eyebrow="THROUGHPUT" title="Ritme trip selesai" meta={`${data.completedTrips} trip`} />
        <div className="d4-chart-summary"><div><strong>{data.completedTrips}</strong><span>Total trip selesai</span></div><div className={data.throughputChange >= 0 ? "positive" : "negative"}><FiArrowUpRight /><strong>{Math.abs(data.throughputChange)}%</strong><span>{data.throughputChange >= 0 ? "meningkat" : "menurun"}</span></div></div>
        {loading ? <LoadingState compact label="Memuat throughput" rows={2} /> : <MiniBars data={data.trend} />}
      </article>

      <article className="d4-card d4-flow-card">
        <SectionTitle eyebrow="ORDER-TO-DELIVERY" title="Pipeline operasional" icon={FiLayers} />
        <div className="d4-flow">
          <FlowStep label="ORDER TERBUKA" value={orders.length} note={`${number(data.orderStatus.CONFIRMED)} confirmed`} />
          <i><FiArrowRight /></i>
          <FlowStep label="DALAM JALAN" value={data.movingTrips} note="trip aktif" tone="moving" />
          <i><FiArrowRight /></i>
          <FlowStep label="SUDAH TIBA" value={data.arrivedTrips.length} note="perlu closing" tone={data.arrivedTrips.length ? "warning" : ""} />
        </div>
        <div className="d4-allocation"><div><span>Alokasi order aktif</span><b>{data.fulfillment}%</b></div><div><i style={{ width: `${data.fulfillment}%` }} /></div><small>{number(data.orderStatus.DRAFT)} draft · {number(data.orderStatus.IN_PROGRESS)} dalam proses</small></div>
      </article>

      <article className="d4-card d4-priority-card">
        <SectionTitle eyebrow="DECISION BRIEFING" title="Prioritas tindakan" meta={`${priorities.length} agenda`} />
        <div className="d4-priority-list">{priorities.map((item) => <button key={item.title} onClick={() => navigate(item.path)}><i className={item.level}>{item.level === "safe" ? <FiCheck /> : item.level === "neutral" ? <FiTool /> : <FiAlertTriangle />}</i><span><strong>{item.title}</strong><small>{item.detail}</small></span><em>{item.action}<FiArrowRight /></em></button>)}</div>
      </article>
    </section>

    <section className="d4-business-grid">
      <article className="d4-card d4-domain-card workshop">
        <SectionTitle eyebrow="WORKSHOP CONTROL" title="Bengkel & maintenance" meta={`${data.openMaintenance} terbuka`} />
        <div className="d4-domain-hero"><i><FiTool /></i><div><strong>{data.status.MAINTENANCE}</strong><span>armada sedang di bengkel</span></div><button onClick={() => navigate("/maintenance")}>Buka bengkel <FiArrowRight /></button></div>
        <div className="d4-domain-metrics"><div><span>Servis terbuka</span><b>{data.openMaintenance}</b><small>pekerjaan aktif</small></div><div><span>Menunggu parts</span><b className={workshop.waitingParts ? "attention" : ""}>{workshop.waitingParts}</b><small>dari pembelian</small></div><div><span>Lebih dari 3 hari</span><b className={workshop.agingJobs ? "attention" : ""}>{workshop.agingJobs}</b><small>butuh eskalasi</small></div></div>
      </article>

      <article className="d4-card d4-domain-card purchasing">
        <SectionTitle eyebrow="PROCUREMENT PULSE" title="Pembelian & supplier" meta={`${purchasePulse.inTransit} PO dikirim`} />
        <div className="d4-domain-hero"><i><FiShoppingCart /></i><div><strong>{purchasePulse.waitingApproval}</strong><span>permintaan menunggu approval</span></div><button onClick={() => navigate("/purchasing")}>Buka pembelian <FiArrowRight /></button></div>
        <div className="d4-domain-metrics"><div><span>Permintaan urgent</span><b className={purchasePulse.urgent ? "attention" : ""}>{purchasePulse.urgent}</b><small>perlu prioritas</small></div><div><span>PO dalam proses</span><b>{purchasePulse.inTransit}</b><small>belum diterima penuh</small></div><div><span>Tagihan terbuka</span><b>{purchasePulse.unpaidBills}</b><small>{rupiah(purchasePulse.outstanding, true)}</small></div></div>
      </article>

      <article className="d4-card d4-domain-card inventory-domain">
        <SectionTitle eyebrow="MATERIAL READINESS" title="Persediaan & kebutuhan" meta={`${data.lowStock} kritis`} />
        <div className="d4-domain-hero"><i><FiPackage /></i><div><strong>{inventory.length}</strong><span>item persediaan terpantau</span></div><button onClick={() => navigate("/inventory")}>Buka stok <FiArrowRight /></button></div>
        <div className="d4-domain-metrics"><div><span>Stok minimum</span><b className={data.lowStock ? "attention" : ""}>{data.lowStock}</b><small>perlu replenishment</small></div><div><span>Kebutuhan bengkel</span><b>{workshop.serviceRequests}</b><small>permintaan terkait servis</small></div><div><span>Kesiapan armada</span><b>{data.status.READY}</b><small>unit siap jalan</small></div></div>
      </article>
    </section>

    {data.arrivedTrips.length > 0 && <section className="d4-card d4-arrived-card">
      <SectionTitle eyebrow="BOTTLENECK" title="Trip tiba menunggu penyelesaian" meta={`${data.arrivedTrips.length} trip`} />
      <div className="d4-arrived-list">{data.arrivedTrips.slice(0, 8).map((trip) => <button key={trip.id} onClick={() => navigate(`/trips/${trip.id}`)}><i><FiMapPin /></i><span><strong>{trip.order?.orderNo || trip.tripNo || "Trip"}</strong><small>{trip.truck?.plateNumber || trip.plateNumberSnap || "Tanpa armada"} · {trip.driverUser?.name || trip.driverNameSnap || "Tanpa pengemudi"}</small></span><span><strong>{trip.order?.toText || trip.toText || "Tujuan belum dicatat"}</strong><small>{trip.cargoNameSnap || trip.order?.cargoName || "Muatan"}</small></span><em>Selesaikan <FiArrowRight /></em></button>)}</div>
    </section>}

    <section className="d4-monitor-grid">
      <article className="d4-card d4-alert-card">
        <SectionTitle eyebrow="REAL-TIME EXCEPTIONS" title="Warning armada" meta={`${data.warnings.length} aktif`} />
        <div className="d4-alert-list" data-testid="alerts-list">{loading ? <LoadingState compact label="Memuat monitoring GPS" rows={3} /> : data.warnings.length ? data.warnings.map((truck) => <AlertRow key={truck.id} truck={truck} />) : <div className="d4-empty"><FiCheck /><strong>Semua armada aman</strong><span>Tidak ada area warning atau berhenti terlalu lama.</span></div>}</div>
      </article>

      <aside className="d4-side-stack">
        <article className="d4-card d4-health-card">
          <SectionTitle eyebrow="FLEET HEALTH" title="Kesiapan sistem" icon={FiTarget} />
          <div className="d4-health-row"><span><i className="gps"><FiRadio /></i>GPS online</span><b>{data.gpsOnline}/{data.gpsMapped}</b><em>{data.gpsHealth}%</em></div>
          <div className="d4-health-row"><span><i className="ready"><FiTruck /></i>Armada ready</span><b>{data.status.READY}</b><em>{trucks.length ? Math.round(data.status.READY / trucks.length * 100) : 0}%</em></div>
          <div className="d4-health-row"><span><i className="service"><FiTool /></i>Servis terbuka</span><b>{data.openMaintenance}</b><em className={data.openMaintenance ? "attention" : ""}>{data.openMaintenance ? "Pantau" : "Aman"}</em></div>
          <div className="d4-health-row"><span><i className="stock"><FiBox /></i>Stok kritis</span><b>{data.lowStock}</b><em className={data.lowStock ? "attention" : ""}>{data.lowStock ? "Tindak" : "Aman"}</em></div>
          <div className="d4-health-foot"><span><FiWifiOff /> {data.gpsMissing} belum dipasang</span><span><FiClock /> {data.gpsStale} tidak update</span></div>
        </article>
        <article className="d4-card d4-quick-card">
          <SectionTitle eyebrow="QUICK ACCESS" title="Kontrol operasional" />
          <div className="d4-quick-actions"><button onClick={() => navigate("/fleet-map")}><FiMapPin /><span>Live map<small>Pantau posisi armada</small></span><FiArrowRight /></button><button onClick={() => navigate("/maintenance")}><FiTool /><span>Maintenance<small>{data.openMaintenance} pekerjaan terbuka</small></span><FiArrowRight /></button><button onClick={() => navigate("/inventory")}><FiBox /><span>Persediaan<small>{data.lowStock} stok kritis</small></span><FiArrowRight /></button><button onClick={() => navigate("/trucks")}><FiTruck /><span>Dokumen armada<small>{data.expiringStnk} STNK hampir habis</small></span><FiArrowRight /></button></div>
        </article>
      </aside>
    </section>
  </main>;
}
