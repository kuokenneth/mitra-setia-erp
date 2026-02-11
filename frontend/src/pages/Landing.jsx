// src/pages/Landing.jsx - Corporate Professional Redesign (Asian Agri Inspired)
// Note: Navigation bar is handled by PublicLayout.jsx
import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  const WA_NUMBER = "62XXXXXXXXXX";
  const PHONE = "+62 000-0000-0000";
  const ADDRESS =
    "Jl. Cemara No.40, Indra Kasih, Kec. Percut Sei Tuan,\nKabupaten Deli Serdang, Sumatera Utara 20371\nMedan, Sumatera Utara, Indonesia";

  const waLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    "Halo CV. Mitra Setia, saya ingin tanya layanan pengangkutan."
  )}`;

  // Corporate Green Color Palette
  const BRAND = {
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
  };

  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [scrollY, setScrollY] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  
  // Counter animation
  const statsRef = useRef(null);
  const [countersStarted, setCountersStarted] = useState(false);
  const [counts, setCounts] = useState({ deliveries: 0, clients: 0, fleet: 0, years: 0 });

  const isMobile = vw <= 768;
  const isTablet = vw <= 1024;

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

  // Counter Animation
  useEffect(() => {
    if (!statsRef.current || countersStarted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCountersStarted(true);
          const duration = 2000;
          const targets = { deliveries: 500, clients: 50, fleet: 30, years: 10 };
          const steps = 60;
          const stepDuration = duration / steps;
          
          let step = 0;
          const timer = setInterval(() => {
            step++;
            const progress = step / steps;
            setCounts({
              deliveries: Math.floor(targets.deliveries * progress),
              clients: Math.floor(targets.clients * progress),
              fleet: Math.floor(targets.fleet * progress),
              years: Math.floor(targets.years * progress),
            });
            if (step >= steps) {
              clearInterval(timer);
              setCounts(targets);
            }
          }, stepDuration);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, [countersStarted]);

  // Reveal animations
  useEffect(() => {
    const nodes = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window) || nodes.length === 0) {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return;
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
      { threshold: 0.15 }
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  const container = {
    maxWidth: 1280,
    margin: "0 auto",
    padding: isMobile ? "0 20px" : "0 48px",
  };

  const services = [
    {
      id: 0,
      title: "Pengangkutan Pupuk",
      shortTitle: "Pupuk",
      desc: "Pengiriman terjadwal untuk kebun & distributor pupuk dengan SOP yang jelas dan dokumentasi lengkap.",
      details: "Kami menyediakan layanan pengangkutan pupuk dengan armada yang terawat dan driver berpengalaman. Setiap pengiriman dilengkapi dengan dokumentasi lengkap dan tracking real-time.",
      image: "https://images.unsplash.com/photo-1562811950-41d4a4944a4b?w=800&q=80",
    },
    {
      id: 1,
      title: "Logistik Operasional",
      shortTitle: "Logistik",
      desc: "Pengiriman parts/komponen/barang untuk pabrik & armada dengan koordinasi yang rapi.",
      details: "Layanan logistik terintegrasi untuk kebutuhan operasional perusahaan Anda. Dari spare parts hingga komponen pabrik, kami pastikan pengiriman tepat waktu.",
      image: "https://images.unsplash.com/photo-1741495515999-0567609a236e?w=800&q=80",
    },
    {
      id: 2,
      title: "Kontrak Perusahaan",
      shortTitle: "Kontrak",
      desc: "Kerjasama jangka panjang untuk pengiriman rutin & kebutuhan operasional dengan harga kompetitif.",
      details: "Program kemitraan jangka panjang dengan benefit eksklusif. Dapatkan prioritas armada, harga khusus, dan dedicated account manager untuk perusahaan Anda.",
      image: "https://images.unsplash.com/photo-1724556271642-e9acaf03ac23?w=800&q=80",
    },
  ];

  const navLinks = [
    { label: "Tentang Kami", href: "#about" },
    { label: "Layanan", href: "#services" },
    { label: "Keunggulan", href: "#why-us" },
    { label: "Kontak", href: "#contact" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BRAND.white,
        color: BRAND.text,
        fontFamily: '"Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* ===========================
          HERO SECTION
         =========================== */}
      <section
        data-testid="hero-section"
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          background: BRAND.primary,
          overflow: "hidden",
        }}
      >
        {/* Background Image with Overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(https://images.unsplash.com/photo-1753579167765-d88ba3719f96?w=1920&q=80)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.3,
          }}
        />
        
        {/* Gradient Overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 50%, rgba(10,99,49,0.95) 100%)`,
          }}
        />

        {/* Decorative Elements */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            right: "5%",
            width: 400,
            height: 400,
            border: `1px solid rgba(255,255,255,0.1)`,
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "15%",
            left: "-5%",
            width: 300,
            height: 300,
            border: `1px solid rgba(255,255,255,0.08)`,
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        {/* Hero Content */}
        <div style={{ ...container, position: "relative", zIndex: 10, width: "100%" }}>
          <div
            style={{
              maxWidth: 800,
              paddingTop: isMobile ? 120 : 80,
              paddingBottom: isMobile ? 60 : 80,
            }}
          >
            {/* Tagline */}
            <div
              className="reveal"
              data-reveal
              style={{
                display: "inline-block",
                padding: "8px 16px",
                background: "rgba(255,255,255,0.15)",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                color: BRAND.white,
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: 24,
              }}
            >
              Solusi Logistik Terpercaya
            </div>

            {/* Main Heading */}
            <h1
              className="reveal"
              data-reveal
              style={{
                margin: 0,
                fontSize: isMobile ? 36 : isTablet ? 48 : 60,
                lineHeight: 1.15,
                fontWeight: 700,
                color: BRAND.white,
                marginBottom: 24,
              }}
            >
              Meningkatkan efisiensi operasional melalui pengiriman yang{" "}
              <span style={{ color: BRAND.accent }}>andal & konsisten.</span>
            </h1>

            {/* Description */}
            <p
              className="reveal"
              data-reveal
              style={{
                fontSize: isMobile ? 16 : 18,
                lineHeight: 1.8,
                color: "rgba(255,255,255,0.85)",
                marginBottom: 40,
                maxWidth: 600,
              }}
            >
              CV. Mitra Setia adalah mitra logistik terpercaya untuk pengangkutan rutin dan 
              kontrak perusahaan dengan standar layanan yang tinggi.
            </p>

            {/* CTA Buttons */}
            <div
              className="reveal"
              data-reveal
              style={{ display: "flex", gap: 16, flexWrap: "wrap" }}
            >
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                data-testid="hero-cta-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "16px 32px",
                  background: BRAND.white,
                  color: BRAND.primary,
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 6,
                  textDecoration: "none",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Minta Penawaran
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
              <a
                href="#about"
                data-testid="hero-cta-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "16px 32px",
                  background: "transparent",
                  border: `2px solid rgba(255,255,255,0.5)`,
                  color: BRAND.white,
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 6,
                  textDecoration: "none",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.borderColor = BRAND.white;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
                }}
              >
                Pelajari Lebih Lanjut
              </a>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          <div
            style={{
              width: 24,
              height: 40,
              border: "2px solid rgba(255,255,255,0.4)",
              borderRadius: 12,
              display: "flex",
              justifyContent: "center",
              paddingTop: 6,
            }}
          >
            <div
              style={{
                width: 4,
                height: 8,
                background: BRAND.white,
                borderRadius: 2,
                animation: "scrollBounce 2s ease-in-out infinite",
              }}
            />
          </div>
        </div>
      </section>

      {/* ===========================
          PHILOSOPHY BAR
         =========================== */}
      <section
        style={{
          background: BRAND.primaryDark,
          padding: "16px 0",
        }}
      >
        <div style={container}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: isMobile ? 16 : 40,
              flexWrap: "wrap",
              textAlign: "center",
            }}
          >
            {["Masyarakat", "Negara", "Pelanggan", "Perusahaan"].map((item, i) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: BRAND.white,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {i > 0 && !isMobile && (
                  <span style={{ color: "rgba(255,255,255,0.3)", marginRight: 8 }}>•</span>
                )}
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===========================
          ABOUT SECTION
         =========================== */}
      <section
        id="about"
        data-testid="about-section"
        style={{
          padding: isMobile ? "80px 0" : "120px 0",
          background: BRAND.white,
        }}
      >
        <div style={container}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isTablet ? "1fr" : "1fr 1fr",
              gap: 60,
              alignItems: "center",
            }}
          >
            {/* Content */}
            <div className="reveal slide-left" data-reveal>
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  background: BRAND.accent,
                  color: BRAND.primary,
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 4,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  marginBottom: 20,
                }}
              >
                Tentang Kami
              </div>
              <h2
                style={{
                  margin: "0 0 20px",
                  fontSize: isMobile ? 32 : 42,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: BRAND.text,
                }}
              >
                CV. Mitra Setia adalah perusahaan logistik yang menempatkan{" "}
                <span style={{ color: BRAND.primary }}>kemitraan</span> di jantung operasinya.
              </h2>
              <p
                style={{
                  fontSize: 16,
                  lineHeight: 1.8,
                  color: BRAND.textLight,
                  marginBottom: 24,
                }}
              >
                Berdiri sejak tahun 2014, CV. Mitra Setia telah berkembang menjadi salah satu 
                penyedia layanan transportasi dan logistik terpercaya di Sumatera Utara. 
                Dengan armada yang terawat dan tim profesional, kami melayani berbagai 
                kebutuhan pengangkutan untuk perusahaan dan industri.
              </p>
              <p
                style={{
                  fontSize: 16,
                  lineHeight: 1.8,
                  color: BRAND.textLight,
                  marginBottom: 32,
                }}
              >
                Bisnis kami meliputi pengangkutan pupuk, logistik operasional, hingga 
                kontrak jangka panjang dengan perusahaan-perusahaan terkemuka.
              </p>
              <a
                href="#services"
                data-testid="about-learn-more"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  color: BRAND.primary,
                  textDecoration: "none",
                  borderBottom: `2px solid ${BRAND.primary}`,
                  paddingBottom: 4,
                  transition: "all 0.3s ease",
                }}
              >
                Tentang Kami
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>

            {/* Image */}
            <div className="reveal slide-right" data-reveal>
              <div
                style={{
                  position: "relative",
                  borderRadius: 8,
                  overflow: "hidden",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
                }}
              >
                <img
                  src="https://images.unsplash.com/photo-1741495515999-0567609a236e?w=800&q=80"
                  alt="CV. Mitra Setia Fleet"
                  style={{
                    width: "100%",
                    height: isMobile ? 300 : 450,
                    objectFit: "cover",
                  }}
                />
                {/* Overlay Badge */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 24,
                    left: 24,
                    background: BRAND.primary,
                    color: BRAND.white,
                    padding: "16px 24px",
                    borderRadius: 6,
                  }}
                >
                  <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>10+</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Tahun Pengalaman</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===========================
          QUOTE SECTION
         =========================== */}
      <section
        style={{
          padding: isMobile ? "60px 0" : "80px 0",
          background: BRAND.secondary,
        }}
      >
        <div style={container}>
          <div
            className="reveal"
            data-reveal
            style={{
              maxWidth: 900,
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "6px 12px",
                background: BRAND.accent,
                color: BRAND.primary,
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 4,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                marginBottom: 24,
              }}
            >
              Filosofi Kami
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: isMobile ? 24 : 32,
                fontWeight: 600,
                lineHeight: 1.5,
                color: BRAND.text,
                fontStyle: "italic",
              }}
            >
              "Kami percaya bahwa perusahaan harus baik bagi Masyarakat, baik bagi Negara, 
              baik bagi Pelanggan – dengan demikian akan baik bagi Perusahaan."
            </h3>
            <div
              style={{
                marginTop: 24,
                fontSize: 14,
                fontWeight: 600,
                color: BRAND.primary,
              }}
            >
              — Pendiri CV. Mitra Setia
            </div>
          </div>
        </div>
      </section>

      {/* ===========================
          SERVICES SECTION (Tab Style)
         =========================== */}
      <section
        id="services"
        data-testid="services-section"
        style={{
          padding: isMobile ? "80px 0" : "120px 0",
          background: BRAND.white,
        }}
      >
        <div style={container}>
          {/* Section Header */}
          <div
            className="reveal"
            data-reveal
            style={{ marginBottom: 48 }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "6px 12px",
                background: BRAND.accent,
                color: BRAND.primary,
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 4,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              Layanan Kami
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: isMobile ? 32 : 42,
                fontWeight: 700,
                lineHeight: 1.2,
                color: BRAND.text,
              }}
            >
              Apa Yang Kami Lakukan
            </h2>
          </div>

          {/* Tab Navigation */}
          <div
            className="reveal"
            data-reveal
            style={{
              display: "flex",
              gap: 0,
              marginBottom: 40,
              borderBottom: `2px solid ${BRAND.border}`,
              overflowX: "auto",
            }}
          >
            {services.map((service, i) => (
              <button
                key={service.id}
                data-testid={`service-tab-${i}`}
                onClick={() => setActiveTab(i)}
                style={{
                  flex: isMobile ? "none" : 1,
                  padding: isMobile ? "16px 24px" : "20px 32px",
                  background: "transparent",
                  border: "none",
                  borderBottom: `3px solid ${activeTab === i ? BRAND.primary : "transparent"}`,
                  fontSize: 15,
                  fontWeight: 600,
                  color: activeTab === i ? BRAND.primary : BRAND.textMuted,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  whiteSpace: "nowrap",
                  marginBottom: -2,
                }}
              >
                {isMobile ? service.shortTitle : service.title}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div
            className="reveal"
            data-reveal
            style={{
              display: "grid",
              gridTemplateColumns: isTablet ? "1fr" : "1fr 1fr",
              gap: 48,
              alignItems: "center",
            }}
          >
            {/* Text Content */}
            <div>
              <h3
                style={{
                  margin: "0 0 16px",
                  fontSize: isMobile ? 24 : 28,
                  fontWeight: 700,
                  color: BRAND.text,
                }}
              >
                {services[activeTab].title}
              </h3>
              <p
                style={{
                  fontSize: 16,
                  lineHeight: 1.8,
                  color: BRAND.textLight,
                  marginBottom: 16,
                }}
              >
                {services[activeTab].desc}
              </p>
              <p
                style={{
                  fontSize: 16,
                  lineHeight: 1.8,
                  color: BRAND.textLight,
                  marginBottom: 32,
                }}
              >
                {services[activeTab].details}
              </p>
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                data-testid="service-cta"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  color: BRAND.primary,
                  textDecoration: "none",
                  borderBottom: `2px solid ${BRAND.primary}`,
                  paddingBottom: 4,
                }}
              >
                Pelajari Lebih Lanjut
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>

            {/* Image */}
            <div
              style={{
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
              }}
            >
              <img
                src={services[activeTab].image}
                alt={services[activeTab].title}
                style={{
                  width: "100%",
                  height: isMobile ? 280 : 380,
                  objectFit: "cover",
                  transition: "all 0.5s ease",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===========================
          STATS SECTION
         =========================== */}
      <section
        ref={statsRef}
        data-testid="stats-section"
        style={{
          padding: isMobile ? "60px 0" : "80px 0",
          background: BRAND.primary,
        }}
      >
        <div style={container}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
              gap: isMobile ? 32 : 48,
              textAlign: "center",
            }}
          >
            {[
              { value: counts.deliveries, suffix: "+", label: "Pengiriman Sukses" },
              { value: counts.clients, suffix: "+", label: "Klien Aktif" },
              { value: counts.fleet, suffix: "+", label: "Unit Armada" },
              { value: counts.years, suffix: "+", label: "Tahun Pengalaman" },
            ].map((stat, i) => (
              <div key={i} data-testid={`stat-${i}`}>
                <div
                  style={{
                    fontSize: isMobile ? 36 : 48,
                    fontWeight: 800,
                    color: BRAND.white,
                    lineHeight: 1,
                    marginBottom: 8,
                  }}
                >
                  {stat.value}{stat.suffix}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.8)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===========================
          WHY US SECTION
         =========================== */}
      <section
        id="why-us"
        data-testid="why-us-section"
        style={{
          padding: isMobile ? "80px 0" : "120px 0",
          background: BRAND.secondary,
        }}
      >
        <div style={container}>
          {/* Section Header */}
          <div
            className="reveal"
            data-reveal
            style={{ textAlign: "center", marginBottom: 60 }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "6px 12px",
                background: BRAND.accent,
                color: BRAND.primary,
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 4,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              Mengapa Kami
            </div>
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: isMobile ? 32 : 42,
                fontWeight: 700,
                lineHeight: 1.2,
                color: BRAND.text,
              }}
            >
              Filosofi Bisnis Kami
            </h2>
            <p
              style={{
                margin: "0 auto",
                maxWidth: 600,
                fontSize: 16,
                lineHeight: 1.8,
                color: BRAND.textLight,
              }}
            >
              CV. Mitra Setia percaya bahwa untuk menjadi bisnis yang berkelanjutan, 
              semua kegiatan perusahaan harus bermanfaat bagi semua pihak.
            </p>
          </div>

          {/* Values Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
              gap: 24,
            }}
          >
            {[
              {
                title: "Masyarakat",
                desc: "Tumbuh bersama masyarakat sekitar dengan membuka lapangan kerja.",
                icon: "👥",
              },
              {
                title: "Negara",
                desc: "Berkontribusi pada pembangunan nasional melalui bisnis kami.",
                icon: "🏛️",
              },
              {
                title: "Pelanggan",
                desc: "Kemitraan kuat yang didasari oleh kualitas dan transparansi.",
                icon: "🤝",
              },
              {
                title: "Perusahaan",
                desc: "Penyediaan layanan berkualitas tinggi untuk keberlanjutan bisnis.",
                icon: "🏢",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="reveal"
                data-reveal
                data-testid={`value-card-${i}`}
                style={{
                  background: BRAND.white,
                  padding: 32,
                  borderRadius: 8,
                  textAlign: "center",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
                  border: `1px solid ${BRAND.border}`,
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.04)";
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    margin: "0 auto 20px",
                    background: BRAND.accent,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                  }}
                >
                  {item.icon}
                </div>
                <h4
                  style={{
                    margin: "0 0 12px",
                    fontSize: 18,
                    fontWeight: 700,
                    color: BRAND.primary,
                  }}
                >
                  {item.title}
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: BRAND.textLight,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===========================
          CTA BANNER
         =========================== */}
      <section
        style={{
          padding: isMobile ? "60px 0" : "80px 0",
          background: BRAND.primary,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative */}
        <div
          style={{
            position: "absolute",
            top: "-50%",
            right: "-10%",
            width: 400,
            height: 400,
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "50%",
          }}
        />

        <div style={container}>
          <div
            className="reveal"
            data-reveal
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 32,
            }}
          >
            <div style={{ maxWidth: 600 }}>
              <h3
                style={{
                  margin: "0 0 12px",
                  fontSize: isMobile ? 24 : 32,
                  fontWeight: 700,
                  color: BRAND.white,
                }}
              >
                Siap untuk bermitra dengan kami?
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                Hubungi kami sekarang untuk mendapatkan penawaran terbaik.
              </p>
            </div>
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              data-testid="cta-banner-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "16px 32px",
                background: BRAND.white,
                color: BRAND.primary,
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 6,
                textDecoration: "none",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Hubungi Kami
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ===========================
          CONTACT SECTION
         =========================== */}
      <section
        id="contact"
        data-testid="contact-section"
        style={{
          padding: isMobile ? "80px 0" : "120px 0",
          background: BRAND.white,
        }}
      >
        <div style={container}>
          {/* Section Header */}
          <div
            className="reveal"
            data-reveal
            style={{ textAlign: "center", marginBottom: 60 }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "6px 12px",
                background: BRAND.accent,
                color: BRAND.primary,
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 4,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              Kontak
            </div>
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: isMobile ? 32 : 42,
                fontWeight: 700,
                lineHeight: 1.2,
                color: BRAND.text,
              }}
            >
              Ayo Terlibat Bersama Kami
            </h2>
          </div>

          {/* Contact Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
              gap: 32,
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            {/* WhatsApp Card */}
            <div
              className="reveal slide-left"
              data-reveal
              data-testid="contact-whatsapp"
              style={{
                background: BRAND.secondary,
                padding: 40,
                borderRadius: 8,
                textAlign: "center",
                border: `1px solid ${BRAND.border}`,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  margin: "0 auto 20px",
                  background: BRAND.primary,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: BRAND.white,
                  fontSize: 28,
                }}
              >
                💬
              </div>
              <h4 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: BRAND.text }}>
                WhatsApp
              </h4>
              <p style={{ margin: "0 0 24px", fontSize: 14, color: BRAND.textMuted }}>
                Chat admin untuk penawaran cepat
              </p>
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  padding: "14px 28px",
                  background: BRAND.primary,
                  color: BRAND.white,
                  fontSize: 14,
                  fontWeight: 700,
                  borderRadius: 6,
                  textDecoration: "none",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.primaryDark)}
                onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.primary)}
              >
                Chat Sekarang
              </a>
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 24,
                  borderTop: `1px solid ${BRAND.border}`,
                  fontSize: 14,
                  color: BRAND.textMuted,
                }}
              >
                📞 {PHONE}
              </div>
            </div>

            {/* Address Card */}
            <div
              className="reveal slide-right"
              data-reveal
              data-testid="contact-address"
              style={{
                background: BRAND.secondary,
                padding: 40,
                borderRadius: 8,
                textAlign: "center",
                border: `1px solid ${BRAND.border}`,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  margin: "0 auto 20px",
                  background: BRAND.accent,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                }}
              >
                📍
              </div>
              <h4 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: BRAND.text }}>
                Kantor Kami
              </h4>
              <p
                style={{
                  margin: "0 0 24px",
                  fontSize: 14,
                  lineHeight: 1.8,
                  color: BRAND.textMuted,
                  whiteSpace: "pre-line",
                }}
              >
                {ADDRESS}
              </p>
              <Link
                to="/login"
                data-testid="contact-login-btn"
                style={{
                  display: "inline-block",
                  padding: "14px 28px",
                  background: "transparent",
                  border: `2px solid ${BRAND.primary}`,
                  color: BRAND.primary,
                  fontSize: 14,
                  fontWeight: 700,
                  borderRadius: 6,
                  textDecoration: "none",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = BRAND.primary;
                  e.currentTarget.style.color = BRAND.white;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = BRAND.primary;
                }}
              >
                Staff Login (ERP)
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===========================
          FOOTER
         =========================== */}
      <footer
        data-testid="footer"
        style={{
          background: BRAND.primaryDark,
          color: BRAND.white,
          padding: isMobile ? "48px 0 24px" : "64px 0 32px",
        }}
      >
        <div style={container}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr",
              gap: 48,
              marginBottom: 48,
            }}
          >
            {/* Company Info */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <img
                  src="/logo3.png"
                  alt="CV. Mitra Setia"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    objectFit: "contain",
                    display: "block",
                    background: BRAND.white,
                  }}
                />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>CV. Mitra Setia</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Transport & Logistics</div>
                </div>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.8, opacity: 0.8, maxWidth: 350 }}>
                Mitra logistik terpercaya untuk pengangkutan rutin dan kontrak perusahaan 
                di Sumatera Utara.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h5 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Menu
              </h5>
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  style={{
                    display: "block",
                    fontSize: 14,
                    color: "rgba(255,255,255,0.8)",
                    textDecoration: "none",
                    marginBottom: 12,
                    transition: "color 0.3s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = BRAND.white)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Contact */}
            <div>
              <h5 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Kontak
              </h5>
              <div style={{ fontSize: 14, lineHeight: 2, opacity: 0.8 }}>
                <div>📞 {PHONE}</div>
                <div>📍 Medan, Sumatera Utara</div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div
            style={{
              paddingTop: 24,
              borderTop: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              © {new Date().getFullYear()} CV. Mitra Setia. All rights reserved.
            </div>
            <div style={{ fontSize: 12, opacity: 0.5 }}>
              Built with MitraSetia ERP
            </div>
          </div>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        data-testid="scroll-to-top"
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          width: 48,
          height: 48,
          borderRadius: 8,
          background: BRAND.primary,
          color: BRAND.white,
          fontSize: 20,
          fontWeight: 700,
          border: "none",
          boxShadow: "0 4px 20px rgba(13, 124, 61, 0.3)",
          cursor: "pointer",
          transform: scrollY > 400 ? "translateY(0)" : "translateY(100px)",
          opacity: scrollY > 400 ? 1 : 0,
          transition: "all 0.3s ease",
          zIndex: 999,
        }}
        aria-label="Scroll to top"
      >
        ↑
      </button>

      {/* CSS Animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        @keyframes scrollBounce {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(8px); opacity: 0.5; }
        }
        
        .reveal {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .reveal.slide-left {
          transform: translateX(-30px);
        }
        .reveal.slide-right {
          transform: translateX(30px);
        }
        .reveal.is-visible {
          opacity: 1;
          transform: translateY(0) translateX(0);
        }
      `}</style>
    </div>
  );
}
