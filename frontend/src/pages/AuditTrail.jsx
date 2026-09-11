import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { FiActivity, FiAlertTriangle, FiChevronLeft, FiChevronRight, FiClock, FiCopy, FiFilter, FiSearch, FiShield, FiUser, FiX } from "react-icons/fi";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import LoadingState from "../components/LoadingState";
import "./AuditTrail.css";

const actionLabel = { CREATE: "Tambah", UPDATE: "Ubah", DELETE: "Hapus", LOGIN: "Login", LOGOUT: "Logout", REGISTER: "Daftar" };
const resourceNames = { auth: "Autentikasi", trips: "Perjalanan", orders: "Pesanan", trucks: "Armada", expenses: "Pengeluaran", inventory: "Inventory", purchases: "Pembelian", receivables: "Piutang", users: "Pengguna", maintenance: "Servis" };

function resolvedAction(log) {
  if (log.path === "/auth/login") return "LOGIN";
  if (log.path === "/auth/logout") return "LOGOUT";
  if (log.path === "/auth/register") return "REGISTER";
  return log.action;
}

function actorLabel(log) { return log.actorName || log.actorEmail || log.changes?.email || "Sistem/Publik"; }
function resourceKey(log) { return log.path?.startsWith("/auth/") ? "auth" : log.resource; }
function resourceLabel(log) { const key = resourceKey(log); return resourceNames[key] || key || "Sistem"; }
function formatDate(value) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value)); }
function shortDate(value) {
  const date = new Date(value);
  return { date: new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date), time: new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(date) };
}
function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  return String(value);
}

