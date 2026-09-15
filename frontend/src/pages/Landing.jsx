import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiCheck, FiClock, FiMapPin, FiPackage, FiPhone, FiShield, FiTruck, FiUsers } from "react-icons/fi";
import "./Landing.css";

const WA_NUMBER = "62XXXXXXXXXX";
const waLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Halo CV. Mitra Setia, saya ingin berkonsultasi mengenai kebutuhan pengangkutan.")}`;
const services = [
  { number: "01", icon: FiPackage, title: "Angkutan Pupuk", text: "Distribusi pupuk menuju kebun dan distributor dengan pencatatan muatan, tujuan bongkar, dan bukti timbang yang terstruktur.", image: "/hero-3.jpg" },
  { number: "02", icon: FiTruck, title: "Logistik Operasional", text: "Pengiriman barang operasional dan komponen perusahaan dengan armada yang tepat serta koordinasi perjalanan yang rapi.", image: "/hero-1.jpg" },
  { number: "03", icon: FiUsers, title: "Kontrak Perusahaan", text: "Kapasitas angkut jangka panjang untuk kebutuhan rutin dengan alur kerja, pelaporan, dan standar layanan yang konsisten.", image: "/hero-2.jpg" },
];
const values = [
  { icon: FiShield, title: "Terukur & terdokumentasi", text: "Setiap perjalanan memiliki catatan muatan, tujuan, biaya, dan dokumen pendukung." },
  { icon: FiMapPin, title: "Visibilitas perjalanan", text: "Status operasional dapat dipantau sejak keberangkatan hingga barang tiba di tujuan." },
  { icon: FiClock, title: "Respons operasional", text: "Tim bekerja dengan koordinasi cepat untuk menjaga ritme pengiriman tetap berjalan." },
];
const process = [
  ["01", "Diskusi kebutuhan", "Kami memahami rute, jenis muatan, volume, serta ritme pengiriman Anda."],
  ["02", "Penyiapan armada", "Armada dan pengemudi dialokasikan sesuai kapasitas dan kebutuhan lapangan."],
  ["03", "Pengiriman terpantau", "Perjalanan, dokumen, dan tujuan bongkar dikelola dalam satu alur operasional."],
  ["04", "Pelaporan selesai", "Bukti pengiriman dan rincian tagihan disiapkan secara jelas untuk ditindaklanjuti."],
];

