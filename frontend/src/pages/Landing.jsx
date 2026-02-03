// src/pages/Landing.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  // TODO: change
  const WA_NUMBER = "62XXXXXXXXXX";
  const PHONE = "+62 000-0000-0000";
  const ADDRESS =
    "Jl. Cemara No.40, Indra Kasih, Kec. Percut Sei Tuan,\nKabupaten Deli Serdang, Sumatera Utara 20371\nMedan, Sumatera Utara, Indonesia";

  const waLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    "Halo CV. Mitra Setia, saya ingin tanya layanan pengangkutan."
  )}`;

  // ✅ GREEN brand only
  const BRAND = {
    ink: "#111827",
    ink2: "#1F2937",
    mintTop: "#F5F6F7",
    mintBottom: "#FFFFFF",
    line: "rgba(20,80,60,0.10)",
    cardLine: "rgba(17,24,39,0.10)",
    green: "#16A34A",
    green2: "#22C55E",
    greenSoft: "rgba(34,197,94,0.14)",
    footerBg: "#0B1F16",
    footerText: "rgba(255,255,255,0.9)",
    footerMuted: "rgba(255,255,255,0.7)",
  };

  const HERO = {
    img: "/hero-1.jpg",
    tag: "Transport & Logistics",
    title: "Pengangkutan rutin\n& kontrak perusahaan.",
    desc: "Pengiriman terjadwal dengan koordinasi yang rapi untuk kebutuhan operasional perusahaan.",
    ctaA: { label: "Minta Penawaran", href: waLink },
    ctaB: { label: "Lihat Layanan", href: "#services" },
  };

  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [scrollY, setScrollY] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);
  const [openService, setOpenService] = useState(0);

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
    const nodes = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window) || nodes.length === 0) {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return undefined;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  // ✅ scroll reactive
  const parallax = Math.min(80, scrollY * 0.18);

  const page = {
    minHeight: "100vh",
    background: `linear-gradient(180deg, ${BRAND.mintTop} 0%, ${BRAND.mintBottom} 60%)`,
    color: BRAND.ink,
    fontFamily:
      '"Manrope",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  };

  const container = {
    maxWidth: 1180,
    margin: "0 auto",
    padding: isMobile ? "0 16px" : "0 22px",
  };

  const section = {
    padding: isMobile ? "56px 0" : "96px 0",
    scrollSnapAlign: "start",
    scrollSnapStop: "always",
  };
  const sectionCenter = { textAlign: "center" };

  const eyebrow = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    opacity: 0.5,
  };

  const h2 = {
    fontSize: isMobile ? 28 : 40,
    lineHeight: 1.15,
    letterSpacing: -0.3,
    fontWeight: 700,
    margin: "10px 0 12px",
  };

  const p = {
    margin: 0,
    fontSize: 17,
    lineHeight: 1.8,
    opacity: 0.78,
    maxWidth: 820,
  };

  const card = {
    borderRadius: 18,
    border: `1px solid ${BRAND.cardLine}`,
    background: "#fff",
    padding: 18,
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
  };
  const panel = {
    ...card,
    padding: isMobile ? 22 : 28,
    borderRadius: 24,
  };

  // ✅ Premium button set (matches screenshot vibe)
  const btn = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(17,24,39,0.10)",
    background: "#fff",
    color: BRAND.ink,
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
    transition: "transform 160ms ease",
  };

  const btnGreen = {
    ...btn,
    borderRadius: 12,
    padding: "12px 16px",
    background: `linear-gradient(95deg, ${BRAND.green2}, ${BRAND.green})`,
    border: "1px solid rgba(34,197,94,0.40)",
    color: "#fff",
    boxShadow: "0 14px 28px rgba(34,197,94,0.18)",
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
    <div
      style={{
        ...page,
        scrollSnapType: isMobile ? "none" : "y mandatory",
        scrollBehavior: "smooth",
      }}
    >
      {/* ===========================
          HERO — improved clarity + better spacing
         =========================== */}
      <section style={{ ...heroWrap, scrollSnapAlign: "start" }}>
        <div style={hero}>
          {/* background image (sharper) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${HERO.img})`,
              backgroundSize: "cover",
              backgroundPosition: `center calc(18% + ${parallax}px)`,
              filter: "saturate(1.02) contrast(1.04) brightness(0.98)",
              transform: "scale(1.03)",
            }}
          />

          {/* overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.75) 70%)",
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
              paddingTop: isMobile ? 56 : isNarrow ? 64 : 72,
              paddingBottom: isMobile ? 90 : 110,
            }}
          >
            <div
              style={{
                maxWidth: 820,
                margin: "0 auto",
                color: BRAND.ink,
                background: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(17,24,39,0.08)",
                borderRadius: 28,
                padding: isMobile ? 18 : 26,
                boxShadow: "0 20px 44px rgba(15,23,42,0.12)",
                backdropFilter: "blur(10px)",
                textAlign: "center",
              }}
              className="fade-up"
            >
              {/* tag pill */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(34,197,94,0.10)",
                  border: "1px solid rgba(34,197,94,0.25)",
                  fontSize: 12,
                  fontWeight: 800,
                  color: BRAND.ink,
                  margin: "0 auto",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: BRAND.green2,
                    boxShadow: "0 0 10px rgba(34,197,94,0.50)",
                  }}
                />
                {HERO.tag}
              </div>

              <h1
                style={{
                  margin: "16px 0 12px",
                  fontSize: isMobile ? 34 : isNarrow ? 50 : 72,
                  lineHeight: 1.08,
                  letterSpacing: isMobile ? -0.6 : -1.0,
                  fontWeight: 700,
                  whiteSpace: "pre-line",
                }}
              >
                {HERO.title}
              </h1>

              <p style={{ margin: "0 auto", fontSize: isMobile ? 15 : 16, lineHeight: 1.8, opacity: 0.78, maxWidth: 620 }}>
                {HERO.desc}
              </p>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18, justifyContent: "center" }}>
                {"href" in HERO.ctaA ? (
                  <a
                    href={HERO.ctaA.href}
                    style={btnGreen}
                    className="lift"
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
                  >
                    {HERO.ctaA.label}
                  </a>
                ) : null}

                {"href" in HERO.ctaB ? (
                  <a
                    href={HERO.ctaB.href}
                    style={btn}
                    className="lift"
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
                  >
                    {HERO.ctaB.label}
                  </a>
                ) : (
                  <Link
                    to={HERO.ctaB.to}
                    style={btn}
                    className="lift"
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
                  >
                    {HERO.ctaB.label}
                  </Link>
                )}
              </div>

              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.78, fontWeight: 800 }}>
                Berbasis di Medan · Pengiriman ke Mandailing Natal
              </div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, fontWeight: 600 }}>
                Operasional harian · Dokumentasi rapi · Kontak cepat
              </div>
            </div>
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
          <div style={sectionCenter}>
            <div style={eyebrow} className="reveal slide-left" data-reveal>Layanan</div>
            <div style={h2} className="reveal slide-left" data-reveal>
              Fokus pada rute yang konsisten dan layanan yang dapat diandalkan.
            </div>
            <p style={p} className="reveal slide-left" data-reveal>
              Pengangkutan rutin, logistik operasional, dan kontrak perusahaan dengan standar yang jelas.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))",
              gap: isMobile ? 12 : 14,
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
            ].map((x, i) => (
              <div
                key={x.t}
                style={{
                  ...panel,
                  position: "relative",
                  overflow: "hidden",
                  minHeight: isMobile ? 120 : 150,
                  padding: isMobile ? 12 : 18,
                  background: "#fff",
                  border: "1px solid rgba(17,24,39,0.08)",
                }}
                className={`lift reveal ${i % 2 === 0 ? "slide-left" : "slide-right"}`}
                data-reveal
              >
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      width: 28,
                      height: 3,
                      borderRadius: 999,
                      background: "linear-gradient(90deg, rgba(34,197,94,0.9), rgba(34,197,94,0.2))",
                      marginBottom: 10,
                    }}
                  />
                  <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.2 }}>{x.t}</div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72, lineHeight: 1.6 }}>
                    Layanan terfokus dan terukur untuk kebutuhan operasional perusahaan.
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenService(openService === i ? -1 : i)}
                    style={{
                      marginTop: 10,
                      display: "inline-flex",
                      gap: 10,
                      alignItems: "center",
                      border: "none",
                      background: "transparent",
                      color: BRAND.green,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 12,
                    }}
                    aria-expanded={openService === i}
                  >
                    Lihat detail <span style={{ fontSize: 18, lineHeight: 1 }}>{openService === i ? "–" : "→"}</span>
                  </button>
                  {openService === i && (
                    <div style={{ marginTop: 10, fontSize: 13, opacity: 0.78, lineHeight: 1.75 }}>
                      {x.d}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}
            className="reveal slide-left"
            data-reveal
          >
            <a href={waLink} target="_blank" rel="noreferrer" style={btnGreen} className="lift">
              Minta Penawaran
            </a>
            <a href="#contact" style={btn} className="lift">
              Kontak
            </a>
          </div>
        </div>
      </section>

      {/* ===========================
          PRODUCT PANELS
         =========================== */}
      {[
        {
          title: "Pengiriman yang konsisten, setiap hari.",
          desc: "Jadwal terukur, komunikasi jelas, dan dokumentasi rapi untuk setiap perjalanan.",
          img: "/hero-1.jpg",
        },
        {
          title: "Kontrol operasional yang lebih baik.",
          desc: "Koordinasi armada dan update status agar pengambilan keputusan lebih cepat.",
          img: "/hero-2.jpg",
        },
        {
          title: "Partner yang bisa diandalkan.",
          desc: "Kontrak jangka panjang dengan standar layanan yang stabil.",
          img: "/hero-3.jpg",
        },
      ].map((x, i) => (
        <section
          key={x.title}
          style={{
            ...section,
            background: "#fff",
            borderTop: `1px solid ${BRAND.line}`,
            minHeight: isMobile ? "60vh" : "72vh",
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1240,
              padding: isMobile ? "0 12px" : "0 22px",
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "1.1fr 1fr",
              gap: isMobile ? 16 : 24,
              alignItems: "center",
            }}
          >
            <div
              style={{
                textAlign: isNarrow ? "center" : "left",
              }}
              className={`reveal ${i % 2 === 0 ? "slide-left" : "slide-right"}`}
              data-reveal
            >
              <div style={eyebrow}>Highlight</div>
              <div style={{ ...h2, fontSize: isMobile ? 30 : 42 }}>{x.title}</div>
              <p style={{ ...p, maxWidth: 520 }}>{x.desc}</p>
            </div>
            <div
              style={{
                position: "relative",
                borderRadius: 28,
                overflow: "hidden",
                border: "1px solid rgba(17,24,39,0.08)",
                minHeight: isMobile ? 180 : 360,
                background: "#fff",
                boxShadow: isMobile ? "0 16px 36px rgba(15,23,42,0.10)" : "0 24px 60px rgba(15,23,42,0.12)",
              }}
              className={`reveal ${i % 2 === 0 ? "slide-right" : "slide-left"}`}
              data-reveal
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${x.img})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "saturate(1.02) contrast(1.05)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.65) 70%)",
                }}
              />
            </div>
          </div>
        </section>
      ))}

      {/* ===========================
          FAQ
         =========================== */}
      <section style={{ ...section, background: "#fff", borderTop: `1px solid ${BRAND.line}` }}>
        <div style={container}>
          <div style={{ textAlign: "center" }}>
            <div style={eyebrow} className="reveal slide-right" data-reveal>FAQ</div>
            <div style={h2} className="reveal slide-right" data-reveal>Pertanyaan yang sering ditanyakan</div>
          </div>
          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 22,
            }}
          >
            {[
              {
                q: "Bagaimana cara minta penawaran cepat?",
                a: "Kirim detail rute, jenis muatan, dan jadwal lewat WhatsApp. Tim kami akan respon dengan estimasi.",
              },
              {
                q: "Apakah tersedia kontrak pengiriman rutin?",
                a: "Ya. Kami melayani kontrak bulanan hingga tahunan untuk kebutuhan operasional perusahaan.",
              },
              {
                q: "Apakah ada update pengiriman selama perjalanan?",
                a: "Ada. Kami berikan update status secara berkala sesuai kebutuhan klien.",
              },
            ].map((x, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={x.q}
                  style={{ ...card }}
                  className={`reveal ${i % 2 === 0 ? "slide-right" : "slide-left"}`}
                  data-reveal
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? -1 : i)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 16,
                      fontWeight: 900,
                      color: BRAND.ink,
                    }}
                    aria-expanded={open}
                  >
                    <span>{x.q}</span>
                    <span style={{ fontSize: 18, opacity: 0.7 }}>{open ? "–" : "+"}</span>
                  </button>
                  {open && (
                    <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.75, opacity: 0.78 }}>{x.a}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===========================
          TIMELINE
         =========================== */}
      <section style={{ ...section, background: BRAND.mintTop, borderTop: `1px solid ${BRAND.line}` }}>
        <div style={container}>
          <div style={sectionCenter}>
            <div style={eyebrow} className="reveal slide-left" data-reveal>Alur</div>
            <div style={h2} className="reveal slide-left" data-reveal>Proses kerja singkat</div>
            <p style={p} className="reveal slide-left" data-reveal>
              Langkah cepat dari permintaan hingga pengiriman, jelas dan terukur.
            </p>
          </div>

          <div
            style={{
              marginTop: 26,
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "0.9fr 1.1fr",
              gap: 18,
            }}
          >
            <div
              style={{
                position: isNarrow ? "static" : "sticky",
                top: 120,
                height: "fit-content",
                alignSelf: "start",
              }}
              className="reveal slide-left"
              data-reveal
            >
              <div style={{ ...panel, background: "#fff" }}>
                <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: -0.2 }}>
                  Alur kerja yang konsisten
                </div>
                <div style={{ marginTop: 10, fontSize: 14, opacity: 0.78, lineHeight: 1.75 }}>
                  Setiap tahap terdokumentasi, dari permintaan hingga update akhir, agar proses mudah diawasi.
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {[
                { t: "Permintaan", d: "Kirim detail rute, muatan, dan jadwal." },
                { t: "Penawaran", d: "Kami kirim estimasi biaya dan timeline." },
                { t: "Eksekusi", d: "Armada jalan sesuai SOP dan koordinasi." },
                { t: "Update", d: "Update status dan dokumentasi selesai." },
              ].map((x, i) => (
                <div
                  key={x.t}
                  style={{
                    ...card,
                    position: "relative",
                    paddingTop: 22,
                    overflow: "hidden",
                  }}
                  className={`lift reveal ${i % 2 === 0 ? "slide-right" : "slide-left"}`}
                  data-reveal
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      fontSize: 12,
                      fontWeight: 800,
                      color: BRAND.green,
                      opacity: 0.8,
                    }}
                  >
                    0{i + 1}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{x.t}</div>
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.78, lineHeight: 1.75 }}>{x.d}</div>
                </div>
              ))}
            </div>
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
          scrollSnapAlign: "start",
        }}
      >
        <div style={container}>
          <div style={{ textAlign: "center" }}>
            <div style={eyebrow} className="reveal slide-right" data-reveal>Kontak</div>
            <div style={h2} className="reveal slide-right" data-reveal>Hubungi CV. Mitra Setia</div>
            <p style={p} className="reveal slide-right" data-reveal>Kirim detail rute & muatan via WhatsApp untuk penawaran cepat.</p>
          </div>

          <div
            style={{
              marginTop: 22,
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
              gap: 18,
            }}
          >
            <div style={card} className="lift reveal slide-left" data-reveal>
              <div style={{ fontWeight: 1000 }}>WhatsApp</div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.78, lineHeight: 1.75 }}>
                Chat admin untuk penawaran cepat.
              </div>
              <div style={{ marginTop: 14 }}>
                <a href={waLink} target="_blank" rel="noreferrer" style={btnGreen} className="lift">
                  Chat WhatsApp
                </a>
              </div>

              <div style={{ marginTop: 18, height: 1, background: BRAND.line }} />

              <div style={{ marginTop: 18, fontWeight: 1000 }}>Telepon</div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.78 }}>{PHONE}</div>
              <div style={{ marginTop: 14 }}>
                <a href={`tel:${PHONE.replace(/\s/g, "")}`} style={btn} className="lift">
                  Call
                </a>
              </div>
            </div>

            <div style={card} className="lift reveal slide-right" data-reveal>
              <div style={{ fontWeight: 1000 }}>Alamat</div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  opacity: 0.78,
                  lineHeight: 1.75,
                  whiteSpace: "pre-line",
                }}
              >
                {ADDRESS}
              </div>

              <div style={{ marginTop: 18, height: 1, background: BRAND.line }} />

              <div style={{ marginTop: 18, fontWeight: 1000 }}>Staff Internal</div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.78, lineHeight: 1.75 }}>
                Login untuk akses sistem ERP internal.
              </div>
              <div style={{ marginTop: 14 }}>
                <Link to="/login" style={btn} className="lift">
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

      {/* floating quick action */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        style={{
          position: "fixed",
          right: isMobile ? 14 : 22,
          bottom: isMobile ? 16 : 22,
          width: isMobile ? 44 : 48,
          height: isMobile ? 44 : 48,
          borderRadius: 999,
          border: "1px solid rgba(34,197,94,0.35)",
          background: `linear-gradient(95deg, ${BRAND.green2}, ${BRAND.green})`,
          color: "#fff",
          fontWeight: 900,
          boxShadow: "0 18px 36px rgba(34,197,94,0.25)",
          cursor: "pointer",
          transform: scrollY > 280 ? "translateY(0)" : "translateY(16px)",
          opacity: scrollY > 280 ? 1 : 0,
          transition: "all 220ms ease",
          zIndex: 60,
        }}
        aria-label="Scroll to top"
      >
        ↑
      </button>
    </div>
  );
}
