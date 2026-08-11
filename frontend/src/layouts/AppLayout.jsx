// src/layouts/AppLayout.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  FiBarChart2,
  FiBox,
  FiClipboard,
  FiDollarSign,
  FiFileText,
  FiTool,
  FiTruck,
  FiUser,
  FiUserPlus,
  FiLogOut,
  FiMenu,
  FiShoppingCart,
  FiCreditCard,
  FiBookOpen,
  FiX,
  FiPieChart,
} from "react-icons/fi";
import { useAuth } from "../AuthContext";
import { LiveUpdatesProvider } from "../liveUpdates";
import "../liveUpdates.css";

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
};

function TopNavLinks({ menu, styles, navRef, onNavigate }) {
  function keepMenuPosition() {
    const element = navRef.current;
    const scrollLeft = element?.scrollLeft || 0;

    onNavigate?.();

    if (element) {
      requestAnimationFrame(() => {
        element.scrollLeft = scrollLeft;
        requestAnimationFrame(() => {
          element.scrollLeft = scrollLeft;
        });
      });
    }
  }

  return (
    <nav
      ref={navRef}
      style={styles.topNav}
      className="top-nav-scroll"
      data-testid="app-navigation"
    >
      {menu.map((m) => (
        <NavLink
          key={m.to}
          to={m.to}
          onMouseDown={(e) => e.preventDefault()}
          onClick={keepMenuPosition}
          data-testid={`nav-link-${m.label.toLowerCase().replace(/\s+/g, '-')}`}
          style={({ isActive }) => ({
            ...styles.topNavItem,
            ...(isActive ? styles.topNavActive : {}),
          })}
        >
          <span style={styles.topNavIcon}>{m.icon ? <m.icon /> : "--"}</span>
          <span>{m.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const navScrollRef = useRef(null);

  const [mobileOpen, setMobileOpen] = useState(false);
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

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  const role = user?.role || "UNKNOWN";
  const isOwnerAdmin = role === "OWNER" || role === "ADMIN";
  const isStaff = role === "STAFF";
  const isSparepartAdmin = role === "SPAREPART_ADMIN";
  const canManageDrivers = isOwnerAdmin || isStaff;
  const isDriver = role === "DRIVER";

  const menu = useMemo(() => {
    if (isDriver) return [{ to: "/driver/jobs", label: "Tugas Saya", icon: FiClipboard }];
    if (isSparepartAdmin) return [
      { to: "/inventory", label: "Inventory", icon: FiBox },
      { to: "/maintenance", label: "Servis", icon: FiTool },
      { to: "/purchasing", label: "Pembelian", icon: FiShoppingCart },
    ];

    return [
      { to: "/dashboard", label: "Dashboard", icon: FiBarChart2 },
      ...(isOwnerAdmin ? [{ to: "/users", label: "Pengguna", icon: FiUser }] : []),
      ...(canManageDrivers
        ? [{ to: "/drivers/new", label: "Tambah Pengemudi", icon: FiUserPlus }]
        : []),
      { to: "/trucks", label: "Armada", icon: FiTruck },
      ...(isOwnerAdmin ? [{ to: "/fleet-profitability", label: "Profit Armada", icon: FiPieChart }] : []),
      { to: "/inventory", label: "Inventory", icon: FiBox },
      { to: "/maintenance", label: "Servis", icon: FiTool },
      { to: "/purchasing", label: "Pembelian", icon: FiShoppingCart },
      { to: "/expenses", label: "Pengeluaran", icon: FiDollarSign },
      { to: "/orders", label: "Pesanan", icon: FiFileText },
      { to: "/receivables", label: "Piutang", icon: FiCreditCard },
      ...(isOwnerAdmin ? [{ to: "/accounting", label: "Accounting", icon: FiBookOpen }] : []),
    ];
  }, [isDriver, isSparepartAdmin, isOwnerAdmin, canManageDrivers]);

  async function doLogout() {
    await logout();
    nav("/", { replace: true });
  }

  const s = {
    page: {
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: BRAND.white,
      fontFamily: '"Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: BRAND.text,
    },

    main: {
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      flex: 1,
    },

    // Desktop topbar
    topbar: {
      padding: "0 32px",
      height: 72,
      background: BRAND.white,
      borderBottom: `1px solid ${BRAND.border}`,
      display: "grid",
      gridTemplateColumns: "minmax(200px, 1fr) minmax(520px, 3fr) minmax(220px, 1fr)",
      alignItems: "center",
      boxSizing: "border-box",
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
      justifyContent: "flex-start",
      minWidth: 0,
      overflow: "hidden",
    },

    brand: { display: "flex", alignItems: "center", gap: 12 },

    brandLogo: {
      width: 40,
      height: 40,
      objectFit: "contain",
      borderRadius: 8,
    },

    brandTitle: { fontWeight: 700, fontSize: 16, color: BRAND.text },
    brandSub: { marginTop: 2, fontSize: 12, color: BRAND.textMuted },

    topNav: {
      display: "flex",
      width: "100%",
      gap: 4,
      alignItems: "center",
      flexWrap: "nowrap",
      justifyContent: "flex-start",
      overflowX: "auto",
      overflowAnchor: "none",
      scrollBehavior: "auto",
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
      msOverflowStyle: "none",
    },

    topNavItem: {
      textDecoration: "none",
      color: BRAND.textMuted,
      fontWeight: 500,
      fontSize: 14,
      padding: "8px 14px",
      borderRadius: 6,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      whiteSpace: "nowrap",
      transition: "all 0.2s ease",
    },

    topNavActive: {
      background: BRAND.accent,
      color: BRAND.primary,
      fontWeight: 600,
    },

    topNavIcon: {
      width: 16,
      height: 16,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    },

    topRight: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      justifyContent: "flex-end",
    },

    topRole: {
      fontSize: 12,
      fontWeight: 600,
      padding: "6px 12px",
      borderRadius: 4,
      background: BRAND.accent,
      color: BRAND.primary,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },

    topLogout: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      border: `1px solid ${BRAND.border}`,
      color: BRAND.textLight,
      fontWeight: 500,
      fontSize: 14,
      padding: "8px 16px",
      borderRadius: 6,
      cursor: "pointer",
      background: BRAND.white,
      transition: "all 0.2s ease",
    },

    contentOuter: {
      width: "100%",
      boxSizing: "border-box",
      padding: isMobile ? 16 : 32,
      background: BRAND.secondary,
      flex: 1,
    },

    contentInner: {
      maxWidth: 1280,
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
      height: 60,
      background: BRAND.white,
      borderBottom: `1px solid ${BRAND.border}`,
    },

    hamburgerBtn: {
      border: `1px solid ${BRAND.border}`,
      background: BRAND.white,
      width: 40,
      height: 40,
      borderRadius: 6,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: BRAND.text,
    },

    mobileTitle: { fontWeight: 700, fontSize: 15, color: BRAND.text },
    mobileSub: { fontSize: 11, color: BRAND.textMuted, marginTop: 2 },

    drawerOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.4)",
      zIndex: 100,
      display: "flex",
      justifyContent: "flex-start",
    },

    drawer: {
      width: "85%",
      maxWidth: 320,
      height: "100%",
      background: BRAND.white,
      overflowY: "auto",
      boxShadow: "4px 0 20px rgba(0,0,0,0.1)",
    },

    drawerContent: {
      padding: 20,
      display: "grid",
      gap: 8,
    },

    drawerHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      borderBottom: `1px solid ${BRAND.border}`,
    },

    closeBtn: {
      border: `1px solid ${BRAND.border}`,
      background: BRAND.white,
      width: 40,
      height: 40,
      borderRadius: 6,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: BRAND.text,
    },

    logoutBtn: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      border: "none",
      color: BRAND.white,
      fontWeight: 600,
      fontSize: 14,
      padding: "12px 24px",
      borderRadius: 6,
      cursor: "pointer",
      background: BRAND.primary,
      marginTop: 16,
      transition: "all 0.2s ease",
    },
  };

  return (
    <div style={s.page} data-testid="app-layout">
      {/* Mobile */}
      {isMobile && (
        <>
          <header style={s.mobileTop} data-testid="mobile-header">
            <button
              onClick={() => setMobileOpen(true)}
              style={s.hamburgerBtn}
              aria-label="Open menu"
              data-testid="mobile-menu-btn"
            >
              <FiMenu size={20} />
            </button>

            <div style={{ minWidth: 0, textAlign: "center", flex: 1 }}>
              <div style={s.mobileTitle}>Mitra Setia ERP</div>
              <div style={s.mobileSub}>Dasbor Operasional</div>
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
              data-testid="mobile-drawer-overlay"
            >
              <div
                style={s.drawer}
                onClick={(e) => e.stopPropagation()}
                role="presentation"
                data-testid="mobile-drawer"
              >
                <div style={s.drawerHeader}>
                  <div style={{ fontWeight: 700, color: BRAND.text, fontSize: 16 }}>Menu</div>
                  <button
                    onClick={() => setMobileOpen(false)}
                    style={s.closeBtn}
                    aria-label="Close menu"
                    data-testid="mobile-close-btn"
                  >
                    <FiX size={18} />
                  </button>
                </div>
                <div style={s.drawerContent}>
                  <TopNavLinks
                    menu={menu}
                    styles={s}
                    navRef={navScrollRef}
                    onNavigate={() => setMobileOpen(false)}
                  />
                  <button
                    onClick={async () => {
                      await doLogout();
                      setMobileOpen(false);
                    }}
                    style={s.logoutBtn}
                    data-testid="mobile-logout-btn"
                  >
                    <FiLogOut size={16} />
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
          <header style={s.topbar} data-testid="desktop-header">
            <div style={s.topLeft}>
              <div style={s.brand}>
                <img src="/logo3.png" alt="Mitra Setia" style={s.brandLogo} />
                <div style={{ minWidth: 0 }}>
                  <div style={s.brandTitle}>Mitra Setia ERP</div>
                  <div style={s.brandSub}>Manajemen Operasional</div>
                </div>
              </div>
            </div>

            <div style={s.topCenter}>
              <TopNavLinks menu={menu} styles={s} navRef={navScrollRef} />
            </div>

            <div style={s.topRight}>
              <span style={s.topRole}>{role}</span>
              <button
                onClick={doLogout}
                style={s.topLogout}
                data-testid="logout-btn"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = BRAND.primary;
                  e.currentTarget.style.color = BRAND.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = BRAND.border;
                  e.currentTarget.style.color = BRAND.textLight;
                }}
              >
                <FiLogOut size={16} />
                Logout
              </button>
            </div>
          </header>
        )}

        <div style={s.contentOuter}>
          <div style={s.contentInner}>
          <LiveUpdatesProvider><Outlet /></LiveUpdatesProvider>
          </div>
        </div>
      </main>

      <style>{`
        .top-nav-scroll::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
        .top-nav-scroll::-webkit-scrollbar-thumb {
          background: transparent;
        }
      `}</style>
    </div>
  );
}
