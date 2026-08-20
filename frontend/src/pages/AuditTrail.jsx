import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { FiChevronLeft, FiChevronRight, FiSearch, FiShield } from "react-icons/fi";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import "./AuditTrail.css";

const actionLabel = { CREATE: "Tambah", UPDATE: "Ubah", DELETE: "Hapus", LOGIN: "Login", LOGOUT: "Logout", REGISTER: "Daftar" };

function resolvedAction(log) {
  if (log.path === "/auth/login") return "LOGIN";
  if (log.path === "/auth/logout") return "LOGOUT";
  if (log.path === "/auth/register") return "REGISTER";
  return log.action;
}

function actorLabel(log) {
  return log.actorName || log.actorEmail || log.changes?.email || "Sistem/Publik";
}

function resourceLabel(log) {
  return log.path?.startsWith("/auth/") ? "auth" : log.resource;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}

export default function AuditTrail() {
  const { user } = useAuth();
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 50, resources: [] });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [resource, setResource] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "OWNER") return;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({ page: String(page), pageSize: "50" });
        if (q.trim()) params.set("q", q.trim());
        if (resource) params.set("resource", resource);
        if (action) params.set("action", action);
        if (dateFrom) params.set("from", new Date(`${dateFrom}T00:00:00`).toISOString());
        if (dateTo) params.set("to", new Date(`${dateTo}T23:59:59.999`).toISOString());
        setData(await api(`/audit?${params}`));
      } catch (err) {
        setError(err.message || "Gagal memuat audit trail");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [user?.role, page, q, resource, action, dateFrom, dateTo]);

  if (user?.role !== "OWNER") return <Navigate to="/dashboard" replace />;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return <div className="audit-page">
    <header className="audit-heading"><div className="audit-icon"><FiShield /></div><div><h1>Audit Trail</h1><p>Riwayat perubahan sistem. Hanya dapat dilihat oleh Owner.</p></div></header>
    <section className="audit-filters">
      <label className="audit-search"><FiSearch/><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Cari user, endpoint, atau ID data" /></label>
      <select value={resource} onChange={(e) => { setResource(e.target.value); setPage(1); }}><option value="">Semua modul</option>{data.resources.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}><option value="">Semua aksi</option>{["CREATE","UPDATE","DELETE","LOGIN","LOGOUT","REGISTER"].map((item) => <option key={item} value={item}>{actionLabel[item]}</option>)}</select>
      <label className="audit-date"><span>Dari tanggal</span><span className={`date-placeholder-wrap ${dateFrom ? "has-value" : ""}`} data-placeholder="Pilih tanggal awal"><input className="tablet-date-input" aria-label="Tanggal awal audit" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} /></span></label>
      <label className="audit-date"><span>Sampai tanggal</span><span className={`date-placeholder-wrap ${dateTo ? "has-value" : ""}`} data-placeholder="Pilih tanggal akhir"><input className="tablet-date-input" aria-label="Tanggal akhir audit" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} /></span></label>
      {(dateFrom || dateTo) && <button className="audit-reset" type="button" onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}>Hapus filter tanggal</button>}
    </section>
    {error && <div className="audit-error">{error}</div>}
    <section className="audit-table-wrap"><table className="audit-table"><thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Modul</th><th>Target</th><th>Status</th></tr></thead><tbody>
      {!loading && !data.items.length && <tr><td colSpan="6" className="audit-empty">Belum ada riwayat audit.</td></tr>}
      {data.items.map((log) => { const displayAction = resolvedAction(log); return <tr key={log.id} onClick={() => setSelected(log)}><td>{formatDate(log.createdAt)}</td><td><strong>{actorLabel(log)}</strong><small>{log.actorRole || "—"}</small></td><td><span className={`audit-action ${displayAction.toLowerCase()}`}>{actionLabel[displayAction] || displayAction}</span></td><td>{resourceLabel(log)}</td><td><code>{log.entityId || log.path}</code></td><td>{log.statusCode}</td></tr>; })}
    </tbody></table></section>
    <footer className="audit-pagination"><span>{data.total} aktivitas</span><div><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><FiChevronLeft/></button><span>Halaman {page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}><FiChevronRight/></button></div></footer>
    {selected && <div className="audit-overlay" onMouseDown={() => setSelected(null)}><article className="audit-detail" onMouseDown={(e) => e.stopPropagation()}><header><div><small>DETAIL AKTIVITAS</small><h2>{actionLabel[resolvedAction(selected)] || resolvedAction(selected)} · {resourceLabel(selected)}</h2></div><button onClick={() => setSelected(null)}>×</button></header><dl><div><dt>Waktu</dt><dd>{formatDate(selected.createdAt)}</dd></div><div><dt>User</dt><dd>{actorLabel(selected)}</dd></div><div><dt>Endpoint</dt><dd>{selected.method} {selected.path}</dd></div><div><dt>IP</dt><dd>{selected.ipAddress || "—"}</dd></div></dl><h3>Ringkasan perubahan</h3><pre>{JSON.stringify(selected.changes, null, 2)}</pre></article></div>}
  </div>;
}
