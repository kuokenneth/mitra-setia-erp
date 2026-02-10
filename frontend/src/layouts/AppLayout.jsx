// src/layouts/AppLayout.jsx - Modern Design
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

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia("(max-width: 900px)").matches
  );

  // Match Landing Page Colors
  const BRAND = {
    green: "#4BCA74",
    green2: "#3BB865",
    greenLight: "#5FD686",
    greenDark: "#2D9F56",
    greenSoft: "rgba(75,202,116,0.15)",
    ink: "#111827",
    ink2: "#1F2937",
  };

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

  const s = {
    page: {
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: `linear-gradient(135deg, ${BRAND.greenLight}20 0%, #ffffff 50%, ${BRAND.greenSoft} 100%)`,
      fontFamily: '"Manrope",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      color: BRAND.ink,
      position: "relative",
      overflow: "hidden",
    },

    // Floating particles
    particles: {
      position: "fixed",
      inset: 0,
      pointerEvents: "none",
      zIndex: 0,
    },

    main: {
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      position: "relative",
      zIndex: 1,
    },

    // Desktop topbar
    topbar: {
      padding: "16px 24px",
      background: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderBottom: `1px solid rgba(75,202,116,0.2)`,
      display: "grid",
      gridTemplateColumns: "minmax(200px, 1fr) minmax(520px, 3fr) minmax(220px, 1fr)",
      alignItems: "center",
      boxSizing: "border-box",
      boxShadow: `0 4px 20px ${BRAND.greenSoft}`,
      position: "sticky",
      top: 0,
      zIndex: 10,
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

    brand: { display: "flex", alignItems: "center", gap: 12 },

    brandLogo: {
      width: 48,
      height: 48,
      objectFit: "contain",
      borderRadius: 12,
    },

    brandTitle: { fontWeight: 800, fontSize: 18, color: BRAND.ink },
    brandSub: { marginTop: 2, fontSize: 13, color: BRAND.ink2, opacity: 0.7 },

    topNav: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "nowrap",
      justifyContent: "center",
      overflowX: "auto",
      scrollbarWidth: "none",
      msOverflowStyle: "none",
    },

    topNavItem: {
      textDecoration: "none",
      color: BRAND.ink,
      fontWeight: 600,
      fontSize: 14,
      padding: "10px 16px",
      borderRadius: 12,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      whiteSpace: "nowrap",
      transition: "all 0.3s ease",
    },

    topNavActive: {
      background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.green2})`,
      color: "#fff",
      boxShadow: `0 4px 12px ${BRAND.green}40`,
    },

    topNavIcon: {
      width: 18,
      height: 18,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    },

    topRight: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      justifyContent: "flex-end",
    },

    topRole: {
      fontSize: 13,
      fontWeight: 700,
      padding: "8px 16px",
      borderRadius: 999,
      background: BRAND.greenSoft,
      border: `1px solid ${BRAND.green}30`,
      color: BRAND.green,
      whiteSpace: "nowrap",
    },

    topLogout: {
      border: "none",
      color: "#ffffff",
      fontWeight: 700,
      fontSize: 14,
      padding: "10px 20px",
      borderRadius: 12,
      cursor: "pointer",
      background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.green})`,
      boxShadow: `0 4px 12px ${BRAND.green}40`,
      transition: "all 0.3s ease",
    },

    contentOuter: {
      width: "100%",
      boxSizing: "border-box",
      padding: isMobile ? 16 : 24,
      paddingTop: isMobile ? 16 : 24,
    },

    contentInner: {
      maxWidth: 1200,
      margin: "0 auto",
      minWidth: 0,
    },

    // Mobile styles
    mobileTop: {
      position: "sticky",
      top: 0,
      zIndex: 50,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "12px 16px",
      background: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderBottom: `1px solid ${BRAND.greenSoft}`,
      boxShadow: `0 2px 10px ${BRAND.greenSoft}`,
    },

    hamburgerBtn: {
      border: `1px solid ${BRAND.greenSoft}`,
      background: "#fff",
      width: 44,
      height: 44,
      borderRadius: 12,
      fontSize: 20,
      fontWeight: 700,
      cursor: "pointer",
      color: BRAND.green,
    },

    mobileTitle: { fontWeight: 800, fontSize: 16, color: BRAND.ink },
    mobileSub: { fontSize: 12, color: BRAND.ink2, opacity: 0.7, marginTop: 2 },

    drawerOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.4)",
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
      zIndex: 100,
      display: "flex",
      justifyContent: "flex-start",
    },

    drawer: {
      width: "85%",
      maxWidth: 360,
      height: "100%",
      background: "rgba(255,255,255,0.95)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      boxShadow: `10px 0 30px ${BRAND.green}20`,
      overflowY: "auto",
    },

    drawerContent: {
      padding: 20,
      display: "grid",
      gap: 12,
    },

    drawerHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      borderBottom: `1px solid ${BRAND.greenSoft}`,
    },

    closeBtn: {
      border: `1px solid ${BRAND.greenSoft}`,
      background: "#fff",
      width: 44,
      height: 44,
      borderRadius: 12,
      cursor: "pointer",
      fontSize: 18,
      fontWeight: 700,
      color: BRAND.green,
    },

    logoutBtn: {
      border: "none",
      color: "#ffffff",
      fontWeight: 700,
      fontSize: 15,
      padding: "12px 24px",
      borderRadius: 12,
      cursor: "pointer",
      background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.green})`,
      boxShadow: `0 4px 12px ${BRAND.green}40`,
      marginTop: 12,
    },
  };

  return (
    <div style={s.page}>
      <style>{`.app-topnav::-webkit-scrollbar{display:none;}`}</style>

      {/* Floating Particles */}
      <div style={s.particles}>
        {[...Array(isMobile ? 10 : 20)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: Math.random() * 3 + 2,
              height: Math.random() * 3 + 2,
              background: `${BRAND.green}30`,
              borderRadius: "50%",
              animation: `float ${Math.random() * 10 + 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Mobile */}
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
              <div style={s.mobileTitle}>Mitra Setia ERP</div>
              <div style={s.mobileSub}>Operations Dashboard</div>
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
                  <div style={{ fontWeight: 800, color: BRAND.ink, fontSize: 18 }}>Menu</div>
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
                    style={s.logoutBtn}
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
                  <div style={s.brandTitle}>Mitra Setia ERP</div>
                  <div style={s.brandSub}>Operations Management</div>
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
                style={s.topLogout}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = `0 6px 20px ${BRAND.green}50`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = `0 4px 12px ${BRAND.green}40`;
                }}
              >
                Logout
              </button>
            </div>
          </header>
        )}

        <div style={s.contentOuter}>
          <div style={s.contentInner}>
            <Outlet />
          </div>
        </div>
      </main>

      {/* Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </div>
  );
}
