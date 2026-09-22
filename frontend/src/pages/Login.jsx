import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiArrowRight, FiCheck, FiLock, FiMail, FiShield, FiTruck } from "react-icons/fi";
import { useAuth } from "../AuthContext";
import "./Register.css";

export default function Login() {
  const { login, logoutReason } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const canSubmit = !busy && email.trim().length > 3 && password.length > 0;

  async function onSubmit(event) {
    event.preventDefault(); setErr(""); setBusy(true);
    try {
      const user = await login(email.trim(), password);
      nav(location.state?.from || (user?.role === "SPAREPART_ADMIN" ? "/inventory" : "/dashboard"), { replace: true });
    } catch (error) { setErr(error?.message || String(error)); }
    finally { setBusy(false); }
  }

  return <main className="register-page login-page">
    <section className="register-story login-story">
      <div className="register-motion" aria-hidden="true"><i /><i /><i /></div>
      <button className="register-brand" type="button" onClick={() => nav("/")} data-testid="login-logo"><img src="/logo3.png" alt=""/><span><strong>CV. Mitra Setia</strong><small>TRANSPORTASI &amp; LOGISTIK</small></span></button>
      <div className="register-story-copy"><span className="register-kicker"><i /> RUANG KERJA OPERASIONAL</span><h1>Kembali bekerja.<br/><em>Semua tetap</em><br/>dalam kendali.</h1><p>Masuk untuk memantau armada, perjalanan, muatan, biaya, dan seluruh aktivitas perusahaan dalam satu sistem.</p></div>
      <div className="login-flow" aria-label="Alur sistem"><span><FiTruck/><small>ARMADA</small></span><i/><span><FiCheck/><small>OPERASI</small></span><i/><span><FiShield/><small>TERCATAT</small></span></div>
      <div className="register-story-footer"><span>MS / SECURE ACCESS</span><span>SUMATERA UTARA</span></div>
    </section>

    <section className="register-panel login-panel">
      <button className="register-back" type="button" onClick={() => nav("/")} data-testid="login-back-home"><FiArrowLeft/> Beranda</button>
      <div className="register-mobile-brand"><img src="/logo3.png" alt="CV. Mitra Setia"/><span><strong>CV. Mitra Setia</strong><small>Portal Internal</small></span></div>
      <div className="register-form-wrap login-form-wrap">
        <span className="register-step">PORTAL INTERNAL <b>AKSES AMAN</b></span>
        <h2>Selamat datang</h2><p className="register-subtitle">Masuk menggunakan akun staff Mitra Setia.</p>
        {logoutReason && <div className="login-notice" role="status"><FiShield/><span>{logoutReason}</span></div>}
        <form onSubmit={onSubmit}>
          <div className="register-field"><label htmlFor="login-email">Email</label><span><FiMail/><input id="login-email" data-testid="login-email-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@perusahaan.com" autoComplete="email" autoFocus /></span></div>
          <div className="register-field"><label htmlFor="login-password">Password</label><span><FiLock/><input id="login-password" data-testid="login-password-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Masukkan password" autoComplete="current-password" /></span></div>
          {err && <div className="register-error" data-testid="login-error"><strong>Login belum berhasil</strong><span>{err}</span></div>}
          <button className="register-submit" type="submit" disabled={!canSubmit} data-testid="login-submit-btn"><span>{busy ? "Memeriksa akses…" : "Masuk ke ERP"}</span>{busy ? <i className="register-spinner"/> : <FiArrowRight/>}</button>
        </form>
        <div className="register-login">Belum memiliki akun? <button type="button" onClick={() => nav("/register")} data-testid="login-register-link">Daftar dengan undangan <FiArrowRight/></button></div>
      </div>
      <small className="register-security"><FiShield/> Sesi aman dan aktivitas sistem tercatat</small>
    </section>
  </main>;
}
