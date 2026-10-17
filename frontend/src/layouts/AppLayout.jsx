import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FiBarChart2, FiBookOpen, FiBox, FiChevronLeft, FiChevronRight, FiClipboard, FiCreditCard, FiDollarSign, FiFileText, FiLogOut, FiMap, FiMapPin, FiMenu, FiPieChart, FiShield, FiShoppingCart, FiTool, FiTruck, FiUser, FiUserPlus, FiX } from "react-icons/fi";
import { useAuth } from "../AuthContext";
import { LiveUpdatesProvider } from "../liveUpdates";
import "../liveUpdates.css";
import "../tabletResponsive.css";
import "./AppLayout.css";

function Navigation({ groups, compact = false, onNavigate }) {
  const location = useLocation();
  const active = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  return <nav className="erp-nav" aria-label="Navigasi utama" data-testid="app-navigation">
    {groups.map((group) => <section className="erp-nav-group" key={group.label}>
      {!compact && group.items && <p className="erp-nav-label">{group.label}</p>}
      {group.items ? group.items.map((item) => <NavLink className={({ isActive }) => `erp-nav-link${isActive || active(item.to) ? " is-active" : ""}`} key={item.to} to={item.to} onClick={onNavigate} title={compact ? item.label : undefined}><item.icon aria-hidden="true" />{!compact && <span>{item.label}</span>}</NavLink>) : <NavLink className={({ isActive }) => `erp-nav-link${isActive ? " is-active" : ""}`} to={group.to} onClick={onNavigate} title={compact ? group.label : undefined} data-testid={`nav-link-${group.label.toLowerCase().replace(/\s+/g, "-")}`}><group.icon aria-hidden="true" />{!compact && <span>{group.label}</span>}</NavLink>}
    </section>)}
  </nav>;
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compact, setCompact] = useState(() => localStorage.getItem("erp-sidebar-compact") === "true");
  const [sidebarPreview, setSidebarPreview] = useState(false);
  const role = user?.role || "UNKNOWN";
  const isOwnerAdmin = role === "OWNER" || role === "ADMIN";
  const isStaff = role === "STAFF";
  const isSparepartAdmin = role === "SPAREPART_ADMIN";
  const canManageDrivers = isOwnerAdmin || isStaff;
  const isDriver = role === "DRIVER";

  const groups = useMemo(() => {
    if (isDriver) return [{ label: "Driver", items: [{ to: "/driver/jobs", label: "Tugas Saya", icon: FiClipboard }] }];
    if (isSparepartAdmin) return [{ label: "Bengkel & Pembelian", items: [{ to: "/inventory", label: "Inventory", icon: FiBox }, { to: "/maintenance", label: "Servis", icon: FiTool }, { to: "/purchasing", label: "Pembelian", icon: FiShoppingCart }] }];
    return [
      { to: "/dashboard", label: "Dashboard", icon: FiBarChart2 },
      { label: "Operasional", items: [{ to: "/trucks", label: "Armada", icon: FiTruck }, { to: "/fleet-map", label: "Peta Armada", icon: FiMap }, { to: "/operational-locations", label: "Master Lokasi", icon: FiMapPin }, { to: "/material-stock", label: "Ambang / Material", icon: FiBox }, { to: "/orders", label: "Pesanan", icon: FiFileText }, { to: "/trips", label: "Trips", icon: FiMap }] },
      { label: "Bengkel & Pembelian", items: [{ to: "/inventory", label: "Inventory", icon: FiBox }, { to: "/maintenance", label: "Servis", icon: FiTool }, { to: "/purchasing", label: "Pembelian", icon: FiShoppingCart }] },
      { label: "Keuangan", items: [{ to: "/expenses", label: "Pengeluaran", icon: FiDollarSign }, { to: "/receivables", label: "Piutang", icon: FiCreditCard }, ...(isOwnerAdmin ? [{ to: "/fleet-profitability", label: "Profit Armada", icon: FiPieChart }, { to: "/accounting", label: "Accounting", icon: FiBookOpen }] : [])] },
      { label: "Administrasi", items: [...(isOwnerAdmin ? [{ to: "/users", label: "Pengguna", icon: FiUser }] : []), ...(canManageDrivers ? [{ to: "/drivers/new", label: "Tambah Pengemudi", icon: FiUserPlus }] : []), ...(role === "OWNER" ? [{ to: "/audit-trail", label: "Audit Trail", icon: FiShield }] : [])] },
    ];
  }, [canManageDrivers, isDriver, isOwnerAdmin, isSparepartAdmin, role]);

  useEffect(() => {
    const close = (event) => event.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", close);
    document.body.classList.toggle("erp-drawer-open", drawerOpen);
    return () => { document.removeEventListener("keydown", close); document.body.classList.remove("erp-drawer-open"); };
  }, [drawerOpen]);

  async function doLogout() { await logout(); navigate("/", { replace: true }); }
  function toggleCompact() { setCompact((current) => { localStorage.setItem("erp-sidebar-compact", String(!current)); return !current; }); }
  const roleLabel = role.replaceAll("_", " ");
  const visuallyCompact = compact && !sidebarPreview;

  return <div className={`erp-shell${compact ? " is-compact" : ""}`} data-testid="app-layout">
    <aside className={`erp-sidebar${compact && sidebarPreview ? " is-auto-expanded" : ""}`} aria-label="Sidebar aplikasi" onMouseEnter={() => compact && setSidebarPreview(true)} onMouseLeave={() => setSidebarPreview(false)} onFocusCapture={() => compact && setSidebarPreview(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSidebarPreview(false); }}>
      <div className="erp-brand"><img src="/logo3.png" alt="Mitra Setia" />{!visuallyCompact && <span><strong>Mitra Setia</strong><small>Logistics ERP</small></span>}</div>
      <Navigation groups={groups} compact={visuallyCompact} />
      <div className="erp-sidebar-footer">
        <NavLink className="erp-user-card" to="/profile" title={visuallyCompact ? user?.name || roleLabel : undefined}><span className="erp-user-avatar">{(user?.name || roleLabel).charAt(0).toUpperCase()}</span>{!visuallyCompact && <span><strong>{user?.name || "Pengguna ERP"}</strong><small>{roleLabel}</small></span>}</NavLink>
        <button className="erp-logout" onClick={doLogout} title={visuallyCompact ? "Keluar" : undefined} data-testid="logout-btn"><FiLogOut />{!visuallyCompact && <span>Keluar</span>}</button>
      </div>
      <button className="erp-sidebar-toggle" onClick={toggleCompact} aria-label={compact ? "Perluas sidebar" : "Perkecil sidebar"}>{compact ? <FiChevronRight /> : <FiChevronLeft />}</button>
    </aside>
    <header className="erp-mobile-header" data-testid="mobile-header">
      <button onClick={() => setDrawerOpen(true)} aria-label="Buka menu" data-testid="mobile-menu-btn"><FiMenu /></button>
      <div className="erp-mobile-brand"><img src="/logo3.png" alt="" /><span><strong>Mitra Setia ERP</strong><small>Manajemen Operasional</small></span></div><span className="erp-role-badge">{roleLabel}</span>
    </header>
    {drawerOpen && <div className="erp-drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDrawerOpen(false)} data-testid="mobile-drawer-overlay"><aside className="erp-drawer" role="dialog" aria-modal="true" aria-label="Menu aplikasi" data-testid="mobile-drawer">
      <div className="erp-drawer-head"><div className="erp-brand"><img src="/logo3.png" alt="Mitra Setia" /><span><strong>Mitra Setia</strong><small>Logistics ERP</small></span></div><button onClick={() => setDrawerOpen(false)} aria-label="Tutup menu" data-testid="mobile-close-btn"><FiX /></button></div>
      <Navigation groups={groups} onNavigate={() => setDrawerOpen(false)} />
      <div className="erp-drawer-footer"><div className="erp-user-card"><span className="erp-user-avatar">{(user?.name || roleLabel).charAt(0).toUpperCase()}</span><span><strong>{user?.name || "Pengguna ERP"}</strong><small>{roleLabel}</small></span></div><button className="erp-logout" onClick={doLogout} data-testid="mobile-logout-btn"><FiLogOut /> Keluar</button></div>
    </aside></div>}
    <main className="erp-main"><div className="erp-content"><LiveUpdatesProvider><Outlet /></LiveUpdatesProvider></div></main>
  </div>;
}
