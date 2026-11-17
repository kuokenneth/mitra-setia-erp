import { useEffect, useRef } from "react";
import { FiAlertTriangle, FiInfo } from "react-icons/fi";

// Presentational confirm / alert dialog rendered by dialogService.
export default function ConfirmView({ kind, title, message, confirmLabel, cancelLabel = "Batal", destructive, tone, onDone }) {
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const isConfirm = kind === "confirm";
  const heading = title || (isConfirm ? (destructive ? "Konfirmasi tindakan" : "Konfirmasi") : tone === "error" ? "Terjadi kendala" : "Informasi");
  const Icon = destructive || tone === "error" || tone === "warning" ? FiAlertTriangle : FiInfo;

  useEffect(() => {
    const previous = document.activeElement;
    // Destructive confirmations focus "Batal" so Enter never triggers the destructive action by accident.
    (destructive && isConfirm ? cancelRef.current : confirmRef.current)?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onDone(isConfirm ? false : undefined); }
      if (event.key === "Tab") {
        const items = [cancelRef.current, confirmRef.current].filter(Boolean);
        if (items.length < 2) { event.preventDefault(); return; }
        const index = items.indexOf(document.activeElement);
        event.preventDefault();
        items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length].focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); previous?.focus?.(); };
  }, [destructive, isConfirm, onDone]);

  return (
    <div className="ms-confirm-overlay" role="presentation">
      <div className={`ms-confirm${destructive ? " is-destructive" : ""}${tone ? ` is-${tone}` : ""}`} role={isConfirm ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby="ms-confirm-title" aria-describedby="ms-confirm-message">
        <div className="ms-confirm-body">
          <span className="ms-confirm-icon" aria-hidden="true"><Icon /></span>
          <div>
            <h2 id="ms-confirm-title">{heading}</h2>
            <p id="ms-confirm-message">{message}</p>
          </div>
        </div>
        <div className="ms-confirm-actions">
          {isConfirm && <button ref={cancelRef} type="button" className="ui-btn ui-btn--outline" onClick={() => onDone(false)}>{cancelLabel}</button>}
          <button ref={confirmRef} type="button" className={`ui-btn ${destructive ? "ui-btn--danger" : "ui-btn--primary"}`} onClick={() => onDone(isConfirm ? true : undefined)}>
            {confirmLabel || (isConfirm ? (destructive ? "Ya, lanjutkan" : "Ya, lanjutkan") : "OK")}
          </button>
        </div>
      </div>
    </div>
  );
}
