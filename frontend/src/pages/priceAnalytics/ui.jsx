import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FiAlertTriangle, FiArrowDown, FiArrowDownRight, FiArrowUp, FiArrowUpRight, FiChevronLeft, FiChevronRight, FiInbox, FiMinus, FiRefreshCw, FiX } from "react-icons/fi";
import { PRICE_STATUS, pct } from "./format";

export function Panel({ title, subtitle, actions, className = "", children, id, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;
  return (
    <section className={`pa-panel ${className}`.trim()} id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      {(title || actions) && (
        <header className="pa-panel-head">
          <div>
            {title && <Heading id={id ? `${id}-title` : undefined}>{title}</Heading>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="pa-panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kpi({ icon, label, value, detail, tone = "green", onClick, loading }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={`pa-kpi ${tone} ${onClick ? "is-link" : ""}`} onClick={onClick}>
      <span className="pa-kpi-top"><i aria-hidden="true">{icon}</i>{label}</span>
      {loading ? <span className="pa-skel pa-skel-value" /> : <strong>{value}</strong>}
      {detail && <small>{loading ? <span className="pa-skel pa-skel-line" /> : detail}</small>}
    </Tag>
  );
}

export function ChangeBadge({ value, size = "md", title }) {
  if (value == null) return <span className={`pa-change none ${size}`} title={title || "Belum ada pembelian sebelumnya untuk dibandingkan"}><FiMinus aria-hidden="true" />—</span>;
  const tone = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const Icon = value > 0 ? FiArrowUpRight : value < 0 ? FiArrowDownRight : FiMinus;
  return <span className={`pa-change ${tone} ${size}`} title={title}><Icon aria-hidden="true" />{pct(value)}</span>;
}

export function StatusTag({ status }) {
  const meta = PRICE_STATUS[status];
  if (!meta || status === "INVOICE") return null;
  return <span className={`pa-tag ${status === "RECEIPT" ? "warn" : "muted"}`} title={meta.note}>{meta.label}</span>;
}

export function Segment({ options, value, onChange, label }) {
  return (
    <div className="pa-segment" role="group" aria-label={label}>
      {options.map((option) => (
        <button type="button" key={option.key} aria-pressed={value === option.key} className={value === option.key ? "active" : ""} onClick={() => onChange(option.key)}>{option.label}</button>
      ))}
    </div>
  );
}

export function Pagination({ pagination, onPage, label = "data" }) {
  if (!pagination || pagination.total <= pagination.limit) {
    return pagination && pagination.total > 0 ? <div className="pa-pager"><span>{pagination.total.toLocaleString("id-ID")} {label}</span></div> : null;
  }
  const { page, totalPages, total, limit } = pagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);
  return (
    <nav className="pa-pager" aria-label={`Halaman ${label}`}>
      <span>{start.toLocaleString("id-ID")}–{end.toLocaleString("id-ID")} dari {total.toLocaleString("id-ID")} {label}</span>
      <div>
        <button type="button" className="pa-icon-btn" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Halaman sebelumnya"><FiChevronLeft /></button>
        <b>{page} / {totalPages}</b>
        <button type="button" className="pa-icon-btn" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Halaman berikutnya"><FiChevronRight /></button>
      </div>
    </nav>
  );
}

export function SortHeader({ label, field, sort, onSort, align, className = "" }) {
  const active = sort.field === field;
  const Icon = active && sort.order === "asc" ? FiArrowUp : FiArrowDown;
  return (
    <th className={`${align === "right" ? "num" : ""} ${className}`.trim()} aria-sort={active ? (sort.order === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={`pa-sort ${active ? "active" : ""}`} onClick={() => onSort(field)}>
        {label}<Icon aria-hidden="true" />
      </button>
    </th>
  );
}

export function EmptyState({ icon, title, children, compact }) {
  return (
    <div className={`pa-empty ${compact ? "compact" : ""}`}>
      <span aria-hidden="true">{icon || <FiInbox />}</span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="pa-error" role="alert">
      <FiAlertTriangle aria-hidden="true" />
      <div><strong>Data belum dapat dimuat</strong><p>{message}</p></div>
      {onRetry && <button type="button" className="pa-btn" onClick={onRetry}><FiRefreshCw /> Coba lagi</button>}
    </div>
  );
}

export function SkeletonRows({ rows = 5, columns = 5 }) {
  return (
    <div className="pa-skel-table" aria-hidden="true">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="pa-skel-row">{Array.from({ length: columns }, (__, c) => <span key={c} className="pa-skel" style={{ width: `${c === 0 ? 92 : 60 + ((r * 7 + c * 13) % 30)}%` }} />)}</div>
      ))}
    </div>
  );
}

export function Dialog({ open, title, subtitle, onClose, children, footer, size = "md" }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const timer = setTimeout(() => panelRef.current?.focus(), 0);
    return () => { document.removeEventListener("keydown", onKey); clearTimeout(timer); previous?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="pa-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`pa-dialog ${size}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panelRef}>
        <header className="pa-dialog-head">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button type="button" className="pa-icon-btn" onClick={onClose} aria-label="Tutup"><FiX /></button>
        </header>
        <div className="pa-dialog-body">{children}</div>
        {footer && <footer className="pa-dialog-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
