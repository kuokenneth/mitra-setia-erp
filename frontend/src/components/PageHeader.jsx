export function ActionGroup({ children, className = "", purpose = "secondary" }) {
  return (
    <div className={`erp-action-group erp-action-group--${purpose} ${className}`.trim()}>
      {children}
    </div>
  );
}

export function ActionToolbar({ children, className = "", ariaLabel = "Aksi halaman" }) {
  return (
    <div className={`erp-action-toolbar ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {children}
    </div>
  );
}

export default function PageHeader({ eyebrow, title, description, children, className = "" }) {
  return (
    <header className={`erp-page-header ${className}`.trim()}>
      <div className="erp-page-header-copy">
        {eyebrow ? <span className="erp-page-header-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </header>
  );
}
