// src/layouts/PublicLayout.jsx - Modern Design
import { Outlet, Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

export default function PublicLayout() {
  const { pathname } = useLocation();
  const hideChrome = pathname === "/login" || pathname === "/register";

  const BRAND = useMemo(
    () => ({
      ink: "#111827",
      ink2: "#1F2937",
      green: "#1f9d53",
      green2: "#2ccf6a",
      greenLight: "#a7f3d0",
      greenDark: "#065f46",
      greenSoft: "rgba(34,197,94,0.1)",
      glass: "rgba(255,255,255,0.85)",
      glassBorder: "rgba(255,255,255,0.4)",
    }),
    []
  );

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 640 : false
  );
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 640);
    const onScroll = () => setScrolled(window.scrollY > 50);

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const page = {
    minHeight: "100dvh",
    background: "#ffffff",
    color: BRAND.ink,
    fontFamily:
      '"Manrope",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
    position: "relative",
  };

  // Modern glassmorphic navbar
  const topbar = {
    position: "relative",
    zIndex: 100,
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    background: scrolled ? BRAND.glass : "transparent",
    backdropFilter: scrolled ? "blur(20px)" : "none",
    WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
    borderBottom: scrolled ? `1px solid ${BRAND.glassBorder}` : "none",
    boxShadow: scrolled ? "0 4px 20px rgba(31, 157, 83, 0.08)" : "none",
  };

  const wrap = {
    maxWidth: 1240,
    margin: "0 auto",
    padding: isMobile ? "12px 20px" : "16px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  };

  const brand = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    textDecoration: "none",
    color: BRAND.ink,
    transition: "transform 0.3s ease",
  };

  const logoIcon = {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: "block",
    objectFit: "contain",
    background: "transparent",
    transition: "transform 0.3s ease",
    border:"none",
  };

  const brandText = {
    lineHeight: 1.2,
  };

  const brandTitle = {
    fontWeight: 800,
    letterSpacing: "-0.02em",
    fontSize: isMobile ? 16 : 18,
    margin: 0,
    color: BRAND.ink,
  };

  const brandSub = {
    margin: 0,
    fontSize: 12,
    opacity: 0.7,
    fontWeight: 600,
    color: BRAND.ink2,
  };

  const nav = {
    display: "flex",
    alignItems: "center",
    gap: 16,
  };

  const navLink = {
    fontSize: 14,
    fontWeight: 600,
    color: BRAND.ink,
    textDecoration: "none",
    transition: "color 0.3s ease",
    padding: "8px 0",
  };

  const loginBtn = {
    padding: isMobile ? "10px 20px" : "12px 24px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    textDecoration: "none",
    background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.green})`,
    color: "#fff",
    border: "none",
    boxShadow: `0 4px 12px ${BRAND.green}40`,
    transition: "all 0.3s ease",
    display: "inline-block",
  };

  const hamburger = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    cursor: "pointer",
    padding: 8,
    background: "transparent",
    border: "none",
  };

  const hamburgerLine = {
    width: 24,
    height: 2,
    background: BRAND.ink,
    borderRadius: 2,
    transition: "all 0.3s ease",
  };

  const mobileMenu = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: BRAND.glass,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    zIndex: 99,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    transform: menuOpen ? "translateX(0)" : "translateX(100%)",
    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  };

  const outletWrap = {
    width: "100%",
    minHeight: hideChrome ? "100dvh" : "auto",
    paddingTop: 0,
  };

  return (
    <div style={page}>
      {!hideChrome && (
        <>
          {/* Modern Navbar */}
          <div style={topbar}>
            <div style={wrap}>
              {/* Logo/Brand */}
              <Link
                to="/"
                style={brand}
                onMouseEnter={(e) => {
                  const icon = e.currentTarget.querySelector('[data-logo-icon]');
                  if (icon) icon.style.transform = "rotateY(180deg)";
                }}
                onMouseLeave={(e) => {
                  const icon = e.currentTarget.querySelector('[data-logo-icon]');
                  if (icon) icon.style.transform = "rotateY(0deg)";
                }}
              >
                <img src="/logo3.png" alt="CV. Mitra Setia" style={logoIcon} data-logo-icon />
                {!isMobile && (
                  <div style={brandText}>
                    <p style={brandTitle}>CV. Mitra Setia</p>
                    <p style={brandSub}>Transport & Logistics</p>
                  </div>
                )}
              </Link>

              {/* Desktop Navigation */}
              {!isMobile && (
                <div style={nav}>
                  <a
                    href="/#services"
                    style={navLink}
                    onMouseEnter={(e) => (e.currentTarget.style.color = BRAND.green)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = BRAND.ink)}
                  >
                    Layanan
                  </a>
                  <a
                    href="/#contact"
                    style={navLink}
                    onMouseEnter={(e) => (e.currentTarget.style.color = BRAND.green)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = BRAND.ink)}
                  >
                    Kontak
                  </a>
                  <Link
                    to="/login"
                    style={loginBtn}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = `0 6px 20px ${BRAND.green}50`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = `0 4px 12px ${BRAND.green}40`;
                    }}
                  >
                    Login
                  </Link>
                </div>
              )}

              {/* Mobile Hamburger */}
              {isMobile && (
                <button
                  style={hamburger}
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="Toggle menu"
                >
                  <span style={hamburgerLine} />
                  <span style={hamburgerLine} />
                  <span style={hamburgerLine} />
                </button>
              )}
            </div>
          </div>

          {/* Mobile Menu */}
          {isMobile && (
            <div style={mobileMenu}>
              <button
                style={{
                  position: "absolute",
                  top: 20,
                  right: 20,
                  background: "transparent",
                  border: "none",
                  fontSize: 32,
                  cursor: "pointer",
                  color: BRAND.ink,
                }}
                onClick={() => setMenuOpen(false)}
              >
                ×
              </button>
              
              <a
                href="/#services"
                style={{
                  ...navLink,
                  fontSize: 24,
                  fontWeight: 700,
                }}
                onClick={() => setMenuOpen(false)}
              >
                Layanan
              </a>
              <a
                href="/#contact"
                style={{
                  ...navLink,
                  fontSize: 24,
                  fontWeight: 700,
                }}
                onClick={() => setMenuOpen(false)}
              >
                Kontak
              </a>
              <Link
                to="/login"
                style={{
                  ...loginBtn,
                  fontSize: 18,
                  padding: "16px 40px",
                }}
                onClick={() => setMenuOpen(false)}
              >
                Login
              </Link>
            </div>
          )}
        </>
      )}

      {/* Main Content */}
      <div style={outletWrap}>
        <Outlet />
      </div>

      {/* Add keyframe animations */}
      <style>{`
        @keyframes logoSpin {
          0%, 100% { transform: rotateY(0deg); }
          50% { transform: rotateY(180deg); }
        }
      `}</style>
    </div>
  );
}
