import { useState } from "react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function CreateDriver() {
  const nav = useNavigate();
  const { user } = useAuth();

  const role = user?.role || "UNKNOWN";
  const canManageDrivers = role === "OWNER" || role === "ADMIN" || role === "STAFF";

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setOk("");
    setLoading(true);

    try {
      await api("/drivers", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim(),
        }),
      });

      setOk("Driver created successfully.");
      setForm({ name: "", email: "", password: "", phone: "" });
    } catch (e) {
      setErr(e.message || "Failed to create driver");
    } finally {
      setLoading(false);
    }
  }

  if (!canManageDrivers) {
    return (
      <div style={s.page}>
        <div style={s.headerRow}>
          <div>
            <div style={s.hTitle}>Create Driver</div>
            <div style={s.hSub}>You don’t have permission to access this page.</div>
          </div>
        </div>

        <div style={s.card}>
          <div style={s.alertErr}>Forbidden</div>
          <button onClick={() => nav(-1)} style={s.secondaryBtn}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.headerRow}>
        <div>
          <div style={s.hTitle}>Create Driver</div>
          <div style={s.hSub}>Add a new driver account for operations.</div>
        </div>

        <div style={s.rolePill}>STAFF TOOL</div>
      </div>

      <div style={s.grid}>
        {/* FORM */}
        <div style={s.card}>
          <div style={s.cardTitle}>Driver Details</div>
          <div style={s.cardSub}>
            Create a driver login. They can sign in and see driver pages.
          </div>

          {err ? <div style={s.alertErr}>{err}</div> : null}
          {ok ? <div style={s.alertOk}>{ok}</div> : null}

          <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
            <div style={s.fieldRow}>
              <div style={s.label}>Full Name</div>
              <input
                style={s.input}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Andi Wijaya"
              />
            </div>

            <div style={s.fieldRow}>
              <div style={s.label}>Email</div>
              <input
                style={s.input}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="driver@email.com"
              />
            </div>

            <div style={s.fieldRow}>
              <div style={s.label}>Temporary Password</div>
              <input
                style={s.input}
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Set an initial password"
              />
              <div style={s.help}>Driver should change it later (next feature).</div>
            </div>

            <div style={s.fieldRow}>
              <div style={s.label}>Phone (optional)</div>
              <input
                style={s.input}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+62..."
              />
            </div>

            <div style={s.actions}>
              <button
                disabled={loading}
                style={{
                  ...s.primaryBtn,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Creating…" : "Create Driver"}
              </button>

              <button
                type="button"
                onClick={() => nav(-1)}
                disabled={loading}
                style={s.secondaryBtn}
              >
                Back
              </button>
            </div>

            <div style={s.tip}>
              Tip: If you get “Email already in use”, use a different email.
            </div>
          </form>
        </div>

        {/* SIDE SUMMARY */}
        <div style={s.sideCol}>
          <div style={s.summaryCard}>
            <div style={s.summaryTitle}>What happens next?</div>
            <div style={s.summaryText}>
              • A new user is created with role <b>DRIVER</b>
              <br />
              • They can login and access <b>Driver Home</b> + <b>My Jobs</b>
              <br />
              • Later we can add: SIM/license, assigned truck, password reset
            </div>

            <div style={s.divider} />

            <div style={s.kv}>
              <div style={s.k}>Creator</div>
              <div style={s.v}>{user?.name || "-"}</div>
            </div>

            <div style={s.kv}>
              <div style={s.k}>Your Role</div>
              <div style={s.v}>{role}</div>
            </div>
          </div>

          <div style={s.miniCard}>
            <div style={s.miniTitle}>Next upgrade</div>
            <div style={s.miniText}>
              Add driver profile fields: SIM number, expiry, address, assigned truck.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const BRAND = {
  green: "#4BCA74",
  green2: "#3BB865",
  greenLight: "#5FD686",
  greenDark: "#2D9F56",
  greenSoft: "rgba(75,202,116,0.15)",
  ink: "#111827",
  ink2: "#1F2937",
};

const s = {
  page: { padding: 6 },

  headerRow: {
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },

  hTitle: { fontWeight: 800, fontSize: 24, color: BRAND.ink, letterSpacing: "-0.02em" },
  hSub: { marginTop: 4, fontSize: 14, color: BRAND.ink2, opacity: 0.8 },

  rolePill: {
    fontSize: 13,
    fontWeight: 700,
    padding: "8px 16px",
    borderRadius: 999,
    background: BRAND.greenSoft,
    border: `1px solid ${BRAND.green}40`,
    color: BRAND.green,
    whiteSpace: "nowrap",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1.35fr 0.85fr",
    gap: 20,
    alignItems: "start",
  },

  card: {
    borderRadius: 20,
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: `0 8px 32px ${BRAND.green}15`,
    border: `1px solid ${BRAND.greenSoft}`,
    padding: 24,
    minWidth: 0,
  },

  cardTitle: { fontWeight: 800, fontSize: 18, color: BRAND.ink },
  cardSub: { marginTop: 6, fontSize: 14, color: BRAND.ink2, opacity: 0.8 },

  alertErr: {
    marginTop: 12,
    borderRadius: 14,
    border: "1px solid rgba(239,68,68,0.28)",
    background: "rgba(239,68,68,0.10)",
    color: "rgba(153,27,27,0.95)",
    padding: "12px 16px",
    fontWeight: 700,
    fontSize: 13,
  },

  alertOk: {
    marginTop: 12,
    borderRadius: 14,
    border: `1px solid ${BRAND.green}40`,
    background: BRAND.greenSoft,
    color: BRAND.green,
    padding: "12px 16px",
    fontWeight: 700,
    fontSize: 13,
  },

  fieldRow: { marginTop: 14 },
  label: {
    fontSize: 14,
    fontWeight: 700,
    color: BRAND.ink,
    marginBottom: 8,
  },

  input: {
    width: "100%",
    borderRadius: 12,
    border: `2px solid ${BRAND.greenSoft}`,
    background: "white",
    padding: "12px 16px",
    outline: "none",
    fontWeight: 600,
    fontSize: 15,
    color: BRAND.ink,
    boxSizing: "border-box",
    transition: "all 0.3s ease",
  },

  help: {
    marginTop: 8,
    fontSize: 13,
    color: BRAND.ink2,
    opacity: 0.7,
  },

  actions: {
    marginTop: 20,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },

  primaryBtn: {
    border: "none",
    borderRadius: 12,
    padding: "14px 24px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    color: "white",
    background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.green})`,
    boxShadow: `0 8px 20px ${BRAND.green}40`,
    transition: "all 0.3s ease",
  },

  secondaryBtn: {
    borderRadius: 12,
    padding: "14px 24px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    color: BRAND.green,
    background: BRAND.greenSoft,
    border: `1px solid ${BRAND.green}40`,
    transition: "all 0.3s ease",
  },

  tip: {
    marginTop: 12,
    fontSize: 13,
    color: BRAND.ink2,
    opacity: 0.7,
  },

  sideCol: { display: "flex", flexDirection: "column", gap: 20 },

  summaryCard: {
    borderRadius: 20,
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: `0 8px 32px ${BRAND.green}15`,
    border: `1px solid ${BRAND.greenSoft}`,
    padding: 24,
  },

  summaryTitle: { fontWeight: 800, color: BRAND.ink, fontSize: 16 },
  summaryText: {
    marginTop: 12,
    fontSize: 14,
    color: BRAND.ink2,
    lineHeight: 1.6,
  },

  divider: {
    height: 1,
    background: BRAND.greenSoft,
    margin: "16px 0",
  },

  kv: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
  },
  k: { fontSize: 14, fontWeight: 600, color: BRAND.ink2 },
  v: { fontSize: 14, fontWeight: 700, color: BRAND.ink },

  miniCard: {
    borderRadius: 20,
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(20px)",
    border: `1px solid ${BRAND.greenSoft}`,
    padding: 20,
  },
  miniTitle: { fontWeight: 800, color: BRAND.ink, fontSize: 16 },
  miniText: {
    marginTop: 8,
    fontSize: 14,
    color: BRAND.ink2,
    lineHeight: 1.5,
  },
};
