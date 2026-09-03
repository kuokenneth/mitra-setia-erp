import "./LoadingState.css";

export default function LoadingState({ label = "Menyiapkan data operasional", note = "Mengambil informasi terbaru…", variant = "list", rows = 3, compact = false }) {
  return (
    <div className={`erp-loading ${variant} ${compact ? "compact" : ""}`} role="status" aria-live="polite" aria-busy="true">
      <div className="erp-loading-brand"><span><i /><i /><i /></span><div><strong>{label}</strong><small>{note}</small></div></div>
      {variant !== "inline" && <div className="erp-loading-skeleton" aria-hidden="true">{Array.from({ length: rows }, (_, index) => <div className="erp-loading-row" key={index}><i /><span><b /><b /></span><em /><em /></div>)}</div>}
    </div>
  );
}

export function LoadingMini({ label = "Memuat" }) {
  return <span className="erp-loading-mini" role="status"><i /><i /><i /><small>{label}</small></span>;
}

export function AppBootLoader() {
  return (
    <main className="erp-boot-loader" role="status" aria-live="polite" aria-label="Memuat aplikasi">
      <div className="erp-boot-orb one" /><div className="erp-boot-orb two" />
      <section>
        <div className="erp-boot-logo">
          <img src="/logo2.jpg" alt="CV Mitra Setia" />
          <span aria-hidden="true" />
        </div>
        <span className="erp-boot-eyebrow">TRANSPORT &amp; LOGISTICS</span>
        <h1>Mitra Setia ERP</h1>
        <p>Menyiapkan ruang kerja operasional Anda</p>
        <div className="erp-boot-progress"><i /></div>
        <small><b /><span>Menyinkronkan sesi dan data terbaru…</span></small>
      </section>
    </main>
  );
}
