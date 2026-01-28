import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  // TODO: change
  const WA_NUMBER = "62XXXXXXXXXX";
  const PHONE = "+62 000-0000-0000";
  const ADDRESS = "Medan, Sumatera Utara, Indonesia";

  const waLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    "Halo CV. Mitra Setia, saya ingin tanya layanan pengangkutan."
  )}`;

  // ✅ same green vibe as Login button
  const BRAND = {
    green1: "#22C55E",
    green2: "#16A34A",
    mintBorder: "rgba(134, 239, 172, 0.65)",
    ink: "#0B2A1F",
    bgTop: "#ECFDF5",
    bgBottom: "#F7FFFB",
  };

  const slides = useMemo(
    () => [
      {
        img: "/hero-1.jpg",
        tag: "CV. Mitra Setia · Transport & Logistics",
        title: "Pengangkutan cepat.\nAman. Terjadwal.",
        desc: "Melayani pengangkutan pupuk, spare part, dan kebutuhan logistik perusahaan di Sumatera.",
        cta: { label: "Chat WhatsApp", href: waLink },
      },
      {
        img: "/hero-2.jpg",
        tag: "Pengiriman rutin & kontrak",
        title: "Proses rapi.\nDokumentasi jelas.",
        desc: "Komunikasi admin cepat, SOP jelas, dan dokumentasi rapi untuk kontrol dan laporan.",
        cta: { label: "Lihat Layanan", href: "#services" },
      },
      {
        img: "/hero-3.jpg",
        tag: "Armada & operasional",
        title: "Keamanan muatan\njadi prioritas.",
        desc: "Koordinasi terstruktur untuk meminimalkan keterlambatan dan downtime.",
        cta: { label: "Kontak", href: "#contact" },
      },
    ],
    [waLink]
  );

  const [idx, setIdx] = useState(0);

  // auto slide like corporate sites
  useEffect(() => {
    const t = setInterval(() => setIdx((v) => (v + 1) % slides.length), 6500);
    return () => clearInterval(t);
  }, [slides.length]);

  const s = slides[idx];

  const page = {
    minHeight: "100vh",
    background: `linear-gradient(180deg, ${BRAND.bgTop} 0%, ${BRAND.bgBottom} 70%)`,
    color: BRAND.ink,
    fontFamily:
      '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  };

  // content container for sections (not for hero)
  const container = { maxWidth: 1180, margin: "0 auto", padding: "0 22px" };

  const btn = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "12px 18px",
    borderRadius: 16,
    border: `1px solid ${BRAND.mintBorder}`,
    background: "rgba(255,255,255,0.92)",
    color: BRAND.ink,
    fontWeight: 900,
    textDecoration: "none",
    boxShadow: "0 16px 40px rgba(10,40,30,0.10)",
    cursor: "pointer",
  };

  const btnPrimary = {
    ...btn,
    background: `linear-gradient(90deg, ${BRAND.green1}, ${BRAND.green2})`,
    color: "#fff",
    border: "1px solid rgba(34,197,94,0.35)",
    boxShadow: "0 22px 55px rgba(34,197,94,0.22)",
  };

  const section = { padding: "84px 0" };
  const eyebrow = { fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.6 };
  const h2 = { fontSize: 38, lineHeight: 1.12, letterSpacing: -1.0, fontWeight: 1000, margin: "10px 0 12px" };
  const p = { margin: 0, fontSize: 16, lineHeight: 1.9, opacity: 0.85, maxWidth: 760 };
  const card = {
    borderRadius: 18,
    border: "1px solid rgba(20,80,60,0.10)",
    background: "#fff",
    padding: 18,
    boxShadow: "0 12px 30px rgba(10,40,30,0.05)",
  };

  const isNarrow = typeof window !== "undefined" && window.innerWidth < 980;

  return (
    <div style={page}>
      {/* ===========================
          HERO CAROUSEL — FULL WIDTH (edge-to-edge)
         =========================== */}
      <section
        style={{
          position: "relative",
					width: "100%", // ✅ not 100vw
					marginLeft: 0,
					borderBottom: "1px solid rgba(20,80,60,0.10)",
					overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", minHeight: isNarrow ? 560 : 680 }}>
          {/* background image */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${s.img})`,
              backgroundSize: "cover",
              backgroundPosition: "center 15%", // ✅ show more top
              filter: "saturate(1.05) contrast(1.05) brightness(0.92)",
              transform: "scale(1.03)",
            }}
          />
          {/* overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg,rgba(20, 40, 34, 0.70) 0%,rgba(20, 40, 34, 0.45) 45%,rgba(20, 40, 34, 0.12) 100%)",
            }}
          />
          {/* soft green glow */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(900px 560px at 18% 18%, rgba(34,197,94,0.22), transparent 60%)",
              pointerEvents: "none",
            }}
          />

          {/* hero content (centered container) */}
          <div style={{ ...container, position: "relative", paddingTop: isNarrow ? 110 : 140, paddingBottom: 70 }}>
            <div style={{ maxWidth: 820, color: "#fff" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  fontSize: 12,
                  fontWeight: 900,
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                🚚 {s.tag}
              </div>

              <h1
                style={{
                  margin: "16px 0 12px",
                  fontSize: isNarrow ? 46 : 70,
                  lineHeight: 1.0,
                  letterSpacing: -1.8,
                  fontWeight: 1000,
                  whiteSpace: "pre-line",
                }}
              >
                {s.title}
              </h1>

              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.9, opacity: 0.88, maxWidth: 720 }}>
                {s.desc}
              </p>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
                <a href={s.cta.href} style={btnPrimary}>
                  {s.cta.label}
                </a>
                <a
                  href={`tel:${PHONE.replace(/\s/g, "")}`}
                  style={{
                    ...btn,
                    background: "rgba(255,255,255,0.12)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  Call {PHONE}
                </a>
                <Link
                  to="/login"
                  style={{
                    ...btn,
                    background: "transparent",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.22)",
                    boxShadow: "none",
                  }}
                >
                  Staff Login
                </Link>
              </div>

              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.78, fontWeight: 800 }}>
                Berbasis di Medan · Melayani Sumatera
              </div>
            </div>
          </div>

          {/* arrows */}
          <div style={{ position: "absolute", left: 22, top: "50%", transform: "translateY(-50%)" }}>
            <button
              onClick={() => setIdx((v) => (v - 1 + slides.length) % slides.length)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                fontWeight: 1000,
                cursor: "pointer",
                backdropFilter: "blur(8px)",
              }}
              aria-label="Prev slide"
            >
              ←
            </button>
          </div>
          <div style={{ position: "absolute", right: 22, top: "50%", transform: "translateY(-50%)" }}>
            <button
              onClick={() => setIdx((v) => (v + 1) % slides.length)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                fontWeight: 1000,
                cursor: "pointer",
                backdropFilter: "blur(8px)",
              }}
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
              bottom: 18,
              transform: "translateX(-50%)",
              display: "flex",
              gap: 8,
              alignItems: "center",
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
                  background: i === idx ? "rgba(255,255,255,0.86)" : "rgba(255,255,255,0.24)",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" style={section}>
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
              marginTop: 24,
            }}
          >
            {[
              {
                t: "Pengangkutan Pupuk",
                d: "Pengiriman terjadwal untuk kebun & distributor pupuk dengan SOP yang jelas.",
              },
              {
                t: "Logistik Spare Part",
                d: "Pengiriman parts/komponen untuk pabrik & armada dengan dokumentasi rapi.",
              },
              {
                t: "Kontrak Perusahaan",
                d: "Kerjasama jangka panjang untuk pengiriman rutin & kebutuhan operasional.",
              },
            ].map((x) => (
              <div key={x.t} style={card}>
                <div style={{ fontWeight: 1000, fontSize: 18, letterSpacing: -0.3 }}>{x.t}</div>
                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.78, lineHeight: 1.75 }}>{x.d}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href={waLink} target="_blank" rel="noreferrer" style={btnPrimary}>
              Minta Penawaran
            </a>
            <a href="#contact" style={btn}>
              Kontak
            </a>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section
        id="contact"
        style={{
          padding: "74px 0",
          background: "linear-gradient(180deg, rgba(236,253,245,0.85), #FFFFFF)",
          borderTop: "1px solid rgba(20,80,60,0.10)",
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
                <a href={waLink} target="_blank" rel="noreferrer" style={btnPrimary}>
                  Chat WhatsApp
                </a>
              </div>

              <div style={{ marginTop: 18, height: 1, background: "rgba(20,80,60,0.10)" }} />

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

              <div style={{ marginTop: 18, height: 1, background: "rgba(20,80,60,0.10)" }} />

              <div style={{ marginTop: 18, fontWeight: 1000 }}>Staff Internal</div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.78, lineHeight: 1.75 }}>
                Login untuk akses sistem ERP internal.
              </div>
              <div style={{ marginTop: 14 }}>
                <Link to="/login" style={btn}>
                  Staff Login (ERP)
                </Link>
              </div>

              <div style={{ marginTop: 18, fontSize: 12, opacity: 0.65 }}>
                © {new Date().getFullYear()} CV. Mitra Setia
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
