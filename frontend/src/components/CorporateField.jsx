import { FiEye, FiEyeOff } from "react-icons/fi";

export default function CorporateField({ id, testid, label, icon, error, note, toggle, shown, ...inputProps }) {
  return <div className={`register-field ${error ? "has-error" : ""}`}>
    <label htmlFor={id}>{label}</label>
    <span>{icon}<input id={id} data-testid={testid} aria-invalid={Boolean(error)} aria-describedby={(error || note) ? `${id}-help` : undefined} {...inputProps}/>{toggle && <button className="password-toggle" type="button" onClick={toggle} aria-label={shown ? "Sembunyikan password" : "Tampilkan password"}>{shown ? <FiEyeOff/> : <FiEye/>}</button>}</span>
    {(error || note) && <small id={`${id}-help`}>{error || note}</small>}
  </div>;
}
