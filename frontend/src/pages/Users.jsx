// src/pages/Users.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import { FiSearch, FiChevronLeft, FiChevronRight } from "react-icons/fi";

// Corporate Green Color Palette (matching Landing Page)
const BRAND = {
  primary: "#0D7C3D",
  primaryDark: "#0A6331",
  primaryLight: "#10A050",
  secondary: "#F5F9F7",
  accent: "#D4E8DC",
  text: "#1A1A1A",
  textLight: "#4A4A4A",
  textMuted: "#6B7280",
  white: "#FFFFFF",
  border: "#E5E7EB",
  warning: "#F59E0B",
  warningBg: "#FFFBEB",
  success: "#10B981",
  successBg: "#ECFDF5",
  error: "#EF4444",
  errorBg: "#FEF2F2",
};

export default function Users() {
  const { user } = useAuth();
  const role = user?.role || "UNKNOWN";
  const allowed = role === "OWNER" || role === "ADMIN";

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const take = 20;
  const [page, setPage] = useState(0);

  const skip = useMemo(() => page * take, [page]);

  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia("(max-width: 900px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = () => setIsMobile(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  async function updateStatus(userId, status) {
    try {
      await api(`/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setItems((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)));
    } catch (e) {
      alert("Gagal memperbarui status");
    }
  }

  function matchesQuery(u, query) {
    if (!query) return true;
    const qn = query.trim().toLowerCase();
    if (!qn) return true;
    const name = (u?.name || "").toLowerCase();
    const email = (u?.email || "").toLowerCase();
    const phone = (u?.phone || "").toLowerCase();
    return name.includes(qn) || email.includes(qn) || phone.includes(qn);
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set("role", roleFilter);
      params.set("skip", String(skip));
      params.set("take", String(take));

      if (q.trim()) {
        const first = await api(`/users?${params.toString()}`);
        const totalCount = first.total || 0;
        const pages = Math.max(1, Math.ceil(totalCount / take));
        const rest = await Promise.all(
          Array.from({ length: pages - 1 }, (_, i) =>
            api(
              `/users?${new URLSearchParams({
                ...(roleFilter ? { role: roleFilter } : {}),
                skip: String((i + 1) * take),
                take: String(take),
              }).toString()}`
            )
          )
        );
        const allItems = [first, ...rest].flatMap((r) => r.items || []);
        const filtered = allItems.filter((u) => matchesQuery(u, q));
        setItems(filtered);
        setTotal(filtered.length);
      } else {
        const data = await api(`/users?${params.toString()}`);
        const rawItems = data.items || [];
        setItems(rawItems);
        setTotal(data.total || rawItems.length);
      }
    } catch (e) {
      setErr(e.message || "Gagal memuat users");
    } finally {
      setLoading(false);
    }
  }
  useLiveRefresh(load);

  useEffect(() => {
    if (!allowed) return;
    load();
  }, [skip, roleFilter]);

  useEffect(() => {
    if (!allowed) return;
    const t = setTimeout(() => {
      setPage(0);
      load();
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (!allowed) {
    return (
      <div data-testid="users-page">
        <div style={s.header}>
          <h1 style={s.title}>Pengguna</h1>
          <p style={s.subtitle}>Anda tidak memiliki izin untuk melihat halaman ini.</p>
        </div>
        <div style={s.card}>
          <div style={s.alertErr}>Akses Ditolak</div>
        </div>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / take));

  return (
    <div data-testid="users-page">
      {/* Header */}
      <div style={s.headerRow}>
        <div>
          <h1 style={s.title}>Pengguna</h1>
          <p style={s.subtitle}>Seluruh akun dalam sistem (kecuali pemilik)</p>
        </div>
        <span style={s.badge}>{total} total</span>
      </div>

      {/* Main Card */}
      <div style={s.card}>
        {/* Toolbar */}
        <div style={s.toolbar}>
          <div style={s.searchRow}>
            <div style={s.inputWrap}>
              <FiSearch size={16} color={BRAND.textMuted} style={{ marginRight: 8 }} />
              <input
                style={s.input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name…"
                data-testid="users-search-input"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={s.select}
              data-testid="users-role-filter"
            >
              <option value="">Semua peran</option>
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staf</option>
              <option value="DRIVER">Pengemudi</option>
            </select>
          </div>

          <div style={s.rightNote}>
            Showing {items.length} of {total}
          </div>
        </div>

        {err && <div style={s.alertErr}>{err}</div>}

        {/* Table */}
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Nama</th>
                <th style={s.th}>Email</th>
                <th style={s.th}>Peran</th>
                <th style={s.th}>Telepon</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} style={s.tr}>
                  <td style={s.td}>
                    <div style={s.nameRow}>
                      <div style={s.avatar}>
                        {(u.name || u.email || "U").slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div style={s.nameText}>{u.name || "-"}</div>
                        <div style={s.idText}>{u.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={s.td}>{u.email}</td>
                  <td style={s.td}>
                    <span style={rolePill(u.role)}>{u.role}</span>
                  </td>
                  <td style={s.td}>{u.phone || "-"}</td>
                  <td style={s.td}>
                    <select
                      value={u.status}
                      onChange={(e) => updateStatus(u.id, e.target.value)}
                      style={{ ...s.statusSelect, ...statusVariant(u.status) }}
                      data-testid={`status-select-${u.id}`}
                    >
                      <option value="ACTIVE">Aktif</option>
                      <option value="BREAK">Istirahat</option>
                      <option value="INACTIVE">Tidak Aktif</option>
                    </select>
                  </td>
                  <td style={s.td}>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}

              {!loading && items.length === 0 && (
                <tr>
                  <td style={s.empty} colSpan={6}>
                    Tidak ada users ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={s.footer}>
          <button
            style={{ ...s.paginationBtn, opacity: page <= 0 ? 0.5 : 1 }}
            disabled={loading || page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            data-testid="users-prev-btn"
          >
            <FiChevronLeft size={16} />
            Prev
          </button>

          <div style={s.pageInfo}>
            Halaman <strong>{page + 1}</strong> dari <strong>{pageCount}</strong>
          </div>

          <button
            style={{ ...s.paginationBtn, opacity: page + 1 >= pageCount ? 0.5 : 1 }}
            disabled={loading || page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            data-testid="users-next-btn"
          >
            Next
            <FiChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function rolePill(role) {
  const base = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  };

  if (role === "ADMIN")
    return { ...base, background: "#EFF6FF", color: "#1D4ED8" };
  if (role === "STAFF")
    return { ...base, background: BRAND.warningBg, color: BRAND.warning };
  return { ...base, background: BRAND.accent, color: BRAND.primary };
}

function statusVariant(status) {
  if (status === "ACTIVE") {
    return { background: BRAND.successBg, color: BRAND.success, borderColor: `${BRAND.success}40` };
  }
  if (status === "BREAK") {
    return { background: BRAND.warningBg, color: BRAND.warning, borderColor: `${BRAND.warning}40` };
  }
  return { background: BRAND.errorBg, color: BRAND.error, borderColor: `${BRAND.error}40` };
}

const s = {
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
    flexWrap: "wrap",
  },

  header: { marginBottom: 24 },
  title: { margin: 0, fontSize: 28, fontWeight: 700, color: BRAND.text },
  subtitle: { margin: "8px 0 0", fontSize: 14, color: BRAND.textMuted },

  badge: {
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 14px",
    borderRadius: 6,
    background: BRAND.accent,
    color: BRAND.primary,
  },

  card: {
    borderRadius: 8,
    background: BRAND.white,
    border: `1px solid ${BRAND.border}`,
    padding: 24,
  },

  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 20,
  },

  searchRow: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" },

  inputWrap: {
    display: "flex",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    background: BRAND.white,
  },

  input: {
    border: "none",
    outline: "none",
    fontSize: 14,
    fontWeight: 500,
    color: BRAND.text,
    width: 200,
    background: "transparent",
  },

  select: {
    padding: "10px 14px",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    background: BRAND.white,
    fontSize: 14,
    fontWeight: 500,
    color: BRAND.text,
    cursor: "pointer",
    outline: "none",
  },

  rightNote: { fontSize: 13, fontWeight: 500, color: BRAND.textMuted },

  alertErr: {
    marginBottom: 16,
    borderRadius: 6,
    border: `1px solid ${BRAND.error}30`,
    background: BRAND.errorBg,
    color: BRAND.error,
    padding: "12px 16px",
    fontWeight: 500,
    fontSize: 14,
  },

  tableWrap: {
    overflowX: "auto",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
  },

  table: { width: "100%", borderCollapse: "collapse", minWidth: 800 },

  th: {
    textAlign: "left",
    fontSize: 12,
    fontWeight: 600,
    color: BRAND.textMuted,
    padding: "12px 16px",
    background: BRAND.secondary,
    borderBottom: `1px solid ${BRAND.border}`,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  tr: { transition: "background 0.2s ease" },

  td: {
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: 500,
    color: BRAND.text,
    borderBottom: `1px solid ${BRAND.border}`,
    verticalAlign: "middle",
  },

  nameRow: { display: "flex", alignItems: "center", gap: 12 },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 6,
    display: "grid",
    placeItems: "center",
    fontWeight: 600,
    fontSize: 14,
    color: BRAND.white,
    background: BRAND.primary,
  },

  nameText: { fontWeight: 600, color: BRAND.text, fontSize: 14 },
  idText: {
    marginTop: 2,
    fontSize: 11,
    color: BRAND.textMuted,
    maxWidth: 180,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  statusSelect: {
    padding: "6px 12px",
    borderRadius: 4,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    outline: "none",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },

  empty: {
    padding: 32,
    textAlign: "center",
    color: BRAND.textMuted,
    fontWeight: 500,
  },

  footer: {
    marginTop: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },

  paginationBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    background: BRAND.white,
    fontSize: 13,
    fontWeight: 500,
    color: BRAND.textLight,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  pageInfo: { fontSize: 14, fontWeight: 500, color: BRAND.textLight },
};
