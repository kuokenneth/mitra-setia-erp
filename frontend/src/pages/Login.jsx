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
    <div style={{ ...styles.page, padding: isMobile ? 12 : 20 }}>
      <div style={{ ...styles.card, padding: isMobile ? 18 : 28 }}>
        {/* Header */}
        <div style={{ ...styles.header, marginBottom: isMobile ? 16 : 22 }}>
          {/* ✅ Clickable logo */}
          <div
            style={{ ...styles.logo, width: isMobile ? 44 : 48, height: isMobile ? 44 : 48 }}
            onClick={() => nav("/")}
            role="button"
            title="Back to Home"
          >
            ERP
          </div>

          <div>
            <h2 style={{ ...styles.title, fontSize: isMobile ? 18 : 20 }}>
              MitraSetia
            </h2>
            <p style={styles.subtitle}>Sign in to your account</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit}>
          <div style={styles.field}>
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

          <div style={styles.field}>
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
              background: hover
                ? "linear-gradient(135deg, #4ade80, #22c55e)"
                : "linear-gradient(135deg, #22c55e, #16a34a)",
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
              <span
                style={styles.registerLink}
                onClick={() => nav("/register")}
              >
                Register
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",                 // ✅ iPhone dynamic viewport
    display: "flex",                     // ✅ more stable than grid for iOS
    alignItems: "center",
    justifyContent: "center",
    padding: "max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))",
    boxSizing: "border-box",
    background: "linear-gradient(180deg, #ECFDF5 0%, #F7FFFB 70%)",
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,Helvetica,Arial,sans-serif',
  },


  card: {
    width: "min(420px, 94vw)",
    padding: 28,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #d1fae5",
    boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
  },

  header: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 22,
  },

  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    color: "white",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    userSelect: "none",
    cursor: "pointer",
  },

  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
    color: "#065f46",
    letterSpacing: -0.2,
  },

  subtitle: {
    margin: 0,
    fontSize: 13,
    color: "#047857",
  },

  field: { marginBottom: 14 },

  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 6,
    color: "#065f46",
  },

  input: {
    padding: "12px",
    borderRadius: 12,
    border: "1px solid #a7f3d0",
    background: "#f8fffb",
    fontSize: 16,
    outline: "none",
    minHeight: 44,
  },

  button: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    border: "none",
    fontWeight: 900,
    fontSize: 15,
    color: "white",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    boxShadow: "0 8px 20px rgba(34,197,94,0.35)",
  },

  errorBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontSize: 12,
    lineHeight: 1.5,
  },

  footer: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: "1px solid #d1fae5",
    fontSize: 12,
    color: "#047857",
    textAlign: "center",
  },

  formControl: { width: "100%", boxSizing: "border-box" },

  registerRow: {
    display: "flex",
    justifyContent: "center",
    gap: 6,
    fontSize: 13,
    flexWrap: "wrap",
  },

  registerText: { color: "#065f46" },

  registerLink: {
    color: "#16a34a",
    fontWeight: 900,
    cursor: "pointer",
  },
};
