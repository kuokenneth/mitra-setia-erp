// src/pages/CreateDriver.jsx - Corporate Minimalist Design
import { useState } from "react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { FiUser, FiMail, FiLock, FiPhone, FiArrowLeft, FiCheck, FiInfo } from "react-icons/fi";

// Corporate Green Color Palette (matching Landing Page)
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
  warning: "#F59E0B",
  warningBg: "#FFFBEB",
  success: "#10B981",
  successBg: "#ECFDF5",
  error: "#EF4444",
  errorBg: "#FEF2F2",
};

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
      setErr(e.message || "Gagal membuat driver");
    } finally {
      setLoading(false);
    }
  }

  if (!canManageDrivers) {
    return (
      <div data-testid="create-driver-page">
        <div style={s.header}>
          <h1 style={s.title}>Tambah Pengemudi</h1>
          <p style={s.subtitle}>Anda tidak memiliki izin untuk mengakses halaman ini.</p>
        </div>
        <div style={s.card}>
          <div style={s.alertErr}>Akses Ditolak</div>
          <button onClick={() => nav(-1)} style={s.secondaryBtn} data-testid="back-btn">
            <FiArrowLeft size={16} />
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="create-driver-page">
      {/* Header */}
      <div style={s.headerRow}>
        <div>
          <h1 style={s.title}>Tambah Pengemudi</h1>
          <p style={s.subtitle}>Tambahkan akun pengemudi baru untuk kebutuhan operasional.</p>
        </div>
        <span style={s.badge}>ALAT STAF</span>
      </div>

      <div style={s.grid}>
        {/* Form Card */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <h2 style={s.cardTitle}>Detail Pengemudi</h2>
            <p style={s.cardSubtitle}>Buat akun masuk untuk pengemudi agar dapat melihat halaman tugasnya.</p>
          </div>

          {err && <div style={s.alertErr}>{err}</div>}
          {ok && <div style={s.alertOk}><FiCheck size={16} /> {ok}</div>}

          <form onSubmit={onSubmit} style={s.form}>
            <div style={s.fieldRow}>
              <label style={s.label}>
                <FiUser size={14} color={BRAND.textMuted} />
                Full Name
              </label>
              <input
                style={s.input}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Andi Wijaya"
                data-testid="driver-name-input"
              />
            </div>

            <div style={s.fieldRow}>
              <label style={s.label}>
                <FiMail size={14} color={BRAND.textMuted} />
                Email
              </label>
              <input
                style={s.input}
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="driver@email.com"
                data-testid="driver-email-input"
              />
            </div>

            <div style={s.fieldRow}>
              <label style={s.label}>
                <FiLock size={14} color={BRAND.textMuted} />
                Temporary Password
              </label>
              <input
                style={s.input}
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Set an initial password"
                data-testid="driver-password-input"
              />
              <p style={s.help}>Pengemudi sebaiknya menggantinya setelah masuk.</p>
            </div>

            <div style={s.fieldRow}>
              <label style={s.label}>
                <FiPhone size={14} color={BRAND.textMuted} />
                Telepon (opsional)
              </label>
              <input
                style={s.input}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+62..."
                data-testid="driver-phone-input"
              />
            </div>

            <div style={s.actions}>
              <button
                type="submit"
                disabled={loading}
                style={{ ...s.primaryBtn, opacity: loading ? 0.7 : 1 }}
                data-testid="create-driver-btn"
              >
                {loading ? "Creating…" : "Tambah Pengemudi"}
              </button>

              <button
                type="button"
                onClick={() => nav(-1)}
                disabled={loading}
                style={s.secondaryBtn}
                data-testid="back-btn"
              >
                <FiArrowLeft size={16} />
                Back
              </button>
            </div>

            <p style={s.tip}>
              <FiInfo size={12} /> Tip: If you get "Email already in use", use a different email.
            </p>
          </form>
        </div>

        {/* Side Panel */}
        <div style={s.sideCol}>
          <div style={s.sideCard}>
            <h3 style={s.sideTitle}>What happens next?</h3>
            <ul style={s.sideList}>
              <li>A new user is created with role <strong>Pengemudi</strong></li>
              <li>Mereka dapat masuk dan mengakses <strong>Beranda Pengemudi</strong> + <strong>Tugas Saya</strong></li>
              <li>Later we can add: SIM/license, assigned truck, password reset</li>
            </ul>

            <div style={s.divider} />

            <div style={s.kvRow}>
              <span style={s.kvLabel}>Dibuat Oleh</span>
              <span style={s.kvValue}>{user?.name || "-"}</span>
            </div>
            <div style={s.kvRow}>
              <span style={s.kvLabel}>Peran Anda</span>
              <span style={s.kvValue}>{role}</span>
            </div>
          </div>

          <div style={s.sideCard}>
            <h3 style={s.sideTitle}>Pengembangan Berikutnya</h3>
            <p style={s.sideText}>
              Add driver profile fields: SIM number, expiry, address, assigned truck.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
    flexWrap: "wrap",
  },

  header: { marginBottom: 24 },
  title: { margin: 0, fontSize: 28, fontWeight: 700, color: BRAND.text },
  subtitle: { margin: "8px 0 0", fontSize: 14, color: BRAND.textMuted },

  badge: {
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 12px",
    borderRadius: 4,
    background: BRAND.accent,
    color: BRAND.primary,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.8fr",
    gap: 24,
    alignItems: "start",
  },

  card: {
    borderRadius: 8,
    background: BRAND.white,
    border: `1px solid ${BRAND.border}`,
    padding: 24,
  },

  cardHeader: { marginBottom: 20 },
  cardTitle: { margin: 0, fontSize: 18, fontWeight: 600, color: BRAND.text },
  cardSubtitle: { margin: "6px 0 0", fontSize: 14, color: BRAND.textMuted },

  alertErr: {
    marginBottom: 16,
    borderRadius: 6,
    border: `1px solid ${BRAND.error}30`,
    background: BRAND.errorBg,
    color: BRAND.error,
    padding: "12px 16px",
    fontWeight: 500,
    fontSize: 14,
  },

  alertOk: {
    marginBottom: 16,
    borderRadius: 6,
    border: `1px solid ${BRAND.success}40`,
    background: BRAND.successBg,
    color: BRAND.success,
    padding: "12px 16px",
    fontWeight: 500,
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  form: { display: "grid", gap: 16 },

  fieldRow: {},

  label: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
    fontWeight: 500,
    color: BRAND.text,
    marginBottom: 8,
  },

  input: {
    width: "100%",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    background: BRAND.white,
    padding: "12px 14px",
    outline: "none",
    fontWeight: 500,
    fontSize: 14,
    color: BRAND.text,
    boxSizing: "border-box",
    transition: "border-color 0.2s ease",
  },

  help: {
    marginTop: 6,
    fontSize: 12,
    color: BRAND.textMuted,
  },

  actions: {
    marginTop: 8,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },

  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "none",
    borderRadius: 6,
    padding: "12px 24px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    color: BRAND.white,
    background: BRAND.primary,
    transition: "all 0.2s ease",
  },

  secondaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 6,
    padding: "12px 20px",
    fontWeight: 500,
    fontSize: 14,
    cursor: "pointer",
    color: BRAND.textLight,
    background: BRAND.white,
    border: `1px solid ${BRAND.border}`,
    transition: "all 0.2s ease",
  },

  tip: {
    marginTop: 8,
    fontSize: 12,
    color: BRAND.textMuted,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  sideCol: { display: "flex", flexDirection: "column", gap: 20 },

  sideCard: {
    borderRadius: 8,
    background: BRAND.white,
    border: `1px solid ${BRAND.border}`,
    padding: 20,
  },

  sideTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: BRAND.text },

  sideList: {
    margin: "12px 0 0",
    paddingLeft: 20,
    fontSize: 14,
    color: BRAND.textLight,
    lineHeight: 1.8,
  },

  sideText: {
    margin: "10px 0 0",
    fontSize: 14,
    color: BRAND.textLight,
    lineHeight: 1.6,
  },

  divider: {
    height: 1,
    background: BRAND.border,
    margin: "16px 0",
  },

  kvRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
  },

  kvLabel: { fontSize: 14, color: BRAND.textMuted },
  kvValue: { fontSize: 14, fontWeight: 600, color: BRAND.text },
};

// Responsive CSS
const style = document.createElement('style');
style.textContent = `
  @media (max-width: 900px) {
    [data-testid="create-driver-page"] > div:nth-child(2) {
      grid-template-columns: 1fr !important;
    }
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(style);
}
