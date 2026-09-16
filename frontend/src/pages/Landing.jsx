import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowUpRight, FiCheck, FiFileText, FiMapPin, FiPackage, FiPhone, FiShield, FiTruck } from "react-icons/fi";
import "./Landing.css";

const WA_NUMBER = "6285389191318";
const waLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo CV. Mitra Setia, saya ingin berkonsultasi mengenai kebutuhan pengangkutan.")}`;

const services = [
  { icon: FiPackage, title: "Angkutan pupuk", text: "Distribusi ke kebun dan distributor, lengkap dengan pencatatan muatan dan bukti timbang." },
  { icon: FiTruck, title: "Logistik operasional", text: "Pengiriman barang dan komponen perusahaan dengan armada yang sesuai kebutuhan lapangan." },
  { icon: FiFileText, title: "Kontrak perusahaan", text: "Kapasitas angkut rutin dengan alur kerja, dokumentasi, dan pelaporan yang konsisten." },
];

const benefits = [
  "Armada dialokasikan sesuai jenis muatan dan rute",
  "Status perjalanan terkoordinasi dari awal hingga tiba",
  "Dokumen pengiriman dan tagihan tersusun dengan jelas",
];

export default function Landing() {
  const [counts, setCounts] = useState([0, 0, 0]);
  const statsRef = useRef(null);

  useEffect(() => {
    const elements = document.querySelectorAll("[data-scroll-reveal]");
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = statsRef.current;
    if (!element) return undefined;
    let frame;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const targets = [500, 30, 10];
      const startedAt = performance.now();
      const animate = (now) => {
        const progress = Math.min(1, (now - startedAt) / 1200);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCounts(targets.map((target) => Math.round(target * eased)));
        if (progress < 1) frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      observer.disconnect();
    }, { threshold: 0.45 });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  return (
    <main className="landing">
      <section className="landing-hero" data-testid="hero-section">
        <div className="landing-shell landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">Mitra Transportasi Korporasi</span>
            <h1>Keandalan logistik untuk operasional bisnis Anda.</h1>
            <p>CV. Mitra Setia menyediakan layanan angkutan perusahaan dengan armada yang terkelola, koordinasi lapangan yang disiplin, dan dokumentasi yang akuntabel.</p>
            <div className="landing-hero-actions">
              <a className="landing-button landing-button-primary" href={waLink} target="_blank" rel="noreferrer" data-testid="hero-cta-primary">Konsultasikan kebutuhan <FiArrowUpRight /></a>
              <a className="landing-button landing-button-secondary" href="#services" data-testid="hero-cta-secondary">Lihat layanan</a>
            </div>
            <div className="landing-hero-note"><FiShield /> Berbasis di Sumatera Utara · Melayani pengiriman rutin dan kontrak</div>
          </div>
          <div className="landing-hero-image">
            <img src="/hero-3.jpg" alt="Armada Mitra Setia dalam perjalanan pengiriman" />
            <div className="landing-image-badge"><span>Jangkauan operasional</span><strong><FiMapPin /> Sumatera Utara</strong></div>
          </div>
        </div>
      </section>

      <section ref={statsRef} className="landing-proof" aria-label="Pengalaman Mitra Setia">
        <div className="landing-shell landing-proof-grid" data-scroll-reveal>
          <p>Pengalaman operasional yang dibangun melalui ketepatan, konsistensi, dan pertanggungjawaban.</p>
          <div><strong>{counts[0]}+</strong><span>Perjalanan</span></div>
          <div><strong>{counts[1]}+</strong><span>Armada</span></div>
          <div><strong>{counts[2]}+</strong><span>Tahun pengalaman</span></div>
        </div>
      </section>

      <section className="landing-sectors" aria-label="Sektor yang dilayani" data-scroll-reveal>
        <div className="landing-shell landing-sectors-grid">
          <span>Sektor yang kami layani</span>
          <strong>Perkebunan</strong><i />
          <strong>Distributor</strong><i />
          <strong>Operasional Industri</strong><i />
          <strong>Kontrak Korporasi</strong>
        </div>
      </section>

      <section className="landing-section landing-services" id="services" data-testid="services-section">
        <div className="landing-shell">
          <div className="landing-section-heading" data-scroll-reveal>
            <span className="landing-eyebrow">Layanan kami</span>
            <h2>Satu mitra untuk kebutuhan angkutan perusahaan.</h2>
            <p>Dari pengiriman satu kali hingga jadwal berulang, layanan disesuaikan dengan ritme operasional Anda.</p>
          </div>
          <div className="landing-service-grid" data-scroll-reveal>
            {services.map(({ icon: Icon, title, text }, index) => (
              <article key={title} data-testid={`service-card-${index}`}>
                <span className="landing-service-icon"><Icon /></span><small>0{index + 1}</small>
                <h3>{title}</h3><p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-why" id="why-us" data-testid="why-us-section">
        <div className="landing-shell landing-why-grid" data-scroll-reveal>
          <div className="landing-why-image"><img src="/hero-1.jpg" alt="Jajaran armada angkutan CV. Mitra Setia" /></div>
          <div className="landing-why-copy">
            <span className="landing-eyebrow">Mengapa Mitra Setia</span>
            <h2>Kerja lapangan yang rapi, informasi yang tetap jelas.</h2>
            <p>Kami menyatukan kesiapan armada, koordinasi perjalanan, dan penyelesaian dokumen dalam satu alur yang mudah diikuti.</p>
            <ul>{benefits.map((benefit) => <li key={benefit}><FiCheck /><span>{benefit}</span></li>)}</ul>
            <a className="landing-inline-link" href={waLink} target="_blank" rel="noreferrer">Bicarakan rute Anda <FiArrowUpRight /></a>
          </div>
        </div>
      </section>

      <section className="landing-contact" id="contact" data-testid="contact-section">
        <div className="landing-shell landing-contact-card" data-scroll-reveal>
          <div>
            <span className="landing-eyebrow">Konsultasi Kebutuhan</span>
            <h2>Siapkan operasional pengiriman yang lebih terarah.</h2>
            <p>Bagikan rute, jenis muatan, dan jadwal. Tim kami akan membantu menyiapkan solusi yang sesuai.</p>
          </div>
          <div className="landing-contact-actions">
            <a className="landing-button landing-button-light" href={waLink} target="_blank" rel="noreferrer" data-testid="contact-whatsapp"><FiPhone /> Hubungi via WhatsApp</a>
            <span><FiMapPin /> Deli Serdang, Sumatera Utara</span>
          </div>
        </div>
      </section>

      <footer className="landing-footer" data-testid="footer">
        <div className="landing-shell landing-footer-grid">
          <div className="landing-footer-brand"><img src="/logo3.png" alt="Logo Mitra Setia" /><div><strong>CV. Mitra Setia</strong><span>Transportasi & Logistik</span></div></div>
          <p>Pengangkutan perusahaan yang terarah dan terdokumentasi.</p>
          <Link to="/login">Login tim internal</Link>
          <span>© {new Date().getFullYear()} CV. Mitra Setia</span>
        </div>
      </footer>
    </main>
  );
}
