// src/layouts/PublicLayout.jsx — public website chrome (CV. Mitra Setia)
// Transparent over the landing hero, solid navy once the page scrolls.
import { Outlet, Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { FiArrowUpRight } from "react-icons/fi";
import CorporateLogo from "../components/CorporateLogo";
import "./PublicLayout.css";

const NAV_LINKS = [
  { label: "Beranda", href: "/#home" },
  { label: "Tentang Kami", href: "/#about" },
  { label: "Layanan", href: "/#services" },
  { label: "Armada", href: "/#fleet" },
  { label: "Operasional", href: "/#operations" },
  { label: "Hubungi Kami", href: "/#contact" },
];
const SECTION_IDS = ["about", "services", "fleet", "operations", "contact"];

export default function PublicLayout() {
  const { pathname } = useLocation();
  const hideChrome = pathname === "/login" || pathname === "/register";
  const isHome = pathname === "/";

  const [scrolled, setScrolled] = useState(false);
  const progressRef = useRef(null);
  const [activeSection, setActiveSection] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // Scroll work happens outside React: the progress bar is written straight to the DOM once
  // per frame, and React state only changes when "scrolled" actually flips.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(prev => (prev === y > 40 ? prev : y > 40));
      const available = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${available > 0 ? Math.min(1, y / available) : 0})`;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    const onResize = () => { if (window.innerWidth > 1180) setMenuOpen(false); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (!isHome) return undefined;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: "-35% 0px -55%", threshold: [0, 0.1, 0.4] });
    SECTION_IDS.map(id => document.getElementById(id)).filter(Boolean).forEach(s => observer.observe(s));
    return () => observer.disconnect();
  }, [isHome]);

  // lock page scroll behind the open mobile menu
  useEffect(() => {
    document.documentElement.classList.toggle("public-menu-open", menuOpen);
    return () => document.documentElement.classList.remove("public-menu-open");
  }, [menuOpen]);

  const transparent = isHome && !scrolled && !menuOpen;
  const isActive = href => activeSection && href.endsWith(`#${activeSection}`);

  return (
    <div className="public-page">
      {!hideChrome && (
        <>
          <header className={`public-nav ${transparent ? "is-transparent" : "is-solid"}`} data-testid="main-navigation">
            <div className="public-nav-inner">
              <CorporateLogo className="public-brand" />

              <nav className="public-links" aria-label="Navigasi utama">
                {NAV_LINKS.map(link => (
                  <a key={link.label} href={link.href} className={isActive(link.href) ? "active" : ""}
                    data-testid={`nav-${link.label.toLowerCase().replace(/\s/g, "-")}`}>
                    {link.label}
                  </a>
                ))}
              </nav>

              <div className="public-actions">
                <Link to="/login" className="public-login" data-testid="nav-login-btn">
                  <span>Portal Karyawan</span>
                  <FiArrowUpRight className="public-login-icon" aria-hidden="true" />
                </Link>
                <button className="public-menu-button" type="button" onClick={() => setMenuOpen(o => !o)}
                  aria-label={menuOpen ? "Tutup menu" : "Buka menu"} aria-expanded={menuOpen} aria-controls="public-mobile-menu"
                  data-testid="mobile-menu-btn">
                  <span /><span /><span />
                </button>
              </div>
            </div>
            <span className="public-scroll-progress" ref={progressRef} />
          </header>

          <div id="public-mobile-menu" className={`public-mobile-menu ${menuOpen ? "is-open" : ""}`} data-testid="mobile-menu" aria-hidden={!menuOpen}>
            <nav aria-label="Navigasi seluler">
              {NAV_LINKS.map(link => (
                <a key={link.label} href={link.href} tabIndex={menuOpen ? 0 : -1}
                  className={isActive(link.href) ? "active" : ""} onClick={() => setMenuOpen(false)}>
                  {link.label}
                </a>
              ))}
              {/* only shown on phones, where the bar button is hidden — never two at once */}
              <Link to="/login" className="public-mobile-portal" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)}
                data-testid="mobile-portal-btn">
                <span>Portal Karyawan</span>
                <FiArrowUpRight aria-hidden="true" />
              </Link>
            </nav>
          </div>
        </>
      )}

      <div className="public-outlet" style={{ minHeight: hideChrome ? "100dvh" : "auto" }}>
        <Outlet />
      </div>

      {/* kept from the previous layout: login/register use this font and reset */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        html, body { margin: 0; padding: 0; overflow-x: clip; }
        #root { width: 100%; min-height: 100dvh; }
      `}</style>
    </div>
  );
}
