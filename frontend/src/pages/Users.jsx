import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

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

  const take = 50;
  const [page, setPage] = useState(0); // 0-based

  const [hoverSelect, setHoverSelect] = useState(false);
  const [focusSelect, setFocusSelect] = useState(false);

  const skip = useMemo(() => page * take, [page]);

  async function updateStatus(userId, status) {
    try {
      await api(`/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setItems((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, status } : u
        )
      );
    } catch (e) {
      alert("Failed to update status");
    }
  }


  async function load() {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (roleFilter) params.set("role", roleFilter);
      params.set("skip", String(skip));
      params.set("take", String(take));

      const data = await api(`/users?${params.toString()}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setErr(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!allowed) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  function onSearch(e) {
    e.preventDefault();
    setPage(0);
    load();
  }

  if (!allowed) {
    return (
      <div style={s.page}>
        <div style={s.headerRow}>
          <div>
            <div style={s.hTitle}>Users</div>
            <div style={s.hSub}>You don’t have permission to view this page.</div>
          </div>
        </div>
        <div style={s.card}>
          <div style={s.alertErr}>Forbidden</div>
        </div>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / take));

  return (
    <div style={s.page}>
      <div style={s.headerRow}>
        <div>
          <div style={s.hTitle}>Users</div>
          <div style={s.hSub}>All accounts in the system (excluding owners)</div>
        </div>
        <div style={s.pill}>{total} total</div>
      </div>

      <div style={s.card}>
        <div style={s.toolbar}>
          <form onSubmit={onSearch} style={s.searchRow}>
            <input
              style={s.input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name…"
            />

            {/* ✅ prettier dropdown */}
            <div
              style={s.selectWrap}
              onMouseEnter={() => setHoverSelect(true)}
              onMouseLeave={() => setHoverSelect(false)}
            >
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                onFocus={() => setFocusSelect(true)}
                onBlur={() => setFocusSelect(false)}
                style={{
                  ...s.select,
                  ...(hoverSelect ? s.selectHover : {}),
                  ...(focusSelect ? s.selectFocus : {}),
                }}
              >
                <option value="">All roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="STAFF">STAFF</option>
                <option value="DRIVER">DRIVER</option>
              </select>

              <div style={s.selectArrow}>▾</div>
            </div>

            <button
              disabled={loading}
              style={{ ...s.primaryBtn, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Loading…" : "Search"}
            </button>
          </form>

          <div style={s.rightNote}>
            Showing {items.length} of {total}
          </div>
        </div>

        {err ? <div style={s.alertErr}>{err}</div> : null}

        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Name</th>
                <th style={s.th}>Email</th>
                <th style={s.th}>Role</th>
                <th style={s.th}>Phone</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} style={s.tr}>
                  <td style={s.tdStrong}>
                    <div style={s.nameRow}>
                      <div style={s.avatar}>
                        {(u.name || u.email || "U").slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
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
                    <div style={s.statusWrap}>
                      <select
                        value={u.status}
                        onChange={(e) => updateStatus(u.id, e.target.value)}
                        style={{
                          ...s.statusSelect,
                          ...statusVariant(u.status),
                        }}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="BREAK">BREAK</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                      <div style={s.statusArrow}>▾</div>
                    </div>
                  </td>


                  <td style={s.td}>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}

              {!loading && items.length === 0 ? (
                <tr>
                  <td style={s.empty} colSpan={6}>
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={s.footer}>
          <button
            style={s.secondaryBtn}
            disabled={loading || page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </button>

          <div style={s.pageInfo}>
            Page <b>{page + 1}</b> of <b>{pageCount}</b>
          </div>

          <button
            style={s.secondaryBtn}
            disabled={loading || page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function rolePill(role) {
  const base = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(6,95,70,0.10)",
  };

  if (role === "ADMIN")
    return {
      ...base,
      background: "rgba(59,130,246,0.12)",
      color: "#1d4ed8",
      border: "1px solid rgba(59,130,246,0.18)",
    };

  if (role === "STAFF")
    return {
      ...base,
      background: "rgba(245,158,11,0.12)",
      color: "#92400e",
      border: "1px solid rgba(245,158,11,0.20)",
    };

  return {
    ...base,
    background: "rgba(107,114,128,0.12)",
    color: "#374151",
    border: "1px solid rgba(107,114,128,0.20)",
  };
}

const statusSelect = (status) => ({
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 1000,
  border: "1px solid rgba(6,95,70,0.18)",
  cursor: "pointer",
  background:
    status === "ACTIVE"
      ? "rgba(34,197,94,0.15)"
      : status === "BREAK"
      ? "rgba(245,158,11,0.15)"
      : "rgba(239,68,68,0.15)",
  color:
    status === "ACTIVE"
      ? "#065f46"
      : status === "BREAK"
      ? "#92400e"
      : "#991b1b",
});

function statusVariant(status) {
  if (status === "ACTIVE") {
    return {
      background: "rgba(34,197,94,0.12)",
      color: "#065f46",
      border: "1px solid rgba(34,197,94,0.22)",
    };
  }
  if (status === "BREAK") {
    return {
      background: "rgba(245,158,11,0.12)",
      color: "#92400e",
      border: "1px solid rgba(245,158,11,0.22)",
    };
  }
  return {
    background: "rgba(239,68,68,0.10)",
    color: "rgba(153,27,27,0.95)",
    border: "1px solid rgba(239,68,68,0.22)",
  };
}


const s = {
  page: { padding: 6 },
  headerRow: {
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  hTitle: { fontWeight: 1000, fontSize: 18, color: "#053a2f" },
  hSub: { marginTop: 4, fontSize: 12, color: "rgba(4,120,87,0.85)", fontWeight: 700 },
  pill: {
    fontSize: 12,
    fontWeight: 900,
    padding: "7px 10px",
    borderRadius: 999,
    background: "#fff",
    border: "1px solid rgba(6,95,70,0.10)",
    color: "#065f46",
  },

  card: {
    borderRadius: 18,
    background: "linear-gradient(180deg, #fff 0%, #fbfffd 100%)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
    border: "1px solid rgba(6,95,70,0.08)",
    padding: 18,
    minWidth: 0,
  },

  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  searchRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  rightNote: { fontSize: 12, fontWeight: 800, color: "rgba(4,120,87,0.75)" },

  input: {
    width: 280,
    borderRadius: 14,
    border: "1px solid rgba(6,95,70,0.12)",
    background: "white",
    padding: "11px 12px",
    outline: "none",
    fontWeight: 800,
    color: "#053a2f",
    boxSizing: "border-box",
  },

  // ✅ NEW dropdown styles
  selectWrap: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  },
  select: {
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",

    borderRadius: 999,
    border: "1px solid rgba(6,95,70,0.18)",
    background: "linear-gradient(180deg, #ffffff 0%, #f6fffb 100%)",
    padding: "10px 44px 10px 16px",

    fontSize: 13,
    fontWeight: 1000,
    color: "#053a2f",

    cursor: "pointer",
    outline: "none",
    boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
    transition: "all 0.15s ease",
  },
  selectHover: {
    boxShadow: "0 14px 28px rgba(34,197,94,0.18)",
    border: "1px solid rgba(34,197,94,0.26)",
    transform: "translateY(-1px)",
  },
  selectFocus: {
    boxShadow: "0 0 0 3px rgba(34,197,94,0.16), 0 14px 28px rgba(0,0,0,0.08)",
    border: "1px solid rgba(34,197,94,0.32)",
  },
  selectArrow: {
    position: "absolute",
    right: 16,
    pointerEvents: "none",
    fontSize: 12,
    fontWeight: 1000,
    color: "rgba(4,120,87,0.9)",
  },

  primaryBtn: {
    border: "none",
    borderRadius: 14,
    padding: "11px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    color: "white",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    boxShadow: "0 14px 30px rgba(34,197,94,0.22)",
  },
  secondaryBtn: {
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    color: "#065f46",
    background: "rgba(34,197,94,0.10)",
    border: "1px solid rgba(34,197,94,0.18)",
  },

  alertErr: {
    marginTop: 12,
    borderRadius: 14,
    border: "1px solid rgba(239,68,68,0.28)",
    background: "rgba(239,68,68,0.10)",
    color: "rgba(153,27,27,0.95)",
    padding: "10px 12px",
    fontWeight: 800,
    fontSize: 12,
  },

  tableWrap: {
    marginTop: 14,
    overflowX: "auto",
    borderRadius: 14,
    border: "1px solid rgba(6,95,70,0.08)",
  },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 900 },
  th: {
    textAlign: "left",
    fontSize: 12,
    letterSpacing: 0.3,
    fontWeight: 1000,
    color: "rgba(4,120,87,0.75)",
    padding: "12px 12px",
    background: "rgba(6,95,70,0.03)",
    borderBottom: "1px solid rgba(6,95,70,0.08)",
  },
  tr: { background: "white" },
  td: {
    padding: "12px 12px",
    fontSize: 13,
    fontWeight: 800,
    color: "#053a2f",
    borderBottom: "1px solid rgba(6,95,70,0.06)",
    verticalAlign: "middle",
  },
  tdStrong: {
    padding: "12px 12px",
    borderBottom: "1px solid rgba(6,95,70,0.06)",
    verticalAlign: "middle",
  },

  nameRow: { display: "flex", alignItems: "center", gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    color: "#065f46",
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.16)",
  },
  nameText: { fontWeight: 1000, color: "#053a2f", fontSize: 13 },
  idText: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(4,120,87,0.65)",
    maxWidth: 240,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  activeYes: { fontSize: 12, fontWeight: 1000, color: "#065f46" },
  activeNo: { fontSize: 12, fontWeight: 1000, color: "rgba(153,27,27,0.95)" },

  empty: { padding: 18, textAlign: "center", color: "rgba(4,120,87,0.75)", fontWeight: 900 },

  footer: {
    marginTop: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  pageInfo: { fontSize: 12, fontWeight: 900, color: "rgba(4,120,87,0.75)" },

  statusWrap: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  },

  statusSelect: {
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",

    borderRadius: 999,
    border: "1px solid rgba(6,95,70,0.16)",
    padding: "7px 34px 7px 12px", // right padding for arrow
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: 0.4,

    outline: "none",
    cursor: "pointer",
    backgroundImage: "none", // ✅ important for Safari
    boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
    transition: "transform 0.12s ease, box-shadow 0.12s ease, border 0.12s ease",
  },

  statusArrow: {
    position: "absolute",
    right: 12,
    pointerEvents: "none",
    fontSize: 11,
    fontWeight: 1000,
    color: "rgba(4,120,87,0.85)",
  },

  
};
