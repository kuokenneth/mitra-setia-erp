import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowRight, FiCheck, FiKey, FiLock, FiMail, FiUser } from "react-icons/fi";
import { api } from "../api";
import CorporateField from "../components/CorporateField";
import useAuthReveal from "../components/useAuthReveal";
import { EMAIL_PATTERN, PASSWORD_MIN, friendlyAuthError } from "../components/authErrors";

const EMPTY = { name: "", email: "", password: "", confirmPassword: "", inviteCode: "" };
const ORDER = ["name", "email", "password", "confirmPassword", "inviteCode"];

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [visible, setVisible] = useState({ password: false, confirmPassword: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const scopeRef = useRef(null);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const inviteRef = useRef(null);
  // only read inside event handlers, never during render
  const focusField = key => ({ name: nameRef, email: emailRef, password: passwordRef, confirmPassword: confirmRef, inviteCode: inviteRef })[key]?.current?.focus();
  useAuthReveal(scopeRef);

  useEffect(() => {
    const previous = document.title;
    document.title = "Daftar | Portal Karyawan CV. Mitra Setia";
    return () => { document.title = previous; };
  }, []);

  const emailNorm = useMemo(() => form.email.trim().toLowerCase(), [form.email]);
  const liveMismatch = form.confirmPassword && form.password !== form.confirmPassword;

  const change = key => event => {
    const value = event.target.value;
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => (current[key] ? { ...current, [key]: undefined } : current));
  };

  function validate() {
    const next = {};
    if (!emailNorm) next.email = "Email wajib diisi.";
    else if (!EMAIL_PATTERN.test(emailNorm)) next.email = "Format email belum benar, contoh: nama@perusahaan.com";
    if (!form.password) next.password = "Password wajib diisi.";
    else if (form.password.length < PASSWORD_MIN) next.password = `Password minimal ${PASSWORD_MIN} karakter.`;
    if (!form.confirmPassword) next.confirmPassword = "Ulangi password Anda.";
    else if (form.password !== form.confirmPassword) next.confirmPassword = "Konfirmasi password tidak sama.";
    if (!form.inviteCode.trim()) next.inviteCode = "Kode undangan wajib diisi.";
    return next;
  }

  const focusFirst = found => {
    const key = ORDER.find(k => found[k]);
    if (key) focusField(key);
  };

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return focusFirst(found);

    setBusy(true);
    try {
      // Role is decided by the server (always STAFF); the client never sends one.
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim() || null,
          email: emailNorm,
          password: form.password,
          confirmPassword: form.confirmPassword,
          inviteCode: form.inviteCode.trim(),
        }),
      });
      nav("/login", { replace: true, state: { registered: true, email: emailNorm } });
    } catch (error) {
      const { message, field } = friendlyAuthError(error, "register");
      if (field) {
        setErrors({ [field]: message });
        focusField(field);
      } else {
        setFormError(message);
      }
      setBusy(false);
    }
  }

  const passwordNote = form.password && form.password.length < PASSWORD_MIN
    ? `${PASSWORD_MIN - form.password.length} karakter lagi`
    : `Minimal ${PASSWORD_MIN} karakter.`;

  return (
    <div ref={scopeRef}>
      <header className="au-head">
        <h1 className="au-title au-reveal">Bergabung dengan Tim Kami</h1>
        <p className="au-lead au-reveal">Daftarkan akun karyawan untuk mengakses sistem internal CV. Mitra Setia.</p>
      </header>

      <form className="au-form" onSubmit={onSubmit} noValidate aria-busy={busy}>
        <CorporateField ref={nameRef} className="au-reveal" id="register-name" testid="register-name-input"
          label="Nama lengkap" optional icon={<FiUser />} autoComplete="name" placeholder="Nama sesuai data karyawan"
          value={form.name} onChange={change("name")} />
        <CorporateField ref={emailRef} className="au-reveal" id="register-email" testid="register-email-input"
          label="Email" icon={<FiMail />} type="email" inputMode="email" autoComplete="email" placeholder="nama@perusahaan.com"
          value={form.email} onChange={change("email")} error={errors.email} />
        <div className="au-row au-reveal">
          <CorporateField ref={passwordRef} id="register-password" testid="register-password-input"
            label="Password" icon={<FiLock />} type={visible.password ? "text" : "password"} autoComplete="new-password"
            placeholder={`Min. ${PASSWORD_MIN} karakter`} value={form.password} onChange={change("password")}
            error={errors.password} note={passwordNote}
            toggle={() => setVisible(v => ({ ...v, password: !v.password }))} shown={visible.password} />
          <CorporateField ref={confirmRef} id="register-confirm" testid="register-confirm-password-input"
            label="Konfirmasi password" icon={<FiCheck />} type={visible.confirmPassword ? "text" : "password"} autoComplete="new-password"
            placeholder="Ulangi password" value={form.confirmPassword} onChange={change("confirmPassword")}
            error={errors.confirmPassword || (liveMismatch ? "Belum sama dengan password." : "")}
            toggle={() => setVisible(v => ({ ...v, confirmPassword: !v.confirmPassword }))} shown={visible.confirmPassword} />
        </div>
        <CorporateField ref={inviteRef} className="au-reveal" id="register-invite" testid="register-invite-code-input"
          label="Kode undangan" icon={<FiKey />} autoComplete="off" autoCapitalize="off" spellCheck={false}
          placeholder="Kode dari admin perusahaan" value={form.inviteCode} onChange={change("inviteCode")}
          error={errors.inviteCode} note="Pendaftaran hanya untuk karyawan yang menerima kode undangan resmi." />

        {formError && (
          <div className="au-alert au-alert-error" role="alert" data-testid="register-error">
            <span><strong>Pendaftaran belum berhasil.</strong> {formError}</span>
          </div>
        )}

        <button className="au-submit au-reveal" type="submit" disabled={busy} data-testid="register-submit-btn">
          {busy ? <><span className="au-spinner" aria-hidden="true" /> Membuat akun…</> : <>Daftar Akun <FiArrowRight aria-hidden="true" /></>}
        </button>
      </form>

      <p className="au-switch au-reveal">
        Sudah memiliki akun? <Link to="/login" data-testid="register-login-link">Masuk di sini</Link>
      </p>
    </div>
  );
}
