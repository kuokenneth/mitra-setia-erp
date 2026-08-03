// src/pages/Register.jsx - Corporate Green Theme
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Register() {
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const isMobile = useMemo(
    () => typeof window !== "undefined" && window.innerWidth <= 768,
    []
  );

  // Corporate Green Color Palette
  const BRAND = {
    primary: "#0D7C3D",
    primaryDark: "#0A6331",
    primaryLight: "#10A050",
    secondary: "#F5F9F7",
    accent: "#D4E8DC",
    text: "#1A1A1A",
    textLight: "#4A4A4A",
    textMuted: "#6B7280",
    white: "#FFFFFF",
    border: "#E5E7EB",
    error: "#DC2626",
    errorBg: "#FEF2F2",
  };

  const emailNorm = useMemo(() => email.trim().toLowerCase(), [email]);

  const pwdMismatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password !== confirmPassword;

  const canSubmit =
    !busy &&
    emailNorm.length > 3 &&
    inviteCode.trim().length > 0 &&
    password.length >= 6 &&
    confirmPassword.length >= 6 &&
    !pwdMismatch;

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);

    try {
      if (!emailNorm) throw new Error("Email wajib diisi.");
      if (!password) throw new Error("Password wajib diisi.");
      if (password.length < 6) throw new Error("Password minimal 6 karakter.");
      if (password !== confirmPassword) throw new Error("Konfirmasi password tidak cocok.");
      if (!inviteCode.trim()) throw new Error("Kode undangan wajib diisi.");

      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || null,
          email: emailNorm,
          password,
          confirmPassword,
          inviteCode: inviteCode.trim(),
          role: "STAFF",
        }),
      });

      nav("/login");
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = (fieldName) => ({
    width: "100%",
    padding: "14px 16px",
    fontSize: 15,
    border: `2px solid ${focusedField === fieldName ? BRAND.primary : BRAND.border}`,
    borderRadius: 8,
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  });

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        background: BRAND.white,
        fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          minHeight: "100dvh",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        }}
      >
        {/* Left Panel - Branding */}
        {!isMobile && (
          <div
            style={{
              position: "relative",
              padding: 64,
              background: BRAND.primary,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* Background Pattern */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(https://images.unsplash.com/photo-1741495515999-0567609a236e?w=1200&q=80)`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                opacity: 0.15,
              }}
            />
            
            {/* Gradient Overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%)`,
              }}
            />

            {/* Decorative Circle */}
            <div
              style={{
                position: "absolute",
                top: "10%",
                right: "-10%",
                width: 300,
                height: 300,
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "50%",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "15%",
                left: "-5%",
                width: 200,
                height: 200,
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "50%",
              }}
            />

            {/* Logo */}
            <div
              onClick={() => nav("/")}
              data-testid="register-logo"
              style={{
                position: "absolute",
                top: 40,
                left: 48,
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
                zIndex: 10,
              }}
            >
              <img
                src="/logo3.png"
                alt="CV. Mitra Setia"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  objectFit: "contain",
                  display: "block",
                  background: BRAND.white,
                }}
              />
              <div style={{ color: BRAND.white }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>CV. Mitra Setia</div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>Transportasi & Logistik</div>
              </div>
            </div>

            {/* Content */}
            <div style={{ position: "relative", zIndex: 10, maxWidth: 400 }}>
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: BRAND.white,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  marginBottom: 24,
                }}
              >
                Registrasi Staff
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 48,
                  fontWeight: 800,
                  color: BRAND.white,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                }}
              >
                Bergabung dengan Tim
              </h1>
              <p
                style={{
                  marginTop: 20,
                  fontSize: 16,
                  lineHeight: 1.7,
                  color: "rgba(255,255,255,0.85)",
                  maxWidth: 340,
                }}
              >
                Pendaftaran hanya untuk staff dengan undangan resmi. Gunakan kode undangan yang diberikan admin.
              </p>
            </div>
          </div>
        )}

        {/* Right Panel - Form */}
        <div
          style={{
            padding: isMobile ? "40px 24px" : 64,
            background: BRAND.white,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
            overflowY: "auto",
          }}
        >
          {/* Back to Home */}
          <div
            onClick={() => nav("/")}
            data-testid="register-back-home"
            style={{
              position: "absolute",
              top: isMobile ? 20 : 40,
              right: isMobile ? 24 : 48,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: BRAND.primary,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Kembali
          </div>

          {/* Mobile Logo */}
          {isMobile && (
            <div
              onClick={() => nav("/")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 32,
                cursor: "pointer",
              }}
            >
              <img
                src="/logo3.png"
                alt="CV. Mitra Setia"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  objectFit: "contain",
                  display: "block",
                  background: BRAND.white,
                }}
              />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: BRAND.text }}>CV. Mitra Setia</div>
                <div style={{ fontSize: 11, color: BRAND.textMuted }}>Transportasi & Logistik</div>
              </div>
            </div>
          )}

          {/* Form Container */}
          <div style={{ maxWidth: 420, width: "100%", margin: isMobile ? 0 : "0 auto" }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 28,
                  fontWeight: 700,
                  color: BRAND.text,
                  letterSpacing: "-0.02em",
                }}
              >
                Daftar Akun
              </h2>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 14,
                  color: BRAND.textMuted,
                }}
              >
                Registrasi akun staff baru
              </p>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit}>
              {/* Name Field */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: BRAND.textLight,
                    marginBottom: 8,
                  }}
                >
                  Nama Lengkap
                </label>
                <input
                  data-testid="register-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Nama lengkap"
                  autoComplete="name"
                  style={inputStyle("name")}
                />
              </div>

              {/* Email Field */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: BRAND.textLight,
                    marginBottom: 8,
                  }}
                >
                  Email
                </label>
                <input
                  data-testid="register-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="email@mitrasetia.com"
                  autoComplete="email"
                  style={inputStyle("email")}
                />
              </div>

              {/* Password Field */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: BRAND.textLight,
                    marginBottom: 8,
                  }}
                >
                  Password
                </label>
                <input
                  data-testid="register-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Minimal 6 karakter"
                  autoComplete="new-password"
                  style={inputStyle("password")}
                />
              </div>

              {/* Confirm Password Field */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: BRAND.textLight,
                    marginBottom: 8,
                  }}
                >
                  Konfirmasi Password
                </label>
                <input
                  data-testid="register-confirm-password-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setFocusedField("confirmPassword")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Ulangi password"
                  autoComplete="new-password"
                  style={{
                    ...inputStyle("confirmPassword"),
                    borderColor: pwdMismatch ? BRAND.error : (focusedField === "confirmPassword" ? BRAND.primary : BRAND.border),
                  }}
                />
                {pwdMismatch && (
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: BRAND.error, fontWeight: 600 }}>
                    Password tidak cocok
                  </p>
                )}
              </div>

              {/* Invite Code Field */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: BRAND.textLight,
                    marginBottom: 8,
                  }}
                >
                  Kode Undangan
                </label>
                <input
                  data-testid="register-invite-code-input"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onFocus={() => setFocusedField("inviteCode")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Kode dari admin"
                  style={inputStyle("inviteCode")}
                />
                <p style={{ margin: "6px 0 0", fontSize: 12, color: BRAND.textMuted }}>
                  Minta kode undangan dari admin
                </p>
              </div>

              {/* Error Message */}
              {err && (
                <div
                  data-testid="register-error"
                  style={{
                    marginBottom: 20,
                    padding: 16,
                    background: BRAND.errorBg,
                    border: `1px solid ${BRAND.error}20`,
                    borderRadius: 8,
                    color: BRAND.error,
                    fontSize: 13,
                  }}
                >
                  <strong style={{ display: "block", marginBottom: 4 }}>Registrasi gagal</strong>
                  {err}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!canSubmit}
                data-testid="register-submit-btn"
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  background: canSubmit ? BRAND.primary : BRAND.textMuted,
                  color: BRAND.white,
                  fontSize: 15,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 8,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  transition: "all 0.2s",
                  opacity: canSubmit ? 1 : 0.6,
                  boxShadow: canSubmit ? `0 4px 12px ${BRAND.primary}30` : "none",
                }}
                onMouseEnter={(e) => {
                  if (canSubmit) e.currentTarget.style.background = BRAND.primaryDark;
                }}
                onMouseLeave={(e) => {
                  if (canSubmit) e.currentTarget.style.background = BRAND.primary;
                }}
              >
                {busy ? "Memproses..." : "Daftar"}
              </button>
            </form>

            {/* Footer */}
            <div
              style={{
                marginTop: 24,
                paddingTop: 24,
                borderTop: `1px solid ${BRAND.border}`,
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: 14, color: BRAND.textMuted }}>
                Sudah punya akun?{" "}
                <span
                  onClick={() => nav("/login")}
                  data-testid="register-login-link"
                  style={{
                    color: BRAND.primary,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Login
                </span>
              </p>
              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: 11,
                  color: BRAND.textMuted,
                  opacity: 0.7,
                }}
              >
                Membutuhkan kode undangan
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
