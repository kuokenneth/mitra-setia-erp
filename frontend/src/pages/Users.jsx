// src/pages/Users.jsx
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

  const take = 20;
  const [page, setPage] = useState(0); // 0-based

  const [hoverSelect, setHoverSelect] = useState(false);
  const [focusSelect, setFocusSelect] = useState(false);

  const skip = useMemo(() => page * take, [page]);

  // ✅ responsive flag
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

  // ✅ styles that depend on isMobile must be inside component
  const s = useMemo(() => makeStyles(isMobile), [isMobile]);

  async function updateStatus(userId, status) {
    try {
      await api(`/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setItems((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)));
    } catch (e) {
      alert("Failed to update status");
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
        // Fetch all pages for a global, case-insensitive search
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
      setErr(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!allowed) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, roleFilter]);

  useEffect(() => {
    if (!allowed) return;
    const t = setTimeout(() => {
      setPage(0);
      load();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

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
          <div style={s.searchRow}>
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

          </div>

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
  const BRAND = {
    green: "#4BCA74",
    greenSoft: "rgba(75,202,116,0.15)",
  };

  const base = {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: `1px solid ${BRAND.green}40`,
  };

  if (role === "ADMIN")
    return {
      ...base,
      background: "rgba(59,130,246,0.12)",
      color: "#1d4ed8",
      border: "1px solid rgba(59,130,246,0.3)",
    };

  if (role === "STAFF")
    return {
      ...base,
      background: "rgba(245,158,11,0.12)",
      color: "#92400e",
      border: "1px solid rgba(245,158,11,0.3)",
    };

  return {
    ...base,
    background: BRAND.greenSoft,
    color: BRAND.green,
    border: `1px solid ${BRAND.green}40`,
  };
}

function statusVariant(status) {
  const BRAND = {
    green: "#4BCA74",
    greenSoft: "rgba(75,202,116,0.15)",
  };

  if (status === "ACTIVE") {
    return {
      background: BRAND.greenSoft,
      color: BRAND.green,
      border: `1px solid ${BRAND.green}40`,
    };
  }
  if (status === "BREAK") {
    return {
      background: "rgba(245,158,11,0.12)",
      color: "#92400e",
      border: "1px solid rgba(245,158,11,0.35)",
    };
  }
  return {
    background: "rgba(239,68,68,0.10)",
    color: "rgba(153,27,27,0.95)",
    border: "1px solid rgba(239,68,68,0.3)",
  };
}

// Modern color palette
const BRAND = {
  green: "#4BCA74",
  green2: "#3BB865",
  greenLight: "#5FD686",
  greenDark: "#2D9F56",
  greenSoft: "rgba(75,202,116,0.15)",
  ink: "#111827",
  ink2: "#1F2937",
};

function makeStyles(isMobile) {
  return {
    page: {
      padding: isMobile ? 0 : 8,
      paddingTop: isMobile ? 0 : 10,
    },

    headerRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: isMobile ? 12 : 20,
    },

    hTitle: { fontWeight: 800, fontSize: 28, color: BRAND.ink, letterSpacing: "-0.02em" },
    hSub: { marginTop: 6, fontSize: 15, color: BRAND.ink2, opacity: 0.8 },

    pill: {
      fontSize: 13,
      fontWeight: 700,
      padding: "8px 16px",
      borderRadius: 999,
      background: BRAND.greenSoft,
      border: `1px solid ${BRAND.green}40`,
      color: BRAND.green,
    },

    card: {
      borderRadius: 20,
      background: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      boxShadow: `0 8px 32px ${BRAND.green}15`,
      border: `1px solid ${BRAND.greenSoft}`,
      padding: isMobile ? 16 : 24,
      minWidth: 0,
    },

    toolbar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },
    searchRow: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" },
    rightNote: { fontSize: 13, fontWeight: 700, color: BRAND.ink2, opacity: 0.8 },

    input: {
      width: isMobile ? "100%" : 300,
      borderRadius: 12,
      border: `2px solid ${BRAND.greenSoft}`,
      background: "#ffffff",
      padding: "12px 16px",
      outline: "none",
      fontWeight: 600,
      fontSize: 15,
      color: BRAND.ink,
      boxSizing: "border-box",
      transition: "all 0.3s ease",
    },

    selectWrap: { position: "relative", display: "inline-flex", alignItems: "center" },
    select: {
      appearance: "none",
      WebkitAppearance: "none",
      MozAppearance: "none",
      borderRadius: 999,
      border: `2px solid ${BRAND.greenSoft}`,
      background: "#ffffff",
      padding: "10px 40px 10px 16px",
      fontSize: 14,
      fontWeight: 700,
      color: BRAND.ink,
      cursor: "pointer",
      outline: "none",
      boxShadow: `0 4px 12px ${BRAND.green}10`,
      transition: "all 0.3s ease",
    },
    selectHover: {
      boxShadow: `0 8px 20px ${BRAND.green}20`,
      border: `2px solid ${BRAND.green}60`,
      transform: "translateY(-1px)",
    },
    selectFocus: {
      boxShadow: `0 0 0 3px ${BRAND.greenSoft}, 0 8px 20px ${BRAND.green}20`,
      border: `2px solid ${BRAND.green}`,
    },
    selectArrow: {
      position: "absolute",
      right: 14,
      pointerEvents: "none",
      fontSize: 14,
      fontWeight: 800,
      color: BRAND.green,
    },

    primaryBtn: {
      border: "none",
      borderRadius: 12,
      padding: "12px 20px",
      fontWeight: 700,
      fontSize: 15,
      cursor: "pointer",
      color: "white",
      background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.green})`,
      boxShadow: `0 8px 20px ${BRAND.green}40`,
      transition: "all 0.3s ease",
    },

    secondaryBtn: {
      borderRadius: 12,
      padding: "10px 16px",
      fontWeight: 700,
      fontSize: 14,
      cursor: "pointer",
      color: BRAND.green,
      background: BRAND.greenSoft,
      border: `1px solid ${BRAND.green}40`,
      transition: "all 0.3s ease",
    },

    alertErr: {
      marginTop: 16,
      borderRadius: 14,
      border: "1px solid rgba(239,68,68,0.28)",
      background: "rgba(239,68,68,0.10)",
      color: "rgba(153,27,27,0.95)",
      padding: "12px 16px",
      fontWeight: 700,
      fontSize: 14,
    },

    tableWrap: {
      marginTop: 20,
      overflowX: "auto",
      borderRadius: 16,
      border: `1px solid ${BRAND.greenSoft}`,
    },

    table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 900 },

    th: {
      textAlign: "left",
      fontSize: 13,
      letterSpacing: 0.5,
      fontWeight: 800,
      color: BRAND.ink,
      padding: "14px 16px",
      background: BRAND.greenSoft,
      borderBottom: `1px solid ${BRAND.green}30`,
    },

    tr: { background: "white", transition: "all 0.2s ease" },

    td: {
      padding: "14px 16px",
      fontSize: 14,
      fontWeight: 600,
      color: BRAND.ink,
      borderBottom: `1px solid ${BRAND.greenSoft}`,
      verticalAlign: "middle",
    },

    tdStrong: {
      padding: "14px 16px",
      borderBottom: `1px solid ${BRAND.greenSoft}`,
      verticalAlign: "middle",
    },

    nameRow: { display: "flex", alignItems: "center", gap: 12 },

    avatar: {
      width: 40,
      height: 40,
      borderRadius: 12,
      display: "grid",
      placeItems: "center",
      fontWeight: 800,
      fontSize: 16,
      color: "#fff",
      background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.green})`,
      border: "none",
    },

    nameText: { fontWeight: 700, color: BRAND.ink, fontSize: 15 },

    idText: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: 600,
      color: BRAND.ink2,
      opacity: 0.7,
      maxWidth: 240,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },

    empty: {
      padding: 24,
      textAlign: "center",
      color: BRAND.ink2,
      fontWeight: 700,
      fontSize: 14,
    },

    footer: {
      marginTop: 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },

    pageInfo: { fontSize: 14, fontWeight: 700, color: BRAND.ink },

    statusWrap: { position: "relative", display: "inline-flex", alignItems: "center" },

    statusSelect: {
      appearance: "none",
      WebkitAppearance: "none",
      MozAppearance: "none",
      borderRadius: 999,
      border: `2px solid ${BRAND.greenSoft}`,
      padding: "8px 36px 8px 14px",
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 0.3,
      outline: "none",
      cursor: "pointer",
      backgroundImage: "none",
      boxShadow: `0 4px 12px ${BRAND.green}10`,
      transition: "all 0.2s ease",
    },

    statusArrow: {
      position: "absolute",
      right: 12,
      pointerEvents: "none",
      fontSize: 12,
      fontWeight: 800,
      color: BRAND.green,
    },
  };
}
