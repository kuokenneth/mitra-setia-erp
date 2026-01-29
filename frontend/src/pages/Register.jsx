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
  const [hover, setHover] = useState(false);

  const isMobile = useMemo(
    () => typeof window !== "undefined" && window.innerWidth <= 640,
    []
  );

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
      if (!emailNorm) throw new Error("Email is required.");
      if (!password) throw new Error("Password is required.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      if (password !== confirmPassword) throw new Error("Confirm password does not match.");
      if (!inviteCode.trim()) throw new Error("Invitation code is required.");

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

  return (
    <div style={{ ...styles.page, padding: isMobile ? 12 : 20 }}>
      <div style={{ ...styles.card, padding: isMobile ? 18 : 28 }}>
        {/* Header */}
        <div style={{ ...styles.header, marginBottom: isMobile ? 16 : 22 }}>
          {/* ✅ Clickable logo -> Home */}
          <div
            style={{ ...styles.logo, width: isMobile ? 44 : 48, height: isMobile ? 44 : 48 }}
            onClick={() => nav("/")}
            role="button"
            title="Back to Home"
          >
            ERP
          </div>

          <div>
            <h2 style={{ ...styles.title, fontSize: isMobile ? 18 : 20 }}>MitraSetia</h2>
            <p style={styles.subtitle}>Register a new user</p>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Name</label>
            <input
              style={{ ...styles.input, ...styles.formControl }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="name"
              autoComplete="name"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={{ ...styles.input, ...styles.formControl }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@mitrasetia.com"
              autoComplete="email"
              inputMode="email"
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
              autoComplete="new-password"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Confirm Password</label>
            <input
              style={{
                ...styles.input,
                ...styles.formControl,
                border: pwdMismatch ? "1px solid #fca5a5" : styles.input.border,
                background: pwdMismatch ? "#fff7f7" : styles.input.background,
              }}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            {pwdMismatch && <div style={styles.inlineError}>Passwords do not match.</div>}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Invitation Code</label>
            <input
              style={{ ...styles.input, ...styles.formControl }}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Provided by admin"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <div style={styles.hint}>Ask admin for the invite code.</div>
          </div>

          {err && (
            <div style={styles.errorBox}>
              <strong>Register failed</strong>
              <div>{err}</div>
            </div>
          )}

          <button
            disabled={!canSubmit}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
              ...styles.button,
              ...styles.formControl,
              opacity: canSubmit ? 1 : 0.55,
              cursor: canSubmit ? "pointer" : "not-allowed",
              background: hover
                ? "linear-gradient(135deg, #4ade80, #22c55e)"
                : "linear-gradient(135deg, #22c55e, #16a34a)",
              transform: hover && canSubmit ? "translateY(-1px)" : "translateY(0)",
              transition: "all 0.2s ease",
              minHeight: 44,
            }}
          >
            {busy ? "Creating..." : "Register"}
          </button>

          <div style={styles.footer}>
            <div style={styles.registerRow}>
              <span style={styles.registerText}>Already have an account?</span>
              <span style={styles.registerLink} onClick={() => nav("/login")}>
                Login
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
  header: { display: "flex", alignItems: "center", gap: 14, marginBottom: 22 },
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
  title: { margin: 0, fontSize: 20, fontWeight: 900, color: "#065f46", letterSpacing: -0.2 },
  subtitle: { margin: 0, fontSize: 13, color: "#047857" },
  field: { marginBottom: 14 },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 6,
    color: "#065f46",
  },
  hint: { marginTop: 6, fontSize: 12, color: "#047857" },
  inlineError: { marginTop: 6, fontSize: 12, color: "#b91c1c", fontWeight: 800 },
  input: {
    padding: "12px 12px",
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
  registerRow: {
    marginTop: 10,
    display: "flex",
    justifyContent: "center",
    gap: 6,
    fontSize: 13,
    flexWrap: "wrap",
  },
  registerText: { color: "#065f46" },
  registerLink: { color: "#16a34a", fontWeight: 900, cursor: "pointer" },
  footer: {
    marginTop: 16,
    paddingTop: 1,
    borderTop: "1px solid #d1fae5",
    fontSize: 12,
    color: "#047857",
    textAlign: "center",
  },
  formControl: { width: "100%", boxSizing: "border-box" },
};
