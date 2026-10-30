import { useLayoutEffect, useRef } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import gsap from "gsap";
import { useAuth } from "../AuthContext";
import { homeFor } from "./authErrors";
import "./AuthLayout.css";

const VISUALS = {
  "/login": { src: "/auth/auth-login.webp", alt: "Tim CV. Mitra Setia memuat muatan ke atas truk" },
  "/register": { src: "/auth/auth-register.webp", alt: "Barisan truk CV. Mitra Setia saat senja" },
};

/**
 * Shared shell for /login and /register.
 * It stays mounted when switching between the two pages, so the visual panel
 * cross-fades instead of reloading, and only the form content changes.
 */
export default function AuthLayout() {
  const { user, loading } = useAuth();
  const { pathname, state } = useLocation();
  const visualRef = useRef(null);

  // subtle parallax: slow settle on load + gentle drift following the pointer
  useLayoutEffect(() => {
    const el = visualRef.current;
    if (!el) return undefined;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".au-photos", { scale: 1.12, duration: 2.2, ease: "power2.out" });
        gsap.from(".au-visual-copy > *", { y: 24, opacity: 0, duration: 1, stagger: 0.1, ease: "power3.out", delay: 0.2 });
      });
      mm.add("(prefers-reduced-motion: no-preference) and (pointer: fine) and (min-width: 900px)", () => {
        const xTo = gsap.quickTo(".au-photos", "x", { duration: 1.2, ease: "power3.out" });
        const yTo = gsap.quickTo(".au-photos", "y", { duration: 1.2, ease: "power3.out" });
        const onMove = e => {
          const r = el.getBoundingClientRect();
          xTo(((e.clientX - r.left) / r.width - 0.5) * -18);
          yTo(((e.clientY - r.top) / r.height - 0.5) * -14);
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        return () => window.removeEventListener("pointermove", onMove);
      });
    }, el);
    return () => ctx.revert();
  }, []);

  // already signed in → straight to the ERP (respecting a pending "from" redirect)
  if (!loading && user) return <Navigate to={state?.from || homeFor(user)} replace />;

  const active = VISUALS[pathname] ? pathname : "/login";

  return (
    <main className="au">
      <aside className="au-visual" ref={visualRef}>
        <div className="au-photos" aria-hidden="true">
          {Object.entries(VISUALS).map(([path, v]) => (
            <img key={path} src={v.src} alt="" className={path === active ? "is-active" : ""}
              decoding="async" fetchPriority={path === active ? "high" : "low"} />
          ))}
        </div>
        <span className="au-sr">{VISUALS[active].alt}</span>
        <div className="au-shade" aria-hidden="true" />
        <div className="au-visual-inner">
          <Link to="/" className="au-brand" aria-label="CV. Mitra Setia, kembali ke beranda">
            <img src="/logo3.png" alt="" />
            <span>CV. MITRA SETIA</span>
          </Link>
          <div className="au-visual-copy">
            <p className="au-label">EMPLOYEE ACCESS PORTAL</p>
            <p className="au-tagline">DRIVEN BY TRUST.<br />POWERED BY PEOPLE.</p>
            <p className="au-support">Portal internal untuk mendukung operasional transportasi yang lebih terintegrasi, efisien, dan profesional.</p>
          </div>
        </div>
      </aside>

      <section className="au-panel">
        <div className="au-top">
          <Link to="/" className="au-back" data-testid="auth-back-home"><FiArrowLeft aria-hidden="true" /> Kembali ke Beranda</Link>
        </div>
        <div className="au-main">
          <div className="au-form-wrap" key={pathname}>
            <Outlet />
          </div>
        </div>
        <p className="au-foot">Akses terbatas untuk karyawan CV. Mitra Setia. Aktivitas sistem tercatat.</p>
      </section>
    </main>
  );
}
