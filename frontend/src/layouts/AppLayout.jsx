import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FiChevronDown, FiLogOut, FiMenu, FiMoreHorizontal, FiUser, FiX } from "react-icons/fi";
import { useAuth } from "../AuthContext";
import { LiveUpdatesProvider, useLiveStatus } from "../liveUpdates";
import { Breadcrumbs } from "../ui";
import useResponsiveTables from "../ui/useResponsiveTables";
import { breadcrumbsFor, buildBottomNav, buildNavigation } from "./navigation";
import "../liveUpdates.css";
import "../tabletResponsive.css";
import "./AppLayout.css";

const isActivePath = (pathname, to) => pathname === to || pathname.startsWith(`${to}/`);
const testId = (label) => `nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`;

function NavItem({ item, compact, onNavigate }) {
  const location = useLocation();
  const Icon = item.icon;
  return (
    <NavLink to={item.to} onClick={onNavigate} title={compact ? item.label : undefined} data-testid={testId(item.label)}
      className={({ isActive }) => `erp-nav-link${isActive || isActivePath(location.pathname, item.to) ? " is-active" : ""}`}>
      <Icon aria-hidden="true" />{compact ? <span className="ui-sr">{item.label}</span> : <span>{item.label}</span>}
    </NavLink>
  );
}

function Navigation({ groups, compact = false, onNavigate }) {
  return (
    <nav className={`erp-nav${compact ? " is-compact" : ""}`} aria-label="Navigasi utama" data-testid="app-navigation" style={{ "--nav-items": groups.reduce((count, group) => count + (group.items?.length || 1), 0), "--nav-groups": groups.length }}>
      {groups.map((group) => (
        <div className="erp-nav-group is-rail" key={group.label} role="group" aria-label={group.label}>
          {(group.items || [group]).map((item) => <NavItem key={item.to} item={item} compact={compact} onNavigate={onNavigate} />)}
        </div>
      ))}
    </nav>
  );
}

function LivePill() {
  const { status } = useLiveStatus();
  const text = status === "live" ? "Live" : status === "offline" ? "Offline" : "Menghubungkan";
  return <span className={`erp-live is-${status}`} role="status" title="Status pembaruan data otomatis"><i aria-hidden="true" /><span>{text}</span></span>;
}

