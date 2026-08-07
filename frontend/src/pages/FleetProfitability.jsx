import { useEffect, useMemo, useState } from "react";
import { FiActivity, FiDollarSign, FiEdit2, FiTruck, FiTrendingUp, FiX } from "react-icons/fi";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import "./FleetProfitability.css";

const money = value => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
const pct = value => `${Number(value || 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
const currentMonth = () => new Date().toLocaleDateString("sv-SE", { year: "numeric", month: "2-digit" });
const labels = { depreciation: "Penyusutan", insurance: "Asuransi", taxPermit: "Pajak & izin", driverSalary: "Gaji pengemudi", lease: "Cicilan / sewa", overhead: "Overhead" };

function Bar({ value, tone = "green" }) {
  return <div className="fp-bar"><span className={tone} style={{ width: `${Math.min(100, Math.max(0, Number(value) || 0))}%` }} /></div>;
}

export default function FleetProfitability() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState({ summary: {}, rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState("profit-desc");
  const canEdit = ["OWNER", "ADMIN"].includes(user?.role);

  async function load() {
    setLoading(true); setError("");
    try { setData(await api(`/fleet-profitability?month=${month}`)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [month]);
  useLiveRefresh(load);
  const best = useMemo(() => [...data.rows].sort((a, b) => b.profit - a.profit)[0], [data.rows]);
  const sortedRows = useMemo(() => [...data.rows].sort((a, b) => {
    if (sortBy === "profit-asc") return a.profit - b.profit;
    if (sortBy === "margin-desc") return b.margin - a.margin;
    if (sortBy === "margin-asc") return a.margin - b.margin;
    if (sortBy === "trips-desc") return b.trips.total - a.trips.total;
    return b.profit - a.profit;
  }), [data.rows, sortBy]);
  function edit(row) { setEditing({ truckId: row.truck.id, plateNumber: row.truck.plateNumber, notes: "", ...row.fixedCosts }); }
  async function save(event) {
    event.preventDefault(); setSaving(true); setError("");
    try { await api("/fleet-profitability/fixed-costs", { method: "PUT", body: JSON.stringify({ ...editing, month }) }); setEditing(null); await load(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return <main className="fp-page">
    <header className="fp-head"><div><span>ANALISIS ARMADA</span><h1>Profit Armada</h1><p>Ukur trip, pendapatan, seluruh biaya, dan keuntungan setiap truk.</p></div><label>Periode<input type="month" value={month} onChange={event => setMonth(event.target.value)} /></label></header>
    {error && <div className="fp-error">{error}</div>}
    <section className="fp-summary">
      <article><FiDollarSign/><small>Pendapatan</small><strong>{money(data.summary.revenue)}</strong><span>{data.summary.trips || 0} trip bulan ini</span></article>
      <article><FiActivity/><small>Total Biaya</small><strong>{money(data.summary.totalCost)}</strong><span>Operasional + sparepart + tetap</span></article>
      <article className={(data.summary.profit || 0) < 0 ? "loss" : "profit"}><FiTrendingUp/><small>Laba Bersih</small><strong>{money(data.summary.profit)}</strong><span>Margin {pct(data.summary.margin)}</span></article>
      <article><FiTruck/><small>Truk Terbaik</small><strong>{best?.truck.plateNumber || "—"}</strong><span>{best ? `${money(best.profit)} · ${pct(best.margin)}` : "Belum ada data"}</span></article>
    </section>
    <section className="fp-panel">
      <div className="fp-panel-head"><div><h2>Performa per Truk</h2><p>Hijau ≥ 20% margin, kuning 0–19,9%, merah berarti rugi.</p></div><label>Urutkan<select value={sortBy} onChange={event => setSortBy(event.target.value)}><option value="profit-desc">Paling untung</option><option value="profit-asc">Paling rugi</option><option value="margin-desc">Margin tertinggi</option><option value="margin-asc">Margin terendah</option><option value="trips-desc">Trip terbanyak</option></select></label></div>
      {loading ? <div className="fp-state"><span className="fp-spinner"/>Menghitung profit armada…</div> : !data.rows.length ? <div className="fp-state">Belum ada armada.</div> :
      <div className="fp-table-wrap"><table><thead><tr><th>Armada</th><th>Trip</th><th>Pendapatan</th><th>Biaya</th><th>Laba / Rugi</th><th>Margin</th><th>Kinerja</th><th /></tr></thead><tbody>
        {sortedRows.map(row => <tr key={row.truck.id}>
          <td><b>{row.truck.plateNumber}</b><small>{[row.truck.brand, row.truck.model].filter(Boolean).join(" ") || "Detail belum diisi"}</small></td>
          <td><b>{row.trips.total}</b><small>{row.trips.completed} selesai · {pct(row.completionRate)}</small></td>
          <td><b>{money(row.revenue)}</b><small>Kontribusi {pct(row.revenueContribution)}</small></td>
          <td><b>{money(row.totalCost)}</b><small>Rasio {pct(row.costRatio)}</small></td>
          <td className={row.profit < 0 ? "negative" : "positive"}><b>{money(row.profit)}</b><small>Biaya tetap {money(row.fixedTotal)}</small></td>
          <td><span className={`fp-badge ${row.health.toLowerCase()}`}>{pct(row.margin)}</span><Bar value={row.margin} tone={row.health === "LOSS" ? "red" : row.health === "WATCH" ? "yellow" : "green"}/></td>
          <td><b>{pct(row.utilizationRate)} utilisasi</b><Bar value={row.utilizationRate}/><small>{row.activeDays} hari aktif · BEP {row.breakEvenTrips ?? "—"} trip</small></td>
          <td>{canEdit && <button className="fp-icon" onClick={() => edit(row)} title="Atur biaya tetap"><FiEdit2/></button>}</td>
        </tr>)}
      </tbody></table></div>}
    </section>
    {editing && <div className="fp-overlay" onMouseDown={event => event.target === event.currentTarget && setEditing(null)}><form className="fp-modal" onSubmit={save}><header><div><span>BIAYA BULANAN</span><h2>{editing.plateNumber}</h2><p>Masukkan biaya tetap untuk periode {month}.</p></div><button type="button" onClick={() => setEditing(null)}><FiX/></button></header><div className="fp-fields">
      {Object.entries(labels).map(([key, label]) => <label key={key}>{label}<input type="number" min="0" step="1" value={editing[key]} onChange={event => setEditing({ ...editing, [key]: event.target.value })}/></label>)}
      <label className="wide">Catatan<textarea rows="3" value={editing.notes} onChange={event => setEditing({ ...editing, notes: event.target.value })} placeholder="Opsional" /></label>
    </div><footer><button type="button" className="secondary" onClick={() => setEditing(null)}>Batal</button><button disabled={saving}>{saving ? "Menyimpan…" : "Simpan Biaya"}</button></footer></form></div>}
  </main>;
}
