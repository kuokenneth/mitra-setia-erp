import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiActivity, FiAlertTriangle, FiCalendar, FiCheckCircle, FiChevronDown, FiChevronLeft, FiChevronRight, FiClock, FiDollarSign, FiExternalLink, FiMapPin, FiMessageSquare, FiNavigation, FiPackage, FiPhone, FiPlus, FiSearch, FiTool, FiTruck, FiUser, FiX } from "react-icons/fi";
import { api } from "../api";
import { useLiveRefresh } from "../liveUpdates";
import LoadingState, { LoadingMini } from "../components/LoadingState";
import "./TripsRedesign.css";
import "./TripCreateMenu.css";
const statusLabel = {
  PLANNED: "Direncanakan",
  DISPATCHED: "Berangkat",
  ARRIVED: "Tiba",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan"
};
const statusColor = {
  PLANNED: {
    color: "#475569",
    background: "#F1F5F9"
  },
  DISPATCHED: {
    color: "#0D7C3D",
    background: "#E8F6ED"
  },
  ARRIVED: {
    color: "#1D4ED8",
    background: "#EFF6FF"
  },
  COMPLETED: {
    color: "#047857",
    background: "#ECFDF5"
  },
  CANCELLED: {
    color: "#B91C1C",
    background: "#FEF2F2"
  }
};
const CONTROL_STAGES = [{
  key: "PLANNED",
  label: "Belum bergerak",
  note: "Menunggu GPS mendeteksi jalan",
  icon: FiClock
}, {
  key: "TO_PICKUP",
  label: "Menuju lokasi muat",
  note: "Perjalanan kosong",
  icon: FiNavigation
}, {
  key: "AT_PICKUP",
  label: "Proses muat",
  note: "Di dalam radius lokasi muat",
  icon: FiPackage
}, {
  key: "TO_DESTINATION",
  label: "Mengantar muatan",
  note: "Menuju tujuan bongkar",
  icon: FiTruck
}, {
  key: "SERVICE_AT_BASE",
  label: "Kembali ke base",
  note: "Perlu tindakan operator",
  icon: FiAlertTriangle,
  warning: true
}, {
  key: "AT_DESTINATION",
  label: "Tiba & bongkar",
  note: "Menunggu berat dan selesai",
  icon: FiMapPin
}];
const ACTION_OPTIONS = [{
  value: "HANDLE",
  label: "Tangani warning",
  icon: FiCheckCircle,
  note: "Tetapkan PIC dan rencana tindak lanjut"
}, {
  value: "SEND_FUNDS",
  label: "Kirim dana",
  icon: FiDollarSign,
  note: "Masuk otomatis ke pengeluaran trip"
}, {
  value: "REPORT_ISSUE",
  label: "Catat kendala",
  icon: FiTool,
  note: "Kerusakan, antrean, atau hambatan lapangan"
}, {
  value: "CONTACT_DRIVER",
  label: "Hubungi pengemudi",
  icon: FiPhone,
  note: "Catat hasil komunikasi dengan pengemudi"
}, {
  value: "RESOLVE",
  label: "Selesaikan warning",
  icon: FiCheckCircle,
  note: "Tandai tindak lanjut telah selesai"
}];
const FUND_CATEGORIES = [["TRIP_ALLOWANCE", "Panjar / uang jalan"], ["REMAINING_TRIP_ALLOWANCE", "Sisa uang jalan"], ["UNLOADING_FEE", "Uang bongkar"], ["FUEL_LOAN", "Pinjaman minyak"], ["DRIVER_SALARY", "Gaji / borongan pengemudi"], ["FUEL", "BBM"], ["TOLL_PARKING", "Tol & parkir"], ["LOADING_UNLOADING", "Biaya muat / bongkar"], ["REPAIR_MAINTENANCE", "Perbaikan darurat"], ["SPAREPART", "Suku cadang"], ["OTHER", "Lainnya"]];
function minutesSince(value, now = Date.now()) {
  return value ? Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000)) : 0;
}
function durationText(minutes) {
  return minutes >= 1440 ? `${Math.floor(minutes / 1440)} hari` : minutes >= 60 ? `${Math.floor(minutes / 60)} jam ${minutes % 60} mnt` : `${minutes} menit`;
}
function controlStage(trip) {
  if (trip.status === "PLANNED") return "PLANNED";
  if (trip.status === "ARRIVED") return "AT_DESTINATION";
  return trip.phase || "TO_DESTINATION";
}
function tripWarning(trip, now) {
  const stage = controlStage(trip);
  const gpsAge = minutesSince(trip.truck?.lastGpsAt, now);
  if (stage === "SERVICE_AT_BASE") return {
    level: "critical",
    text: `Kembali ke ${trip.serviceStops?.[0]?.location?.name || "base"} — perlu tindakan`
  };
  if (trip.truck?.lastGpsAt && gpsAge >= 15) return {
    level: "critical",
    text: `GPS tidak update ${durationText(gpsAge)}`
  };
  if (stage === "PLANNED" && minutesSince(trip.createdAt, now) >= 30) return {
    level: "warning",
    text: `Belum bergerak ${durationText(minutesSince(trip.createdAt, now))}`
  };
  if (stage === "AT_PICKUP" && minutesSince(trip.pickupArrivedAt, now) >= 60) return {
    level: "warning",
    text: `Proses muat ${durationText(minutesSince(trip.pickupArrivedAt, now))}`
  };
  if (stage === "AT_DESTINATION" && minutesSince(trip.arrivedAt, now) >= 60) return {
    level: "warning",
    text: `Menunggu bongkar/selesai ${durationText(minutesSince(trip.arrivedAt, now))}`
  };
  if (trip.truck?.gpsStoppedSince && minutesSince(trip.truck.gpsStoppedSince, now) >= 30) return {
    level: "warning",
    text: `Berhenti lama ${durationText(minutesSince(trip.truck.gpsStoppedSince, now))}`
  };
  if (trip.truck?.gpsStopWarning) return {
    level: "warning",
    text: "Berhenti lama di perjalanan"
  };
  return null;
}
function dateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}
export default function Trips() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [controlTrips, setControlTrips] = useState([]);
  const [controlLoading, setControlLoading] = useState(true);
  const searchRequestRef = useRef({
    id: 0,
    controller: null
  });
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 20
  });
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    dateFrom: "",
    dateTo: ""
  });
  const [applied, setApplied] = useState({
    q: "",
    status: "",
    dateFrom: "",
    dateTo: ""
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionTrip, setActionTrip] = useState(null);
  const [actionWarning, setActionWarning] = useState(null);
  const [actionHistory, setActionHistory] = useState([]);
  const [actionPics, setActionPics] = useState([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionForm, setActionForm] = useState({
    actionType: "HANDLE",
    assignedToId: "",
    note: "",
    amount: "",
    expenseCategory: "TRIP_ALLOWANCE"
  });
  const [emptyReturnOpen, setEmptyReturnOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [singleTripOpen, setSingleTripOpen] = useState(false);
  const [singleTripBusy, setSingleTripBusy] = useState(false);
  const [singleTripTrucks, setSingleTripTrucks] = useState([]);
  const [singleTripLocations, setSingleTripLocations] = useState([]);
  const [singleTripQ, setSingleTripQ] = useState("");
  const [singleTripForm, setSingleTripForm] = useState({ truckId: "", pickupLocationId: "", destinationLocationId: "", plannedDepartAt: "", cargoName: "Cangkang", reason: "" });
  const [emptyReturnBusy, setEmptyReturnBusy] = useState(false);
  const [emptyReturnTrucks, setEmptyReturnTrucks] = useState([]);
  const [baseLocations, setBaseLocations] = useState([]);
  const [emptyReturnQ, setEmptyReturnQ] = useState("");
  const [emptyReturnForm, setEmptyReturnForm] = useState({ truckId: "", destinationLocationId: "", plannedDepartAt: "", reason: "Kembali ke base tanpa muatan untuk pemeriksaan / perbaikan" });
  async function openSingleTrip() {
    setCreateMenuOpen(false);
    setSingleTripOpen(true);
    setSingleTripBusy(true);
    setError("");
    setSingleTripQ("");
    try {
      const [truckData, locationData] = await Promise.all([api("/trucks"), api("/operational-locations")]);
      const trucks = (truckData.items || []).filter(truck => truck.status === "READY" && truck.driverUser?.id);
      const locations = (locationData.items || []).filter(location => location.isActive);
      const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setSingleTripTrucks(trucks);
      setSingleTripLocations(locations);
      setSingleTripForm(form => ({ ...form, truckId: trucks[0]?.id || "", pickupLocationId: locations[0]?.id || "", destinationLocationId: locations[1]?.id || "", plannedDepartAt: localNow }));
    } catch (error) {
      setError(error.message || "Gagal menyiapkan trip tunggal");
      setSingleTripOpen(false);
    } finally {
      setSingleTripBusy(false);
    }
  }
  async function createSingleTrip(event) {
    event.preventDefault();
    setSingleTripBusy(true);
    setError("");
    try {
      const trip = await api("/trips/single", { method: "POST", body: JSON.stringify(singleTripForm) });
      setSingleTripOpen(false);
      nav(`/trips/${trip.id}`);
    } catch (error) {
      setError(error.message || "Gagal membuat trip tunggal");
    } finally {
      setSingleTripBusy(false);
    }
  }
  async function openEmptyReturn() {
    setEmptyReturnOpen(true);
    setEmptyReturnBusy(true);
    setError("");
    setEmptyReturnQ("");
    try {
      const [truckData, locationData] = await Promise.all([api("/trucks"), api("/operational-locations")]);
      const trucks = (truckData.items || []).filter(truck => truck.status === "READY" && truck.lastGpsAt && truck.driverUser?.id);
      const bases = (locationData.items || []).filter(location => location.isActive && location.type === "BASE");
      const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setEmptyReturnTrucks(trucks);
      setBaseLocations(bases);
      setEmptyReturnForm(form => ({ ...form, truckId: trucks[0]?.id || "", destinationLocationId: bases[0]?.id || "", plannedDepartAt: localNow }));
    } catch (error) {
      setError(error.message || "Gagal menyiapkan trip kembali kosong");
      setEmptyReturnOpen(false);
    } finally {
      setEmptyReturnBusy(false);
    }
  }
  async function createEmptyReturn(event) {
    event.preventDefault();
    setEmptyReturnBusy(true);
    setError("");
    try {
      const trip = await api("/trips/empty-return", { method: "POST", body: JSON.stringify(emptyReturnForm) });
      setEmptyReturnOpen(false);
      nav(`/trips/${trip.id}`);
    } catch (error) {
      setError(error.message || "Gagal membuat trip kembali kosong");
    } finally {
      setEmptyReturnBusy(false);
    }
  }
  async function load(targetPage = page, active = applied) {
    const requestId = searchRequestRef.current.id + 1;
    searchRequestRef.current.controller?.abort();
    const controller = new AbortController();
    searchRequestRef.current = {
      id: requestId,
      controller
    };
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: "20"
      });
      if (active.q.trim()) params.set("q", active.q.trim());
      if (active.status) params.set("status", active.status);
      if (active.dateFrom) params.set("dateFrom", new Date(`${active.dateFrom}T00:00:00`).toISOString());
      if (active.dateTo) params.set("dateTo", new Date(`${active.dateTo}T23:59:59.999`).toISOString());
      const data = await api(`/trips?${params.toString()}`, {
        signal: controller.signal
      });
      if (searchRequestRef.current.id !== requestId) return;
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setItems(nextItems);
      setPagination(data?.pagination || {
        page: targetPage,
        totalPages: 1,
        total: nextItems.length,
        limit: 20
      });
    } catch (e) {
      if (e?.name !== "AbortError") setError(e.message || "Gagal memuat perjalanan");
    } finally {
      if (searchRequestRef.current.id === requestId) setLoading(false);
    }
  }
  async function loadControl() {
    setControlLoading(true);
    try {
      const data = await api("/trips/control-center");
      setControlTrips(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setError(e.message || "Gagal memuat pusat kontrol trip");
    } finally {
      setControlLoading(false);
    }
  }
  async function openActionCenter(trip, warning) {
    setActionTrip(trip);
    setActionWarning(warning);
    setActionError("");
    setActionHistory(trip.operationalActions || []);
    setActionForm({
      actionType: "HANDLE",
      assignedToId: "",
      note: warning?.text || "",
      amount: "",
      expenseCategory: "TRIP_ALLOWANCE"
    });
    try {
      const [history, pics] = await Promise.all([api(`/trips/${trip.id}/actions`), api("/trips/control-center/pics")]);
      setActionHistory(Array.isArray(history?.items) ? history.items : []);
      setActionPics(Array.isArray(pics?.items) ? pics.items : []);
    } catch (e) {
      setActionError(e.message || "Gagal memuat pusat tindakan");
    }
  }
  async function saveAction(event) {
    event.preventDefault();
    setActionBusy(true);
    setActionError("");
    try {
      const created = await api(`/trips/${actionTrip.id}/actions`, {
        method: "POST",
        body: JSON.stringify({
          ...actionForm,
          warningCode: controlStage(actionTrip)
        })
      });
      setActionHistory(rows => [created, ...rows]);
      setActionForm(form => ({
        ...form,
        note: "",
        amount: ""
      }));
      await loadControl();
    } catch (e) {
      setActionError(e.message || "Gagal menyimpan tindakan");
    } finally {
      setActionBusy(false);
    }
  }
  useEffect(() => {
    load(page, applied);
  }, [page, applied]);
  useEffect(() => {
    loadControl();
  }, []);
  useLiveRefresh(() => {
    load(page, applied);
    loadControl();
  });
  function resetFilters() {
    const empty = {
      q: "",
      status: "",
      dateFrom: "",
      dateTo: ""
    };
    setFilters(empty);
    setPage(1);
    setApplied(empty);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setApplied({
        ...filters
      });
    }, filters.q.trim() ? 140 : 0);
    return () => window.clearTimeout(timer);
  }, [filters]);
  const summary = useMemo(() => ({
    active: controlTrips.length,
    moving: controlTrips.filter(trip => trip.status === "DISPATCHED").length,
    arrived: controlTrips.filter(trip => trip.status === "ARRIVED").length,
    completed: items.filter(trip => trip.status === "COMPLETED").length
  }), [items, controlTrips]);
  const filteredEmptyReturnTrucks = useMemo(() => {
    const keyword = emptyReturnQ.trim().toLocaleLowerCase("id-ID");
    if (!keyword) return emptyReturnTrucks;
    return emptyReturnTrucks.filter(truck => [truck.plateNumber, truck.driverUser?.name, truck.gpsLocation?.name, truck.currentLocation].some(value => String(value || "").toLocaleLowerCase("id-ID").includes(keyword)));
  }, [emptyReturnTrucks, emptyReturnQ]);
  const filteredSingleTripTrucks = useMemo(() => {
    const keyword = singleTripQ.trim().toLocaleLowerCase("id-ID");
    if (!keyword) return singleTripTrucks;
    return singleTripTrucks.filter(truck => [truck.plateNumber, truck.driverUser?.name, truck.gpsLocation?.name, truck.currentLocation].some(value => String(value || "").toLocaleLowerCase("id-ID").includes(keyword)));
  }, [singleTripTrucks, singleTripQ]);
  const selectedSingleTruck = singleTripTrucks.find(truck => truck.id === singleTripForm.truckId) || null;
  const selectedSinglePickup = singleTripLocations.find(location => location.id === singleTripForm.pickupLocationId) || null;
  const selectedSingleDestination = singleTripLocations.find(location => location.id === singleTripForm.destinationLocationId) || null;
  const selectedEmptyReturnTruck = emptyReturnTrucks.find(truck => truck.id === emptyReturnForm.truckId) || null;
  const selectedEmptyReturnBase = baseLocations.find(location => location.id === emptyReturnForm.destinationLocationId) || null;
  const emptyReturnAlreadyAtBase = Boolean(selectedEmptyReturnTruck && selectedEmptyReturnBase && selectedEmptyReturnTruck.gpsLocation?.id === selectedEmptyReturnBase.id);
  const control = useMemo(() => {
    const now = Date.now();
    const groups = Object.fromEntries(CONTROL_STAGES.map(stage => [stage.key, []]));
    controlTrips.forEach(trip => {
      const key = controlStage(trip);
      (groups[key] || groups.TO_DESTINATION).push({
        trip,
        warning: tripWarning(trip, now)
      });
    });
    return {
      groups,
      warnings: controlTrips.filter(trip => tripWarning(trip, now)).length
    };
  }, [controlTrips]);
  return <div className="trips-v3-page"><header className="trips-v3-head"><div><span>TRIP CONTROL</span><h1>Perjalanan Armada</h1><p>Pantau penugasan, posisi workflow, muatan tiba, dan penyelesaian perjalanan.</p></div><div className="trip-create-actions"><b>{pagination.total} total trip</b><div className="trip-create-menu" onMouseEnter={() => setCreateMenuOpen(true)} onMouseLeave={() => setCreateMenuOpen(false)}><button type="button" aria-haspopup="menu" aria-expanded={createMenuOpen} onClick={() => setCreateMenuOpen(open => !open)}><FiPlus /> Buat Trip <FiChevronDown /></button>{createMenuOpen && <div role="menu"><button type="button" role="menuitem" onClick={openSingleTrip}><FiPackage/><span><strong>Trip Tunggal</strong><small>Muatan tanpa pesanan</small></span></button><button type="button" role="menuitem" onClick={() => { setCreateMenuOpen(false); openEmptyReturn(); }}><FiTruck/><span><strong>Kembali Kosong</strong><small>Armada pulang tanpa muatan</small></span></button></div>}</div></div></header>
    <section className="trips-v3-summary"><article><FiActivity /><small>AKTIF</small><strong>{summary.active}</strong><span>Planned sampai tiba</span></article><article><FiTruck /><small>DALAM PERJALANAN</small><strong>{summary.moving}</strong><span>Status dispatched</span></article><article><FiMapPin /><small>SUDAH TIBA</small><strong>{summary.arrived}</strong><span>Menunggu penyelesaian</span></article><article><FiCheckCircle /><small>SELESAI</small><strong>{summary.completed}</strong><span>Pada halaman ini</span></article></section>
    <section className="trip-control-center"><header><div><span>LIVE OPERATION FLOW</span><h2>Pusat Kontrol Trip</h2><p>Perpindahan tahap mengikuti data GPS. Klik warning untuk melakukan tindak lanjut.</p></div><b className={control.warnings ? "warning" : "safe"}><FiAlertTriangle /> {control.warnings} warning</b></header>{controlLoading ? <LoadingState label="Menyiapkan pusat kontrol" note="Mengelompokkan perjalanan berdasarkan tahap GPS…" rows={4} /> : <div className="trip-control-grid">{CONTROL_STAGES.map(stage => {
          const Icon = stage.icon;
          const rows = control.groups[stage.key] || [];
          return <article className={`trip-control-lane ${stage.warning ? "warning" : ""}`} key={stage.key}><div className="trip-control-lane-head"><span><Icon /></span><div><strong>{stage.label}</strong><small>{stage.note}</small></div><b>{rows.length}</b></div><div className="trip-control-cards">{rows.slice(0, 5).map(({
                trip,
                warning
              }) => <button type="button" key={trip.id} className={warning ? warning.level : ""} onClick={() => warning ? openActionCenter(trip, warning) : nav(`/trips/${trip.id}`)}><div><strong>{trip.truck?.plateNumber || trip.plateNumberSnap || "Tanpa armada"}</strong><span>{trip.order?.orderNo || (trip.purpose === "EMPTY_RETURN" ? "Kembali kosong" : trip.purpose === "SINGLE_TRIP" ? "Trip tunggal" : "Trip operasional")}</span></div><p><FiMapPin /> {stage.key === "TO_PICKUP" ? trip.fromText : stage.key === "AT_PICKUP" ? trip.fromText : stage.key === "SERVICE_AT_BASE" ? trip.serviceStops?.[0]?.location?.name || "Base" : trip.toText}</p>{warning ? <em><FiAlertTriangle /> {warning.text}</em> : <small>{trip.driverUser?.name || trip.driverNameSnap || "Tanpa pengemudi"}</small>}<FiChevronRight /></button>)}{!rows.length && <div className="trip-control-empty">Tidak ada trip</div>}{rows.length > 5 && <div className="trip-control-more">+{rows.length - 5} trip lainnya</div>}</div></article>;
        })}</div>}</section>
    <section className="trips-v3-tools"><label><FiSearch /><input value={filters.q} onChange={e => setFilters(f => ({
          ...f,
          q: e.target.value
        }))} placeholder="Cari order, nomor polisi, pengemudi, atau tujuan…" />{loading && <LoadingMini />}</label><select value={filters.status} onChange={e => setFilters(f => ({
        ...f,
        status: e.target.value
      }))}><option value="">Semua status</option>{Object.entries(statusLabel).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select><input aria-label="Tanggal mulai" type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({
        ...f,
        dateFrom: e.target.value
      }))} /><input aria-label="Tanggal selesai" type="date" value={filters.dateTo} onChange={e => setFilters(f => ({
        ...f,
        dateTo: e.target.value
      }))} /><button type="button" onClick={resetFilters}><FiX /> Reset</button></section>
    {error && <div className="trips-v3-error">{error}</div>}
    <section className="trips-v3-board"><header><div><span>DAFTAR OPERASIONAL</span><h2>Trip Aktif & Riwayat</h2></div><b>{items.length} ditampilkan</b></header><div className="trips-v3-list">{!loading && items.map(trip => {
          const planned = trip.qtyPlanned == null ? null : Number(trip.qtyPlanned);
          const actual = trip.qtyActual == null ? null : Number(trip.qtyActual);
          const loss = planned == null || actual == null ? null : Math.max(0, planned - actual);
          return <article key={trip.id} onClick={() => nav(`/trips/${trip.id}`)}><div className="trips-v3-id"><span style={statusColor[trip.status]}>{statusLabel[trip.status] || trip.status}</span><h3>{trip.order?.orderNo || (trip.purpose === "EMPTY_RETURN" ? "Kembali Kosong" : trip.purpose === "SINGLE_TRIP" ? "Trip Tunggal" : "Tanpa Order")}</h3><p>{trip.order?.customerName || "Operasional internal"}</p></div><div className="trips-v3-assignment"><FiTruck /><div><small>ARMADA & PENGEMUDI</small><strong>{trip.truck?.plateNumber || trip.plateNumberSnap || "—"}</strong><span>{trip.driverUser?.name || trip.driverNameSnap || "Tanpa pengemudi"}</span></div></div><div className="trips-v3-route"><FiMapPin /><div><small>RUTE</small><strong>{trip.order?.fromText || trip.fromText || "—"} <i>→</i> {trip.order?.toText || trip.toText || "—"}</strong><span><FiCalendar /> {dateTime(trip.plannedDepartAt || trip.createdAt)}</span></div></div><div className="trips-v3-load"><FiPackage /><div><small>MUATAN</small><strong>{actual ?? planned ?? "—"} {trip.unitSnap || ""}</strong><span>{actual == null ? `Rencana ${planned ?? "—"}` : `Tiba ${actual} dari ${planned ?? "—"}`}</span>{loss > 0 && <em>Selisih {loss} {trip.unitSnap || ""}</em>}</div></div><div className="trips-v3-docs"><span><b>{trip._count?.arrivalProofs || 0}</b> bukti</span><span><b>{trip._count?.expenses || 0}</b> biaya</span><FiChevronRight /></div></article>;
        })}{loading && <LoadingState label="Memuat perjalanan" note="Menyinkronkan tahap GPS dan penugasan armada…" rows={4} />} {!loading && !items.length && <div className="trips-v3-state">Tidak ada trip yang sesuai filter.</div>}</div><footer><span>Halaman {pagination.page} dari {pagination.totalPages}</span><div><button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><FiChevronLeft /> Sebelumnya</button><button disabled={page >= pagination.totalPages || loading} onClick={() => setPage(p => p + 1)}>Berikutnya <FiChevronRight /></button></div></footer></section>
    {singleTripOpen && <div className="trip-action-overlay" onMouseDown={event => event.target === event.currentTarget && !singleTripBusy && setSingleTripOpen(false)}>
      <section className="trip-action-modal empty-return-builder">
        <header><div><span>TRIP TANPA PESANAN</span><h2>Buat Trip Tunggal</h2><p>Pilih armada, lokasi muat, dan tujuan. Berat akan dicatat nanti pada proses tagihan.</p></div><button type="button" disabled={singleTripBusy} onClick={() => setSingleTripOpen(false)} aria-label="Tutup"><FiX /></button></header>
        <form onSubmit={createSingleTrip}>
          <div className="empty-return-grid">
            <section className="empty-return-picker">
              <div className="empty-return-section-title"><div><span>LANGKAH 1</span><strong>Pilih Armada Ready</strong></div><b>{filteredSingleTripTrucks.length}</b></div>
              <label className="empty-return-search"><FiSearch/><input value={singleTripQ} onChange={event => setSingleTripQ(event.target.value)} placeholder="Cari BK, pengemudi, atau lokasi…"/></label>
              <div className="empty-return-trucks">{filteredSingleTripTrucks.map(truck => <button type="button" className={singleTripForm.truckId === truck.id ? "active" : ""} key={truck.id} onClick={() => setSingleTripForm(form => ({ ...form, truckId: truck.id }))}><i><FiTruck/></i><span><strong>{truck.plateNumber}</strong><small>{truck.brand || "Armada"} {truck.model ? `· ${truck.model}` : ""}</small><em><FiMapPin/> {truck.gpsLocation?.name || truck.currentLocation || "Lokasi GPS belum dikenali"}</em></span><b>{truck.driverUser?.name || "Tanpa pengemudi"}</b></button>)}{!singleTripBusy && !filteredSingleTripTrucks.length && <div className="empty-return-empty">Tidak ada armada READY yang sesuai pencarian.</div>}</div>
            </section>
            <section className="empty-return-details">
              <div className="empty-return-section-title"><div><span>LANGKAH 2</span><strong>Atur Rute Tunggal</strong></div></div>
              <label><span>Jenis muatan</span><input required value={singleTripForm.cargoName} onChange={event => setSingleTripForm(form => ({ ...form, cargoName: event.target.value }))} placeholder="Contoh: Cangkang"/></label>
              <label><span>Lokasi muat</span><select required value={singleTripForm.pickupLocationId} onChange={event => setSingleTripForm(form => ({ ...form, pickupLocationId: event.target.value }))}><option value="">Pilih lokasi muat</option>{singleTripLocations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
              <label><span>Tujuan bongkar</span><select required value={singleTripForm.destinationLocationId} onChange={event => setSingleTripForm(form => ({ ...form, destinationLocationId: event.target.value }))}><option value="">Pilih tujuan</option>{singleTripLocations.filter(location => location.id !== singleTripForm.pickupLocationId).map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
              <label><span>Rencana berangkat</span><input required type="datetime-local" value={singleTripForm.plannedDepartAt} onChange={event => setSingleTripForm(form => ({ ...form, plannedDepartAt: event.target.value }))}/></label>
              <label><span>Keterangan (opsional)</span><textarea rows="2" value={singleTripForm.reason} onChange={event => setSingleTripForm(form => ({ ...form, reason: event.target.value }))} placeholder="Informasi tambahan perjalanan"/></label>
              {selectedSingleTruck && selectedSinglePickup && selectedSingleDestination && <div className="empty-return-summary"><span>RUTE TRIP TUNGGAL</span><strong>{selectedSinglePickup.name} <b>→</b> {selectedSingleDestination.name}</strong><small>{selectedSingleTruck.plateNumber} · {singleTripForm.cargoName || "Muatan"} · berat diisi saat tagihan</small></div>}
            </section>
          </div>
          <footer><button type="button" className="secondary" disabled={singleTripBusy} onClick={() => setSingleTripOpen(false)}>Batal</button><button type="submit" disabled={singleTripBusy || !singleTripForm.truckId || !singleTripForm.pickupLocationId || !singleTripForm.destinationLocationId || singleTripForm.pickupLocationId === singleTripForm.destinationLocationId}>{singleTripBusy ? "Menyiapkan…" : "Buat Trip Tunggal"}</button></footer>
        </form>
      </section>
    </div>}
    {emptyReturnOpen && <div className="trip-action-overlay" onMouseDown={event => event.target === event.currentTarget && !emptyReturnBusy && setEmptyReturnOpen(false)}>
      <section className="trip-action-modal empty-return-builder">
        <header><div><span>TRIP OPERASIONAL</span><h2>Buat Trip Kembali Kosong</h2><p>Pilih armada READY dan base tujuan seperti saat membuat trip pesanan.</p></div><button type="button" disabled={emptyReturnBusy} onClick={() => setEmptyReturnOpen(false)} aria-label="Tutup"><FiX /></button></header>
        <form onSubmit={createEmptyReturn}>
          <div className="empty-return-grid">
            <section className="empty-return-picker">
              <div className="empty-return-section-title"><div><span>LANGKAH 1</span><strong>Pilih Armada Ready</strong></div><b>{filteredEmptyReturnTrucks.length}</b></div>
              <label className="empty-return-search"><FiSearch/><input value={emptyReturnQ} onChange={event => setEmptyReturnQ(event.target.value)} placeholder="Cari BK, pengemudi, atau lokasi…"/></label>
              <div className="empty-return-trucks">
                {filteredEmptyReturnTrucks.map(truck => {
                  const active = emptyReturnForm.truckId === truck.id;
                  return <button type="button" className={active ? "active" : ""} key={truck.id} onClick={() => setEmptyReturnForm(form => ({ ...form, truckId: truck.id }))}><i><FiTruck/></i><span><strong>{truck.plateNumber}</strong><small>{truck.brand || "Armada"} {truck.model ? `· ${truck.model}` : ""}</small><em><FiMapPin/> {truck.gpsLocation?.name || truck.currentLocation || "Lokasi GPS belum dikenali"}</em></span><b>{truck.driverUser?.name || "Tanpa pengemudi"}</b></button>;
                })}
                {!emptyReturnBusy && !filteredEmptyReturnTrucks.length && <div className="empty-return-empty">Tidak ada armada READY yang sesuai pencarian.</div>}
              </div>
            </section>
            <section className="empty-return-details">
              <div className="empty-return-section-title"><div><span>LANGKAH 2</span><strong>Atur Perjalanan</strong></div></div>
              <label><span>Base tujuan</span><div className="empty-return-bases">{baseLocations.map(location => <button type="button" className={emptyReturnForm.destinationLocationId === location.id ? "active" : ""} key={location.id} onClick={() => setEmptyReturnForm(form => ({ ...form, destinationLocationId: location.id }))}><FiMapPin/><span><strong>{location.name}</strong><small>{location.address || `Radius ${location.radiusM} meter`}</small></span></button>)}</div></label>
              <label><span>Rencana berangkat</span><input required type="datetime-local" value={emptyReturnForm.plannedDepartAt} onChange={event => setEmptyReturnForm(form => ({ ...form, plannedDepartAt: event.target.value }))}/></label>
              <label><span>Keperluan kembali</span><textarea required rows="3" value={emptyReturnForm.reason} onChange={event => setEmptyReturnForm(form => ({ ...form, reason: event.target.value }))} placeholder="Contoh: kembali ke base untuk perbaikan rem"/></label>
              {selectedEmptyReturnTruck && selectedEmptyReturnBase && <div className={`empty-return-summary ${emptyReturnAlreadyAtBase ? "warning" : ""}`}><span>RUTE KEMBALI KOSONG</span><strong>{selectedEmptyReturnTruck.gpsLocation?.name || selectedEmptyReturnTruck.currentLocation || "Posisi armada"} <b>→</b> {selectedEmptyReturnBase.name}</strong><small>{emptyReturnAlreadyAtBase ? "Armada sudah berada di base tujuan. Pilih base lain atau armada lain." : "Tanpa muatan · pendapatan Rp0 · pengeluaran tetap dicatat ke armada"}</small></div>}
            </section>
          </div>
          {!emptyReturnBusy && !baseLocations.length && <div className="trip-action-error">Belum ada master lokasi berjenis BASE yang aktif.</div>}
          <footer><button type="button" className="secondary" disabled={emptyReturnBusy} onClick={() => setEmptyReturnOpen(false)}>Batal</button><button type="submit" disabled={emptyReturnBusy || !emptyReturnForm.truckId || !emptyReturnForm.destinationLocationId || emptyReturnAlreadyAtBase}>{emptyReturnBusy ? "Menyiapkan…" : "Buat Trip Kembali Kosong"}</button></footer>
        </form>
      </section>
    </div>}
    {actionTrip && <div className="trip-action-overlay" onMouseDown={event => event.target === event.currentTarget && setActionTrip(null)}><section className="trip-action-modal"><header><div><span>PUSAT TINDAKAN WARNING</span><h2>{actionTrip.truck?.plateNumber || actionTrip.plateNumberSnap}</h2><p>{actionWarning?.text} · {actionTrip.order?.orderNo || "Trip operasional"}</p></div><button type="button" onClick={() => setActionTrip(null)} aria-label="Tutup"><FiX /></button></header><div className="trip-action-context"><div><FiMapPin /><span><small>LOKASI / RUTE</small><strong>{actionTrip.truck?.currentLocation || actionTrip.toText || "Lokasi GPS belum tersedia"}</strong></span></div><div><FiUser /><span><small>PENGEMUDI</small><strong>{actionTrip.driverUser?.name || actionTrip.driverNameSnap || "Belum ditugaskan"}</strong></span></div><a href={`https://www.google.com/maps/search/?api=1&query=${actionTrip.truck?.latitude || actionTrip.destinationLat},${actionTrip.truck?.longitude || actionTrip.destinationLng}`} target="_blank" rel="noreferrer"><FiExternalLink /> Buka lokasi</a></div><form onSubmit={saveAction}><div className="trip-action-options">{ACTION_OPTIONS.map(option => {
              const Icon = option.icon;
              return <button type="button" key={option.value} className={actionForm.actionType === option.value ? "active" : ""} onClick={() => setActionForm(form => ({
                ...form,
                actionType: option.value
              }))}><Icon /><span><strong>{option.label}</strong><small>{option.note}</small></span></button>;
            })}</div><div className="trip-action-fields"><label><span>PIC penanganan</span><select value={actionForm.assignedToId} onChange={event => setActionForm(form => ({
                ...form,
                assignedToId: event.target.value
              }))}><option value="">Belum ditetapkan</option>{actionPics.map(pic => <option key={pic.id} value={pic.id}>{pic.name || pic.email} · {pic.role}</option>)}</select></label>{actionForm.actionType === "SEND_FUNDS" && <label><span>Jenis pengeluaran</span><select value={actionForm.expenseCategory} onChange={event => setActionForm(form => ({
                  ...form,
                  expenseCategory: event.target.value
                }))}>{FUND_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}{actionForm.actionType === "SEND_FUNDS" && <label><span>Nominal dana</span><div className="trip-action-money"><b>Rp</b><input required min="1" type="number" value={actionForm.amount} onChange={event => setActionForm(form => ({
                  ...form,
                  amount: event.target.value
                }))} placeholder="0" /></div></label>}<label className="wide"><span>Catatan tindakan</span><textarea required rows="3" value={actionForm.note} onChange={event => setActionForm(form => ({
                ...form,
                note: event.target.value
              }))} placeholder="Jelaskan tindakan atau hasil komunikasi…" /></label></div>{actionError && <div className="trip-action-error">{actionError}</div>}<footer><button type="button" className="secondary" onClick={() => nav(`/trips/${actionTrip.id}`)}>Lihat detail trip</button><button type="submit" disabled={actionBusy}>{actionBusy ? "Menyimpan…" : "Simpan tindakan"}</button></footer></form><div className="trip-action-history"><div><span>RIWAYAT PENANGANAN</span><b>{actionHistory.length} catatan</b></div>{actionHistory.map(action => <article key={action.id}><i className={action.status === "RESOLVED" ? "resolved" : ""}><FiMessageSquare /></i><div><strong>{ACTION_OPTIONS.find(option => option.value === action.actionType)?.label || action.actionType}</strong><p>{action.note}</p><small>{action.createdBy?.name || "Sistem"} · {dateTime(action.createdAt)}{action.assignedTo?.name ? ` · PIC ${action.assignedTo.name}` : ""}</small></div>{action.amount > 0 && <b>Rp {Number(action.amount).toLocaleString("id-ID")}</b>}</article>)}{!actionHistory.length && <p className="empty">Belum ada tindak lanjut untuk warning ini.</p>}</div></section></div>}
  </div>;
}
