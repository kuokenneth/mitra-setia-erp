import { forwardRef } from "react";
import { FiAlertCircle, FiEye, FiEyeOff } from "react-icons/fi";

/**
 * Shared input for the employee portal (login + registration).
 * Props kept compatible with the previous version: id, testid, label, icon,
 * error, note, toggle, shown + any native <input> props.
 */
const CorporateField = forwardRef(function CorporateField(
  { id, testid, label, optional = false, icon, error, note, toggle, shown, className = "", ...inputProps },
  ref
) {
  const helpId = error || note ? `${id}-help` : undefined;
  return (
    <div className={`cf ${error ? "has-error" : ""} ${className}`}>
      <label className="cf-label" htmlFor={id}>
        {label}{optional && <span className="cf-optional"> (opsional)</span>}
      </label>
      <div className="cf-control">
        {icon && <span className="cf-icon" aria-hidden="true">{icon}</span>}
        <input
          ref={ref}
          id={id}
          data-testid={testid}
          aria-invalid={Boolean(error)}
          aria-describedby={helpId}
          {...inputProps}
        />
        {toggle && (
          <button className="cf-toggle" type="button" onClick={toggle}
            aria-label={shown ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={Boolean(shown)}>
            {shown ? <FiEyeOff /> : <FiEye />}
          </button>
        )}
      </div>
      {error
        ? <p id={helpId} className="cf-help cf-error" role="alert"><FiAlertCircle aria-hidden="true" />{error}</p>
        : note ? <p id={helpId} className="cf-help">{note}</p> : null}
    </div>
  );
});

export default CorporateField;
