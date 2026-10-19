import { Link } from "react-router-dom";

export default function CorporateLogo({ className = "", compact = false, onClick, asButton = false }) {
  const content = <><img src="/logo3.png" alt="" /><span><strong>CV. Mitra Setia</strong><small>{compact ? "Portal Karyawan" : "Transportasi & Logistik"}</small></span></>;
  if (asButton) return <button className={className} type="button" onClick={onClick}>{content}</button>;
  return <Link className={className} to="/">{content}</Link>;
}
