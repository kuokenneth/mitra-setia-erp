// src/pages/OrderCreate.jsx - Corporate Minimalist Design
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { FiArrowLeft, FiSave, FiCheck } from "react-icons/fi";

//////////////////////
// THEME - CORPORATE MINIMALIST
//////////////////////

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
  danger: "#EF4444",
  dangerBg: "#FEF2F2",
};

//////////////////////
// UI COMPONENTS
//////////////////////

function Button({ variant = "secondary", children, icon: Icon, ...props }) {
  const styles = {
    primary: {
      background: BRAND.primary,
      color: BRAND.white,
      border: "none",
    },
    secondary: {
      background: BRAND.white,
      color: BRAND.textLight,
      border: `1px solid ${BRAND.border}`,
    },
  };

  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 16px",
    borderRadius: 6,
    fontWeight: 500,
    fontSize: 14,
    cursor: props.disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s ease",
    opacity: props.disabled ? 0.6 : 1,
    ...styles[variant],
  };

  return (
    <button
      style={baseStyle}
      onMouseEnter={(e) => {
        if (!props.disabled) {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
      {...props}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: BRAND.white,
        borderRadius: 8,
        border: `1px solid ${BRAND.border}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      {label && (
        <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
          {label}
        </label>
      )}
      <input
        style={{
          width: "100%",
          height: 44,
          padding: "0 14px",
          borderRadius: 6,
          border: `1px solid ${BRAND.border}`,
          outline: "none",
          fontSize: 14,
          fontWeight: 500,
          color: BRAND.text,
          background: BRAND.white,
          transition: "border-color 0.2s ease",
          boxSizing: "border-box",
        }}
        onFocus={(e) => (e.target.style.borderColor = BRAND.primary)}
        onBlur={(e) => (e.target.style.borderColor = BRAND.border)}
        {...props}
      />
    </div>
  );
}

export default function OrderCreate() {
  const nav = useNavigate();

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    customerName: "",
    cargoName: "",
    qty: "",
    unit: "TON",
    fromText: "",
    toText: "",
    plannedAt: "",
    notes: "",
  });

  const [proofUrl, setProofUrl] = useState("");
  const [proofs, setProofs] = useState([]);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function addProof() {
    if (!proofUrl.trim()) return;
    setProofs((p) => [...p, { url: proofUrl.trim() }]);
    setProofUrl("");
  }

  async function submit(status) {
    try {
      setErr("");
      setSaving(true);

      const payload = {
        ...form,
        qty: form.qty ? Number(form.qty) : null,
        plannedAt: form.plannedAt ? new Date(form.plannedAt).toISOString() : null,
        status,
        proofs,
      };

      const order = await api("/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      nav(`/orders/${order.id}`);
    } catch (e) {
      setErr(e.message || "Gagal membuat order");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-testid="order-create-page">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: BRAND.text }}>Pesanan Baru</h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: BRAND.textMuted }}>
          Buat pesanan transportasi sebelum menetapkan kendaraan dan pengemudi
        </p>
      </div>

      <Card style={{ maxWidth: 900 }}>
        <div style={{ padding: 24 }}>
          {/* Error Alert */}
          {err && (
            <div
              style={{
                marginBottom: 20,
                padding: 12,
                borderRadius: 6,
                background: BRAND.dangerBg,
                border: `1px solid ${BRAND.danger}20`,
                color: BRAND.danger,
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              {err}
            </div>
          )}

          {/* Form Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Input
              label="Customer / Company name"
              placeholder="Company name"
              value={form.customerName}
              onChange={(e) => update("customerName", e.target.value)}
            />

            <Input
              label="Cargo name"
              placeholder="Product name"
              value={form.cargoName}
              onChange={(e) => update("cargoName", e.target.value)}
            />

            <Input
              label="Quantity"
              type="number"
              placeholder="0"
              value={form.qty}
              onChange={(e) => update("qty", e.target.value)}
            />

            <Input
              label="Unit"
              placeholder="TON, BAG, etc"
              value={form.unit}
              onChange={(e) => update("unit", e.target.value)}
            />

            <Input
              label="From location"
              placeholder="Origin"
              value={form.fromText}
              onChange={(e) => update("fromText", e.target.value)}
            />

            <Input
              label="To destination"
              placeholder="Destination"
              value={form.toText}
              onChange={(e) => update("toText", e.target.value)}
            />

            <Input
              label="Planned date"
              type="date"
              value={form.plannedAt}
              onChange={(e) => update("plannedAt", e.target.value)}
            />

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500, color: BRAND.textMuted }}>
                Notes / special instructions
              </label>
              <textarea
                style={{
                  width: "100%",
                  minHeight: 90,
                  padding: 14,
                  borderRadius: 6,
                  border: `1px solid ${BRAND.border}`,
                  outline: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  color: BRAND.text,
                  resize: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
                placeholder="Notes..."
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </div>
          </div>

          {/* Proof Upload */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 10, color: BRAND.text }}>Bukti Pesanan (URL)</div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <input
                  style={{
                    width: "100%",
                    height: 44,
                    padding: "0 14px",
                    borderRadius: 6,
                    border: `1px solid ${BRAND.border}`,
                    outline: "none",
                    fontSize: 14,
                    fontWeight: 500,
                    color: BRAND.text,
                    boxSizing: "border-box",
                  }}
                  placeholder="Paste image / PDF URL"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                />
              </div>
              <Button variant="secondary" onClick={addProof}>
                Add
              </Button>
            </div>

            {proofs.length > 0 && (
              <ul style={{ marginTop: 12, paddingLeft: 20, fontSize: 14, color: BRAND.textLight }}>
                {proofs.map((p, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <a href={p.url} target="_blank" rel="noreferrer" style={{ color: BRAND.primary }}>
                      {p.url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Actions */}
          <div
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: `1px solid ${BRAND.border}`,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Button variant="secondary" icon={FiArrowLeft} onClick={() => nav("/orders")}>
              Cancel
            </Button>

            <div style={{ display: "flex", gap: 12 }}>
              <Button variant="secondary" icon={FiSave} disabled={saving} onClick={() => submit("DRAFT")}>
                Save Draft
              </Button>

              <Button variant="primary" icon={FiCheck} disabled={saving} onClick={() => submit("CONFIRMED")}>
                {saving ? "Menyimpan..." : "Confirm Order"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
