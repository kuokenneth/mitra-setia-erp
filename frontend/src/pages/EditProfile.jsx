import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function EditProfile() {
  const { user, setUser } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const initials = useMemo(() => {
    const base = user?.name || user?.email || "U";
    return base.slice(0, 1).toUpperCase();
  }, [user]);

  useEffect(() => {
    (async () => {
      setPageLoading(true);
      setErr("");
      try {
        const me = await api("/users/me");
        setUser(me);
        setName(me?.name || "");
        setPhone(me?.phone || "");
      } catch (e) {
        setErr(e.message || "Failed to load profile.");
      } finally {
        setPageLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setErr("");

    try {
      const updated = await api("/users/me", {
        method: "PUT",
        body: JSON.stringify({ name, phone }),
      });
      setUser(updated);
      setMsg("Profile updated successfully.");
    } catch (e) {
      setErr(e.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  }

  function onReset() {
    setMsg("");
    setErr("");
    setName(user?.name || "");
    setPhone(user?.phone || "");
  }

  return (
    <div style={s.page}>
      <div style={s.headerRow}>
        <div>
          <div style={s.hTitle}>My Account</div>
          <div style={s.hSub}>Update your profile details</div>
        </div>

        <div style={s.rolePill}>{user?.role || "UNKNOWN"}</div>
      </div>

      {pageLoading ? (
        <div style={s.loadingCard}>Loading profile…</div>
      ) : (
        <div style={s.grid}>
          {/* LEFT: FORM */}
          <div style={s.card}>
            <div style={s.cardTitle}>Profile</div>
            <div style={s.cardSub}>
              Keep your name and contact details up to date.
            </div>

            {err ? <div style={s.alertErr}>{err}</div> : null}
            {msg ? <div style={s.alertOk}>{msg}</div> : null}

            <form onSubmit={onSave} style={{ marginTop: 14 }}>
              <div style={s.fieldRow}>
                <div style={s.label}>Name</div>
                <input
                  style={s.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div style={s.fieldRow}>
                <div style={s.label}>Email (read only)</div>
                <input style={s.inputDisabled} value={user?.email || ""} readOnly />
              </div>

              <div style={s.fieldRow}>
                <div style={s.label}>Phone (optional)</div>
                <input
                  style={s.input}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+62..."
                />
              </div>

              <div style={s.actions}>
                <button
                  disabled={loading}
                  style={{
                    ...s.primaryBtn,
                    opacity: loading ? 0.7 : 1,
                    transform: loading ? "translateY(0)" : "translateY(0)",
                  }}
                >
                  {loading ? "Saving…" : "Save Changes"}
                </button>

                <button
                  type="button"
                  onClick={onReset}
                  disabled={loading}
                  style={{
                    ...s.secondaryBtn,
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  Reset
                </button>
              </div>

            </form>
          </div>

          {/* RIGHT: SUMMARY */}
          <div style={s.sideCol}>
            <div style={s.summaryCard}>
              <div style={s.summaryTop}>
                <div style={s.bigAvatar}>{initials}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={s.summaryName}>{user?.name || "User"}</div>
                  <div style={s.summaryEmail}>{user?.email || "-"}</div>
                </div>
              </div>

              <div style={s.divider} />

              <div style={s.kv}>
                <div style={s.k}>Role</div>
                <div style={s.v}>{user?.role || "-"}</div>
              </div>

              <div style={s.kv}>
                <div style={s.k}>Phone</div>
                <div style={s.v}>{user?.phone || "-"}</div>
              </div>

              <div style={s.note}>
                Your session uses secure cookies. If you see “Not authenticated”,
                login again.
              </div>
            </div>

            <div style={s.miniCard}>
              <div style={s.miniTitle}>Security</div>
              <div style={s.miniText}>
                Next step: add “Change Password” here.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: {
    padding: 6,
  },

  headerRow: {
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },

  hTitle: {
    fontWeight: 1000,
    fontSize: 22,
    color: "#053a2f",
    letterSpacing: -0.2,
  },
  hSub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(4,120,87,0.85)",
    fontWeight: 700,
  },

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

  loadingCard: {
    borderRadius: 18,
    background: "linear-gradient(180deg, #ffffff 0%, #fbfffd 100%)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
    border: "1px solid rgba(6,95,70,0.08)",
    padding: 18,
    fontWeight: 800,
    color: "rgba(4,120,87,0.85)",
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

  cardTitle: {
    fontWeight: 1000,
    fontSize: 14,
    color: "#053a2f",
  },
  cardSub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(4,120,87,0.78)",
    fontWeight: 700,
  },

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

  inputDisabled: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(6,95,70,0.10)",
    background: "rgba(6,95,70,0.03)",
    padding: "11px 12px",
    outline: "none",
    fontWeight: 800,
    color: "rgba(4,120,87,0.8)",
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

  summaryTop: { display: "flex", alignItems: "center", gap: 12 },
  bigAvatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    color: "#065f46",
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.18)",
    userSelect: "none",
  },
  summaryName: { fontWeight: 1000, color: "#053a2f" },
  summaryEmail: {
    marginTop: 2,
    fontSize: 12,
    color: "rgba(4,120,87,0.85)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 260,
    fontWeight: 800,
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

  note: {
    marginTop: 10,
    fontSize: 11,
    color: "rgba(4,120,87,0.7)",
    fontWeight: 700,
    lineHeight: 1.35,
  },

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