export default function AuditTrail() {
  const { user } = useAuth();
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 50, resources: [], summary: { today: 0, actors: 0, deletes: 0, byAction: {} } });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [resource, setResource] = useState("");
  const [action, setAction] = useState("");
  const [actorRole, setActorRole] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (user?.role !== "OWNER") return;
    const timer = setTimeout(async () => {
      try {
        setLoading(true); setError("");
        const params = new URLSearchParams({ page: String(page), pageSize: "50" });
        if (q.trim()) params.set("q", q.trim());
        if (resource) params.set("resource", resource);
        if (action) params.set("action", action);
        if (actorRole) params.set("actorRole", actorRole);
        if (dateFrom) params.set("from", new Date(`${dateFrom}T00:00:00`).toISOString());
        if (dateTo) params.set("to", new Date(`${dateTo}T23:59:59.999`).toISOString());
        setData(await api(`/audit?${params}`));
      } catch (err) { setError(err.message || "Gagal memuat audit trail"); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [user?.role, page, q, resource, action, actorRole, dateFrom, dateTo]);

  const activeFilters = useMemo(() => [q, resource, action, actorRole, dateFrom, dateTo].filter(Boolean).length, [q, resource, action, actorRole, dateFrom, dateTo]);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  if (user?.role !== "OWNER") return <Navigate to="/dashboard" replace />;

  function resetFilters() { setQ(""); setResource(""); setAction(""); setActorRole(""); setDateFrom(""); setDateTo(""); setPage(1); }
  function setRange(days) {
    const end = new Date(); const start = new Date(); start.setDate(end.getDate() - (days - 1));
    setDateFrom(start.toISOString().slice(0, 10)); setDateTo(end.toISOString().slice(0, 10)); setPage(1);
  }
  async function copyText(value, key) {
    await navigator.clipboard.writeText(value || ""); setCopied(key); window.setTimeout(() => setCopied(""), 1400);
  }

  return <div className="audit-page">
    <header className="audit-hero">
      <div><span className="audit-kicker">ADMINISTRASI & KEAMANAN</span><h1>Audit Trail</h1><p>Telusuri siapa yang melakukan perubahan, kapan terjadi, dan data apa yang terpengaruh.</p></div>
      <div className="audit-hero-badge"><FiShield/><span><strong>Owner only</strong><small>Catatan tidak dapat diubah</small></span></div>
    </header>

    <section className="audit-summary">
      <article><span className="audit-summary-icon total"><FiActivity/></span><div><small>Aktivitas ditemukan</small><strong>{data.total}</strong><p>Sesuai filter aktif</p></div></article>
      <article><span className="audit-summary-icon today"><FiClock/></span><div><small>Aktivitas hari ini</small><strong>{data.summary?.today || 0}</strong><p>Pembaruan terbaru</p></div></article>
      <article><span className="audit-summary-icon actor"><FiUser/></span><div><small>Aktor terlibat</small><strong>{data.summary?.actors || 0}</strong><p>User atau sistem</p></div></article>
      <article><span className="audit-summary-icon danger"><FiAlertTriangle/></span><div><small>Penghapusan</small><strong>{data.summary?.deletes || 0}</strong><p>Perlu perhatian</p></div></article>
    </section>

    <section className="audit-workspace">
      <div className="audit-workspace-head"><div><span className="audit-kicker">LOG AKTIVITAS</span><h2>Riwayat perubahan sistem</h2></div></div>
      <section className="audit-filters">
        <label className="audit-search"><FiSearch/><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Cari nama, email, endpoint, atau ID data..." /></label>
        <select aria-label="Filter modul" value={resource} onChange={(e) => { setResource(e.target.value); setPage(1); }}><option value="">Semua modul</option>{data.resources.map((item) => <option key={item} value={item}>{resourceNames[item] || item}</option>)}</select>
        <select aria-label="Filter aksi" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}><option value="">Semua aksi</option>{["CREATE","UPDATE","DELETE","LOGIN","LOGOUT","REGISTER"].map((item) => <option key={item} value={item}>{actionLabel[item]}</option>)}</select>
        <select aria-label="Filter peran" value={actorRole} onChange={(e) => { setActorRole(e.target.value); setPage(1); }}><option value="">Semua peran</option><option value="OWNER">Owner</option><option value="ADMIN">Admin</option><option value="STAFF">Staff</option><option value="DRIVER">Pengemudi</option></select>
        <div className="audit-period"><span>Periode cepat</span><div className="audit-quick-ranges"><button type="button" onClick={() => setRange(1)}>Hari ini</button><button type="button" onClick={() => setRange(7)}>7 hari</button><button type="button" onClick={() => setRange(30)}>30 hari</button></div></div>
        <label className="audit-date"><span>Dari</span><span className={`audit-date-control ${dateFrom ? "has-value" : ""}`} data-placeholder="Pilih tanggal"><input aria-label="Tanggal awal audit" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} /></span></label>
        <label className="audit-date"><span>Sampai</span><span className={`audit-date-control ${dateTo ? "has-value" : ""}`} data-placeholder="Pilih tanggal"><input aria-label="Tanggal akhir audit" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} /></span></label>
      </section>
      <div className="audit-filter-footer"><span><FiFilter/> {activeFilters ? `${activeFilters} filter aktif` : "Menampilkan seluruh aktivitas"}</span>{activeFilters > 0 && <button type="button" onClick={resetFilters}>Reset semua filter</button>}</div>
      {error && <div className="audit-error">{error}</div>}
      <section className="audit-table-wrap">{loading && !data.items.length && <LoadingState label="Memuat audit trail" note="Mengambil aktivitas dan perubahan sistem…" rows={6} />}<table className="audit-table"><thead><tr><th>Waktu</th><th>Aktor</th><th>Aktivitas</th><th>Modul & target</th><th>Endpoint</th><th>Respons</th></tr></thead><tbody>
        {!loading && !data.items.length && <tr><td colSpan="6" className="audit-empty"><FiSearch/><strong>Tidak ada aktivitas ditemukan</strong><span>Coba ubah kata kunci atau reset filter.</span></td></tr>}
        {data.items.map((log) => { const displayAction = resolvedAction(log); const time = shortDate(log.createdAt); return <tr key={log.id} onClick={() => setSelected(log)}><td><strong className="audit-time-date">{time.date}</strong><small>{time.time}</small></td><td><strong>{actorLabel(log)}</strong><small>{log.actorRole || "Sistem"}</small></td><td><span className={`audit-action ${displayAction.toLowerCase()}`}>{actionLabel[displayAction] || displayAction}</span></td><td><strong>{resourceLabel(log)}</strong><small className="audit-entity">{log.entityId || "Tanpa ID target"}</small></td><td><code>{log.method} {log.path}</code></td><td><span className="audit-response">{log.statusCode}</span><small>Berhasil</small></td></tr>; })}
      </tbody></table></section>
      <footer className="audit-pagination"><span>Menampilkan {data.items.length} dari {data.total} aktivitas</span><div><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><FiChevronLeft/></button><span>Halaman <strong>{page}</strong> dari {pages}</span><button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}><FiChevronRight/></button></div></footer>
    </section>

    {selected && <div className="audit-overlay" onMouseDown={() => setSelected(null)}><article className="audit-detail" onMouseDown={(e) => e.stopPropagation()}>
      <header><div><small>DETAIL AKTIVITAS</small><h2>{actionLabel[resolvedAction(selected)] || resolvedAction(selected)} {resourceLabel(selected)}</h2><p>{formatDate(selected.createdAt)}</p></div><button onClick={() => setSelected(null)} aria-label="Tutup"><FiX/></button></header>
      <div className="audit-detail-summary"><div><span>Aktor</span><strong>{actorLabel(selected)}</strong><small>{selected.actorRole || "Sistem"}</small></div><div><span>Target</span><strong>{selected.entityId || "Tanpa ID"}</strong><small>{resourceLabel(selected)}</small></div><div><span>Respons</span><strong>{selected.statusCode}</strong><small>Berhasil diproses</small></div></div>
      <section className="audit-request"><div><span>Endpoint</span><code>{selected.method} {selected.path}</code></div><button onClick={() => copyText(`${selected.method} ${selected.path}`, "endpoint")}><FiCopy/>{copied === "endpoint" ? "Tersalin" : "Salin"}</button></section>
      <section className="audit-technical"><div><span>Alamat IP</span><strong>{selected.ipAddress || "—"}</strong></div><div><span>Perangkat</span><strong>{selected.userAgent || "—"}</strong></div></section>
      <div className="audit-change-head"><div><h3>Data yang dikirim</h3><p>Nilai sensitif otomatis disamarkan oleh sistem.</p></div><button onClick={() => copyText(JSON.stringify(selected.changes, null, 2), "changes")}><FiCopy/>{copied === "changes" ? "Tersalin" : "Salin data"}</button></div>
      <div className="audit-changes">{Object.entries(selected.changes || {}).length ? Object.entries(selected.changes || {}).map(([key, value]) => <div key={key}><span>{key}</span><pre>{displayValue(value)}</pre></div>) : <div className="audit-no-change">Tidak ada rincian data pada aktivitas ini.</div>}</div>
    </article></div>}
  </div>;
}
