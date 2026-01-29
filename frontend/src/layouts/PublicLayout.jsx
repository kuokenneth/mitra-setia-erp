import { Outlet, Link, NavLink } from "react-router-dom";

export default function PublicLayout() {
  const BRAND = {
    green1: "#22C55E",
    green2: "#16A34A",
    mintBgTop: "#ECFDF5",
    mintBgBottom: "#F7FFFB",
    ink: "#0B2A1F",
    mintBorder: "rgba(134, 239, 172, 0.65)",
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;

  const page = {
    minHeight: "100vh",
    background: `linear-gradient(180deg, ${BRAND.mintBgTop} 0%, ${BRAND.mintBgBottom} 70%)`,
    color: BRAND.ink,
    fontFamily:
      '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  };

  const topbar = {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "rgba(255,255,255,0.98)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(20, 80, 60, 0.10)",
    boxShadow: "0 18px 36px rgba(0,0,0,0.08)",
  };

  const wrap = {
    maxWidth: 1180,
    margin: "0 auto",
    padding: isMobile ? "10px 12px" : "14px 18px",
    display: "flex",
    alignItems: isMobile ? "flex-start" : "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  };

  const brand = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    textDecoration: "none",
    color: BRAND.ink,
    minWidth: 0,
    flex: isMobile ? "1 1 100%" : "0 0 auto",
  };

  const logoImg = {
    height: isMobile ? 46 : 80,
    width: "auto",
    display: "block",
    borderRadius: 10,
  };

  const nav = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    width: isMobile ? "100%" : "auto",
    justifyContent: isMobile ? "flex-start" : "flex-end",
  };

  const pill = {
    padding: isMobile ? "9px 12px" : "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(20,80,60,0.14)",
    background: "#fff",
    color: BRAND.ink,
    fontWeight: 900,
    fontSize: isMobile ? 13 : 14,
    textDecoration: "none",
    boxShadow: "0 10px 25px rgba(10,40,30,0.06)",
  };

  const activePill = {
    ...pill,
    border: `1px solid ${BRAND.mintBorder}`,
    background: "rgba(134,239,172,0.18)",
  };

  const loginBtn = {
    ...pill,
    background: `linear-gradient(90deg, ${BRAND.green1}, ${BRAND.green2})`,
    color: "#fff",
    border: "1px solid rgba(34,197,94,0.35)",
    boxShadow: "0 16px 35px rgba(34,197,94,0.22)",
  };

  const outletWrap = { width: "100%" };

  const footer = {
    marginTop: 0,
    padding: isMobile ? "18px 12px" : "26px 18px",
    borderTop: "1px solid rgba(20,80,60,0.10)",
    opacity: 0.85,
    background: "rgba(255,255,255,0.35)",
  };

  return (
    <div style={page}>
      <div style={topbar}>
        <div style={wrap}>
          <Link to="/" style={brand}>
            <img src="/logo.jpg" alt="CV. Mitra Setia" style={logoImg} />
          </Link>

          <div style={nav}>
            <NavLink to="/" end style={({ isActive }) => (isActive ? activePill : pill)}>
              Home
            </NavLink>

            <Link to="/login" style={loginBtn}>
              Login
            </Link>
          </div>
        </div>
      </div>

      <div style={outletWrap}>
        <Outlet />
      </div>

      <div style={footer}>
        <div style={{ maxWidth: 1180, margin: "0 auto", fontSize: 12 }}>
          © {new Date().getFullYear()} CV. Mitra Setia · Medan, Indonesia · Built with MitraSetia ERP
        </div>
      </div>
    </div>
  );
}
