import { useRef } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiArrowUpRight, FiLock, FiMail, FiMapPin, FiPhone } from "react-icons/fi";
import CorporateLogo from "../components/CorporateLogo";
import useLandingMotion from "./landing/useLandingMotion";
import useTruckScene from "./landing/useTruckScene";
import {
  COMPANY, FLEET, REASONS, SERVICES, STEPS, WA_CONSULT, WA_GENERAL,
  clean, isPlaceholder, waLink,
} from "./landing/content";
import "./Landing.css";

const ROUTE_PATH = "M70 600 C 70 520 210 528 226 452 S 112 344 196 282 S 430 300 404 202 S 282 116 340 76 S 440 44 470 44";

/* deterministic "dust" motes for the hero (no Math.random → stable renders) */
const DUST = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${38 + ((i * 53) % 58)}%`,
  size: 2 + ((i * 7) % 4),
  delay: `${-((i * 1.7) % 9)}s`,
  dur: `${9 + ((i * 3) % 8)}s`,
}));

/** Renders a value; placeholder values ([like this]) get a visible dashed style. */
function Val({ value }) {
  if (value == null) return null;
  return isPlaceholder(value)
    ? <span className="lp-placeholder" title="Data belum dikonfirmasi">{clean(value)}</span>
    : value;
}

const TITLE = "BUILT TO DELIVER. DRIVEN BY TRUST.";
const FLEET_VIEWS = ["Tampak depan", "Profil samping", "Tampak belakang", "Roda tandem", "Bak muatan"];

export default function Landing() {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  useLandingMotion(rootRef);
  useTruckScene(rootRef, canvasRef);

  return (
    <main className="lp" ref={rootRef}>
      {/* real-time 3D scene behind the transparent "window" sections (hero, services, fleet, CTA) */}
      <canvas className="lp-scene" ref={canvasRef} aria-hidden="true" />
      <div className="lp-scene-vignette" aria-hidden="true" />

      {/* ============ 1. HERO ============ */}
      <section className="hx" id="home" aria-labelledby="hx-title">
        <span className="lp-sr">Animasi 3D truk dump heavy-duty melaju di jalan perkebunan kelapa sawit.</span>
        <div className="hx-dust" aria-hidden="true">
          {DUST.map((d, i) => (
            <span key={i} style={{ left: d.left, top: d.top, width: d.size, height: d.size, animationDelay: d.delay, animationDuration: d.dur }} />
          ))}
        </div>
        <div className="hx-shade" aria-hidden="true" />
        <div className="lp-shell hx-content">
          <div>
            <p className="hx-kicker">CV. Mitra Setia, Medan</p>
            <h1 id="hx-title" className="hx-title">
              <span className="hx-line"><span>MOVING BUSINESS</span></span>
              <span className="hx-line"><span>FORWARD.</span></span>
            </h1>
          </div>
          <div className="hx-bottom">
            <p className="hx-sub">Solusi transportasi darat yang andal untuk mendukung pertumbuhan bisnis Anda.</p>
            <div className="hx-actions">
              <a className="lp-btn lp-btn-accent" href="#services">Jelajahi Layanan</a>
              <a className="lp-btn lp-btn-ghost" href="#contact">Hubungi Kami</a>
            </div>
          </div>
        </div>
        <div className="hx-veil" aria-hidden="true" />
      </section>

      {/* ============ 2. INTRODUCTION ============ */}
      <section className="ab" id="about" aria-labelledby="ab-title">
        <div className="lp-shell ab-grid">
          <div className="ab-media-wrap">
            <figure className="ab-media">
              <img src="/landing/about.webp" alt="Tim CV. Mitra Setia memuat karung ke atas truk" loading="lazy" decoding="async" />
            </figure>
          </div>
          <div className="ab-copy">
            <h2 id="ab-title" className="ab-title" aria-label={TITLE}>
              {TITLE.split(" ").map((w, i) => <span className="ab-word" aria-hidden="true" key={i}>{w} </span>)}
            </h2>
            <p className="ab-lead">
              CV. Mitra Setia adalah perusahaan transportasi darat yang berbasis di Medan, Sumatera Utara.
              Kami melayani kebutuhan pengangkutan pelanggan industri dan komersial, mulai dari pupuk dan cangkang
              kelapa sawit hingga ambang dan material curah.
            </p>
            <dl className="ab-pillars">
              {[
                ["Keandalan", "Rencana angkutan yang jelas, dijalankan sesuai kesepakatan dengan pelanggan."],
                ["Disiplin operasional", "Armada, pengemudi, jadwal, dan dokumen dikelola dengan tertib di setiap pekerjaan."],
                ["Keselamatan", "Keselamatan pengemudi, muatan, dan pengguna jalan menjadi pertimbangan di setiap perjalanan."],
                ["Kemitraan jangka panjang", "Kami bekerja untuk menjadi mitra logistik yang dapat diandalkan dari tahun ke tahun."],
              ].map(([t, d]) => (
                <div className="ab-pillar" key={t}><dt>{t}</dt><dd>{d}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ============ 3. SERVICES ============ */}
      <section className="sv" id="services" aria-labelledby="sv-title">
        <div className="sv-intro">
          <div className="lp-shell sv-head">
            <h2 id="sv-title">Tiga layanan pengangkutan utama kami.</h2>
            <p>Setiap layanan disesuaikan dengan jenis muatan, rute, dan jadwal pengiriman pelanggan.</p>
          </div>
        </div>
        <div className="sv-stack">
          {/* anchor targets at each panel's position */}
          {SERVICES.map((s, i) => (
            <span key={`a-${s.id}`} id={`layanan-${s.id}`} className="sv-anchor" style={{ "--i": i }} aria-hidden="true" />
          ))}
          {SERVICES.map(s => (
            <article className="sv-panel" key={s.id} aria-labelledby={`sv-${s.id}`}>
              <div className="sv-inner" style={{ "--fallback": `url(${s.image})` }}>
                <div className="sv-shade" aria-hidden="true" />
                <p className="sv-title" aria-hidden="true">{s.decor || s.title}</p>
                <div className="lp-shell sv-body">
                  <h3 id={`sv-${s.id}`} className="sv-reveal">{s.title}</h3>
                  <p className="sv-lead sv-reveal">{s.text}</p>
                  <a className="lp-link sv-reveal" href={waLink(`Halo CV. Mitra Setia, saya ingin berdiskusi mengenai layanan ${s.title}.`)} target="_blank" rel="noreferrer">
                    {s.cta} <FiArrowUpRight aria-hidden="true" />
                  </a>
                </div>
                <span className="lp-sr">{s.alt}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ============ 4. FLEET — the camera circles the truck as you scroll ============ */}
      <section className="fl" id="fleet" aria-labelledby="fl-title">
        <div className="fl-sticky">
          <div className="fl-shade" aria-hidden="true" />
          <div className="lp-shell fl-layout">
            <div className="fl-intro">
              <h2 id="fl-title">POWERED BY OUR FLEET.</h2>
              <p>Unit heavy-duty yang disiapkan untuk pekerjaan angkutan berat di Sumatera Utara, dari pupuk dan cangkang kelapa sawit hingga material curah.</p>
              <p className="fl-note">Visualisasi 3D bersifat ilustratif dan bukan replika persis unit armada kami.</p>
            </div>
            <div className="fl-specs">
              <p className="fl-model-label">Unit utama</p>
              <p className="fl-model"><Val value={FLEET.model} /></p>
              <dl>
                {FLEET.specs.filter(s => s.value != null).map(s => (
                  <div className="fl-spec" key={s.label}>
                    <dt>{s.label}</dt>
                    <dd><Val value={s.value} /></dd>
                  </div>
                ))}
              </dl>
            </div>
            <ol className="fl-views" aria-label="Sudut pandang armada">
              {FLEET_VIEWS.map((v, i) => (
                <li className={`fl-view${i === 0 ? " is-active" : ""}`} key={v}><span aria-hidden="true">{i + 1}</span>{v}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ============ 5. OPERATIONS ============ */}
      <section className="op" id="operations" aria-labelledby="op-title">
        <div className="op-pin">
          <div className="lp-shell op-grid">
            <div className="op-copy">
              <h2 id="op-title">PRECISION IN EVERY JOURNEY.</h2>
              <ol className="op-steps">
                {STEPS.map((s, i) => (
                  <li className="op-step" key={s.title}>
                    <span className="op-step-num" aria-hidden="true">{i + 1}</span>
                    <div>
                      <h3>{s.title}</h3>
                      <p>{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {/* desktop scroll story: the active step's description cross-fades in one fixed slot (no layout shifts) */}
              <div className="op-detail" aria-hidden="true">
                {STEPS.map(s => <p className="op-detail-item" key={s.title}>{s.text}</p>)}
              </div>
            </div>
            <figure className="op-map">
              <svg viewBox="0 0 540 660" role="img" aria-label="Ilustrasi alur pengiriman dari Medan menuju lokasi tujuan dalam lima tahap">
                <path className="op-route-base" d={ROUTE_PATH} />
                <path className="op-route-active" d={ROUTE_PATH} />
                {STEPS.map((s, i) => (
                  <g className="op-node" key={s.title}>
                    <circle className="op-node-off" r="17" />
                    <circle className="op-node-on" r="17" />
                    <text className="op-node-num" dy="5">{i + 1}</text>
                  </g>
                ))}
                <g className="op-truck">
                  <rect x="-15" y="-9" width="30" height="18" rx="4" />
                  <path d="M9 -5 L15 0 L9 5 Z" />
                </g>
                <text className="op-label" x="70" y="644" textAnchor="middle">Medan</text>
                <text className="op-label" x="470" y="20" textAnchor="middle">Lokasi tujuan</text>
              </svg>
              <figcaption>Ilustrasi alur kerja pengiriman</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ============ 6. WHY ============ */}
      <section className="wy" id="why" aria-labelledby="wy-title">
        <div className="lp-shell">
          <h2 id="wy-title">Mengapa bermitra dengan CV. Mitra Setia.</h2>
          <ul className="wy-list">
            {REASONS.map(r => (
              <li className="wy-row" key={r.title}>
                <h3>{r.title}</h3>
                <p>{r.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============ 7. FINAL CTA ============ */}
      <section className="ct" id="contact" aria-labelledby="ct-title">
        <div className="ct-shade" aria-hidden="true" />
        <div className="lp-shell ct-content">
          <h2 id="ct-title">YOUR CARGO. OUR COMMITMENT.</h2>
          <p>Bangun kemitraan logistik yang lebih kuat bersama CV. Mitra Setia.</p>
          <div className="ct-actions">
            <a className="lp-btn lp-btn-accent" href={WA_GENERAL} target="_blank" rel="noreferrer"><FiPhone aria-hidden="true" /> Hubungi Tim Kami</a>
            <a className="lp-btn lp-btn-ghost" href={WA_CONSULT} target="_blank" rel="noreferrer">Konsultasikan Kebutuhan Pengiriman <FiArrowRight aria-hidden="true" /></a>
          </div>
        </div>
      </section>

      {/* ============ 8. FOOTER ============ */}
      <footer className="ft">
        <div className="lp-shell ft-grid">
          <div className="ft-brand">
            <CorporateLogo className="ft-logo" />
            <p>Transportasi darat dan logistik industri dari Medan, Sumatera Utara.</p>
          </div>
          <nav className="ft-col" aria-label="Layanan">
            <h2>Layanan</h2>
            {SERVICES.map(s => <a key={s.id} href={`#layanan-${s.id}`}>{s.title}</a>)}
          </nav>
          <nav className="ft-col" aria-label="Navigasi footer">
            <h2>Perusahaan</h2>
            <a href="#about">Tentang Kami</a>
            <a href="#services">Layanan</a>
            <a href="#fleet">Armada</a>
            <a href="#contact">Hubungi Kami</a>
          </nav>
          <address className="ft-col">
            <h2>Kontak</h2>
            <a href={WA_GENERAL} target="_blank" rel="noreferrer"><FiPhone aria-hidden="true" /> WhatsApp {COMPANY.whatsappDisplay}</a>
            <a href={`mailto:${clean(COMPANY.email)}`}><FiMail aria-hidden="true" /> <Val value={COMPANY.email} /></a>
            <span><FiMapPin aria-hidden="true" /> <Val value={COMPANY.address} /></span>
          </address>
          <div className="ft-col">
            <h2>Internal</h2>
            <Link to="/login" className="ft-portal"><FiLock aria-hidden="true" /> Portal Karyawan</Link>
          </div>
          <p className="ft-copy">© {new Date().getFullYear()} {COMPANY.name}. {COMPANY.city}. {COMPANY.domain}</p>
        </div>
      </footer>
    </main>
  );
}
