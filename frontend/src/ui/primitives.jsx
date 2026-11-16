import { forwardRef, useId } from "react";
import { FiChevronDown, FiChevronRight, FiInbox, FiLoader, FiSearch } from "react-icons/fi";
import { Link } from "react-router-dom";
import { statusLabel, statusTone } from "./status";

const cx = (...parts) => parts.filter(Boolean).join(" ");

/* ---------- Layout ---------- */
export function Page({ children, className, ...rest }) {
  return <div className={cx("ui-page", className)} {...rest}>{children}</div>;
}

export function PageHeader({ title, description, actions, children, className }) {
  return (
    <header className={cx("ui-page-header", className)}>
      <div className="ui-page-header__copy">
        <h1 className="ui-page-header__title">{title}</h1>
        {description ? <p className="ui-page-header__desc">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="ui-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function Breadcrumbs({ items = [], home = { label: "Beranda", to: "/dashboard" } }) {
  return (
    <nav className="ui-crumbs" aria-label="Breadcrumb">
      <Link to={home.to}>{home.label}</Link>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} style={{ display: "contents" }}>
            <FiChevronRight aria-hidden="true" />
            {last || !item.to ? <span aria-current={last ? "page" : undefined}>{item.label}</span> : <Link to={item.to}>{item.label}</Link>}
          </span>
        );
      })}
    </nav>
  );
}

/* ---------- Buttons ---------- */
export const Button = forwardRef(function Button({ variant = "outline", size, block, loading, icon, children, className, type = "button", disabled, ...rest }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={cx("ui-btn", `ui-btn--${variant}`, size && `ui-btn--${size}`, block && "ui-btn--block", className)} {...rest}>
      {loading ? <FiLoader className="ui-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

export const PrimaryButton = forwardRef(function PrimaryButton(props, ref) { return <Button ref={ref} variant="primary" {...props} />; });
export const SecondaryButton = forwardRef(function SecondaryButton(props, ref) { return <Button ref={ref} variant="outline" {...props} />; });

export const IconButton = forwardRef(function IconButton({ label, icon, variant = "ghost", size, className, ...rest }, ref) {
  return <Button ref={ref} variant={variant} size={size} className={cx("ui-btn--icon", className)} aria-label={label} title={label} icon={icon} {...rest} />;
});

/* ---------- Surfaces ---------- */
export function Card({ title, subtitle, action, footer, flush, children, className, bodyClassName, as = "section", ...rest }) {
  const Tag = as;
  return (
    <Tag className={cx("ui-card", className)} {...rest}>
      {(title || action) && (
        <div className="ui-card__head">
          <div>{title && <h2 className="ui-card__title">{title}</h2>}{subtitle && <p className="ui-card__subtitle">{subtitle}</p>}</div>
          {action}
        </div>
      )}
      <div className={cx("ui-card__body", flush && "ui-card__body--flush", bodyClassName)}>{children}</div>
      {footer ? <div className="ui-card__foot">{footer}</div> : null}
    </Tag>
  );
}

export function StatCard({ label, value, sub, icon, tone = "default", onClick, children, className, ...rest }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cx("ui-stat", `ui-stat--${tone}`, className)} {...rest}>
      <span className="ui-stat__label"><span>{label}</span>{icon ? <span className="ui-stat__icon" aria-hidden="true">{icon}</span> : null}</span>
      <span className="ui-stat__value">{value}</span>
      {sub ? <span className="ui-stat__sub">{sub}</span> : null}
      {children ? <span className="ui-stat__visual">{children}</span> : null}
    </Tag>
  );
}
export const KPIStatCard = StatCard;

export function Meter({ value = 0, tone, label }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return <span className={cx("ui-meter", tone && `ui-meter--${tone}`)} role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}><i style={{ width: `${pct}%` }} /></span>;
}

export function Badge({ tone = "default", dot, children, className, ...rest }) {
  return <span className={cx("ui-badge", `ui-badge--${tone}`, dot && "ui-badge--dot", className)} {...rest}>{children}</span>;
}

