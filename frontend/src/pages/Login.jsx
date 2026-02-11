// src/pages/Login.jsx - Corporate Green Theme
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      nav("/dashboard");
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

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
                backgroundImage: `url(https://images.unsplash.com/photo-1753579167765-d88ba3719f96?w=1200&q=80)`,
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
              data-testid="login-logo"
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
                <div style={{ fontSize: 10, opacity: 0.8 }}>Transport & Logistics</div>
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
                Staff Portal
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
                Selamat Datang Kembali
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
                Masuk ke sistem ERP internal untuk mengelola operasional secara efisien & terintegrasi.
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
          }}
        >
          {/* Back to Home */}
          <div
            onClick={() => nav("/")}
            data-testid="login-back-home"
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
                marginBottom: 40,
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
                <div style={{ fontSize: 11, color: BRAND.textMuted }}>Transport & Logistics</div>
              </div>
            </div>
          )}

          {/* Form Container */}
          <div style={{ maxWidth: 400, width: "100%", margin: isMobile ? 0 : "0 auto" }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 28,
                  fontWeight: 700,
                  color: BRAND.text,
                  letterSpacing: "-0.02em",
                }}
              >
                Login
              </h2>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 14,
                  color: BRAND.textMuted,
                }}
              >
                Masuk dengan akun staff Anda
              </p>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit}>
              {/* Email Field */}
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
                  Email
                </label>
                <input
                  data-testid="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="email@mitrasetia.com"
                  autoComplete="email"
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    fontSize: 15,
                    border: `2px solid ${focusedField === "email" ? BRAND.primary : BRAND.border}`,
                    borderRadius: 8,
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Password Field */}
              <div style={{ marginBottom: 24 }}>
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
                  data-testid="login-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    fontSize: 15,
                    border: `2px solid ${focusedField === "password" ? BRAND.primary : BRAND.border}`,
                    borderRadius: 8,
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Error Message */}
              {err && (
                <div
                  data-testid="login-error"
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
                  <strong style={{ display: "block", marginBottom: 4 }}>Login gagal</strong>
                  {err}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={busy}
                data-testid="login-submit-btn"
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  background: busy ? BRAND.textMuted : BRAND.primary,
                  color: BRAND.white,
                  fontSize: 15,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 8,
                  cursor: busy ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  boxShadow: `0 4px 12px ${BRAND.primary}30`,
                }}
                onMouseEnter={(e) => {
                  if (!busy) e.currentTarget.style.background = BRAND.primaryDark;
                }}
                onMouseLeave={(e) => {
                  if (!busy) e.currentTarget.style.background = BRAND.primary;
                }}
              >
                {busy ? "Memproses..." : "Login"}
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
                Belum punya akun?{" "}
                <span
                  onClick={() => nav("/register")}
                  data-testid="login-register-link"
                  style={{
                    color: BRAND.primary,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Daftar
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
                Hanya untuk pengguna yang berwenang
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
