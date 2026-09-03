import { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiArrowRight, FiBox, FiCheck, FiClock, FiDollarSign, FiExternalLink, FiMapPin, FiRadio, FiTool, FiTruck, FiWifiOff } from "react-icons/fi";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import LoadingState from "../components/LoadingState";
import "./Dashboard.css";
import "./DashboardTypography.css";

const list = (value) => Array.isArray(value) ? value : value?.items || value?.data || value?.rows || [];
const rupiah = (value) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value || 0));
const stopTime = (minutes) => {
  const total = Math.max(0, Number(minutes) || 0);
  return total >= 60 ? `${Math.floor(total / 60)} jam ${Math.floor(total % 60)} menit` : `${Math.floor(total)} menit`;
};

function AlertRow({ truck }) {
  const critical = truck.gpsLocation?.type === "WARNING";
  const returnToBase = truck.tripReturnWarning || truck.tripServiceWarning;
  const stopped = Boolean(truck.gpsStopWarning);
  const hasGps = Number.isFinite(Number(truck.lastGpsLatitude)) && Number.isFinite(Number(truck.lastGpsLongitude));
  return (
    <article className={`d3-alert ${critical ? "critical" : "stopped"}`}>
      <i><FiAlertTriangle /></i>
      <div className="d3-alert-main">
        <div><strong>{truck.plateNumber}</strong><b>{critical ? "AREA WARNING" : returnToBase ? "KEMBALI KE BASE" : "BERHENTI LAMA"}</b></div>
        <p><FiMapPin /> {returnToBase ? `${returnToBase.location} · perlu tindakan` : truck.gpsLocation?.name || "Di luar master lokasi"}</p>
      </div>
      <div className="d3-alert-meta"><span>{returnToBase ? stopTime(returnToBase.durationMinutes) : stopped ? stopTime(truck.gpsStopWarning.durationMinutes) : "Sedang berada di area"}</span><small>{truck.driverUser?.name || "Tanpa pengemudi"}</small></div>
      {hasGps && <a href={`https://www.google.com/maps?q=${truck.lastGpsLatitude},${truck.lastGpsLongitude}`} target="_blank" rel="noreferrer"><FiExternalLink /></a>}
    </article>
  );
}

