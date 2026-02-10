// src/pages/Landing.jsx - Modern Redesign with Top 5 Enhancements
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

  // Modern color palette
  const BRAND = {
    ink: "#111827",
    ink2: "#1F2937",
    green: "#1f9d53",
    green2: "#3BB865",
    greenLight: "#5FD686",
    greenDark: "#2D9F56",
    greenSoft: "rgba(75,202,116,0.15)",
    glass: "rgba(255,255,255,0.85)",
    glassBorder: "rgba(255,255,255,0.4)",
    footerBg: "#1F7A44",
  };

  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [scrollY, setScrollY] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);
  const [openService, setOpenService] = useState(0);
  const [showNavbar, setShowNavbar] = useState(false);
  
  // Refs for 3D tilt and counter animations
  const statsRef = useRef(null);
  const [countersStarted, setCountersStarted] = useState(false);
  const [counts, setCounts] = useState({ deliveries: 0, clients: 0, fleet: 0 });

  const isMobile = vw <= 640;
  const isNarrow = vw < 980;

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    const onScroll = () => {
      const y = window.scrollY || 0;
      setScrollY(y);
      setShowNavbar(y > 100);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    onResize();
    onScroll();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Animated Counter Effect
  useEffect(() => {
    if (!statsRef.current || countersStarted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCountersStarted(true);
          
          // Animate counters
          const duration = 2000;
          const targets = { deliveries: 500, clients: 10, fleet: 30 };
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
      { threshold: 0.15 }
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  const parallax = Math.min(60, scrollY * 0.15);

  // Styles
  const container = {
    maxWidth: 1240,
    margin: "0 auto",
    padding: isMobile ? "0 20px" : "0 32px",
  };

  const glassCard = {
    background: BRAND.glass,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: `1px solid ${BRAND.glassBorder}`,
    borderRadius: 24,
    boxShadow: "0 8px 32px rgba(31, 157, 83, 0.1)",
  };

  const gradientText = {
    background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.green2})`,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  };

  // 3D Tilt Effect Handler
  const handleCardTilt = (e, cardRef) => {
    if (isMobile) return;
    
    const card = cardRef;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = (y - centerY) / 10;
    const rotateY = (centerX - x) / 10;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const resetCardTilt = (cardRef) => {
    if (isMobile) return;
    cardRef.style.transform = "perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        color: BRAND.ink,
        fontFamily: '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ===========================
          FLOATING NAVBAR - Enhancement #1
         =========================== */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          transform: showNavbar ? "translateY(0)" : "translateY(-100%)",
          opacity: showNavbar ? 1 : 0,
          transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          style={{
            ...glassCard,
            margin: "16px auto",
            maxWidth: 1200,
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 16,
          }}
        >
          {/* Logo with Animation */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
            }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <img
              src="/logo3.png"
              alt="CV. Mitra Setia"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                objectFit: "contain",
                border: "none",
                padding: 4,
              }}
            />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.ink }}>
                CV. Mitra Setia
              </div>
              <div style={{ fontSize: 10, color: BRAND.ink2, opacity: 0.7 }}>
                Transport & Logistics
              </div>
            </div>
          </div>

          {/* Nav Links */}
          {!isMobile && (
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              {["services", "contact"].map((link) => (
                <a
                  key={link}
                  href={`#${link}`}
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: BRAND.ink,
                    textDecoration: "none",
                    textTransform: "capitalize",
                    transition: "color 0.3s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = BRAND.green)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = BRAND.ink)}
                >
                  {link}
                </a>
              ))}
            </div>
          )}

          {/* CTA Button */}
          <Link
            to="/login"
            style={{
              padding: "10px 20px",
              background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.green})`,
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 10,
              textDecoration: "none",
              transition: "all 0.3s",
            }}
          >
            Login
          </Link>
        </div>
      </nav>

      {/* ===========================
          PARTICLE ANIMATION - Enhancement #4
         =========================== */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          overflow: "hidden",
        }}
      >
        {[...Array(isMobile ? 15 : 30)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: Math.random() * 4 + 2,
              height: Math.random() * 4 + 2,
              background: `${BRAND.green}${Math.random() > 0.5 ? "40" : "20"}`,
              borderRadius: "50%",
              animation: `float ${Math.random() * 10 + 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* ===========================
          HERO SECTION
         =========================== */}
      <section
        style={{
          position: "relative",
          minHeight: isMobile ? "100vh" : "95vh",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Abstract Background Layers */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${BRAND.greenLight} 0%, #ffffff 50%, ${BRAND.greenSoft} 100%)`,
          }}
        />

        {/* Animated Gradient Blobs */}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            right: "-10%",
            width: isMobile ? "400px" : "700px",
            height: isMobile ? "400px" : "700px",
            background: `radial-gradient(circle, ${BRAND.green2}40 0%, transparent 70%)`,
            borderRadius: "50%",
            filter: "blur(60px)",
            animation: "float 20s ease-in-out infinite",
            transform: `translateY(${parallax}px)`,
          }}
        />

        <div
          style={{
            position: "absolute",
            bottom: "-15%",
            left: "-5%",
            width: isMobile ? "350px" : "600px",
            height: isMobile ? "350px" : "600px",
            background: `radial-gradient(circle, ${BRAND.green}30 0%, transparent 70%)`,
            borderRadius: "50%",
            filter: "blur(50px)",
            animation: "float 25s ease-in-out infinite reverse",
          }}
        />

        {/* Geometric Shapes */}
        <div
          style={{
            position: "absolute",
            top: "15%",
            left: "5%",
            width: "200px",
            height: "200px",
            border: `2px solid ${BRAND.green}30`,
            borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
            animation: "rotate 30s linear infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "20%",
            right: "8%",
            width: "150px",
            height: "150px",
            border: `2px solid ${BRAND.green2}40`,
            borderRadius: "50%",
            animation: "rotate 25s linear infinite reverse",
          }}
        />

        {/* Grid Pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(${BRAND.green}08 1px, transparent 1px),
              linear-gradient(90deg, ${BRAND.green}08 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
            opacity: 0.4,
          }}
        />

        {/* Floating Doodle */}
        <div
          style={{
            position: "absolute",
            top: isMobile ? "10%" : "15%",
            right: isMobile ? "-10%" : "5%",
            width: isMobile ? "250px" : "400px",
            opacity: 0.15,
            animation: "floatY 8s ease-in-out infinite",
            transform: `translateY(${parallax * 0.5}px)`,
          }}
        >
          <img
            src="/doodle.png"
            alt=""
            style={{ width: "100%", height: "auto", filter: "saturate(0.8)" }}
          />
        </div>

        {/* Hero Content */}
        <div style={{ ...container, position: "relative", zIndex: 10, width: "100%" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "1.2fr 0.8fr",
              gap: 40,
              alignItems: "center",
            }}
          >
            {/* Left Content */}
            <div className="stagger">
              {/* Tag Badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  background: BRAND.glass,
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${BRAND.green}40`,
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  color: BRAND.green,
                  marginBottom: 24,
                }}
                className="float-soft"
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: BRAND.green2,
                    boxShadow: `0 0 10px ${BRAND.green2}`,
                  }}
                />
                Transport & Logistics
              </div>

              {/* Main Heading */}
              <h1
                style={{
                  margin: 0,
                  fontSize: isMobile ? 42 : isNarrow ? 56 : 72,
                  lineHeight: 1.1,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  marginBottom: 20,
                }}
              >
                Pengangkutan rutin{" "}
                <span style={gradientText}>& kontrak perusahaan.</span>
              </h1>

              {/* Description */}
              <p
                style={{
                  fontSize: isMobile ? 16 : 18,
                  lineHeight: 1.7,
                  color: BRAND.ink2,
                  marginBottom: 32,
                  maxWidth: 580,
                }}
              >
                Pengiriman terjadwal dengan koordinasi yang rapi untuk kebutuhan
                operasional perusahaan.
              </p>

              {/* CTA Buttons */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <a
                  href={waLink}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "16px 32px",
                    background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.green})`,
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 700,
                    borderRadius: 16,
                    textDecoration: "none",
                    boxShadow: `0 10px 30px ${BRAND.green}40`,
                    transition: "all 0.3s ease",
                    border: "none",
                  }}
                  className="lift"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = `0 15px 40px ${BRAND.green}50`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = `0 10px 30px ${BRAND.green}40`;
                  }}
                >
                  Minta Penawaran
                </a>

                <a
                  href="#services"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "16px 32px",
                    background: BRAND.glass,
                    backdropFilter: "blur(10px)",
                    color: BRAND.ink,
                    fontSize: 16,
                    fontWeight: 700,
                    borderRadius: 16,
                    textDecoration: "none",
                    border: `1px solid ${BRAND.glassBorder}`,
                    transition: "all 0.3s ease",
                  }}
                  className="lift"
                >
                  Lihat Layanan
                </a>
              </div>

              {/* Info Text */}
              <div
                style={{
                  marginTop: 24,
                  fontSize: 13,
                  color: BRAND.ink2,
                  opacity: 0.8,
                }}
              >
                📍 Berbasis di Medan
                <br />
                ⚡ Operasional harian · Dokumentasi rapi · Kontak cepat
              </div>
            </div>

            {/* Right - Animated Counter Cards - Enhancement #3 */}
            {!isMobile && (
              <div className="reveal slide-right" data-reveal ref={statsRef}>
                <div
                  style={{
                    ...glassCard,
                    padding: 32,
                    display: "grid",
                    gap: 24,
                  }}
                >
                  {[
                    { label: "Pengiriman Sukses", value: counts.deliveries, icon: "📦", suffix: "+" },
                    { label: "Klien Aktif", value: counts.clients, icon: "🤝", suffix: "+" },
                    { label: "Armada Siap", value: counts.fleet, icon: "🚚", suffix: "+" },
                  ].map((stat, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: 20,
                        background: "rgba(255,255,255,0.6)",
                        borderRadius: 16,
                        border: `1px solid ${BRAND.green}20`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 32,
                          width: 60,
                          height: 60,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: `linear-gradient(135deg, ${BRAND.greenLight}, ${BRAND.green}30)`,
                          borderRadius: 16,
                        }}
                      >
                        {stat.icon}
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 28,
                            fontWeight: 800,
                            ...gradientText,
                          }}
                        >
                          {stat.value}{stat.suffix}
                        </div>
                        <div style={{ fontSize: 13, color: BRAND.ink2, opacity: 0.8 }}>
                          {stat.label}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            opacity: 0.6,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em" }}>SCROLL</span>
          <div
            style={{
              width: 2,
              height: 40,
              background: `linear-gradient(180deg, ${BRAND.green}, transparent)`,
              animation: "scrollDown 2s ease-in-out infinite",
            }}
          />
        </div>
      </section>

      {/* ===========================
          SERVICES SECTION with 3D Tilt - Enhancement #2
         =========================== */}
      <section
        id="services"
        style={{
          padding: isMobile ? "80px 0" : "120px 0",
          position: "relative",
          background: "#ffffff",
        }}
      >
        {/* Background Doodle Watermark */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "800px",
            opacity: 0.03,
            pointerEvents: "none",
          }}
        >
          <img src="/doodle.png" alt="" style={{ width: "100%" }} />
        </div>

        <div style={container}>
          {/* Section Header */}
          <div style={{ textAlign: "center", marginBottom: 60 }} className="reveal" data-reveal>
            <div
              style={{
                display: "inline-block",
                padding: "8px 16px",
                background: BRAND.greenSoft,
                color: BRAND.green,
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 999,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Layanan
            </div>
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: isMobile ? 36 : 48,
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
              }}
            >
              Fokus pada rute yang{" "}
              <span style={gradientText}>konsisten & andal</span>
            </h2>
            <p
              style={{
                margin: "0 auto",
                maxWidth: 600,
                fontSize: 18,
                lineHeight: 1.7,
                color: BRAND.ink2,
                opacity: 0.8,
              }}
            >
              Pengangkutan rutin, logistik operasional, dan kontrak perusahaan dengan
              standar yang jelas.
            </p>
          </div>

          {/* Service Cards with 3D Tilt Effect */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, 1fr)",
              gap: 24,
            }}
          >
            {[
              {
                icon: "🌾",
                title: "Pengangkutan Pupuk",
                desc: "Pengiriman terjadwal untuk kebun & distributor pupuk dengan SOP yang jelas.",
                color: BRAND.green,
              },
              {
                icon: "📦",
                title: "Logistik",
                desc: "Pengiriman parts/komponen/barang untuk pabrik & armada dengan dokumentasi rapi.",
                color: BRAND.green2,
              },
              {
                icon: "🤝",
                title: "Kontrak Perusahaan",
                desc: "Kerjasama jangka panjang untuk pengiriman rutin & kebutuhan operasional.",
                color: BRAND.greenDark,
              },
            ].map((service, i) => (
              <div
                key={i}
                className="reveal"
                data-reveal
                style={{
                  ...glassCard,
                  padding: 32,
                  position: "relative",
                  overflow: "hidden",
                  transition: "all 0.1s ease",
                  cursor: "pointer",
                  transformStyle: "preserve-3d",
                }}
                onMouseMove={(e) => handleCardTilt(e, e.currentTarget)}
                onMouseLeave={(e) => resetCardTilt(e.currentTarget)}
              >
                {/* Gradient Accent */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: `linear-gradient(90deg, ${service.color}, ${BRAND.green2})`,
                  }}
                />

                {/* Icon */}
                <div
                  style={{
                    width: 80,
                    height: 80,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 40,
                    background: `linear-gradient(135deg, ${service.color}20, ${service.color}10)`,
                    borderRadius: 20,
                    marginBottom: 20,
                  }}
                >
                  {service.icon}
                </div>

                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: 22,
                    fontWeight: 800,
                    color: BRAND.ink,
                  }}
                >
                  {service.title}
                </h3>

                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: BRAND.ink2,
                    opacity: 0.8,
                  }}
                >
                  {service.desc}
                </p>

                <button
                  type="button"
                  onClick={() => setOpenService(openService === i ? -1 : i)}
                  style={{
                    marginTop: 20,
                    padding: "10px 20px",
                    background: "transparent",
                    border: `2px solid ${service.color}40`,
                    borderRadius: 12,
                    color: service.color,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = service.color;
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = service.color;
                  }}
                >
                  {openService === i ? "Tutup Detail" : "Lihat Detail"} →
                </button>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div
            style={{
              marginTop: 60,
              textAlign: "center",
              display: "flex",
              gap: 16,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
            className="reveal"
            data-reveal
          >
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "16px 32px",
                background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.green})`,
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 16,
                textDecoration: "none",
                boxShadow: `0 10px 30px ${BRAND.green}40`,
                transition: "all 0.3s ease",
              }}
              className="lift"
            >
              Minta Penawaran Sekarang
            </a>
          </div>
        </div>
      </section>

      {/* ===========================
          FEATURES - Split Layout
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
      ].map((feature, i) => (
        <section
          key={i}
          style={{
            padding: isMobile ? "80px 0" : "120px 0",
            position: "relative",
            background: i % 2 === 0 ? `linear-gradient(135deg, ${BRAND.greenLight}30 0%, #ffffff 100%)` : "#ffffff",
          }}
        >
          {/* Abstract Background */}
          <div
            style={{
              position: "absolute",
              top: i % 2 === 0 ? "20%" : "auto",
              bottom: i % 2 !== 0 ? "20%" : "auto",
              right: i % 2 === 0 ? "-5%" : "auto",
              left: i % 2 !== 0 ? "-5%" : "auto",
              width: "400px",
              height: "400px",
              background: `radial-gradient(circle, ${BRAND.green}15 0%, transparent 70%)`,
              borderRadius: "50%",
              filter: "blur(80px)",
              pointerEvents: "none",
            }}
          />

          <div style={container}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
                gap: 60,
                alignItems: "center",
              }}
            >
              {/* Content */}
              <div
                className="reveal slide-left"
                data-reveal
                style={{ order: i % 2 === 0 ? 1 : 2 }}
              >
                <div
                  style={{
                    display: "inline-block",
                    padding: "6px 12px",
                    background: BRAND.greenSoft,
                    color: BRAND.green,
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 16,
                  }}
                >
                  Highlight {i + 1}
                </div>
                <h3
                  style={{
                    margin: "0 0 16px",
                    fontSize: isMobile ? 32 : 42,
                    fontWeight: 800,
                    lineHeight: 1.2,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 18,
                    lineHeight: 1.7,
                    color: BRAND.ink2,
                    opacity: 0.8,
                    maxWidth: 500,
                  }}
                >
                  {feature.desc}
                </p>
              </div>

              {/* Image with Glass Frame */}
              <div
                className="reveal slide-right"
                data-reveal
                style={{ order: i % 2 === 0 ? 2 : 1 }}
              >
                <div
                  style={{
                    position: "relative",
                    borderRadius: 32,
                    overflow: "hidden",
                    ...glassCard,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 24,
                      overflow: "hidden",
                      height: isMobile ? 250 : 400,
                      position: "relative",
                    }}
                  >
                    <img
                      src={feature.img}
                      alt={feature.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    {/* Gradient Overlay */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: `linear-gradient(135deg, ${BRAND.green}20 0%, transparent 100%)`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* ===========================
          FAQ
         =========================== */}
      <section
        style={{
          padding: isMobile ? "80px 0" : "120px 0",
          position: "relative",
          background: `linear-gradient(180deg, ${BRAND.greenLight}20 0%, #ffffff 100%)`,
        }}
      >
        <div style={container}>
          <div style={{ textAlign: "center", marginBottom: 60 }} className="reveal" data-reveal>
            <div
              style={{
                display: "inline-block",
                padding: "8px 16px",
                background: BRAND.greenSoft,
                color: BRAND.green,
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 999,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              FAQ
            </div>
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: isMobile ? 36 : 48,
                fontWeight: 800,
                lineHeight: 1.2,
              }}
            >
              Pertanyaan yang <span style={gradientText}>sering ditanyakan</span>
            </h2>
          </div>

          <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gap: 16 }}>
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
            ].map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className="reveal"
                  data-reveal
                  style={{
                    ...glassCard,
                    padding: 24,
                    transition: "all 0.3s ease",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : i)}
                    style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: BRAND.ink,
                      }}
                    >
                      {faq.q}
                    </span>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isOpen ? BRAND.green : BRAND.greenSoft,
                        color: isOpen ? "#fff" : BRAND.green,
                        borderRadius: "50%",
                        fontSize: 20,
                        fontWeight: 700,
                        transition: "all 0.3s ease",
                      }}
                    >
                      {isOpen ? "−" : "+"}
                    </div>
                  </button>
                  {isOpen && (
                    <div
                      style={{
                        marginTop: 16,
                        paddingTop: 16,
                        borderTop: `1px solid ${BRAND.green}20`,
                        fontSize: 15,
                        lineHeight: 1.7,
                        color: BRAND.ink2,
                        opacity: 0.8,
                      }}
                    >
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===========================
          CONTACT
         =========================== */}
      <section
        id="contact"
        style={{
          padding: isMobile ? "80px 0" : "120px 0",
          position: "relative",
          background: "#ffffff",
        }}
      >
        {/* Background Abstract */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "600px",
            height: "600px",
            background: `radial-gradient(circle, ${BRAND.green}10 0%, transparent 70%)`,
            borderRadius: "50%",
            filter: "blur(100px)",
            pointerEvents: "none",
          }}
        />

        <div style={container}>
          <div style={{ textAlign: "center", marginBottom: 60 }} className="reveal" data-reveal>
            <div
              style={{
                display: "inline-block",
                padding: "8px 16px",
                background: BRAND.greenSoft,
                color: BRAND.green,
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 999,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Kontak
            </div>
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: isMobile ? 36 : 48,
                fontWeight: 800,
                lineHeight: 1.2,
              }}
            >
              Hubungi <span style={gradientText}>CV. Mitra Setia</span>
            </h2>
            <p
              style={{
                margin: "0 auto",
                maxWidth: 600,
                fontSize: 18,
                lineHeight: 1.7,
                color: BRAND.ink2,
                opacity: 0.8,
              }}
            >
              Kirim detail rute & muatan via WhatsApp untuk penawaran cepat.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
              gap: 24,
              maxWidth: 1000,
              margin: "0 auto",
            }}
          >
            {/* WhatsApp Card */}
            <div
              className="reveal slide-left"
              data-reveal
              style={{
                ...glassCard,
                padding: 40,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  margin: "0 auto 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 40,
                  background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.green})`,
                  borderRadius: 20,
                  color: "#fff",
                }}
              >
                💬
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>WhatsApp</h3>
              <p style={{ margin: "0 0 20px", fontSize: 15, opacity: 0.7 }}>
                Chat admin untuk penawaran cepat
              </p>
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "14px 28px",
                  background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.green})`,
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 12,
                  textDecoration: "none",
                  transition: "all 0.3s ease",
                }}
                className="lift"
              >
                Chat Sekarang
              </a>
              <div
                style={{
                  margin: "24px 0",
                  height: 1,
                  background: `${BRAND.green}20`,
                }}
              />
              <div style={{ fontSize: 13, opacity: 0.6 }}>📞 {PHONE}</div>
            </div>

            {/* Location Card */}
            <div
              className="reveal slide-right"
              data-reveal
              style={{
                ...glassCard,
                padding: 40,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  margin: "0 auto 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 40,
                  background: `linear-gradient(135deg, ${BRAND.greenLight}, ${BRAND.green}40)`,
                  borderRadius: 20,
                }}
              >
                📍
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>Alamat</h3>
              <p
                style={{
                  margin: "0 0 20px",
                  fontSize: 14,
                  lineHeight: 1.7,
                  opacity: 0.7,
                  whiteSpace: "pre-line",
                }}
              >
                {ADDRESS}
              </p>
              <div
                style={{
                  margin: "24px 0",
                  height: 1,
                  background: `${BRAND.green}20`,
                }}
              />
              <Link
                to="/login"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "14px 28px",
                  background: "transparent",
                  border: `2px solid ${BRAND.green}`,
                  color: BRAND.green,
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 12,
                  textDecoration: "none",
                  transition: "all 0.3s ease",
                }}
                className="lift"
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
        style={{
          background: BRAND.footerBg,
          color: "#fff",
          padding: isMobile ? "40px 0" : "60px 0",
          position: "relative",
        }}
      >
        <div style={container}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>
              © {new Date().getFullYear()} CV. Mitra Setia
            </div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              Medan, Indonesia · Built with MitraSetia ERP
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Scroll to Top */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        style={{
          position: "fixed",
          right: isMobile ? 20 : 32,
          bottom: isMobile ? 20 : 32,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.green})`,
          color: "#fff",
          fontSize: 24,
          fontWeight: 700,
          border: "none",
          boxShadow: `0 8px 24px ${BRAND.green}60`,
          cursor: "pointer",
          transform: scrollY > 400 ? "translateY(0)" : "translateY(100px)",
          opacity: scrollY > 400 ? 1 : 0,
          transition: "all 0.4s ease",
          zIndex: 1000,
        }}
        aria-label="Scroll to top"
      >
        ↑
      </button>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes scrollDown {
          0% { opacity: 0; transform: translateY(-10px); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translateY(10px); }
        }
        @keyframes logoSpin {
          0%, 100% { transform: rotateY(0deg); }
          50% { transform: rotateY(180deg); }
        }
        
        .lift {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .lift:hover {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
