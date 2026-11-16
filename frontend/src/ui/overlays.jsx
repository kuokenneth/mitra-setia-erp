import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiImage, FiUploadCloud, FiX } from "react-icons/fi";
import useDialogLifecycle from "../components/useDialogLifecycle";
import { Button, IconButton } from "./primitives";

/** Centered dialog on desktop/tablet, bottom sheet on phones (CSS-driven). */
export function Modal({ open, onClose, title, description, size = "md", footer, children, closeLabel = "Tutup", dismissible = true }) {
  const { dialogRef, titleId } = useDialogLifecycle(open, dismissible ? onClose : undefined);
  if (!open) return null;
  return createPortal(
    <div className="ui-overlay" onMouseDown={(event) => { if (dismissible && event.target === event.currentTarget) onClose?.(); }}>
      <div ref={dialogRef} className={`ui-modal ui-modal--${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="ui-modal__head">
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} className="ui-modal__title">{title}</h2>
            {description ? <p className="ui-modal__desc">{description}</p> : null}
          </div>
          {dismissible ? <IconButton label={closeLabel} icon={<FiX />} size="sm" onClick={onClose} /> : null}
        </div>
        <div className="ui-modal__body">{children}</div>
        {footer ? <div className="ui-modal__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
export const BottomSheet = Modal;

export function Drawer({ open, onClose, title, children, footer }) {
  const { dialogRef, titleId } = useDialogLifecycle(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="ui-overlay" style={{ padding: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <aside ref={dialogRef} className="ui-drawer-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="ui-modal__head"><h2 id={titleId} className="ui-modal__title">{title}</h2><IconButton label="Tutup" icon={<FiX />} size="sm" onClick={onClose} /></div>
        <div className="ui-modal__body">{children}</div>
        {footer ? <div className="ui-modal__foot">{footer}</div> : null}
      </aside>
    </div>,
    document.body,
  );
}

export function ConfirmationDialog({ open, onClose, onConfirm, title = "Konfirmasi", description, confirmLabel = "Ya, lanjutkan", cancelLabel = "Batal", destructive, loading, requireReason }) {
  const [reason, setReason] = useState("");
  const close = () => { setReason(""); onClose?.(); };
  return (
    <Modal open={open} onClose={close} title={title} description={description} size="sm"
      footer={<><Button onClick={close}>{cancelLabel}</Button><Button variant={destructive ? "danger" : "primary"} loading={loading} disabled={requireReason && reason.trim().length < 3} onClick={() => onConfirm?.(reason.trim())}>{confirmLabel}</Button></>}>
      {requireReason ? <label className="ui-field"><span className="ui-field__label">Alasan <b>*</b></span><textarea className="ui-textarea" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Wajib diisi untuk jejak audit" /></label> : null}
    </Modal>
  );
}

export function FileUploader({ accept = "image/*,application/pdf", multiple, onFiles, label = "Pilih atau ambil foto", hint = "JPG, PNG, atau PDF", disabled }) {
  return (
    <label className="ui-uploader" aria-disabled={disabled}>
      <FiUploadCloud aria-hidden="true" size={22} />
      <strong>{label}</strong>
      <small>{hint}</small>
      <input type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={(event) => { onFiles?.(event.target.files); event.target.value = ""; }} />
    </label>
  );
}

export function ImagePreview({ images = [], emptyLabel = "Belum ada foto" }) {
  const [active, setActive] = useState(null);
  const close = useCallback(() => setActive(null), []);
  useEffect(() => {
    if (active == null) return undefined;
    const onKey = (event) => event.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, close]);
  if (!images.length) return <div className="ui-empty" style={{ padding: 16 }}><span className="ui-empty__icon"><FiImage /></span><span className="ui-empty__desc">{emptyLabel}</span></div>;
  return (
    <>
      <div className="ui-thumbs">
        {images.map((image, index) => <button key={image.src || index} type="button" className="ui-thumb" onClick={() => setActive(index)} aria-label={`Perbesar ${image.alt || `foto ${index + 1}`}`}><img src={image.src} alt={image.alt || ""} loading="lazy" decoding="async" /></button>)}
      </div>
      {active != null && createPortal(<div className="ui-lightbox" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && close()}><img src={images[active].src} alt={images[active].alt || ""} /><IconButton label="Tutup" icon={<FiX />} onClick={close} /></div>, document.body)}
    </>
  );
}