function Metric({ label, value, note, tone }) {
  return <div className={`d3-metric ${tone || ""}`}><small>{label}</small><strong>{value}</strong><span>{note}</span></div>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [referenceTime] = useState(() => Date.now());
  const [trucks, setTrucks] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [finance, setFinance] = useState({ summary: {} });
  useLiveRefresh(() => setRevision((value) => value + 1));

  const month = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api("/trucks"), api("/maintenance"), api("/inventory/items"), api(`/fleet-profitability?month=${month}`)])
      .then(([truckData, maintenanceData, inventoryData, financeData]) => {
        if (cancelled) return;
        setTrucks(list(truckData));
        setMaintenance(list(maintenanceData));
        setInventory(list(inventoryData));
        setFinance(financeData?.summary ? financeData : { summary: {} });
        setConnected(true);
      })
      .catch((error) => { console.error(error); if (!cancelled) setConnected(false); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, revision]);

  const data = useMemo(() => {
    const status = { READY: 0, DISPATCH: 0, MAINTENANCE: 0, INACTIVE: 0 };
    trucks.forEach((truck) => { const key = String(truck.status || "INACTIVE").toUpperCase(); status[key] = (status[key] || 0) + 1; });
    const active = status.READY + status.DISPATCH;
    const warnings = trucks.filter((truck) => truck.tripReturnWarning || truck.tripServiceWarning || truck.gpsStopWarning || truck.gpsLocation?.type === "WARNING").sort((a, b) => Number(b.gpsLocation?.type === "WARNING") - Number(a.gpsLocation?.type === "WARNING") || Number(Boolean(b.tripReturnWarning || b.tripServiceWarning)) - Number(Boolean(a.tripReturnWarning || a.tripServiceWarning)) || Number(b.gpsStopWarning?.durationMinutes || 0) - Number(a.gpsStopWarning?.durationMinutes || 0));
    const gpsMapped = trucks.filter((truck) => truck.gpsImei || truck.gpsDeviceId);
    const oneHourAgo = referenceTime - 60 * 60 * 1000;
    const gpsOnline = gpsMapped.filter((truck) => truck.lastGpsAt && new Date(truck.lastGpsAt).getTime() >= oneHourAgo).length;
    const gpsStale = gpsMapped.length - gpsOnline;
    const gpsMissing = trucks.length - gpsMapped.length;
    const openMaintenance = maintenance.filter((job) => String(job.status || "").toUpperCase() === "OPEN").length;
    const lowStock = inventory.filter((item) => {
      const qty = Number(item.qtyTotal ?? item.totalQty ?? item.qty ?? 0);
      const minimum = Number(item.reorderPoint ?? item.minQty ?? 0);
      return minimum > 0 && qty <= minimum;
    }).length;
    const expiringStnk = trucks.filter((truck) => {
      if (!truck.stnkExpiry) return false;
      const diff = new Date(truck.stnkExpiry).getTime() - referenceTime;
      return diff >= 0 && diff <= 30 * 86400000;
    }).length;
    return { status, active, warnings, gpsMapped: gpsMapped.length, gpsOnline, gpsStale, gpsMissing, openMaintenance, lowStock, expiringStnk };
  }, [trucks, maintenance, inventory, referenceTime]);

  const utilization = trucks.length ? Math.round(data.active / trucks.length * 100) : 0;
  const profit = Number(finance.summary?.profit || 0);

  return (
    <main className="d3-page" data-testid="dashboard-page">
      <header className="d3-header">
        <div><span>OVERVIEW</span><h1>Good day, {user?.name || "Pengguna"}</h1><p>Berikut kondisi operasional yang perlu Anda ketahui hari ini.</p></div>
        <div className="d3-header-side"><time>{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</time><b className={connected ? "connected" : "disconnected"}><i />{connected ? "Live data" : "Data terputus"}</b></div>
      </header>

      <section className="d3-overview">
        <div className="d3-utilization">
          <div className="d3-ring" style={{ "--progress": `${utilization * 3.6}deg` }}><div><strong>{loading ? "—" : `${utilization}%`}</strong><span>utilisasi</span></div></div>
          <div><span>KONDISI ARMADA</span><h2>{data.active} dari {trucks.length} truk aktif</h2><p>Armada berstatus siap atau sedang berjalan.</p><button onClick={() => (window.location.href = "/trucks")}>Lihat semua armada <FiArrowRight /></button></div>
        </div>
        <div className="d3-metrics">
          <Metric label="READY" value={data.status.READY} note="Siap beroperasi" tone="ready" />
          <Metric label="BERJALAN" value={data.status.DISPATCH} note="Dalam perjalanan" tone="moving" />
          <Metric label="SERVIS" value={data.status.MAINTENANCE} note="Dalam perbaikan" tone="service" />
          <Metric label="WARNING" value={data.warnings.length} note="Perlu perhatian" tone="warning" />
        </div>
        <div className="d3-profit">
          <div><span>FINANCIAL PULSE</span><FiDollarSign /></div><small>Laba bersih bulan ini</small><strong className={profit < 0 ? "loss" : "gain"}>{loading ? "—" : rupiah(profit)}</strong><p>{rupiah(finance.summary?.revenue)} pendapatan · Margin {Number(finance.summary?.margin || 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</p><button onClick={() => (window.location.href = "/fleet-profitability")}>Buka laporan <FiArrowRight /></button>
        </div>
      </section>

      <section className="d3-grid">
        <div className="d3-card d3-alerts-card">
          <div className="d3-title"><div><span>REAL-TIME MONITORING</span><h2>Warning Armada</h2></div><b className={data.warnings.length ? "attention" : "safe"}>{data.warnings.length} aktif</b></div>
          <div className="d3-alert-list" data-testid="alerts-list">{loading ? <LoadingState compact label="Memuat monitoring GPS" note="Memeriksa warning armada terbaru…" rows={3} /> : data.warnings.length ? data.warnings.map((truck) => <AlertRow key={truck.id} truck={truck} />) : <div className="d3-empty safe"><FiCheck /><strong>Semua aman</strong><p>Tidak ada kendaraan di area warning atau berhenti lama.</p></div>}</div>
        </div>

        <div className="d3-card d3-gps-card">
          <div className="d3-title"><div><span>DEVICE HEALTH</span><h2>Koneksi GPS</h2></div><FiRadio /></div>
          <div className="d3-gps-score"><strong>{data.gpsOnline}</strong><span>dari {data.gpsMapped} device<br/>aktif 1 jam terakhir</span></div>
          <div className="d3-gps-bar"><i style={{ width: `${data.gpsMapped ? data.gpsOnline / data.gpsMapped * 100 : 0}%` }} /></div>
          <div className="d3-gps-details"><span><i className="online" />Online <b>{data.gpsOnline}</b></span><span><i className="stale" />Tidak update <b>{data.gpsStale}</b></span><span><FiWifiOff />Belum terpasang <b>{data.gpsMissing}</b></span></div>
          <button onClick={() => (window.location.href = "/trucks")}>Periksa perangkat <FiArrowRight /></button>
        </div>

        <div className="d3-card d3-action-card">
          <div className="d3-title"><div><span>ACTION CENTER</span><h2>Perlu Ditindak</h2></div><FiClock /></div>
          <button onClick={() => (window.location.href = "/maintenance")}><i className="maintenance"><FiTool /></i><span><strong>{data.openMaintenance} servis terbuka</strong><small>Pekerjaan yang belum selesai</small></span><FiArrowRight /></button>
          <button onClick={() => (window.location.href = "/inventory")}><i className="stock"><FiBox /></i><span><strong>{data.lowStock} stok menipis</strong><small>Di bawah batas minimum</small></span><FiArrowRight /></button>
          <button onClick={() => (window.location.href = "/trucks")}><i className="document"><FiTruck /></i><span><strong>{data.expiringStnk} STNK segera habis</strong><small>Dalam 30 hari ke depan</small></span><FiArrowRight /></button>
        </div>
      </section>
    </main>
  );
}
