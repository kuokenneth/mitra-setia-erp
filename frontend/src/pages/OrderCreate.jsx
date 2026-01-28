import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

//////////////////////
// THEME (same as Maintenance / Orders)
//////////////////////
const pageBg = {
  minHeight: "100vh",
  padding: 22,
  background: "linear-gradient(180deg, #EAF7F1 0%, #F6FFFB 70%)",
  color: "#0B2A1F",
};

const container = { maxWidth: 900, margin: "0 auto" };

const panel = {
  background: "#FFFFFF",
  borderRadius: 22,
  padding: 22,
  border: "1px solid rgba(20, 80, 60, 0.10)",
  boxShadow: "0 18px 55px rgba(10, 40, 30, 0.08)",
};

const title = {
  fontSize: 36,
  fontWeight: 1000,
  letterSpacing: -1,
  margin: 0,
};

const subTitle = {
  marginTop: 6,
  color: "#2F6B55",
  fontWeight: 800,
  fontSize: 13,
};

const formGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginTop: 20,
};

const fullRow = { gridColumn: "1 / -1" };

const input = {
  height: 44,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid rgba(15, 60, 45, 0.18)",
  fontWeight: 800,
  outline: "none",
};

const textarea = {
  ...input,
  height: 90,
  padding: "10px 14px",
};

const btnGreen = {
  height: 46,
  padding: "0 22px",
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(180deg, #16A34A 0%, #0F8A3B 100%)",
  color: "#FFF",
  fontWeight: 1000,
  cursor: "pointer",
  boxShadow: "0 16px 28px rgba(22, 163, 74, 0.25)",
};

const btnGhost = {
  height: 46,
  padding: "0 22px",
  borderRadius: 999,
  border: "1px solid rgba(15, 60, 45, 0.18)",
  background: "#FFFFFF",
  color: "#0B2A1F",
  fontWeight: 900,
  cursor: "pointer",
};

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
      setErr(e.message || "Failed to create order");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={pageBg}>
      <div style={container}>
        <div style={panel}>
          <h1 style={title}>New Order</h1>
          <div style={subTitle}>
            Create a transport order before assigning trucks and drivers
          </div>

          {err && (
            <div style={{ marginTop: 12, color: "#B42318", fontWeight: 900 }}>
              {err}
            </div>
          )}

          <div style={formGrid}>
            <input
              style={input}
              placeholder="Customer / Company name"
              value={form.customerName}
              onChange={(e) => update("customerName", e.target.value)}
            />

            <input
              style={input}
              placeholder="Cargo name"
              value={form.cargoName}
              onChange={(e) => update("cargoName", e.target.value)}
            />

            <input
              style={input}
              type="number"
              placeholder="Quantity"
              value={form.qty}
              onChange={(e) => update("qty", e.target.value)}
            />

            <input
              style={input}
              placeholder="Unit (TON, BAG, etc)"
              value={form.unit}
              onChange={(e) => update("unit", e.target.value)}
            />

            <input
              style={input}
              placeholder="From location"
              value={form.fromText}
              onChange={(e) => update("fromText", e.target.value)}
            />

            <input
              style={input}
              placeholder="To destination"
              value={form.toText}
              onChange={(e) => update("toText", e.target.value)}
            />

            <input
              style={input}
              type="date"
              value={form.plannedAt}
              onChange={(e) => update("plannedAt", e.target.value)}
            />

            <textarea
              style={{ ...textarea, ...fullRow }}
              placeholder="Notes / special instructions"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>

          {/* Proof upload (URL-based for now) */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>
              Proof of Order (URL)
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                style={{ ...input, flex: 1 }}
                placeholder="Paste image / PDF URL"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
              />
              <button style={btnGhost} onClick={addProof}>
                Add
              </button>
            </div>

            {proofs.length > 0 && (
              <ul style={{ marginTop: 10, fontSize: 13 }}>
                {proofs.map((p, i) => (
                  <li key={i}>{p.url}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Actions */}
          <div
            style={{
              marginTop: 26,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <button style={btnGhost} onClick={() => nav("/orders")}>
              Cancel
            </button>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={btnGhost}
                disabled={saving}
                onClick={() => submit("DRAFT")}
              >
                Save Draft
              </button>

              <button
                style={btnGreen}
                disabled={saving}
                onClick={() => submit("CONFIRMED")}
              >
                {saving ? "Saving..." : "Confirm Order"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
