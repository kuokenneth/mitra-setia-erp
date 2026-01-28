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

const s = {
  page: { padding: 6 },

  headerRow: {
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },

  hTitle: { fontWeight: 1000, fontSize: 18, color: "#053a2f" },
  hSub: { marginTop: 4, fontSize: 12, color: "rgba(4,120,87,0.85)", fontWeight: 700 },

  rolePill: {
    fontSize: 12,
    fontWeight: 900,
    padding: "7px 10px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid rgba(6,95,70,0.10)",
    color: "#065f46",
    whiteSpace: "nowrap",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1.35fr 0.85fr",
    gap: 14,
    alignItems: "start",
  },

  card: {
    borderRadius: 18,
    background: "linear-gradient(180deg, #ffffff 0%, #fbfffd 100%)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
    border: "1px solid rgba(6,95,70,0.08)",
    padding: 18,
    minWidth: 0,
  },

  cardTitle: { fontWeight: 1000, fontSize: 14, color: "#053a2f" },
  cardSub: { marginTop: 4, fontSize: 12, color: "rgba(4,120,87,0.78)", fontWeight: 700 },

  alertErr: {
    marginTop: 12,
    borderRadius: 14,
    border: "1px solid rgba(239,68,68,0.28)",
    background: "rgba(239,68,68,0.10)",
    color: "rgba(153,27,27,0.95)",
    padding: "10px 12px",
    fontWeight: 800,
    fontSize: 12,
  },

  alertOk: {
    marginTop: 12,
    borderRadius: 14,
    border: "1px solid rgba(34,197,94,0.26)",
    background: "rgba(34,197,94,0.10)",
    color: "#065f46",
    padding: "10px 12px",
    fontWeight: 900,
    fontSize: 12,
  },

  fieldRow: { marginTop: 12 },
  label: {
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(4,120,87,0.85)",
    marginBottom: 6,
  },

  input: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(6,95,70,0.12)",
    background: "white",
    padding: "11px 12px",
    outline: "none",
    fontWeight: 800,
    color: "#053a2f",
    boxSizing: "border-box",
  },

  help: {
    marginTop: 6,
    fontSize: 11,
    color: "rgba(4,120,87,0.65)",
    fontWeight: 700,
  },

  actions: {
    marginTop: 16,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  primaryBtn: {
    border: "none",
    borderRadius: 14,
    padding: "11px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    color: "white",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    boxShadow: "0 14px 30px rgba(34,197,94,0.22)",
  },

  secondaryBtn: {
    borderRadius: 14,
    padding: "11px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    color: "#065f46",
    background: "rgba(34,197,94,0.10)",
    border: "1px solid rgba(34,197,94,0.18)",
  },

  tip: {
    marginTop: 12,
    fontSize: 11,
    color: "rgba(4,120,87,0.7)",
    fontWeight: 700,
  },

  sideCol: { display: "flex", flexDirection: "column", gap: 14 },

  summaryCard: {
    borderRadius: 18,
    background: "linear-gradient(180deg, #ffffff 0%, #fbfffd 100%)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
    border: "1px solid rgba(6,95,70,0.08)",
    padding: 18,
  },

  summaryTitle: { fontWeight: 1000, color: "#053a2f", fontSize: 13 },
  summaryText: {
    marginTop: 8,
    fontSize: 12,
    color: "rgba(4,120,87,0.78)",
    fontWeight: 750,
    lineHeight: 1.4,
  },

  divider: {
    height: 1,
    background: "rgba(6,95,70,0.08)",
    margin: "14px 0",
  },

  kv: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
  },
  k: { fontSize: 12, fontWeight: 900, color: "rgba(4,120,87,0.75)" },
  v: { fontSize: 12, fontWeight: 1000, color: "#053a2f" },

  miniCard: {
    borderRadius: 18,
    background: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(6,95,70,0.08)",
    padding: 16,
  },
  miniTitle: { fontWeight: 1000, color: "#053a2f", fontSize: 13 },
  miniText: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(4,120,87,0.75)",
    fontWeight: 750,
    lineHeight: 1.35,
  },
};
