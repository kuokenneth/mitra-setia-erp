import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiArrowRight, FiCheck, FiLock, FiMail, FiShield, FiTruck, FiUser } from "react-icons/fi";
import { api } from "../api";
import "./Register.css";

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", inviteCode: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const emailNorm = useMemo(() => form.email.trim().toLowerCase(), [form.email]);
  const mismatch = form.password && form.confirmPassword && form.password !== form.confirmPassword;
  const canSubmit = !busy && emailNorm.length > 3 && form.inviteCode.trim() && form.password.length >= 6 && form.confirmPassword.length >= 6 && !mismatch;
  const change = key => event => setForm(current => ({ ...current, [key]: event.target.value }));

  async function onSubmit(event) {
    event.preventDefault(); setErr(""); setBusy(true);
    try {
      if (!emailNorm) throw new Error("Email wajib diisi.");
      if (form.password.length < 6) throw new Error("Password minimal 6 karakter.");
      if (mismatch) throw new Error("Konfirmasi password tidak cocok.");
      if (!form.inviteCode.trim()) throw new Error("Kode undangan wajib diisi.");
      await api("/auth/register", { method: "POST", body: JSON.stringify({ name: form.name.trim() || null, email: emailNorm, password: form.password, confirmPassword: form.confirmPassword, inviteCode: form.inviteCode.trim(), role: "STAFF" }) });
      nav("/login");
    } catch (error) { setErr(error?.message || String(error)); }
    finally { setBusy(false); }
  }

  return <main className="register-page">
    <section className="register-story">
      <div className="register-motion" aria-hidden="true"><i /><i /><i /></div>
      <button className="register-brand" type="button" onClick={() => nav("/")} data-testid="register-logo"><img src="/logo3.png" alt="" /><span><strong>CV. Mitra Setia</strong><small>TRANSPORTASI &amp; LOGISTIK</small></span></button>
      <div className="register-story-copy"><span className="register-kicker"><i /> PORTAL INTERNAL</span><h1>Satu akun.<br/><em>Seluruh operasi</em><br/>tetap terarah.</h1><p>Akses aman untuk tim yang mengelola armada, perjalanan, muatan, dan keuangan Mitra Setia.</p></div>
      <div className="register-operation-card"><span><FiTruck /></span><div><small>ALUR OPERASIONAL</small><strong>Terhubung &amp; terdokumentasi</strong></div><b><i /> Aktif</b></div>
      <div className="register-story-footer"><span>MS / STAFF ACCESS</span><span>SUMATERA UTARA</span></div>
    </section>

    <section className="register-panel">
      <button className="register-back" type="button" onClick={() => nav("/")} data-testid="register-back-home"><FiArrowLeft /> Beranda</button>
      <div className="register-mobile-brand"><img src="/logo3.png" alt="CV. Mitra Setia"/><span><strong>CV. Mitra Setia</strong><small>Portal Internal</small></span></div>
      <div className="register-form-wrap">
        <span className="register-step">AKSES STAFF <b>01 / 01</b></span><h2>Buat akun Anda</h2><p className="register-subtitle">Gunakan identitas kerja dan kode undangan resmi dari admin.</p>
        <form onSubmit={onSubmit}>
          <Field id="register-name" testid="register-name-input" label="Nama lengkap" icon={<FiUser/>} value={form.name} onChange={change("name")} placeholder="Nama lengkap" autoComplete="name" />
          <Field id="register-email" testid="register-email-input" label="Email" icon={<FiMail/>} type="email" value={form.email} onChange={change("email")} placeholder="nama@perusahaan.com" autoComplete="email" />
          <div className="register-field-grid">
            <Field id="register-password" testid="register-password-input" label="Password" icon={<FiLock/>} type="password" value={form.password} onChange={change("password")} placeholder="Min. 6 karakter" autoComplete="new-password" />
            <Field id="register-confirm" testid="register-confirm-password-input" label="Konfirmasi" icon={<FiCheck/>} type="password" value={form.confirmPassword} onChange={change("confirmPassword")} placeholder="Ulangi password" autoComplete="new-password" error={mismatch ? "Password tidak cocok" : ""} />
          </div>
          <Field id="register-invite" testid="register-invite-code-input" label="Kode undangan" icon={<FiShield/>} value={form.inviteCode} onChange={change("inviteCode")} placeholder="Masukkan kode dari admin" note="Akun hanya dapat dibuat melalui undangan resmi." />
          {err && <div className="register-error" data-testid="register-error"><strong>Registrasi belum berhasil</strong><span>{err}</span></div>}
          <button className="register-submit" type="submit" disabled={!canSubmit} data-testid="register-submit-btn"><span>{busy ? "Menyiapkan akun…" : "Daftar sebagai staff"}</span>{busy ? <i className="register-spinner"/> : <FiArrowRight />}</button>
        </form>
        <div className="register-login">Sudah memiliki akun? <button type="button" onClick={() => nav("/login")} data-testid="register-login-link">Masuk di sini <FiArrowRight /></button></div>
      </div>
      <small className="register-security"><FiShield /> Akses dilindungi dan aktivitas tercatat</small>
    </section>
  </main>;
}

function Field({ id, testid, label, icon, error, note, ...inputProps }) {
  return <div className={`register-field ${error ? "has-error" : ""}`}><label htmlFor={id}>{label}</label><span>{icon}<input id={id} data-testid={testid} {...inputProps}/></span>{(error || note) && <small>{error || note}</small>}</div>;
}
