// src/pages/Landing.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  // TODO: change
  const WA_NUMBER = "62XXXXXXXXXX";
  const PHONE = "+62 000-0000-0000";
  const ADDRESS = "Jl. Cemara No.40, Indra Kasih, Kec. Percut Sei Tuan, Kabupaten Deli Serdang, Sumatera Utara 20371Medan, Sumatera Utara, Indonesia";

  const waLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    "Halo CV. Mitra Setia, saya ingin tanya layanan pengangkutan."
  )}`;

  // ✅ GREEN brand only
  const BRAND = {
    ink: "#0B2A1F",
    ink2: "#11362A",
    mintTop: "#ECFDF5",
    mintBottom: "#F7FFFB",
    line: "rgba(20,80,60,0.10)",
    cardLine: "rgba(20,80,60,0.12)",
    green: "#16A34A",
    green2: "#22C55E",
    greenSoft: "rgba(34,197,94,0.14)",
    footerBg: "#173E35",
    footerText: "rgba(255,255,255,0.88)",
    footerMuted: "rgba(255,255,255,0.72)",
  };

  const slides = useMemo(
    () => [
      {
        img: "/hero-3.jpg",
        tag: "Armada & operasional",
        title: "Keamanan muatan\njadi prioritas.",
        desc: "Koordinasi terstruktur untuk meminimalkan keterlambatan dan downtime.",
        ctaA: { label: "Kontak", href: "#contact" },
        ctaB: { label: "Staff Login", to: "/login" },
      },
      {
        img: "/hero-1.jpg",
        tag: "Transport & Logistics",
        title: "Pengangkutan rutin\n& kontrak perusahaan.",
        desc: "Melayani pengangkutan pupuk dan kebutuhan logistik perusahaan di Sumatera.",
        ctaA: { label: "Minta Penawaran", href: waLink },
        ctaB: { label: "Lihat Layanan", href: "#services" },
      },
      {
        img: "/hero-2.jpg",
        tag: "Dokumentasi rapi",
        title: "Proses jelas.\nKomunikasi cepat.",
        desc: "SOP terukur, dokumentasi rapi, dan update cepat untuk kontrol pengiriman.",
        ctaA: { label: "Chat WhatsApp", href: waLink },
        ctaB: { label: "Kontak", href: "#contact" },
      },
    ],
    [waLink]
  );

  const [idx, setIdx] = useState(0);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [scrollY, setScrollY] = useState(0);

  const isMobile = vw <= 640;
  const isNarrow = vw < 980;

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    const onScroll = () => setScrollY(window.scrollY || 0);

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });

    onResize();
    onScroll();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setIdx((v) => (v + 1) % slides.length), 6500);
    return () => clearInterval(t);
  }, [slides.length]);

  const s = slides[idx];

  // ✅ scroll reactive
  const parallax = Math.min(80, scrollY * 0.18);

  const page = {
    minHeight: "100vh",
    background: `linear-gradient(180deg, ${BRAND.mintTop} 0%, ${BRAND.mintBottom} 70%)`,
    color: BRAND.ink,
    fontFamily:
      '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  };

  const container = {
    maxWidth: 1180,
    margin: "0 auto",
    padding: isMobile ? "0 12px" : "0 22px",
  };

  const section = { padding: isMobile ? "64px 0" : "86px 0" };

  const eyebrow = {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    opacity: 0.6,
  };

  const h2 = {
    fontSize: isMobile ? 28 : 40,
    lineHeight: 1.12,
    letterSpacing: -1.0,
    fontWeight: 1000,
    margin: "10px 0 12px",
  };

  const p = {
    margin: 0,
    fontSize: 16,
    lineHeight: 1.9,
    opacity: 0.85,
    maxWidth: 820,
  };

  const card = {
    borderRadius: 18,
    border: `1px solid ${BRAND.cardLine}`,
    background: "#fff",
    padding: 18,
    boxShadow: "0 12px 30px rgba(10,40,30,0.05)",
  };

  // ✅ Premium button set (matches screenshot vibe)
  const btn = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.92)",
    color: BRAND.ink,
    fontWeight: 950,
    textDecoration: "none",
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(0,0,0,0.12)",
    transition: "transform 160ms ease",
  };

  const btnGreen = {
    ...btn,
    borderRadius: 12,
    padding: "12px 16px",
    background: `linear-gradient(90deg, ${BRAND.green2}, ${BRAND.green})`,
    border: "1px solid rgba(34,197,94,0.38)",
    color: "#fff",
    boxShadow: "0 18px 40px rgba(34,197,94,0.20)",
  };

  const heroWrap = {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    borderBottom: "none", // ✅ remove border so it doesn’t fight the wave
    background: "#fff",
  };


  const hero = {
    position: "relative",
    minHeight: isMobile ? 560 : isNarrow ? 640 : 720,
  };

  const arrowBtn = {
    width: isMobile ? 40 : 44,
    height: isMobile ? 40 : 44,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.24)",
    background: "rgba(255,255,255,0.14)",
    color: "#fff",
    fontWeight: 1000,
    cursor: "pointer",
    backdropFilter: "blur(8px)",
  };

  // ✅ Cleaner abstract (corporate wave)
  function AbstractWave({ nextBg = "#ECFDF5" }) {
    return (
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -1,
          height: 86,               // ✅ smaller
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <svg viewBox="0 0 1440 86" preserveAspectRatio="none" width="100%" height="86">
          {/* ✅ single clean wave, no double band */}
          <path
            d="M0,44 C220,78 520,22 720,46 C960,74 1180,48 1440,62 L1440,86 L0,86 Z"
            fill={nextBg}           // ✅ match the next section background
          />
        </svg>
      </div>
    );
  }


  return (
    <div style={page}>
      {/* ===========================
          HERO — improved clarity + better spacing
         =========================== */}
      <section style={heroWrap}>
        <div style={hero}>
          {/* background image (sharper) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${s.img})`,
              backgroundSize: "cover",
              backgroundPosition: `center calc(18% + ${parallax}px)`,
              filter: "saturate(1.08) contrast(1.10) brightness(0.98)",
              transform: "scale(1.03)",
            }}
          />

          {/* overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, rgba(6,22,17,0.78) 0%, rgba(6,22,17,0.52) 45%, rgba(6,22,17,0.18) 100%)",
            }}
          />

          {/* soft top highlight */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.00) 42%)",
              pointerEvents: "none",
            }}
          />

          {/* soft green glow */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(900px 520px at 18% 18%, ${BRAND.greenSoft}, transparent 60%)`,
              pointerEvents: "none",
            }}
          />

          {/* content */}
          <div
            style={{
              ...container,
              position: "relative",
              paddingTop: isMobile ? 64 : isNarrow ? 72 : 86, // ✅ fixes awkward gap
              paddingBottom: isMobile ? 110 : 130,
            }}
          >
            <div style={{ maxWidth: 860, color: "#fff" }}>
              {/* tag pill */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.16)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  fontSize: 12,
                  fontWeight: 950,
                  color: "rgba(255,255,255,0.92)",
                  boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: BRAND.green2,
                    boxShadow: "0 0 14px rgba(34,197,94,0.60)",
                  }}
                />
                {s.tag}
              </div>

              <h1
                style={{
                  margin: "16px 0 12px",
                  fontSize: isMobile ? 40 : isNarrow ? 52 : 76,
                  lineHeight: 1.0,
                  letterSpacing: isMobile ? -1.1 : -1.9,
                  fontWeight: 1000,
                  whiteSpace: "pre-line",
                }}
              >
                {s.title}
              </h1>

              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.9, opacity: 0.9, maxWidth: 740 }}>
                {s.desc}
              </p>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
                {"href" in s.ctaA ? (
                  <a
                    href={s.ctaA.href}
                    style={btnGreen}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
                  >
                    {s.ctaA.label}
                  </a>
                ) : null}

                {"href" in s.ctaB ? (
                  <a
                    href={s.ctaB.href}
                    style={btn}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
                  >
                    {s.ctaB.label}
                  </a>
                ) : (
                  <Link
                    to={s.ctaB.to}
                    style={{
                      ...btn,
                      background: "rgba(255,255,255,0.12)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.18)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
                  >
                    {s.ctaB.label}
                  </Link>
                )}
              </div>

              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.78, fontWeight: 800 }}>
                Berbasis di Medan · Pengiriman ke Mandailing Natal
              </div>
            </div>
          </div>

          {/* arrows */}
          <div style={{ position: "absolute", left: isMobile ? 10 : 22, top: "50%", transform: "translateY(-50%)" }}>
            <button
              onClick={() => setIdx((v) => (v - 1 + slides.length) % slides.length)}
              style={arrowBtn}
              aria-label="Prev slide"
            >
              ←
            </button>
          </div>
          <div style={{ position: "absolute", right: isMobile ? 10 : 22, top: "50%", transform: "translateY(-50%)" }}>
            <button
              onClick={() => setIdx((v) => (v + 1) % slides.length)}
              style={arrowBtn}
              aria-label="Next slide"
            >
              →
            </button>
          </div>

          {/* dots */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: isMobile ? 22 : 18,
              transform: "translateX(-50%)",
              display: "flex",
              gap: 8,
              alignItems: "center",
              zIndex: 5,
            }}
          >
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Slide ${i + 1}`}
                style={{
                  width: i === idx ? 28 : 10,
                  height: 10,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.22)",
                  background: i === idx ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.24)",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>

          {/* abstract */}
          <AbstractWave nextBg={BRAND.mintTop} />

        </div>
      </section>

      {/* ===========================
          SERVICES
         =========================== */}
      <section id="services" style={{ ...section, background: BRAND.mintTop }}>
        <div style={container}>
          <div style={eyebrow}>Layanan</div>
          <div style={h2}>Apa yang kami kerjakan</div>
          <p style={p}>
            Fokus untuk pengiriman rutin & kontrak. Proses jelas, dokumentasi rapi, dan komunikasi cepat.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))",
              gap: 18,
              marginTop: 26,
            }}
          >
            {[
              {
                t: "Pengangkutan Pupuk",
                d: "Pengiriman terjadwal untuk kebun & distributor pupuk dengan SOP yang jelas.",
              },
              {
                t: "Logistik",
                d: "Pengiriman parts/komponen/barang untuk pabrik & armada dengan dokumentasi rapi.",
              },
              {
                t: "Kontrak Perusahaan",
                d: "Kerjasama jangka panjang untuk pengiriman rutin & kebutuhan operasional.",
              },
            ].map((x) => (
              <div key={x.t} style={card}>
                <div style={{ fontWeight: 1000, fontSize: 18, letterSpacing: -0.3 }}>{x.t}</div>
                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.78, lineHeight: 1.75 }}>{x.d}</div>

                <a
                  href="#contact"
                  style={{
                    marginTop: 14,
                    display: "inline-flex",
                    gap: 10,
                    alignItems: "center",
                    textDecoration: "none",
                    color: BRAND.green,
                    fontWeight: 1000,
                    letterSpacing: 0.5,
                  }}
                >
                  SELENGKAPNYA <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
                </a>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href={waLink} target="_blank" rel="noreferrer" style={btnGreen}>
              Minta Penawaran
            </a>
            <a href="#contact" style={btn}>
              Kontak
            </a>
          </div>
        </div>
      </section>

      {/* ===========================
          CONTACT
         =========================== */}
      <section
        id="contact"
        style={{
          padding: isMobile ? "64px 0" : "78px 0",
          background: "#fff",
          borderTop: `1px solid ${BRAND.line}`,
        }}
      >
        <div style={container}>
          <div style={eyebrow}>Kontak</div>
          <div style={h2}>Hubungi CV. Mitra Setia</div>
          <p style={p}>Kirim detail rute & muatan via WhatsApp untuk penawaran cepat.</p>

          <div
            style={{
              marginTop: 22,
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
              gap: 18,
            }}
          >
            <div style={card}>
              <div style={{ fontWeight: 1000 }}>WhatsApp</div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.78, lineHeight: 1.75 }}>
                Chat admin untuk penawaran cepat.
              </div>
              <div style={{ marginTop: 14 }}>
                <a href={waLink} target="_blank" rel="noreferrer" style={btnGreen}>
                  Chat WhatsApp
                </a>
              </div>

              <div style={{ marginTop: 18, height: 1, background: BRAND.line }} />

              <div style={{ marginTop: 18, fontWeight: 1000 }}>Telepon</div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.78 }}>{PHONE}</div>
              <div style={{ marginTop: 14 }}>
                <a href={`tel:${PHONE.replace(/\s/g, "")}`} style={btn}>
                  Call
                </a>
              </div>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 1000 }}>Alamat</div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.78, lineHeight: 1.75 }}>{ADDRESS}</div>

              <div style={{ marginTop: 18, height: 1, background: BRAND.line }} />

              <div style={{ marginTop: 18, fontWeight: 1000 }}>Staff Internal</div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.78, lineHeight: 1.75 }}>
                Login untuk akses sistem ERP internal.
              </div>
              <div style={{ marginTop: 14 }}>
                <Link to="/login" style={btn}>
                  Staff Login (ERP)
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===========================
          FOOTER (simple)
         =========================== */}
      <footer style={{ background: BRAND.footerBg, color: BRAND.footerText }}>
        <div style={{ ...container, padding: isMobile ? "22px 0" : "26px 0" }}>
          <div style={{ fontSize: 12, color: BRAND.footerMuted, fontWeight: 850 }}>
            © {new Date().getFullYear()} CV. Mitra Setia · Medan, Indonesia · Built with MitraSetia ERP
          </div>
        </div>
      </footer>
    </div>
  );
}
