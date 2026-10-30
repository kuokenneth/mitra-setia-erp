import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiArrowRight, FiCheckCircle, FiInfo, FiLock, FiMail } from "react-icons/fi";
import { useAuth } from "../AuthContext";
import CorporateField from "../components/CorporateField";
import useAuthReveal from "../components/useAuthReveal";
import { EMAIL_PATTERN, friendlyAuthError, homeFor } from "../components/authErrors";

export default function Login() {
  const { login, logoutReason } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const registeredEmail = location.state?.registered ? location.state.email || "" : "";

  const [email, setEmail] = useState(registeredEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const scopeRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  useAuthReveal(scopeRef);

  useEffect(() => {
    const previous = document.title;
    document.title = "Masuk | Portal Karyawan CV. Mitra Setia";
    (registeredEmail ? passwordRef : emailRef).current?.focus();
    return () => { document.title = previous; };
  }, [registeredEmail]);

  function validate() {
    const next = {};
    if (!email.trim()) next.email = "Email wajib diisi.";
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = "Format email belum benar, contoh: nama@perusahaan.com";
    if (!password) next.password = "Password wajib diisi.";
    return next;
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    const found = validate();
    setErrors(found);
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      nav(location.state?.from || homeFor(user), { replace: true });
    } catch (error) {
      setFormError(friendlyAuthError(error, "login").message);
      setPassword("");
      passwordRef.current?.focus();
      setBusy(false);
    }
  }

  const clear = key => setErrors(current => (current[key] ? { ...current, [key]: undefined } : current));

  return (
    <div ref={scopeRef}>
      <header className="au-head">
        <h1 className="au-title au-reveal">Selamat Datang Kembali</h1>
        <p className="au-lead au-reveal">Masuk menggunakan akun karyawan CV. Mitra Setia.</p>
      </header>

      {registeredEmail && (
        <div className="au-alert au-alert-success au-reveal" role="status">
          <FiCheckCircle aria-hidden="true" />
          <span><strong>Akun berhasil dibuat.</strong> Silakan masuk dengan password yang baru Anda buat.</span>
        </div>
      )}
      {logoutReason && !registeredEmail && (
        <div className="au-alert au-alert-info au-reveal" role="status">
          <FiInfo aria-hidden="true" /><span>{logoutReason}</span>
        </div>
      )}

      <form className="au-form" onSubmit={onSubmit} noValidate aria-busy={busy}>
        <CorporateField
          ref={emailRef} className="au-reveal" id="login-email" testid="login-email-input"
          label="Email" icon={<FiMail />} type="email" inputMode="email" autoComplete="username"
          placeholder="nama@perusahaan.com" value={email} error={errors.email}
          onChange={e => { setEmail(e.target.value); clear("email"); }}
        />
        <CorporateField
          ref={passwordRef} className="au-reveal" id="login-password" testid="login-password-input"
          label="Password" icon={<FiLock />} type={showPassword ? "text" : "password"} autoComplete="current-password"
          placeholder="Masukkan password" value={password} error={errors.password}
          onChange={e => { setPassword(e.target.value); clear("password"); }}
          toggle={() => setShowPassword(v => !v)} shown={showPassword}
        />

        {formError && (
          <div className="au-alert au-alert-error" role="alert" data-testid="login-error">
            <span><strong>Login belum berhasil.</strong> {formError}</span>
          </div>
        )}

        <button className="au-submit au-reveal" type="submit" disabled={busy} data-testid="login-submit-btn">
          {busy ? <><span className="au-spinner" aria-hidden="true" /> Memeriksa akses…</> : <>Masuk ke Portal <FiArrowRight aria-hidden="true" /></>}
        </button>
      </form>

      <p className="au-switch au-reveal">
        Belum memiliki akun? <Link to="/register" data-testid="login-register-link">Daftar Karyawan</Link>
      </p>
    </div>
  );
}
