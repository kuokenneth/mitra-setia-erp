import { useEffect, useMemo, useState } from "react";
import { FiActivity, FiAlertTriangle, FiCalendar, FiDollarSign, FiEdit2, FiFileText, FiTruck, FiTrendingDown, FiTrendingUp, FiX } from "react-icons/fi";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import LoadingState from "../components/LoadingState";
import "./FleetProfitability.css";
import "./FleetProfitabilityPro.css";

const money = value => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
const pct = value => `${Number(value || 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
const currentMonth = () => new Date().toLocaleDateString("sv-SE", { year: "numeric", month: "2-digit" });
const labels = { depreciation: "Penyusutan", insurance: "Asuransi", taxPermit: "Pajak & izin", driverSalary: "Gaji pengemudi", lease: "Cicilan / sewa", overhead: "Overhead" };
const date = value => value ? new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function Bar({ value, tone = "green" }) {
  return <div className="fp-bar"><span className={tone} style={{ width: `${Math.min(100, Math.max(0, Number(value) || 0))}%` }} /></div>;
}

export default function FleetProfitability() {
  const { user } = useAuth();
  const canAccess = ["OWNER", "ADMIN"].includes(user?.role);
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState({ summary: {}, rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState("profit-desc");
  const [selected, setSelected] = useState(null);
  const canEdit = ["OWNER", "ADMIN"].includes(user?.role);

  async function load() {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    const normalizedMonth = String(month || "").trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalizedMonth)) {
      setError("Pilih periode bulan yang valid.");
      setLoading(false);
      return;
    }
    setLoading(true); setError("");
    try { setData(await api(`/fleet-profitability?month=${encodeURIComponent(normalizedMonth)}`)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  // load follows the selected month and access state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (canAccess) load(); }, [month, canAccess]);
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

  if (!canAccess) return <main className="fp-page"><header className="fp-head"><div><span>AKSES DIBATASI</span><h1>Profit Armada</h1><p>Halaman ini hanya tersedia untuk Owner dan Admin.</p></div></header></main>;

  return <main className="fp-page">
    <header className="fp-head"><div className="fp-head-copy"><span>KEUANGAN · ANALISIS ARMADA</span><h1>Profit Armada</h1><p>Pantau kontribusi pendapatan, struktur biaya, dan laba bersih setiap armada dalam satu laporan.</p></div><div className="fp-period-card"><FiCalendar/><label><small>PERIODE LAPORAN</small><input type="month" value={month} onChange={event => setMonth(event.target.value)} /></label></div></header>
    {error && <div className="fp-error">{error}</div>}
    <section className="fp-summary">
      <article className="revenue"><FiDollarSign/><small>Pendapatan</small><strong>{money(data.summary.revenue)}</strong><span>{data.summary.trips || 0} trip pada periode ini</span></article>
      <article className="cargo-loss"><FiAlertTriangle/><small>Kehilangan Muatan</small><strong>{money(data.summary.cargoLoss)}</strong><span>Selisih nilai rencana dan tiba</span></article>
      <article className="cost"><FiActivity/><small>Total Biaya</small><strong>{money(data.summary.totalCost)}</strong><span>Trip, armada, sparepart, dan tetap</span></article>
      <article className={`net ${(data.summary.profit || 0) < 0 ? "loss" : "profit"}`}><FiTrendingUp/><small>Laba Bersih</small><strong>{money(data.summary.profit)}</strong><span>Margin bersih {pct(data.summary.margin)}</span></article>
      <article className="best"><FiTruck/><small>Armada Terbaik</small><strong>{best?.truck.plateNumber || "—"}</strong><span>{best ? `${money(best.profit)} · margin ${pct(best.margin)}` : "Belum ada data"}</span></article>
    </section>
    <section className="fp-panel">
      <div className="fp-panel-head"><div className="fp-panel-title"><span>PERFORMA ARMADA</span><h2>Analisis per Truk</h2><p>Bandingkan pendapatan, biaya, margin, dan utilisasi seluruh armada.</p></div><div className="fp-panel-controls"><span className="fp-count"><FiTruck/> {sortedRows.length} armada</span><label>Urutkan<select value={sortBy} onChange={event => setSortBy(event.target.value)}><option value="profit-desc">Paling untung</option><option value="profit-asc">Paling rugi</option><option value="margin-desc">Margin tertinggi</option><option value="margin-asc">Margin terendah</option><option value="trips-desc">Trip terbanyak</option></select></label></div></div>
      {loading ? <LoadingState label="Menghitung profit armada" note="Merekonsiliasi pendapatan, biaya trip, dan sparepart…" rows={5} /> : !data.rows.length ? <div className="fp-state">Belum ada armada.</div> :
      <div className="fp-table-wrap"><table><thead><tr><th>Armada</th><th>Trip</th><th>Pendapatan</th><th>Biaya</th><th>Laba / Rugi</th><th>Margin</th><th>Kinerja</th><th /></tr></thead><tbody>
        {sortedRows.map(row => <tr key={row.truck.id} onClick={() => setSelected(row)} className="fp-clickable" title="Klik untuk melihat rincian laba rugi">
          <td><div className="fp-truck-cell"><span><FiTruck/></span><div><b>{row.truck.plateNumber}</b><small>{[row.truck.brand, row.truck.model].filter(Boolean).join(" ") || "Detail belum diisi"}</small></div></div></td>
          <td><b>{row.trips.total}</b><small>{row.trips.completed} selesai · {pct(row.completionRate)}</small></td>
          <td><b>{money(row.revenue)}</b><small>Kontribusi {pct(row.revenueContribution)}</small>{row.cargoLoss > 0 && <small style={{ color: "#bf3434" }}>Kehilangan {money(row.cargoLoss)}</small>}</td>
          <td><b>{money(row.totalCost)}</b><small>Rasio {pct(row.costRatio)}</small></td>
          <td className={row.profit < 0 ? "negative" : "positive"}><b>{money(row.profit)}</b><small>Biaya tetap {money(row.fixedTotal)}</small></td>
          <td><span className={`fp-badge ${row.health.toLowerCase()}`}>{pct(row.margin)}</span><Bar value={row.margin} tone={row.health === "LOSS" ? "red" : row.health === "WATCH" ? "yellow" : "green"}/></td>
          <td><b>{pct(row.utilizationRate)} utilisasi</b><Bar value={row.utilizationRate}/><small>{row.activeDays} hari aktif · BEP {row.breakEvenTrips ?? "—"} trip</small></td>
          <td>{canEdit && <button className="fp-icon" onClick={event => { event.stopPropagation(); edit(row); }} title="Atur biaya tetap"><FiEdit2/></button>}</td>
        </tr>)}
      </tbody></table></div>}
    </section>
    {selected && <div className="fp-overlay" onMouseDown={event => event.target === event.currentTarget && setSelected(null)}><section className="fp-detail-modal">
      <header><div className="fp-detail-heading"><span>RINCIAN LABA / RUGI</span><h2>{selected.truck.plateNumber}</h2><p>Rekonsiliasi lengkap periode {month}. Semua angka di bawah membentuk laba/rugi akhir.</p></div><div className="fp-detail-head-actions"><div className={`fp-detail-head-metric ${selected.profit < 0 ? "loss" : "profit"}`}><small>{selected.profit < 0 ? "RUGI BERSIH" : "LABA BERSIH"}</small><strong>{money(Math.abs(selected.profit))}</strong><span>Margin {pct(selected.margin)}</span></div><button type="button" onClick={() => setSelected(null)} aria-label="Tutup rincian"><FiX/></button></div></header>
      <div className="fp-detail-body">
        <div className="fp-detail-intro"><div><span>01</span><div><h3>Rekonsiliasi Keuangan</h3><p>Pendapatan dikurangi seluruh komponen biaya pada armada ini.</p></div></div><small>{selected.trips.total} trip · {selected.activeDays} hari aktif</small></div>
        <div className="fp-equation">
          <article><FiTrendingUp/><small>Pendapatan</small><strong>{money(selected.revenue)}</strong></article><i>−</i>
          <article><FiTrendingDown/><small>Pengeluaran Trip</small><strong>{money(selected.tripExpenses)}</strong></article><i>−</i>
          <article><FiFileText/><small>Pengeluaran Armada</small><strong>{money(selected.vehicleExpenses)}</strong></article><i>−</i>
          <article><FiActivity/><small>Sparepart</small><strong>{money(selected.spareParts)}</strong></article><i>−</i>
          <article><FiDollarSign/><small>Biaya Tetap</small><strong>{money(selected.fixedTotal)}</strong></article><i>=</i>
          <article className={selected.profit < 0 ? "loss" : "profit"}><small>Laba / Rugi</small><strong>{money(selected.profit)}</strong><b>{pct(selected.margin)}</b></article>
        </div>

        <div className="fp-detail-section"><div className="fp-detail-title"><div><FiTruck/><h3>Sumber Pendapatan & Biaya Armada</h3></div><span>{selected.tripDetails?.length || 0} sumber</span></div>
          <div className="fp-detail-table"><table><thead><tr><th>Tanggal / Trip</th><th>Rute</th><th>Dasar Pendapatan</th><th>Pendapatan</th><th>Pengeluaran</th><th>Kontribusi Bersih</th></tr></thead><tbody>
            {(selected.tripDetails || []).map(trip => <tr key={trip.id}><td><b>{date(trip.date)}</b><small>{trip.purpose === "EMPTY_RETURN" ? "Kembali kosong" : trip.orderNo || "Tanpa nomor DO"}</small></td><td><b>{trip.fromText || "—"} → {trip.toText || "—"}</b><small>{trip.customerName || "Operasional internal"}</small></td><td>{trip.invoiceNumber ? <><b>{trip.invoiceNumber}</b><small>{pct(trip.allocationPercent)} dari invoice {money(trip.invoiceTotal)}{!trip.historical && trip.quantity != null ? ` · Tiba ${trip.quantity}/${trip.orderedQuantity || "?"} ${trip.unit || ""}` : trip.historical ? ` · ${trip.cargoName || "Muatan historis"} · ${Number(trip.quantity || 0).toLocaleString("id-ID")} ${trip.unit || ""}` : ""}</small>{trip.cargoLoss > 0 && <small style={{ color: "#bf3434" }}>Kehilangan {Math.max(0, Number(trip.plannedQuantity) - Number(trip.quantity)).toLocaleString("id-ID")} {trip.unit || ""} = {money(trip.cargoLoss)}</small>}</> : <><b>Tidak ada pendapatan</b><small>{trip.purpose === "EMPTY_RETURN" ? "Trip kembali kosong" : "Invoice belum terkirim"}</small></>}</td><td className="positive"><b>{money(trip.allocatedRevenue)}</b></td><td className={trip.expenseTotal ? "negative" : ""}><b>{money(trip.expenseTotal)}</b>{trip.expenses?.map(expense => <small key={expense.id}>{expense.reason}: {money(expense.amount)}</small>)}</td><td className={trip.netContribution < 0 ? "negative" : "positive"}><b>{money(trip.netContribution)}</b></td></tr>)}
            {!selected.tripDetails?.length && <tr><td colSpan="6" className="fp-none">Tidak ada pendapatan armada pada bulan ini.</td></tr>}
          </tbody></table></div>
        </div>

        <div className="fp-detail-columns">
          <div className="fp-detail-section"><div className="fp-detail-title"><div><FiActivity/><h3>Sparepart Terpasang</h3></div><strong>{money(selected.spareParts)}</strong></div><div className="fp-cost-list">{(selected.sparePartDetails || []).map(part => <div key={part.id}><span><b>{part.name}</b><small>{part.sku || "Tanpa SKU"} · {date(part.installedAt)}</small></span><strong>{money(part.cost)}</strong></div>)}{!selected.sparePartDetails?.length && <p>Belum ada biaya sparepart bulan ini.</p>}</div></div>
          <div className="fp-detail-section"><div className="fp-detail-title"><div><FiFileText/><h3>Pengeluaran Langsung Armada</h3></div><strong>{money(selected.vehicleExpenses)}</strong></div><div className="fp-cost-list">{(selected.vehicleExpenseDetails || []).map(item => <div key={item.id}><span><b>{item.reason}</b><small>{date(item.paidAt)} · {item.status}</small></span><strong>{money(item.amount)}</strong></div>)}{!selected.vehicleExpenseDetails?.length && <p>Belum ada pengeluaran langsung armada bulan ini.</p>}</div></div>
          <div className="fp-detail-section"><div className="fp-detail-title"><div><FiFileText/><h3>Biaya Tetap Bulanan</h3></div><strong>{money(selected.fixedTotal)}</strong></div><div className="fp-cost-list">{Object.entries(labels).map(([key, label]) => <div key={key}><span>{label}</span><strong>{money(selected.fixedCosts?.[key])}</strong></div>)}</div></div>
        </div>
        <div className={`fp-result ${selected.profit < 0 ? "loss" : "profit"}`}><div><small>PERHITUNGAN AKHIR</small><p>{money(selected.revenue)} − {money(selected.tripExpenses)} − {money(selected.vehicleExpenses)} − {money(selected.spareParts)} − {money(selected.fixedTotal)}</p></div><div><small>{selected.profit < 0 ? "RUGI" : "LABA"}</small><strong>{money(Math.abs(selected.profit))}</strong></div></div>
      </div>
    </section></div>}
    {editing && <div className="fp-overlay" onMouseDown={event => event.target === event.currentTarget && setEditing(null)}><form className="fp-modal" onSubmit={save}><header><div><span>BIAYA BULANAN</span><h2>{editing.plateNumber}</h2><p>Masukkan biaya tetap untuk periode {month}.</p></div><button type="button" onClick={() => setEditing(null)}><FiX/></button></header><div className="fp-fields">
      {Object.entries(labels).map(([key, label]) => <label key={key}>{label}<input type="number" min="0" step="1" value={editing[key]} onChange={event => setEditing({ ...editing, [key]: event.target.value })}/></label>)}
      <label className="wide">Catatan<textarea rows="3" value={editing.notes} onChange={event => setEditing({ ...editing, notes: event.target.value })} placeholder="Opsional" /></label>
    </div><footer><button type="button" className="secondary" onClick={() => setEditing(null)}>Batal</button><button disabled={saving}>{saving ? "Menyimpan…" : "Simpan Biaya"}</button></footer></form></div>}
  </main>;
}
