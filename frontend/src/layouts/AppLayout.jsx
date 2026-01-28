import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const [hoverLogout, setHoverLogout] = useState(false);
  const [hoverUserCard, setHoverUserCard] = useState(false);

  const role = user?.role || "UNKNOWN";
  const isOwnerAdmin = role === "OWNER" || role === "ADMIN";
  const isStaff = role === "STAFF";
  const canManageDrivers = isOwnerAdmin || isStaff;
  const isDriver = role === "DRIVER";

  const menu = isDriver
    ? [
        { to: "/driver/jobs", label: "My Jobs" },
      ]
    : [
        { to: "/dashboard", label: "Dashboard" },
        ...(isOwnerAdmin ? [{ to: "/users", label: "Users" }] : []),

        // ✅ STAFF / ADMIN / OWNER can create drivers
        ...(canManageDrivers ? [{ to: "/drivers/new", label: "Create Driver" }] : []),

        { to: "/trucks", label: "Trucks" },
        { to: "/inventory", label: "Inventory" },
        { to: "/maintenance", label: "Maintenance" },
        { to: "/orders", label: "Orders" },
      ];

  return (
    <div style={s.page}>
      <aside style={s.sidebar}>
        <div style={s.brand}>
          <div style={s.logo}>CMS</div>
          <div style={{ minWidth: 0 }}>
            <div style={s.brandTitle}>Mitra Setia</div>
            <div style={s.brandSub}>Transport & Operations</div>
          </div>
        </div>

        {/* ✅ CLICKABLE USER CARD -> /profile */}
        <div
          style={{
            ...s.userCard,
            cursor: "pointer",
            transform: hoverUserCard ? "translateY(-1px)" : "translateY(0)",
            boxShadow: hoverUserCard
              ? "0 16px 36px rgba(0,0,0,0.10)"
              : s.userCard.boxShadow,
            border: hoverUserCard
              ? "1px solid rgba(34,197,94,0.25)"
              : s.userCard.border,
            transition: "all 0.18s ease",
          }}
          onMouseEnter={() => setHoverUserCard(true)}
          onMouseLeave={() => setHoverUserCard(false)}
          onClick={() => nav("/profile")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") nav("/profile");
          }}
          title="Edit profile"
        >
          <div style={s.userRow}>
            <div style={s.avatar}>
              {(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={s.userName}>{user?.name || "User"}</div>
              <div style={s.userEmail}>{user?.email || "-"}</div>
            </div>
          </div>
        </div>

        <div style={s.menuLabel}>MENU</div>
        <nav style={s.nav}>
          {menu.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              style={({ isActive }) => ({
                ...s.navItem,
                ...(isActive ? s.navActive : {}),
              })}
            >
              {m.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: "auto" }}>
          <button
            onClick={async () => {
              await logout();
              nav("/", { replace: true });
            }}
            onMouseEnter={() => setHoverLogout(true)}
            onMouseLeave={() => setHoverLogout(false)}
            style={{
              ...s.logoutBtn,
              background: hoverLogout
                ? "linear-gradient(135deg, #34d399, #22c55e)"
                : "linear-gradient(135deg, #22c55e, #16a34a)",
              transform: hoverLogout ? "translateY(-1px)" : "translateY(0)",
            }}
          >
            Logout
          </button>
          <div style={s.sidebarFootNote}>v0.1 • Local</div>
        </div>
      </aside>

      <main style={s.main}>
        <header style={s.topbar}>
          <div style={{ minWidth: 0 }}>
            <div style={s.topTitle}>Operation</div>
            <div style={s.topSub}>Mitra Setia ERP • Company operation management</div>
          </div>

          <div style={s.topRight}>
            <span style={s.topRole}>{role}</span>
          </div>
        </header>

        <div style={s.contentOuter}>
          <div style={s.contentInner}>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    background: "#f3fbf6",
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,Helvetica,Arial,sans-serif',
    color: "#064e3b",
    overflowX: "hidden",
  },

  sidebar: {
    background: "#ffffff",
    borderRight: "1px solid rgba(6,95,70,0.08)",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxSizing: "border-box",
  },

  brand: { display: "flex", alignItems: "center", gap: 12 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    color: "white",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    boxShadow: "0 10px 18px rgba(34,197,94,0.20)",
    userSelect: "none",
  },
  brandTitle: { fontWeight: 900, fontSize: 15, lineHeight: 1.1, color: "#053a2f" },
  brandSub: { fontSize: 12, color: "rgba(4,120,87,0.8)", marginTop: 2 },

  userCard: {
    marginTop: 6,
    padding: 14,
    borderRadius: 18,
    background: "linear-gradient(180deg, #ffffff 0%, #fbfffd 100%)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
    border: "1px solid rgba(6,95,70,0.08)",
  },
  userRow: { display: "flex", alignItems: "center", gap: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    color: "#065f46",
    background: "rgba(34,197,94,0.12)",
  },
  userName: { fontWeight: 900, fontSize: 13, color: "#053a2f" },
  userEmail: {
    fontSize: 12,
    color: "rgba(4,120,87,0.9)",
    marginTop: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 190,
  },
  profileHint: {
    marginTop: 6,
    fontSize: 11,
    color: "rgba(4,120,87,0.65)",
    fontWeight: 800,
  },

  menuLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1,
    color: "rgba(4,120,87,0.75)",
    marginTop: 4,
    paddingLeft: 6,
  },
  nav: { display: "flex", flexDirection: "column", gap: 4, marginTop: 6 },
  navItem: {
    textDecoration: "none",
    color: "#0f3d2f",
    fontWeight: 800,
    fontSize: 13,
    padding: "10px 12px",
    borderRadius: 14,
    transition: "all 0.15s ease",
  },
  navActive: {
    background: "rgba(34,197,94,0.14)",
    color: "#065f46",
  },

  logoutBtn: {
    width: "100%",
    border: "none",
    color: "white",
    fontWeight: 900,
    fontSize: 13,
    padding: "12px 12px",
    borderRadius: 14,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(34,197,94,0.22)",
    transition: "all 0.2s ease",
  },
  sidebarFootNote: {
    marginTop: 10,
    fontSize: 11,
    color: "rgba(4,120,87,0.7)",
    textAlign: "center",
  },

  main: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },

  topbar: {
    padding: "18px 22px",
    background: "rgba(255,255,255,0.85)",
    borderBottom: "1px solid rgba(6,95,70,0.08)",
    backdropFilter: "blur(8px)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxSizing: "border-box",
  },
  topTitle: { fontWeight: 1000, fontSize: 18, color: "#053a2f" },
  topSub: { marginTop: 4, fontSize: 12, color: "rgba(4,120,87,0.85)" },
  topRight: { display: "flex", alignItems: "center", gap: 10 },
  topRole: {
    fontSize: 12,
    fontWeight: 900,
    padding: "7px 10px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid rgba(6,95,70,0.10)",
    color: "#065f46",
  },

  contentOuter: {
    width: "100%",
    boxSizing: "border-box",
    padding: 22,
  },
  contentInner: {
    maxWidth: 1100,
    margin: "0 auto",
    minWidth: 0,
  },
};
