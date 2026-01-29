// src/layouts/AppLayout.jsx
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const [hoverLogout, setHoverLogout] = useState(false);
  const [hoverUserCard, setHoverUserCard] = useState(false);

  // ✅ Mobile drawer
  const [mobileOpen, setMobileOpen] = useState(false);

  // ✅ Detect mobile (reactive)
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

  // ✅ Desktop sidebar collapse/expand (persist)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("cms_sidebar_open");
      return saved == null ? true : saved === "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("cms_sidebar_open", sidebarOpen ? "1" : "0");
    } catch {}
  }, [sidebarOpen]);

  // ✅ When switching layout modes, close drawer
  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  const role = user?.role || "UNKNOWN";
  const isOwnerAdmin = role === "OWNER" || role === "ADMIN";
  const isStaff = role === "STAFF";
  const canManageDrivers = isOwnerAdmin || isStaff;
  const isDriver = role === "DRIVER";

  const menu = useMemo(() => {
    if (isDriver) return [{ to: "/driver/jobs", label: "My Jobs", icon: "🧾" }];

    return [
      { to: "/dashboard", label: "Dashboard", icon: "📊" },
      ...(isOwnerAdmin ? [{ to: "/users", label: "Users", icon: "👥" }] : []),
      ...(canManageDrivers
        ? [{ to: "/drivers/new", label: "Create Driver", icon: "🧑‍✈️" }]
        : []),
      { to: "/trucks", label: "Trucks", icon: "🚚" },
      { to: "/inventory", label: "Inventory", icon: "📦" },
      { to: "/maintenance", label: "Maintenance", icon: "🛠️" },
      { to: "/orders", label: "Orders", icon: "🧾" },
    ];
  }, [isDriver, isOwnerAdmin, canManageDrivers]);

  async function doLogout() {
    await logout();
    nav("/", { replace: true });
  }

  function SidebarContent({ inDrawer = false }) {
    const collapsed = !isMobile && !inDrawer && !sidebarOpen;

    return (
      <div
        style={{
          ...s.sidebar,
          ...(inDrawer ? s.sidebarDrawer : {}),
          padding: collapsed ? 14 : s.sidebar.padding,
        }}
      >
        <div style={s.brand}>
          <div style={s.logo}>CMS</div>

          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={s.brandTitle}>Mitra Setia</div>
              <div style={s.brandSub}>Transport & Operations</div>
            </div>
          )}
        </div>

        {/* ✅ User card (collapsed = same size as CMS) */}
        {collapsed ? (
          <button
            style={s.userMiniBtn}
            onClick={() => nav("/profile")}
            title="Edit profile"
            aria-label="Edit profile"
          >
            <span style={s.avatarMini}>
              {(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}
            </span>
          </button>
        ) : (
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
        )}

        {!collapsed && <div style={s.menuLabel}>MENU</div>}

        <nav style={s.nav}>
          {menu.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              onClick={() => inDrawer && setMobileOpen(false)}
              style={({ isActive }) => ({
                ...s.navItem,
                ...(isActive ? s.navActive : {}),
                justifyContent: collapsed ? "center" : "flex-start",
                padding: collapsed ? "10px 10px" : "10px 12px",
              })}
              title={collapsed ? m.label : undefined}
            >
              <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <span style={s.navIcon}>{m.icon || "•"}</span>
                {(!collapsed || inDrawer || isMobile) && m.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: "auto" }}>
          <button
            onClick={async () => {
              await doLogout();
              if (inDrawer) setMobileOpen(false);
            }}
            onMouseEnter={() => setHoverLogout(true)}
            onMouseLeave={() => setHoverLogout(false)}
            style={{
              ...s.logoutBtn,
              background: hoverLogout
                ? "linear-gradient(135deg, #34d399, #22c55e)"
                : "linear-gradient(135deg, #22c55e, #16a34a)",
              transform: hoverLogout ? "translateY(-1px)" : "translateY(0)",
              padding: collapsed ? "12px 10px" : s.logoutBtn.padding,
            }}
            title={collapsed ? "Logout" : undefined}
          >
            {collapsed ? "⎋" : "Logout"}
          </button>
          <div style={s.sidebarFootNote}>v0.1 • Local</div>
        </div>
      </div>
    );
  }

  const gridCols = isMobile ? "1fr" : sidebarOpen ? "280px 1fr" : "76px 1fr";

  return (
    <div style={{ ...s.page, gridTemplateColumns: gridCols }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside style={s.sidebarWrap}>
          <SidebarContent />
        </aside>
      )}

      {/* Mobile: top bar + drawer */}
      {isMobile && (
        <>
          <header style={s.mobileTop}>
            <button
              onClick={() => setMobileOpen(true)}
              style={s.hamburgerBtn}
              aria-label="Open menu"
            >
              ☰
            </button>

            <div style={{ minWidth: 0, textAlign: "center", flex: 1 }}>
              <div style={s.mobileTitle}>Mitra Setia</div>
              <div style={s.mobileSub}>ERP • Operation</div>
            </div>

            <span style={s.topRole}>{role}</span>
          </header>

          {mobileOpen && (
            <div
              style={s.drawerOverlay}
              onClick={() => setMobileOpen(false)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Escape" && setMobileOpen(false)}
            >
              <div
                style={s.drawer}
                onClick={(e) => e.stopPropagation()}
                role="presentation"
              >
                <div style={s.drawerHeader}>
                  <div style={{ fontWeight: 950, color: "#053a2f" }}>Menu</div>
                  <button
                    onClick={() => setMobileOpen(false)}
                    style={s.closeBtn}
                    aria-label="Close menu"
                  >
                    ✕
                  </button>
                </div>
                <SidebarContent inDrawer />
              </div>
            </div>
          )}
        </>
      )}

      <main style={s.main}>
        {/* Desktop topbar */}
        {!isMobile && (
          <header style={s.topbar}>
            <div style={s.topLeft}>
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                style={s.desktopHamburger}
                aria-label={sidebarOpen ? "Collapse menu" : "Expand menu"}
                title={sidebarOpen ? "Collapse menu" : "Expand menu"}
              >
                ☰
              </button>

              <div style={{ minWidth: 0 }}>
                <div style={s.topTitle}>Operation</div>
                <div style={s.topSub}>
                  Mitra Setia ERP • Company operation management
                </div>
              </div>
            </div>

            <div style={s.topRight}>
              <span style={s.topRole}>{role}</span>
            </div>
          </header>
        )}

        {/* ✅ FIX: remove extra top padding (prevents huge white top on iPhone pages) */}
        <div style={{ ...s.contentOuter, padding: isMobile ? 8 : 22 }}>
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

  sidebarWrap: {
    background: "#fff",
    borderRight: "1px solid rgba(6,95,70,0.08)",
  },

  sidebar: {
    background: "#ffffff",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxSizing: "border-box",
    height: "100%",
  },

  sidebarDrawer: {
    borderRight: "none",
    padding: 16,
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
    maxWidth: 220,
  },

  // ✅ Collapsed user button (same size as CMS)
  userMiniBtn: {
    marginTop: 6,
    width: "100%",
    display: "flex",
    justifyContent: "center",
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "pointer",
  },
  avatarMini: {
    width: 44,
    height: 44,
    aspectRatio: "1 / 1",
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 16,
    lineHeight: "1",
    color: "#065f46",
    background: "rgba(34,197,94,0.14)",
    border: "1px solid rgba(6,95,70,0.10)",
    boxShadow: "0 10px 18px rgba(34,197,94,0.20)",
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
    display: "flex",
    alignItems: "center",
  },
  navActive: {
    background: "rgba(34,197,94,0.14)",
    color: "#065f46",
  },
  navIcon: {
    width: 22,
    display: "inline-flex",
    justifyContent: "center",
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
  topLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  desktopHamburger: {
    border: "1px solid rgba(6,95,70,0.12)",
    background: "#fff",
    width: 44,
    height: 44,
    borderRadius: 14,
    fontSize: 20,
    fontWeight: 900,
    cursor: "pointer",
    color: "#065f46",
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
    whiteSpace: "nowrap",
  },

  contentOuter: {
    width: "100%",
    boxSizing: "border-box",
    padding: 22,
    paddingTop: 0, // ✅ key fix to avoid big white area under sticky mobile header
  },
  contentInner: {
    maxWidth: 1100,
    margin: "0 auto",
    minWidth: 0,
  },

  //////////////////////
  // Mobile top + drawer
  //////////////////////
  mobileTop: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px", // ✅ slimmer
    background: "rgba(255,255,255,0.92)",
    borderBottom: "1px solid rgba(6,95,70,0.10)",
    backdropFilter: "blur(8px)",
  },
  hamburgerBtn: {
    border: "1px solid rgba(6,95,70,0.12)",
    background: "#fff",
    width: 40, // ✅ slimmer
    height: 40, // ✅ slimmer
    borderRadius: 12, // ✅ slimmer
    fontSize: 18, // ✅ slimmer
    fontWeight: 900,
    cursor: "pointer",
    color: "#065f46",
  },
  mobileTitle: { fontWeight: 950, fontSize: 14, color: "#053a2f", lineHeight: 1.1 },
  mobileSub: { fontSize: 12, color: "rgba(4,120,87,0.85)", marginTop: 2 },

  drawerOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    zIndex: 100,
    display: "flex",
    justifyContent: "flex-start",
  },
  drawer: {
    width: "86%",
    maxWidth: 360,
    height: "100%",
    background: "#fff",
    boxShadow: "18px 0 50px rgba(0,0,0,0.18)",
    overflowY: "auto",
  },
  drawerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottom: "1px solid rgba(6,95,70,0.08)",
  },
  closeBtn: {
    border: "1px solid rgba(6,95,70,0.12)",
    background: "#fff",
    width: 40,
    height: 40,
    borderRadius: 14,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 900,
    color: "#065f46",
  },
};
