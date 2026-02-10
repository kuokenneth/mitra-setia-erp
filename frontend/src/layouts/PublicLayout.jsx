// src/layouts/PublicLayout.jsx
import { Outlet, Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

export default function PublicLayout() {
  const { pathname } = useLocation();
  const hideChrome = pathname === "/login" || pathname === "/register";

  const BRAND = useMemo(
    () => ({
      emerald: "#1f9d53",
      emerald2: "#2ccf6a",
      forest: "#111827",
      mintTop: "#6fcf8f",
      mintBottom: "#5cc67f",
      glass: "rgba(255,255,255,0.72)",
    }),
    []
  );

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 640 : false
  );
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 640);
    const onScroll = () => setScrolled(window.scrollY > 10);

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
    background: `radial-gradient(700px 420px at 14% 12%, rgba(34,197,94,0.22), transparent 60%),
                 linear-gradient(180deg, ${BRAND.mintTop} 0%, ${BRAND.mintBottom} 70%)`,
    backgroundImage:
      "radial-gradient(rgba(255,255,255,0.25) 1px, transparent 1px)",
    backgroundSize: "16px 16px",
    color: BRAND.forest,
    fontFamily:
      '"Manrope",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  };

  const topbar = {
    position: "sticky",
    top: 0,
    zIndex: 50,
    transition: "all 220ms ease",
    backdropFilter: "blur(10px)",
    background: scrolled ? "rgba(255,255,255,0.96)" : "transparent",
    borderBottom: scrolled ? "1px solid rgba(17, 24, 39, 0.06)" : "none",
    boxShadow: "none",
  };

  const wrap = {
    maxWidth: 1180,
    margin: "0 auto",
    padding: isMobile ? "10px 12px" : scrolled ? "10px 18px" : "18px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  };

  const brand = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    textDecoration: "none",
    color: BRAND.forest,
    minWidth: 0,
  };

  const logoWrap = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: scrolled ? "6px 10px" : "8px 12px",
    borderRadius: 16,
    background: "transparent",
    border: "1px solid transparent",
    boxShadow: "none",
    transition: "all 220ms ease",
  };

  const logoImg = {
    height: isMobile ? 42 : scrolled ? 52 : 66,
    width: "auto",
    display: "block",
    borderRadius: 12,
  };

  const brandText = {
    lineHeight: 1.1,
    minWidth: 0,
  };

  const brandTitle = {
    fontWeight: 800,
    letterSpacing: -0.2,
    fontSize: isMobile ? 15 : 16,
    margin: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: isMobile ? 220 : 360,
  };

  const brandSub = {
    margin: 0,
    fontSize: 12,
    opacity: 0.7,
    fontWeight: 600,
    letterSpacing: 0.2,
  };

  const nav = {
    display: "flex",
    alignItems: "center",
    gap: 10,
  };

  const loginBtn = {
    padding: isMobile ? "10px 14px" : "10px 16px",
    borderRadius: 999,
    fontWeight: 700,
    textDecoration: "none",
    background: "transparent",
    color: BRAND.forest,
    border: "1px solid rgba(17,24,39,0.16)",
    boxShadow: "none",
    transition: "transform 160ms ease",
  };

  const outletWrap = {
    width: "100%",
    minHeight: hideChrome ? "100dvh" : "auto",
    display: "block",
    placeItems: "unset",
    padding: 0,
    boxSizing: "border-box",
  };

  const footer = {
    marginTop: 0,
    padding: isMobile ? "18px 12px" : "26px 18px",
    borderTop: "1px solid rgba(20,80,60,0.10)",
    opacity: 0.85,
    background: "rgba(255,255,255,0.50)",
    backdropFilter: "blur(10px)",
  };

  return (
    <div style={page}>
      {!hideChrome && (
        <div style={topbar}>
          <div style={wrap}>
            <Link to="/" style={brand}>
              <div style={logoWrap}>
                <img src="/logo3.png" alt="CV. Mitra Setia" style={logoImg} />
                {!isMobile && (
                  <div style={brandText}>
                    <p style={brandTitle}>CV. Mitra Setia</p>
                    <p style={brandSub}>Transport & Logistics</p>
                  </div>
                )}
              </div>
            </Link>

            <div style={nav}>
              <Link
                to="/login"
                style={loginBtn}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      )}

      <div style={outletWrap}>
        <Outlet />
      </div>

    </div>
  );
}
