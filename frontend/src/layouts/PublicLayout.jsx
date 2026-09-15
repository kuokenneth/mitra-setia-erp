// src/layouts/PublicLayout.jsx - Corporate Green Design
import { Outlet, Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./PublicLayout.css";

export default function PublicLayout() {
  const { pathname } = useLocation();
  const hideChrome = pathname === "/login" || pathname === "/register";
  // Corporate Green Color Palette
  const BRAND = useMemo(
    () => ({
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
    }),
    []
  );

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 1280 : false
  );
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const compact = window.innerWidth <= 1280;
      setIsMobile(compact);
      if (!compact) setMenuOpen(false);
    };
    const onScroll = () => {
      setScrolled(window.scrollY > 50);
      const available = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(available > 0 ? Math.min(100, (window.scrollY / available) * 100) : 0);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (pathname !== "/") return undefined;
    const ids = ["about", "services", "why-us", "contact"];
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: "-30% 0px -55%", threshold: [0, 0.1, 0.4] });
    ids.map(id => document.getElementById(id)).filter(Boolean).forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [pathname]);

  const page = {
    minHeight: "100dvh",
    background: BRAND.white,
    color: BRAND.text,
    fontFamily: '"Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    position: "relative",
  };

  // Navbar styles - transparent on landing hero, white when scrolled or on other pages
  const showTransparent = false;
  
  const topbar = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    transition: "all 0.3s ease",
    background: showTransparent ? "transparent" : BRAND.white,
    boxShadow: showTransparent ? "none" : "0 6px 18px rgba(0,0,0,0.08)",
  };

  const wrap = {
    maxWidth: 1280,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
    padding: isMobile ? "10px 20px" : "12px 48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    height: scrolled ? 70 : 80,
    transition: "height 0.3s ease",
  };

  const brand = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    textDecoration: "none",
    transition: "transform 0.3s ease",
  };

  const logoImg = {
    width: isMobile ? 48 : 56,
    height: isMobile ? 48 : 56,
    borderRadius: 8,
    objectFit: "contain",
    display: "block",
    background: "transparent",
  };

  const brandTitle = {
    fontWeight: 700,
    fontSize: isMobile ? 16 : 18,
    margin: 0,
    color: showTransparent ? BRAND.white : BRAND.text,
    transition: "color 0.3s ease",
  };

  const brandSub = {
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.5px",
    color: showTransparent ? "rgba(255,255,255,0.8)" : BRAND.textMuted,
    transition: "color 0.3s ease",
  };

  const navLinks = [
    { label: "Tentang Kami", href: "/#about" },
    { label: "Layanan", href: "/#services" },
    { label: "Keunggulan", href: "/#why-us" },
    { label: "Kontak", href: "/#contact" },
  ];

  const navLinkStyle = {
    fontSize: 14,
    fontWeight: 600,
    color: showTransparent ? BRAND.white : BRAND.text,
    textDecoration: "none",
    transition: "color 0.3s ease",
    padding: "8px 0",
  };

  const contactBtn = {
    padding: "10px 20px",
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 14,
    textDecoration: "none",
    background: "transparent",
    border: `2px solid ${showTransparent ? BRAND.white : BRAND.primary}`,
    color: showTransparent ? BRAND.white : BRAND.primary,
    transition: "all 0.3s ease",
  };

  const loginBtn = {
    padding: "10px 20px",
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 14,
    textDecoration: "none",
    background: showTransparent ? "#B9DB4C" : BRAND.primary,
    color: showTransparent ? "#14321E" : BRAND.white,
    border: "none",
    transition: "all 0.3s ease",
  };

  const hamburger = {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    cursor: "pointer",
    padding: 8,
    background: "transparent",
    border: "none",
  };

  const hamburgerLine = {
    width: 24,
    height: 2,
    background: showTransparent ? BRAND.white : BRAND.text,
    borderRadius: 2,
    transition: "all 0.3s ease",
  };

  const mobileMenu = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: BRAND.white,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    transform: menuOpen ? "translateX(0)" : "translateX(100%)",
    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  };

  const outletWrap = {
    width: "100%",
    minHeight: hideChrome ? "100dvh" : "auto",
    paddingTop: 0, // Landing reserves the fixed navbar height in its hero.
  };

  return (
    <div style={page}>
      {!hideChrome && (
        <>
          {/* Corporate Navbar */}
          <nav style={topbar} className={`public-nav ${scrolled ? "is-scrolled" : ""}`} data-testid="main-navigation">
            <div style={wrap} className="public-nav-inner">
              {/* Logo/Brand */}
              <Link to="/" style={brand} className="public-brand" data-testid="logo">
                <img src="/logo3.png" alt="CV. Mitra Setia" style={logoImg} />
                <div>
                  <p style={brandTitle}>CV. Mitra Setia</p>
                  <p style={brandSub}>Transportasi & Logistik</p>
                </div>
              </Link>

              {/* Desktop Navigation */}
              {!isMobile && (
                <div className="public-links" style={{ display: "flex", alignItems: "center", gap: 32 }}>
                  {navLinks.map((link) => (
                    <a
                    key={link.label}
                    href={link.href}
                    style={navLinkStyle}
                    className={activeSection && link.href.endsWith(activeSection) ? "active" : ""}
                      data-testid={`nav-${link.label.toLowerCase().replace(/\s/g, '-')}`}
                      onMouseEnter={(e) => (e.currentTarget.style.color = showTransparent ? "#B9DB4C" : BRAND.primary)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = showTransparent ? BRAND.white : BRAND.text)}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}

              {/* CTA Buttons */}
              <div className="public-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {!isMobile && (
                  <a
                    href="https://wa.me/62XXXXXXXXXX"
                    target="_blank"
                    rel="noreferrer"
                    style={contactBtn}
                    data-testid="nav-whatsapp-btn"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = BRAND.primary;
                      e.currentTarget.style.borderColor = BRAND.primary;
                      e.currentTarget.style.color = BRAND.white;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.borderColor = showTransparent ? BRAND.white : BRAND.primary;
                      e.currentTarget.style.color = showTransparent ? BRAND.white : BRAND.primary;
                    }}
                  >
                    Hubungi Kami
                  </a>
                )}
                <Link
                  to="/login"
                  style={loginBtn}
                  className="public-login"
                  data-testid="nav-login-btn"
                  onMouseEnter={(e) => (e.currentTarget.style.background = showTransparent ? "#CBEA66" : BRAND.primaryDark)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = showTransparent ? "#B9DB4C" : BRAND.primary)}
                >
                  Login
                </Link>

                {/* Mobile Hamburger */}
                {isMobile && (
                  <button
                    style={hamburger}
                    className="public-menu-button"
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label="Toggle menu"
                    data-testid="mobile-menu-btn"
                  >
                    <span style={hamburgerLine} />
                    <span style={hamburgerLine} />
                    <span style={hamburgerLine} />
                  </button>
                )}
              </div>
            </div>
            <span className="public-scroll-progress" style={{ width: `${scrollProgress}%` }} />
          </nav>

          {/* Mobile Menu */}
          {isMobile && (
            <div style={mobileMenu} className="public-mobile-menu" data-testid="mobile-menu">
              {/* Close Button */}
              <div style={{ display: "flex", justifyContent: "flex-end", padding: 20 }}>
                <button
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: 32,
                    cursor: "pointer",
                    color: BRAND.text,
                    padding: 8,
                  }}
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                >
                  ×
                </button>
              </div>

              {/* Mobile Links */}
              <div style={{ display: "flex", flexDirection: "column", padding: "20px 32px", gap: 8 }}>
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: BRAND.text,
                      textDecoration: "none",
                      padding: "16px 0",
                      borderBottom: `1px solid ${BRAND.border}`,
                    }}
                    onClick={() => setMenuOpen(false)}
                    className={activeSection && link.href.endsWith(activeSection) ? "active" : ""}
                  >
                    {link.label}
                  </a>
                ))}
                <a
                  href="https://wa.me/62XXXXXXXXXX"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    marginTop: 24,
                    padding: "16px",
                    background: BRAND.primary,
                    color: BRAND.white,
                    fontSize: 16,
                    fontWeight: 600,
                    borderRadius: 6,
                    textDecoration: "none",
                    textAlign: "center",
                  }}
                  onClick={() => setMenuOpen(false)}
                >
                  Hubungi Kami
                </a>
              </div>
            </div>
          )}
        </>
      )}

      {/* Main Content */}
      <div style={outletWrap}>
        <Outlet />
      </div>

      {/* Global Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        html, body { margin: 0; padding: 0; overflow-x: clip; }
        #root { width: 100%; min-height: 100dvh; }
      `}</style>
    </div>
  );
}
