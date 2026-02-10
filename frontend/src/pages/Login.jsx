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
  const [hover, setHover] = useState(false);

  const isMobile = useMemo(
    () => typeof window !== "undefined" && window.innerWidth <= 640,
    []
  );

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
    <div style={styles.page}>
      <div
        style={{
          ...styles.shell,
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        }}
      >
        {/* Left panel */}
        {!isMobile && (
          <div style={styles.leftPanel}>
            <div style={styles.leftBackdrop} />
            <div style={styles.leftDots} />
            <div style={styles.leftBrand} onClick={() => nav("/")} role="button" title="Back to Home">
              <span style={styles.leftDot} />
              <span>CV. MITRA SETIA</span>
            </div>
            <div style={styles.leftContent}>
              <div style={styles.leftEyebrow}>Nice to see you again</div>
              <div style={styles.leftTitle}>WELCOME BACK</div>
              <div style={styles.leftSub}>
                Masuk ke sistem ERP internal CV. Mitra Setia untuk mengelola operasional secara efisien & terintegrasi.
              </div>
            </div>
          </div>
        )}

        {/* Right panel */}
        <div style={styles.rightPanel}>
          <div style={styles.backHome} onClick={() => nav("/")}>
            Back to Home
          </div>
          <div style={styles.formInner}>
            <div style={styles.header}>
              <div>
                <h2 style={styles.title}>Login Account</h2>
                <p style={styles.subtitle}>Secure access for internal staff</p>
              </div>
            </div>

            <form onSubmit={onSubmit}>
            <div style={{ ...styles.field, marginBottom: 16 }}>
              <label style={styles.label}>Email</label>
              <input
                style={{ ...styles.input, ...styles.formControl }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@mitrasetia.com"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            <div style={{ ...styles.field, marginBottom: 18 }}>
              <label style={styles.label}>Password</label>
              <input
                style={{ ...styles.input, ...styles.formControl }}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {err && (
              <div style={styles.errorBox}>
                <strong>Login failed</strong>
                <div>{err}</div>
              </div>
            )}

            <button
              disabled={busy}
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              style={{
                ...styles.button,
                ...styles.formControl,
                opacity: busy ? 0.7 : 1,
                background: hover ? "#1a8f4a" : "#1f9d53",
                transform: hover ? "translateY(-1px)" : "translateY(0)",
                transition: "all 0.2s ease",
                cursor: busy ? "not-allowed" : "pointer",
                minHeight: 44,
              }}
            >
              {busy ? "Signing in..." : "Login"}
            </button>

            <div style={styles.footer}>
              <div style={styles.registerRow}>
                <span style={styles.registerText}>Don’t have an account?</span>
                <span style={styles.registerLink} onClick={() => nav("/register")}>
                  Register
                </span>
              </div>
              <div style={styles.complianceNote}>Authorized users only.</div>
            </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",                 // ✅ iPhone dynamic viewport
    display: "flex",                     // ✅ more stable than grid for iOS
    alignItems: "stretch",
    justifyContent: "stretch",
    padding: 0,
    boxSizing: "border-box",
    background: "#ffffff",
    fontFamily:
      '"Manrope",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  },


  shell: {
    width: "100%",
    minHeight: "100dvh",
    display: "grid",
    borderRadius: 0,
    overflow: "hidden",
    background: "#ffffff",
    border: "none",
    boxShadow: "none",
  },

  leftPanel: {
    position: "relative",
    padding: 56,
    color: "#f0fff6",
    background:
      "radial-gradient(520px 380px at 70% 18%, rgba(255,255,255,0.22), transparent 60%), linear-gradient(135deg, #1b8f4c 0%, #2ccf6a 100%)",
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
  },

  leftBrand: {
    position: "absolute",
    top: 32,
    left: 36,
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    opacity: 0.95,
    cursor: "pointer",
  },

  leftDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(255,255,255,0.9)",
  },

  leftContent: {
    marginTop: 0,
    maxWidth: 360,
    zIndex: 1,
  },

  leftEyebrow: {
    fontSize: 14,
    letterSpacing: 0.4,
    textTransform: "none",
    opacity: 0.9,
  },

  leftTitle: {
    marginTop: 12,
    fontSize: 46,
    fontWeight: 800,
    letterSpacing: 1.6,
    lineHeight: 1.08,
  },

  leftSub: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 1.85,
    opacity: 0.9,
    maxWidth: 280,
  },

  leftBackdrop: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(520px 360px at 18% 18%, rgba(255,255,255,0.10), transparent 65%), radial-gradient(640px 420px at 70% 12%, rgba(255,255,255,0.12), transparent 70%)",
    pointerEvents: "none",
  },

  leftDots: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "radial-gradient(rgba(255,255,255,0.20) 1px, transparent 1px)",
    backgroundSize: "12px 12px",
    opacity: 0.35,
    pointerEvents: "none",
    mixBlendMode: "screen",
  },

  rightPanel: {
    padding: 48,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  formInner: {
    width: "100%",
    maxWidth: 420,
  },

  header: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
    textAlign: "left",
    marginBottom: 26,
  },


  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: "#111827",
    letterSpacing: -0.3,
  },

  subtitle: {
    margin: 0,
    fontSize: 11.5,
    color: "#9ca3af",
  },

  field: { marginBottom: 14 },

  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: "#374151",
  },

  input: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontSize: 16,
    outline: "none",
    minHeight: 44,
  },

  button: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    border: "none",
    fontWeight: 700,
    fontSize: 15,
    color: "white",
    background: "#1f9d53",
    boxShadow: "0 8px 16px rgba(31,157,83,0.22)",
  },

  errorBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    fontSize: 12,
    lineHeight: 1.5,
  },

  footer: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: "1px solid rgba(17,24,39,0.06)",
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },

  formControl: { width: "100%", boxSizing: "border-box" },

  registerRow: {
    display: "flex",
    justifyContent: "center",
    gap: 6,
    fontSize: 12.5,
    flexWrap: "wrap",
  },

  registerText: { color: "#6b7280" },

  registerLink: {
    color: "#1f9d53",
    fontWeight: 700,
    cursor: "pointer",
  },

  complianceNote: {
    marginTop: 8,
    fontSize: 10.5,
    color: "#9ca3af",
  },
  backHome: {
    position: "absolute",
    top: 24,
    right: 32,
    fontSize: 12,
    color: "#1f9d53",
    fontWeight: 600,
    cursor: "pointer",
  },
};
