import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiActivity, FiCalendar, FiCheckCircle, FiChevronLeft, FiChevronRight, FiClock, FiMapPin, FiPackage, FiSearch, FiTruck, FiX } from "react-icons/fi";
import { api } from "../api";
import { useLiveRefresh } from "../liveUpdates";
import "./TripsRedesign.css";

const statusLabel = { PLANNED: "Direncanakan", DISPATCHED: "Berangkat", ARRIVED: "Tiba", COMPLETED: "Selesai", CANCELLED: "Dibatalkan" };
const statusColor = {
  PLANNED: { color: "#475569", background: "#F1F5F9" },
  DISPATCHED: { color: "#0D7C3D", background: "#E8F6ED" },
  ARRIVED: { color: "#1D4ED8", background: "#EFF6FF" },
  COMPLETED: { color: "#047857", background: "#ECFDF5" },
  CANCELLED: { color: "#B91C1C", background: "#FEF2F2" },
};

function dateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function Trips() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const searchRequestRef = useRef({ id: 0, controller: null });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
  const [filters, setFilters] = useState({ q: "", status: "", dateFrom: "", dateTo: "" });
  const [applied, setApplied] = useState({ q: "", status: "", dateFrom: "", dateTo: "" });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(targetPage = page, active = applied) {
    const requestId = searchRequestRef.current.id + 1;
    searchRequestRef.current.controller?.abort();
    const controller = new AbortController();
    searchRequestRef.current = { id: requestId, controller };
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: "20" });
      if (active.q.trim()) params.set("q", active.q.trim());
      if (active.status) params.set("status", active.status);
      if (active.dateFrom) params.set("dateFrom", new Date(`${active.dateFrom}T00:00:00`).toISOString());
      if (active.dateTo) params.set("dateTo", new Date(`${active.dateTo}T23:59:59.999`).toISOString());
      const data = await api(`/trips?${params.toString()}`, { signal: controller.signal });
      if (searchRequestRef.current.id !== requestId) return;
      setItems(data.items || []);
      setPagination(data.pagination || { page: targetPage, totalPages: 1, total: (data.items || []).length, limit: 20 });
    } catch (e) { if (e?.name !== "AbortError") setError(e.message || "Gagal memuat perjalanan"); }
    finally { if (searchRequestRef.current.id === requestId) setLoading(false); }
  }

  useEffect(() => { load(page, applied); }, [page, applied]);
  useLiveRefresh(() => load(page, applied));

  function resetFilters() { const empty = { q: "", status: "", dateFrom: "", dateTo: "" }; setFilters(empty); setPage(1); setApplied(empty); }

  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(1); setApplied({ ...filters }); }, filters.q.trim() ? 140 : 0);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const summary = useMemo(() => ({
    active: items.filter((trip) => ["PLANNED", "DISPATCHED", "ARRIVED"].includes(trip.status)).length,
    moving: items.filter((trip) => trip.status === "DISPATCHED").length,
    arrived: items.filter((trip) => trip.status === "ARRIVED").length,
    completed: items.filter((trip) => trip.status === "COMPLETED").length,
  }), [items]);

  return <div className="trips-v3-page"><header className="trips-v3-head"><div><span>TRIP CONTROL</span><h1>Perjalanan Armada</h1><p>Pantau penugasan, posisi workflow, muatan tiba, dan penyelesaian perjalanan.</p></div><b>{pagination.total} total trip</b></header>
    <section className="trips-v3-summary"><article><FiActivity/><small>AKTIF</small><strong>{summary.active}</strong><span>Planned sampai tiba</span></article><article><FiTruck/><small>DALAM PERJALANAN</small><strong>{summary.moving}</strong><span>Status dispatched</span></article><article><FiMapPin/><small>SUDAH TIBA</small><strong>{summary.arrived}</strong><span>Menunggu penyelesaian</span></article><article><FiCheckCircle/><small>SELESAI</small><strong>{summary.completed}</strong><span>Pada halaman ini</span></article></section>
    <section className="trips-v3-tools"><label><FiSearch/><input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Cari order, nomor polisi, pengemudi, atau tujuan…"/>{loading && <small>Memuat…</small>}</label><select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}><option value="">Semua status</option>{Object.entries(statusLabel).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select><input aria-label="Tanggal mulai" type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}/><input aria-label="Tanggal selesai" type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}/><button type="button" onClick={resetFilters}><FiX/> Reset</button></section>
    {error && <div className="trips-v3-error">{error}</div>}
    <section className="trips-v3-board"><header><div><span>DAFTAR OPERASIONAL</span><h2>Trip Aktif & Riwayat</h2></div><b>{items.length} ditampilkan</b></header><div className="trips-v3-list">{!loading && items.map((trip) => { const planned=trip.qtyPlanned==null?null:Number(trip.qtyPlanned);const actual=trip.qtyActual==null?null:Number(trip.qtyActual);const loss=planned==null||actual==null?null:Math.max(0,planned-actual);return <article key={trip.id} onClick={() => nav(`/trips/${trip.id}`)}><div className="trips-v3-id"><span style={statusColor[trip.status]}>{statusLabel[trip.status]||trip.status}</span><h3>{trip.order?.orderNo||(trip.purpose==="EMPTY_RETURN"?"Kembali Kosong":"Tanpa Order")}</h3><p>{trip.order?.customerName||"Operasional internal"}</p></div><div className="trips-v3-assignment"><FiTruck/><div><small>ARMADA & PENGEMUDI</small><strong>{trip.truck?.plateNumber||trip.plateNumberSnap||"—"}</strong><span>{trip.driverUser?.name||trip.driverNameSnap||"Tanpa pengemudi"}</span></div></div><div className="trips-v3-route"><FiMapPin/><div><small>RUTE</small><strong>{trip.order?.fromText||trip.fromText||"—"} <i>→</i> {trip.order?.toText||trip.toText||"—"}</strong><span><FiCalendar/> {dateTime(trip.plannedDepartAt||trip.createdAt)}</span></div></div><div className="trips-v3-load"><FiPackage/><div><small>MUATAN</small><strong>{actual??planned??"—"} {trip.unitSnap||""}</strong><span>{actual==null?`Rencana ${planned??"—"}`:`Tiba ${actual} dari ${planned??"—"}`}</span>{loss>0&&<em>Selisih {loss} {trip.unitSnap||""}</em>}</div></div><div className="trips-v3-docs"><span><b>{trip._count?.arrivalProofs||0}</b> bukti</span><span><b>{trip._count?.expenses||0}</b> biaya</span><FiChevronRight/></div></article>})}{loading&&<div className="trips-v3-state"><FiClock/> Memuat perjalanan…</div>}{!loading&&!items.length&&<div className="trips-v3-state">Tidak ada trip yang sesuai filter.</div>}</div><footer><span>Halaman {pagination.page} dari {pagination.totalPages}</span><div><button disabled={page<=1||loading} onClick={()=>setPage((p)=>p-1)}><FiChevronLeft/> Sebelumnya</button><button disabled={page>=pagination.totalPages||loading} onClick={()=>setPage((p)=>p+1)}>Berikutnya <FiChevronRight/></button></div></footer></section>
  </div>;
}