function UserMenu({ user, roleLabel, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const esc = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const initial = (user?.name || roleLabel).charAt(0).toUpperCase();
  return (
    <div className="erp-user-menu" ref={ref}>
      <button type="button" className="erp-user-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} data-testid="user-menu-btn">
        <span className="erp-user-avatar" aria-hidden="true">{initial}</span>
        <span className="erp-user-meta"><strong>{user?.name || "Pengguna ERP"}</strong><small>{roleLabel}</small></span>
        <FiChevronDown className="erp-user-chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="erp-menu" role="menu">
          <div className="erp-menu-label">{user?.email || roleLabel}</div>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); navigate("/profile"); }}><FiUser aria-hidden="true" /> Profil Saya</button>
          <div className="erp-menu-sep" />
          <button type="button" role="menuitem" className="is-danger" onClick={() => { setOpen(false); onLogout(); }} data-testid="logout-btn"><FiLogOut aria-hidden="true" /> Keluar</button>
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const role = user?.role || "UNKNOWN";
  const roleLabel = role.replaceAll("_", " ");
  const groups = useMemo(() => buildNavigation(role), [role]);
  const bottomNav = useMemo(() => buildBottomNav(role), [role]);
  const crumbs = useMemo(() => breadcrumbsFor(location.pathname, groups), [location.pathname, groups]);
  const pageLabel = crumbs.length ? crumbs[crumbs.length - 1].label : "Mitra Setia ERP";
  const bottomActive = bottomNav.some((item) => isActivePath(location.pathname, item.to));

  useEffect(() => {
    const close = (event) => event.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", close);
    document.body.classList.toggle("erp-drawer-open", drawerOpen);
    return () => { document.removeEventListener("keydown", close); document.body.classList.remove("erp-drawer-open"); };
  }, [drawerOpen]);
  useEffect(() => { document.documentElement.classList.add("erp-app"); return () => document.documentElement.classList.remove("erp-app"); }, []);

  useResponsiveTables();

  async function doLogout() { await logout(); navigate("/", { replace: true }); }

  return (
    <LiveUpdatesProvider showIndicator={false}>
      <div className="erp-shell is-collapsed" data-testid="app-layout">
        <a className="erp-skip" href="#erp-main">Lewati ke konten</a>

        <aside className="erp-sidebar" aria-label="Sidebar aplikasi">
          <div className="erp-brand">
            <img src="/logo3.png" alt="Mitra Setia" />
            <span className="erp-brand-copy"><strong>Mitra Setia</strong><small>Logistics ERP</small></span>
          </div>
          <div className="erp-sidebar-full"><Navigation groups={groups} /></div>
          <div className="erp-sidebar-rail"><Navigation groups={groups} compact /></div>
        </aside>

        <div className="erp-frame">
          <header className="erp-header" data-testid="mobile-header">
            <button type="button" className="erp-icon-btn erp-menu-btn" onClick={() => setDrawerOpen(true)} aria-label="Buka menu" aria-expanded={drawerOpen} data-testid="mobile-menu-btn"><FiMenu /></button>
            <div className="erp-header-crumbs"><Breadcrumbs items={crumbs} /></div>
            <div className="erp-header-title"><img src="/logo3.png" alt="" /><strong>{pageLabel}</strong></div>
            <div className="erp-header-end">
              <LivePill />
              <UserMenu user={user} roleLabel={roleLabel} onLogout={doLogout} />
            </div>
          </header>

          <main className="erp-main" id="erp-main" tabIndex={-1}>
            <div className="erp-content"><Outlet /></div>
          </main>
        </div>

        {bottomNav.length > 0 && (
          <nav className="erp-tabbar" aria-label="Navigasi cepat" data-testid="bottom-nav">
            {bottomNav.map((item) => { const Icon = item.icon; return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `erp-tab${isActive || isActivePath(location.pathname, item.to) ? " is-active" : ""}`}><Icon aria-hidden="true" /><span>{item.label}</span></NavLink>
            ); })}
            <button type="button" className={`erp-tab${!bottomActive || drawerOpen ? " is-active" : ""}`} onClick={() => setDrawerOpen(true)} aria-label="Menu lengkap"><FiMoreHorizontal aria-hidden="true" /><span>Menu</span></button>
          </nav>
        )}

        {drawerOpen && (
          <div className="erp-drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDrawerOpen(false)} data-testid="mobile-drawer-overlay">
            <aside className="erp-drawer" role="dialog" aria-modal="true" aria-label="Menu aplikasi" data-testid="mobile-drawer">
              <div className="erp-drawer-head">
                <div className="erp-brand"><img src="/logo3.png" alt="Mitra Setia" /><span className="erp-brand-copy"><strong>Mitra Setia</strong><small>Logistics ERP</small></span></div>
                <button type="button" className="erp-icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Tutup menu" data-testid="mobile-close-btn"><FiX /></button>
              </div>
              <Navigation groups={groups} onNavigate={() => setDrawerOpen(false)} />
              <div className="erp-drawer-footer">
                <NavLink className="erp-user-card" to="/profile" onClick={() => setDrawerOpen(false)}><span className="erp-user-avatar">{(user?.name || roleLabel).charAt(0).toUpperCase()}</span><span><strong>{user?.name || "Pengguna ERP"}</strong><small>{roleLabel}</small></span></NavLink>
                <button type="button" className="erp-logout" onClick={doLogout} data-testid="mobile-logout-btn"><FiLogOut aria-hidden="true" /> Keluar</button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </LiveUpdatesProvider>
  );
}
