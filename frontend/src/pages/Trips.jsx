import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiCalendar, FiChevronLeft, FiChevronRight, FiMapPin, FiSearch, FiTruck } from "react-icons/fi";
import { api } from "../api";
import { useLiveRefresh } from "../liveUpdates";

const C = { green: "#0D7C3D", pale: "#F5F9F7", border: "#E2E8E5", text: "#18221E", muted: "#6B7771", white: "#FFFFFF", red: "#DC2626" };
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
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
  const [filters, setFilters] = useState({ q: "", status: "", dateFrom: "", dateTo: "" });
  const [applied, setApplied] = useState({ q: "", status: "", dateFrom: "", dateTo: "" });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(targetPage = page, active = applied) {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: "20" });
      if (active.q.trim()) params.set("q", active.q.trim());
      if (active.status) params.set("status", active.status);
      if (active.dateFrom) params.set("dateFrom", new Date(`${active.dateFrom}T00:00:00`).toISOString());
      if (active.dateTo) params.set("dateTo", new Date(`${active.dateTo}T23:59:59.999`).toISOString());
      const data = await api(`/trips?${params.toString()}`);
      setItems(data.items || []);
      setPagination(data.pagination || { page: targetPage, totalPages: 1, total: (data.items || []).length, limit: 20 });
    } catch (e) { setError(e.message || "Gagal memuat perjalanan"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(page, applied); }, [page, applied]);
  useLiveRefresh(() => load(page, applied));

  function applyFilters(e) { e?.preventDefault(); setPage(1); setApplied({ ...filters }); }
  function resetFilters() { const empty = { q: "", status: "", dateFrom: "", dateTo: "" }; setFilters(empty); setPage(1); setApplied(empty); }

  return <div style={{ minHeight: "100vh", background: C.pale, padding: 24, color: C.text }}>
    <div style={{ maxWidth: 1380, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div><div style={{ color: C.green, fontSize: 12, fontWeight: 800, letterSpacing: 1.4 }}>RIWAYAT OPERASIONAL</div><h1 style={{ margin: "6px 0 4px", fontSize: 30 }}>Semua Trips</h1><div style={{ color: C.muted, fontSize: 14 }}>Lihat seluruh perjalanan dan buka detail trip.</div></div>
        <div style={{ padding: "8px 13px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.white, color: C.muted, fontSize: 13 }}><strong style={{ color: C.text }}>{pagination.total}</strong> perjalanan</div>
      </div>

      <form className="trips-filter-grid" onSubmit={applyFilters} style={{ marginTop: 22, padding: 18, display: "grid", gridTemplateColumns: "minmax(220px, 1.5fr) repeat(3, minmax(150px, .7fr)) auto auto", gap: 10, alignItems: "end", border: `1px solid ${C.border}`, borderRadius: 12, background: C.white }}>
        <label style={label}><span>Cari trip</span><div style={{ position: "relative" }}><FiSearch style={{ position: "absolute", left: 12, top: 13, color: C.muted }}/><input style={{ ...input, paddingLeft: 38 }} value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="No. order, truk, sopir, tujuan..."/></div></label>
        <label style={label}><span>Status</span><select style={input} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}><option value="">Semua status</option>{Object.entries(statusLabel).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
        <label style={label}><span>Dari tanggal</span><span className={`date-placeholder-wrap ${filters.dateFrom ? "has-value" : ""}`} data-placeholder="Pilih tanggal awal"><input className="tablet-date-input" aria-label="Tanggal mulai trip" style={input} type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}/></span></label>
        <label style={label}><span>Sampai tanggal</span><span className={`date-placeholder-wrap ${filters.dateTo ? "has-value" : ""}`} data-placeholder="Pilih tanggal akhir"><input className="tablet-date-input" aria-label="Tanggal selesai trip" style={input} type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}/></span></label>
        <button style={primary}>Terapkan</button><button type="button" style={secondary} onClick={resetFilters}>Reset</button>
      </form>

      {error && <div style={{ marginTop: 14, padding: 13, borderRadius: 9, color: C.red, background: "#FEF2F2" }}>{error}</div>}

      <div style={{ marginTop: 16, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", background: C.white }}>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 1050, borderCollapse: "collapse" }}><thead><tr>{["Trip / Order", "Truk & Sopir", "Rute", "Jadwal", "Status", "Qty", "Dokumen"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{!loading && items.map((trip) => <tr key={trip.id} onClick={() => nav(`/trips/${trip.id}`)} style={{ cursor: "pointer" }}>
            <td style={td}><strong>{trip.order?.orderNo || (trip.purpose === "EMPTY_RETURN" ? "Kembali Kosong" : "Tanpa Order")}</strong><div style={sub}>{trip.id}</div></td>
            <td style={td}><div style={{ display: "flex", gap: 8, alignItems: "center" }}><FiTruck color={C.green}/><strong>{trip.truck?.plateNumber || trip.plateNumberSnap || "—"}</strong></div><div style={sub}>{trip.driverUser?.name || trip.driverNameSnap || "Tanpa sopir"}</div></td>
            <td style={td}><div style={{ display: "flex", gap: 7, alignItems: "center" }}><FiMapPin color={C.green}/><span>{trip.order?.fromText || trip.fromText || "—"} → {trip.order?.toText || trip.toText || "—"}</span></div><div style={sub}>{trip.order?.customerName || "—"}</div></td>
            <td style={td}><div style={{ display: "flex", gap: 7, alignItems: "center" }}><FiCalendar color={C.muted}/>{dateTime(trip.plannedDepartAt || trip.createdAt)}</div><div style={sub}>{trip.completedAt ? `Selesai ${dateTime(trip.completedAt)}` : ""}</div></td>
            <td style={td}><span style={{ ...statusColor[trip.status], display: "inline-block", padding: "6px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700 }}>{statusLabel[trip.status] || trip.status}</span></td>
            <td style={td}>{trip.qtyActual ?? trip.qtyPlanned ?? "—"} {trip.unitSnap || ""}</td>
            <td style={td}><div style={{ fontSize: 12 }}>{trip._count?.arrivalProofs || 0} bukti tiba</div><div style={sub}>{trip._count?.expenses || 0} expense</div></td>
          </tr>)}
          {loading && <tr><td colSpan="7" style={{ ...td, textAlign: "center", padding: 36, color: C.muted }}>Memuat perjalanan...</td></tr>}
          {!loading && !items.length && <tr><td colSpan="7" style={{ ...td, textAlign: "center", padding: 36, color: C.muted }}>Tidak ada trip yang sesuai filter.</td></tr>}</tbody>
        </table></div>
        <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderTop: `1px solid ${C.border}` }}><span style={{ color: C.muted, fontSize: 12 }}>Halaman {pagination.page} dari {pagination.totalPages} · 20 trip per halaman</span><div style={{ display: "flex", gap: 8 }}><button style={pager} disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}><FiChevronLeft/> Sebelumnya</button><button style={pager} disabled={page >= pagination.totalPages || loading} onClick={() => setPage((p) => p + 1)}>Berikutnya <FiChevronRight/></button></div></div>
      </div>
    </div>
  </div>;
}

const label = { display: "grid", gap: 6, color: C.muted, fontSize: 12, fontWeight: 600 };
const input = { width: "100%", height: 42, padding: "0 12px", boxSizing: "border-box", borderRadius: 8, border: `1px solid ${C.border}`, outline: "none", background: C.white, color: C.text };
const primary = { height: 42, padding: "0 17px", border: 0, borderRadius: 8, background: C.green, color: C.white, fontWeight: 700, cursor: "pointer" };
const secondary = { ...primary, border: `1px solid ${C.border}`, background: C.white, color: C.text };
const th = { padding: "13px 15px", textAlign: "left", fontSize: 11, letterSpacing: .5, textTransform: "uppercase", color: C.muted, background: "#F8FAF9", borderBottom: `1px solid ${C.border}` };
const td = { padding: "14px 15px", fontSize: 13, verticalAlign: "top", borderBottom: `1px solid #EEF2F0` };
const sub = { marginTop: 4, color: C.muted, fontSize: 11 };
const pager = { height: 34, padding: "0 11px", display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 7, border: `1px solid ${C.border}`, background: C.white, color: C.text, cursor: "pointer" };