export function StatusBadge({ status, label, tone, dot }) {
  return <Badge tone={tone || statusTone(status)} dot={dot}>{label || statusLabel(status)}</Badge>;
}

export function DetailPanel({ items = [], className }) {
  return <dl className={cx("ui-detail", className)}>{items.filter(Boolean).map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value ?? "-"}</dd></div>)}</dl>;
}

/* ---------- States ---------- */
export function EmptyState({ title = "Belum ada data", description, action, icon }) {
  return (
    <div className="ui-empty" role="status">
      <span className="ui-empty__icon" aria-hidden="true">{icon || <FiInbox />}</span>
      <span className="ui-empty__title">{title}</span>
      {description ? <span className="ui-empty__desc">{description}</span> : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 14, radius, style, className }) {
  return <span className={cx("ui-skeleton", className)} style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function LoadingSkeleton({ rows = 4, label = "Memuat data" }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} style={{ display: "grid", gap: 10, padding: 16 }}>
      {Array.from({ length: rows }, (_, index) => <div key={index} style={{ display: "grid", gap: 6 }}><Skeleton width={`${60 + ((index * 13) % 30)}%`} /><Skeleton width="40%" height={10} /></div>)}
    </div>
  );
}

/* ---------- Tabs ---------- */
export function Tabs({ items, value, onChange, label = "Tab", className }) {
  return (
    <div className={cx("ui-tabs", className)} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button key={item.value} type="button" role="tab" aria-selected={value === item.value} className="ui-tabs__tab" onClick={() => onChange(item.value)}>
          {item.icon}{item.label}{item.count != null ? <span className="ui-tabs__count">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ---------- Form controls ---------- */
export function FormField({ label, hint, error, required, children, className, htmlFor }) {
  const auto = useId();
  const id = htmlFor || auto;
  return (
    <div className={cx("ui-field", className)}>
      {label ? <label className="ui-field__label" htmlFor={id}>{label}{required ? <b> *</b> : null}</label> : null}
      {typeof children === "function" ? children(id) : children}
      {error ? <span className="ui-field__error" role="alert">{error}</span> : hint ? <span className="ui-field__hint">{hint}</span> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx("ui-input", className)} {...rest} />;
});

export const SelectField = forwardRef(function SelectField({ className, children, ...rest }, ref) {
  return <span className={cx("ui-select", className)}><select ref={ref} {...rest}>{children}</select><FiChevronDown aria-hidden="true" /></span>;
});

export const DatePicker = forwardRef(function DatePicker({ type = "date", ...rest }, ref) {
  return <Input ref={ref} type={type} {...rest} />;
});

export function SearchInput({ value, onChange, placeholder = "Cari…", label, className, ...rest }) {
  return (
    <span className={cx("ui-search", className)}>
      <FiSearch aria-hidden="true" />
      <input className="ui-input" type="search" inputMode="search" value={value} onChange={(event) => onChange?.(event.target.value, event)} placeholder={placeholder} aria-label={label || placeholder} {...rest} />
    </span>
  );
}

export function FilterBar({ children, end, className }) {
  return <div className={cx("ui-filterbar", className)}>{children}{end ? <div className="ui-filterbar__end">{end}</div> : null}</div>;
}

export function StickyActionBar({ summary, children, className }) {
  return <div className={cx("ui-sticky-actions", className)}>{summary ? <div className="ui-sticky-actions__summary">{summary}</div> : null}{children}</div>;
}

export function Pagination({ page, pageCount, total, onPage, label = "data" }) {
  return (
    <div className="ui-pagination">
      <span>{Number(total || 0).toLocaleString("id-ID")} {label}</span>
      <span className="ui-pagination__nav">
        <span>Hal. {page} / {Math.max(1, pageCount || 1)}</span>
        <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Halaman sebelumnya">‹</Button>
        <Button size="sm" disabled={page >= (pageCount || 1)} onClick={() => onPage(page + 1)} aria-label="Halaman berikutnya">›</Button>
      </span>
    </div>
  );
}