export default function Landing() {
  const [activeService, setActiveService] = useState(0);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const statsRef = useRef(null);
  useEffect(() => {
    const elements = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window)) { elements.forEach(el => el.classList.add("is-visible")); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold: 0.12 });
    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = statsRef.current;
    if (!node) return undefined;
    let frame;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const targets = [500, 50, 30, 10];
      const startedAt = performance.now();
      const animate = now => {
        const progress = Math.min(1, (now - startedAt) / 1100);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCounts(targets.map(target => Math.round(target * eased)));
        if (progress < 1) frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      observer.disconnect();
    }, { threshold: 0.35 });
    observer.observe(node);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  return <main className="landing">
    <section className="landing-hero" data-testid="hero-section">
      <div className="landing-motion-layer" aria-hidden="true">
        <span className="landing-route-line landing-route-line-one"><i /></span>
        <span className="landing-route-line landing-route-line-two"><i /></span>
        <span className="landing-moving-glow landing-moving-glow-one" />
        <span className="landing-moving-glow landing-moving-glow-two" />
      </div>
      <div className="landing-shell landing-hero-grid">
        <div className="landing-hero-copy" data-reveal>
          <span className="landing-kicker"><i /> Mitra transportasi Sumatera</span>
          <h1>Pengiriman industri yang <em>pasti arahnya.</em></h1>
          <p>CV. Mitra Setia membantu perusahaan mengelola pengangkutan rutin dengan armada yang siap, koordinasi lapangan yang rapi, dan dokumentasi yang dapat dipertanggungjawabkan.</p>
          <div className="landing-hero-actions">
            <a className="landing-button landing-button-primary" href={waLink} target="_blank" rel="noreferrer" data-testid="hero-cta-primary">Konsultasikan kebutuhan <FiArrowRight /></a>
            <a className="landing-button landing-button-ghost" href="#services" data-testid="hero-cta-secondary">Lihat layanan</a>
          </div>
          <div className="landing-hero-assurance"><span><FiCheck /> Pengiriman rutin</span><span><FiCheck /> Bukti terdokumentasi</span><span><FiCheck /> Armada terkelola</span></div>
        </div>
        <div className="landing-hero-visual" data-reveal>
          <span className="landing-visual-index">MS / 01</span>
          <img src="/hero-3.jpg" alt="Armada CV. Mitra Setia membawa muatan pupuk" />
          <div className="landing-visual-shade" />
          <div className="landing-route-card"><span className="landing-route-icon"><FiTruck /></span><div><small>OPERASIONAL TERINTEGRASI</small><strong>Muatan sampai dengan jelas</strong></div><span className="landing-live"><i /> Aktif</span></div>
          <div className="landing-visual-caption"><span>Transportasi & Logistik</span><b>Sumatera Utara</b></div>
        </div>
      </div>
      <div className="landing-trustbar" aria-label="Bidang layanan Mitra Setia"><div className="landing-trust-track">
        {[0, 1].map(group => <div className="landing-trust-group" aria-hidden={group === 1} key={group}><span>MITRA SETIA / BERGERAK DENGAN PASTI</span><i /><b>Perkebunan</b><i /><b>Distributor</b><i /><b>Operasional Industri</b><i /><b>Kontrak Rutin</b><i /><b>Muatan Terdokumentasi</b><i /></div>)}
      </div></div>
    </section>

    <section className="landing-section landing-about" id="about" data-testid="about-section">
      <div className="landing-shell landing-about-grid">
        <div className="landing-section-intro" data-reveal><span className="landing-kicker"><i /> Tentang Mitra Setia</span><h2>Bukan sekadar memindahkan barang.</h2></div>
        <div className="landing-about-copy" data-reveal><p className="landing-lead">Kami menjaga agar setiap pengiriman bergerak dengan tujuan, catatan, dan tanggung jawab yang jelas.</p><p>Berbasis di Sumatera Utara, CV. Mitra Setia melayani kebutuhan transportasi perusahaan dengan pendekatan operasional yang disiplin—mulai dari alokasi armada hingga penyelesaian dokumen pengiriman.</p><a href="#why-us" className="landing-text-link" data-testid="about-learn-more">Mengapa bekerja bersama kami <FiArrowRight /></a></div>
      </div>
      <div className="landing-shell landing-about-media" data-reveal><span className="landing-media-label">ARMADA / SUMATERA UTARA</span><img src="/hero-1.jpg" alt="Jajaran armada angkutan CV. Mitra Setia" /><div className="landing-about-stamp"><strong>Siap bergerak</strong><span>untuk kebutuhan rutin dan kontrak</span></div></div>
    </section>

    <section className="landing-section landing-services" id="services" data-testid="services-section"><div className="landing-shell">
      <div className="landing-heading-row" data-reveal><div><span className="landing-kicker"><i /> Layanan utama</span><h2>Solusi yang mengikuti cara kerja Anda.</h2></div><p>Dari satu perjalanan hingga kontrak berulang, kami menyesuaikan armada dan alur operasional dengan kebutuhan bisnis.</p></div>
      <div className="landing-services-layout">
        <div className="landing-service-list" data-reveal>{services.map((service, index) => { const Icon = service.icon; return <button key={service.title} className={`landing-service-tab ${activeService === index ? "active" : ""}`} onClick={() => setActiveService(index)} onMouseEnter={() => setActiveService(index)} aria-pressed={activeService === index} data-testid={`service-tab-${index}`}><span className="landing-service-number">{service.number}</span><span className="landing-service-icon"><Icon /></span><span><strong>{service.title}</strong><small>{service.text}</small></span><FiArrowRight /></button>; })}</div>
        <div className="landing-service-image" data-reveal><img key={services[activeService].image} src={services[activeService].image} alt={services[activeService].title} /><div><small>LAYANAN {services[activeService].number}</small><strong>{services[activeService].title}</strong></div></div>
      </div>
      <a href={waLink} target="_blank" rel="noreferrer" className="landing-text-link landing-services-cta" data-testid="service-cta">Diskusikan kebutuhan pengiriman <FiArrowRight /></a>
    </div></section>

    <section className="landing-process"><div className="landing-shell">
      <div className="landing-heading-row landing-heading-light" data-reveal><div><span className="landing-kicker"><i /> Cara kami bekerja</span><h2>Satu alur yang mudah diikuti.</h2></div><p>Koordinasi lapangan tetap sederhana, sementara informasi penting tetap tercatat.</p></div>
      <div className="landing-process-grid">{process.map(([number, title, text]) => <article key={number} data-reveal><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
    </div></section>

    <section ref={statsRef} className="landing-stats" data-testid="stats-section"><div className="landing-shell landing-stats-grid">{["Perjalanan ditangani", "Relasi pelanggan", "Armada operasional", "Tahun pengalaman"].map((label, index) => <div key={label} data-testid={`stat-${index}`} data-reveal><strong>{counts[index]}+</strong><span>{label}</span></div>)}</div></section>

    <section className="landing-section landing-values" id="why-us" data-testid="why-us-section"><div className="landing-shell">
      <div className="landing-heading-center" data-reveal><span className="landing-kicker"><i /> Standar layanan</span><h2>Kepercayaan dibangun dari pekerjaan yang konsisten.</h2><p>Kami merancang setiap proses agar tim Anda memperoleh kepastian, bukan sekadar janji.</p></div>
      <div className="landing-values-grid">{values.map((value, index) => { const Icon = value.icon; return <article key={value.title} data-testid={`value-card-${index}`} data-reveal><span><Icon /></span><h3>{value.title}</h3><p>{value.text}</p></article>; })}</div>
    </div></section>

    <section className="landing-cta"><div className="landing-shell landing-cta-card" data-reveal><div><span className="landing-kicker"><i /> Siap berdiskusi?</span><h2>Mari susun pengiriman yang lebih terarah.</h2><p>Ceritakan rute, jenis muatan, dan kebutuhan ritme pengiriman perusahaan Anda.</p></div><a href={waLink} target="_blank" rel="noreferrer" className="landing-button landing-button-white" data-testid="cta-banner-btn">Hubungi tim kami <FiArrowRight /></a></div></section>

    <section className="landing-section landing-contact" id="contact" data-testid="contact-section"><div className="landing-shell landing-contact-grid">
      <div data-reveal><span className="landing-kicker"><i /> Kontak</span><h2>Kebutuhan angkutan Anda dimulai dari percakapan yang jelas.</h2></div>
      <div className="landing-contact-list" data-reveal><a href={waLink} target="_blank" rel="noreferrer" data-testid="contact-whatsapp"><FiPhone /><span><small>WhatsApp operasional</small><strong>Hubungi tim Mitra Setia</strong></span><FiArrowRight /></a><div data-testid="contact-address"><FiMapPin /><span><small>Alamat kantor</small><strong>Jl. Cemara No.40, Indra Kasih, Deli Serdang, Sumatera Utara</strong></span></div><Link to="/login" data-testid="contact-login-btn"><FiShield /><span><small>Khusus tim internal</small><strong>Masuk ke Mitra Setia ERP</strong></span><FiArrowRight /></Link></div>
    </div></section>

    <footer className="landing-footer" data-testid="footer"><div className="landing-shell landing-footer-grid"><div className="landing-footer-brand"><img src="/logo3.png" alt="Logo Mitra Setia" /><div><strong>CV. Mitra Setia</strong><span>Transportasi & Logistik</span></div></div><p>Pengangkutan perusahaan yang terarah, terdokumentasi, dan konsisten.</p><span>© {new Date().getFullYear()} CV. Mitra Setia</span></div></footer>
  </main>;
}
