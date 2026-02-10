// src/layouts/AppLayout.jsx
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  FiBarChart2,
  FiBox,
  FiClipboard,
  FiFileText,
  FiTool,
  FiTruck,
  FiUser,
  FiUserPlus,
} from "react-icons/fi";
import { useAuth } from "../AuthContext";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const [hoverLogout, setHoverLogout] = useState(false);

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
    if (isDriver) return [{ to: "/driver/jobs", label: "My Jobs", icon: FiClipboard }];

    return [
      { to: "/dashboard", label: "Dashboard", icon: FiBarChart2 },
      ...(isOwnerAdmin ? [{ to: "/users", label: "Users", icon: FiUser }] : []),
      ...(canManageDrivers
        ? [{ to: "/drivers/new", label: "Create Driver", icon: FiUserPlus }]
        : []),
      { to: "/trucks", label: "Trucks", icon: FiTruck },
      { to: "/inventory", label: "Inventory", icon: FiBox },
      { to: "/maintenance", label: "Maintenance", icon: FiTool },
      { to: "/orders", label: "Orders", icon: FiFileText },
    ];
  }, [isDriver, isOwnerAdmin, canManageDrivers]);

  async function doLogout() {
    await logout();
    nav("/", { replace: true });
  }

  function TopNavLinks({ onNavigate }) {
    return (
      <nav style={s.topNav} className="app-topnav">
        {menu.map((m) => (
          <NavLink
            key={m.to}
            to={m.to}
            onClick={onNavigate}
            style={({ isActive }) => ({
              ...s.topNavItem,
              ...(isActive ? s.topNavActive : {}),
            })}
          >
            <span style={s.topNavIcon}>{m.icon ? <m.icon /> : "--"}</span>
            <span>{m.label}</span>
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <div style={s.page}>
      <style>{`.app-topnav::-webkit-scrollbar{display:none;}`}</style>
      <div style={s.pagePattern} />
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
              <div style={s.mobileSub}>ERP and Operations</div>
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
                  <div style={{ fontWeight: 900, color: "#0b1f16" }}>Menu</div>
                  <button
                    onClick={() => setMobileOpen(false)}
                    style={s.closeBtn}
                    aria-label="Close menu"
                  >
                    ✕
                  </button>
                </div>
                <div style={s.drawerContent}>
                  <TopNavLinks onNavigate={() => setMobileOpen(false)} />
                  <button
                    onClick={async () => {
                      await doLogout();
                      setMobileOpen(false);
                    }}
                    onMouseEnter={() => setHoverLogout(true)}
                    onMouseLeave={() => setHoverLogout(false)}
                    style={{
                      ...s.logoutBtn,
                      background: hoverLogout
                        ? "linear-gradient(135deg, #1aa14a, #0f6f2f)"
                        : "linear-gradient(135deg, #178a3c, #0f6f2f)",
                      transform: hoverLogout ? "translateY(-1px)" : "translateY(0)",
                    }}
                  >
                    Logout
                  </button>
                </div>
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
              <div style={s.brand}>
                <img src="/logo3.png" alt="Mitra Setia" style={s.brandLogo} />
                <div style={{ minWidth: 0 }}>
                  <div style={s.brandTitle}>Mitra Setia</div>
                  <div style={s.brandSub}>ERP for operations management</div>
                </div>
              </div>
            </div>

            <div style={s.topCenter}>
              <TopNavLinks />
            </div>

            <div style={s.topRight}>
              <span style={s.topRole}>{role}</span>
              <button
                onClick={doLogout}
                onMouseEnter={() => setHoverLogout(true)}
                onMouseLeave={() => setHoverLogout(false)}
                style={{
                  ...s.topLogout,
                  background: hoverLogout
                    ? "linear-gradient(135deg, #1aa14a, #0f6f2f)"
                    : "linear-gradient(135deg, #178a3c, #0f6f2f)",
                }}
              >
                Logout
              </button>
            </div>
          </header>
        )}

        {/* ✅ KEY FIX: on mobile, AppLayout adds NO outer padding (prevents huge white top on some pages) */}
        <div
          style={{
            ...s.contentOuter,
            padding: isMobile ? 0 : 24,
            paddingTop: isMobile ? 0 : 18,
          }}
        >

          <div
            style={{
              ...s.contentInner,
              padding: isMobile ? 12 : 0, // ✅ mobile padding here instead
            }}
          >
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
    display: "flex",
    flexDirection: "column",
    background:
      "radial-gradient(circle at 18% 18%, rgba(34, 197, 94, 0.22), transparent 44%), radial-gradient(circle at 80% 12%, rgba(16, 185, 129, 0.20), transparent 40%), #e3f5ea",
    fontFamily:
      '"IBM Plex Sans","Source Sans 3","Segoe UI",Roboto,Helvetica,Arial,sans-serif',
    color: "#0b1f16",
    overflowX: "hidden",
    position: "relative",
  },
  pagePattern: {
    pointerEvents: "none",
    position: "absolute",
    inset: 0,
    backgroundImage:
      "radial-gradient(rgba(16, 185, 129, 0.22) 1px, transparent 1px)",
    backgroundSize: "12px 12px",
    opacity: 0.32,
    zIndex: 0,
  },

  main: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },

  topbar: {
    padding: "14px 22px",
    background: "rgba(255,255,255,0.96)",
    borderBottom: "1px solid rgba(15, 82, 47, 0.12)",
    backdropFilter: "blur(8px)",
    display: "grid",
    gridTemplateColumns: "minmax(200px, 1fr) minmax(520px, 3fr) minmax(220px, 1fr)",
    alignItems: "center",
    boxSizing: "border-box",
    boxShadow: "0 8px 20px rgba(10, 58, 30, 0.08)",
    position: "relative",
    zIndex: 2,
  },
  topLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  topCenter: {
    display: "flex",
    justifyContent: "center",
    minWidth: 0,
  },
  hamburgerLines: {
    display: "grid",
    gridTemplateRows: "repeat(3, 2px)",
    alignContent: "center",
    justifyItems: "center",
    width: 18,
    height: 18,
    gap: 4,
    transform: "translateY(1px)",
  },
  hamburgerLine: {
    width: 16,
    height: 2,
    background: "#0f6f2f",
    borderRadius: 999,
  },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  brandLogo: {
    width: 44,
    height: 44,
    objectFit: "contain",
    background: "transparent",
  },
  brandTitle: { fontWeight: 900, fontSize: 16, color: "#0b1f16" },
  brandSub: { marginTop: 2, fontSize: 12, color: "rgba(6, 78, 59, 0.75)" },
  topNav: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "nowrap",
    justifyContent: "center",
    overflowX: "auto",
    paddingBottom: 2,
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },
  topNavItem: {
    textDecoration: "none",
    color: "#0b1f16",
    fontWeight: 700,
    fontSize: 12,
    padding: "6px 8px",
    borderRadius: 10,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
  },
  topNavActive: {
    background: "#e1f3e7",
    color: "#0f6f2f",
    border: "1px solid rgba(20,136,58,0.22)",
  },
  topNavIcon: {
    width: 16,
    height: 16,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  topRight: { display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" },
  topRole: {
    fontSize: 12,
    fontWeight: 800,
    padding: "7px 10px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid rgba(15, 82, 47, 0.18)",
    color: "#0b1f16",
    whiteSpace: "nowrap",
  },
  topLogout: {
    border: "none",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 12,
    padding: "8px 12px",
    borderRadius: 999,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(20,136,58,0.24)",
  },

  contentOuter: {
    width: "100%",
    boxSizing: "border-box",
    padding: 22,
    position: "relative",
    zIndex: 1,
  },
  contentInner: {
    maxWidth: 1100,
    margin: "0 auto",
    minWidth: 0,
  },

  mobileTop: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.94)",
    borderBottom: "1px solid rgba(15, 82, 47, 0.14)",
    backdropFilter: "blur(8px)",
  },
  hamburgerBtn: {
    border: "1px solid rgba(15, 82, 47, 0.12)",
    background: "#fff",
    width: 40,
    height: 40,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 900,
    cursor: "pointer",
    color: "#0b1f16",
  },
  mobileTitle: { fontWeight: 900, fontSize: 14, color: "#0b1f16", lineHeight: 1.1 },
  mobileSub: { fontSize: 12, color: "rgba(6, 78, 59, 0.75)", marginTop: 2 },

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
    boxShadow: "18px 0 50px rgba(10, 58, 30, 0.20)",
    overflowY: "auto",
  },
  drawerContent: {
    padding: 16,
    display: "grid",
    gap: 14,
  },
  drawerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottom: "1px solid rgba(15, 82, 47, 0.10)",
  },
  closeBtn: {
    border: "1px solid rgba(15, 82, 47, 0.12)",
    background: "#fff",
    width: 40,
    height: 40,
    borderRadius: 14,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 900,
    color: "#0b1f16",
  },
};
