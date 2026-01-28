import { useState } from "react";
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
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>ERP</div>
          <div>
            <h2 style={styles.title}>MitraSetia</h2>
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
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,Helvetica,Arial,sans-serif',
    padding: 20,
  },

  card: {
    width: "min(420px, 95vw)",
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
    fontWeight: 800,
    color: "white",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
  },

  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: "#065f46",
  },

  subtitle: {
    margin: 0,
    fontSize: 13,
    color: "#047857",
  },

  field: {
    marginBottom: 14,
  },

  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: "#065f46",
  },

  input: {
    padding: "12px 12px",
    borderRadius: 10,
    border: "1px solid #a7f3d0",
    background: "#f8fffb",
    fontSize: 14,
    outline: "none",
  },

  button: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    border: "none",
    fontWeight: 700,
    fontSize: 14,
    color: "white",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    boxShadow: "0 8px 20px rgba(34,197,94,0.35)",
    cursor: "pointer",
  },

  errorBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontSize: 12,
  },

  footer: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: "1px solid #d1fae5",
    fontSize: 12,
    color: "#047857",
    textAlign: "center",
  },

  // 🔑 IMPORTANT: ensures perfect alignment
  formControl: {
    width: "100%",
    boxSizing: "border-box",
  },

	registerRow: {
		marginTop: 0,
		display: "flex",
		justifyContent: "center",
		gap: 3,
		fontSize: 13,
	},

	registerText: {
		color: "#065f46",
	},

	registerLink: {
		color: "#16a34a",
		fontWeight: 700,
		cursor: "pointer",
	},

};
