// src/pages/Orders.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";

//////////////////////
// THEME (match Maintenance page look)
//////////////////////
const pageBg = {
  minHeight: "100vh",
  padding: 22,
  color: "#0B2A1F",
};

const topBar = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "18px 22px",
  background: "#FFFFFF",
  borderBottom: "1px solid rgba(20, 80, 60, 0.10)",
};

const container = { maxWidth: 1180, margin: "0 auto" };

const panel = {
  background: "#FFFFFF",
  borderRadius: 22,
  padding: 18,
  border: "1px solid rgba(20, 80, 60, 0.10)",
  boxShadow: "0 18px 55px rgba(10, 40, 30, 0.08)",
};

const headerRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const title = {
  fontSize: 44,
  fontWeight: 1000,
  letterSpacing: -1.2,
  margin: 0,
  lineHeight: 1.0,
};

const subTitle = {
  marginTop: 6,
  fontWeight: 800,
  color: "#2F6B55",
  fontSize: 13,
};

const pillRow = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 14,
};

const pillInput = {
  height: 44,
  minWidth: 240,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid rgba(15, 60, 45, 0.18)",
  outline: "none",
  fontWeight: 800,
  color: "#0B2A1F",
  background: "#FFFFFF",
  boxShadow: "0 10px 22px rgba(10, 40, 30, 0.06)",
};

const pillSelect = {
  ...pillInput,
  minWidth: 170,
  paddingRight: 18,
  appearance: "none",
};

const pillDate = {
  ...pillInput,
  minWidth: 160,
};

const btnGreen = {
  height: 44,
  padding: "0 18px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "linear-gradient(180deg, #16A34A 0%, #0F8A3B 100%)",
  color: "#FFFFFF",
  fontWeight: 1000,
  cursor: "pointer",
  boxShadow: "0 16px 28px rgba(22, 163, 74, 0.25)",
};

const btnGhost = {
  height: 44,
  padding: "0 16px",
  borderRadius: 999,
  border: "1px solid rgba(15, 60, 45, 0.18)",
  background: "#FFFFFF",
  color: "#0B2A1F",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(10, 40, 30, 0.06)",
};

const divider = {
  height: 1,
  background: "rgba(20, 80, 60, 0.10)",
  marginTop: 14,
};

const tableHead = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1.1fr 0.9fr 0.9fr 0.7fr",
  gap: 12,
  padding: "12px 14px",
  marginTop: 12,
  color: "#2F6B55",
  fontWeight: 1000,
  letterSpacing: 1.2,
  fontSize: 12,
};

const rowCard = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1.1fr 0.9fr 0.9fr 0.7fr",
  gap: 12,
  padding: "14px 14px",
  borderRadius: 16,
  border: "1px solid rgba(15, 60, 45, 0.12)",
  background: "linear-gradient(180deg, #FFFFFF 0%, #FBFFFD 100%)",
  boxShadow: "0 12px 26px rgba(10, 40, 30, 0.06)",
  alignItems: "center",
};

const subLine = {
  marginTop: 4,
  color: "#2F6B55",
  fontWeight: 900,
  fontSize: 12,
};

const badgeBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 34,
  padding: "0 14px",
  borderRadius: 999,
  fontWeight: 1000,
  fontSize: 12,
  letterSpacing: 0.6,
  border: "1px solid rgba(15, 60, 45, 0.16)",
  background: "#E9FBF1",
  color: "#0B2A1F",
  width: "fit-content",
};

function fmtDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function statusBadgeStyle(status) {
  const s = String(status || "").toUpperCase();
  if (s === "COMPLETED") return { ...badgeBase, background: "#DDFBEA", borderColor: "rgba(16,185,129,0.35)" };
  if (s === "IN_PROGRESS") return { ...badgeBase, background: "#E9FBF1", borderColor: "rgba(34,197,94,0.35)" };
  if (s === "CONFIRMED") return { ...badgeBase, background: "#EAF7FF", borderColor: "rgba(59,130,246,0.25)" };
  if (s === "CANCELLED") return { ...badgeBase, background: "#FFF1F2", borderColor: "rgba(244,63,94,0.25)" };
  return { ...badgeBase, background: "#F1F5F9", borderColor: "rgba(15, 60, 45, 0.12)" };
}

//////////////////////
// MODAL (same pattern as Maintenance popups)
//////////////////////
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 80,
};

const modalCard = {
  width: "min(860px, 100%)",
  background: "#FFFFFF",
  borderRadius: 22,
  border: "1px solid rgba(20, 80, 60, 0.12)",
  boxShadow: "0 22px 70px rgba(0,0,0,0.20)",
  padding: 18,
};

const modalTitle = { fontSize: 20, fontWeight: 1000, margin: 0 };
const modalSub = { marginTop: 4, color: "#2F6B55", fontWeight: 800, fontSize: 12 };

const fieldGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 14,
};

const full = { gridColumn: "1 / -1" };

const input = {
  height: 44,
  padding: "0 14px",
  borderRadius: 14,
  border: "1px solid rgba(15, 60, 45, 0.18)",
  outline: "none",
  fontWeight: 800,
  color: "#0B2A1F",
};

const textarea = {
  ...input,
  height: 96,
  padding: "10px 14px",
};

export default function Orders() {
  const { user } = useAuth();
  const role = user?.role || "UNKNOWN";
  const allowed = role === "OWNER" || role === "ADMIN" || role === "STAFF";
  const nav = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [customer, setCustomer] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Create Order modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");


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

  const statusOptions = useMemo(
    () => ["", "DRAFT", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
    []
  );

  function buildQuery() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (customer.trim()) params.set("customer", customer.trim());
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      params.set("dateTo", end.toISOString());
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const data = await api(`/orders${buildQuery()}`);
      setItems(data?.items || []);
    } catch (e) {
      setErr(e?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetCreate() {
    setCreateErr("");
    setForm({
      customerName: "",
      cargoName: "",
      qty: "",
      unit: "TON",
      fromText: "",
      toText: "",
      plannedAt: "",
      notes: "",
    });
    setProofUrl("");
    setProofs([]);
  }

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function addProof() {
    const url = proofUrl.trim();
    if (!url) return;
    setProofs((p) => [...p, { url }]);
    setProofUrl("");
  }

  function removeProof(idx) {
    setProofs((p) => p.filter((_, i) => i !== idx));
  }

  async function uploadFiles(fileList) {
    const fd = new FormData();
    for (const f of fileList) fd.append("files", f);

    // IMPORTANT: do NOT set Content-Type manually for FormData
    const res = await fetch(VITE_API_URL + "/api/uploads", {
      method: "POST",
      body: fd,
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || data?.message || "Upload failed");
    return data?.items || [];
  }


  async function createOrder(statusToSave) {
    try {
      setCreateErr("");
      setCreating(true);

      const payload = {
        customerName: form.customerName || null,
        cargoName: form.cargoName || null,
        qty: form.qty ? Number(form.qty) : null,
        unit: form.unit || null,
        fromText: form.fromText || null,
        toText: form.toText || null,
        plannedAt: form.plannedAt ? new Date(form.plannedAt).toISOString() : null,
        notes: form.notes || null,
        status: statusToSave,
        proofs,
      };

      const order = await api("/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setShowCreate(false);
      resetCreate();
      await load();
      nav(`/orders/${order.id}`);
    } catch (e) {
      setCreateErr(e?.message || "Failed to create order");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={pageBg}>

      <div style={{ ...container, marginTop: 18 }}>
        <div style={panel}>
          <div style={headerRow}>
            <div>
              <h1 style={title}>Orders</h1>
              <div style={subTitle}>Create orders, assign trips, and generate dispatch letters</div>
            </div>

            {allowed ? (
              <button
                style={btnGreen}
                onClick={() => {
                  resetCreate();
                  setShowCreate(true);
                }}
                title="Create new order"
              >
                + New Order
              </button>
            ) : (
              <div style={{ color: "#2F6B55", fontWeight: 900, fontSize: 12 }}>Read-only access</div>
            )}
          </div>

          {/* Filters */}
          <div style={pillRow}>
            <input
              style={{ ...pillInput, minWidth: 300 }}
              placeholder="Search order no / destination / cargo..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <select style={pillSelect} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Status</option>
              {statusOptions
                .filter((x) => x)
                .map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
            </select>

            <input
              style={{ ...pillInput, minWidth: 220 }}
              placeholder="Customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />

            <input style={pillDate} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input style={pillDate} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />

            <button style={btnGreen} onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Apply"}
            </button>

            <button
              style={btnGhost}
              onClick={() => {
                setQ("");
                setStatus("");
                setCustomer("");
                setDateFrom("");
                setDateTo("");
                setTimeout(load, 0);
              }}
              disabled={loading}
            >
              Reset
            </button>
          </div>

          <div style={divider} />

          {err ? <div style={{ marginTop: 12, color: "#B42318", fontWeight: 900 }}>{err}</div> : null}

          {/* Table header */}
          <div style={tableHead}>
            <div>ORDER</div>
            <div>ROUTE</div>
            <div>CARGO</div>
            <div>PLANNED</div>
            <div style={{ textAlign: "right" }}>ACTION</div>
          </div>

          {/* Rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.length === 0 && !loading ? (
              <div
                style={{
                  marginTop: 10,
                  padding: 16,
                  borderRadius: 16,
                  border: "1px dashed rgba(15, 60, 45, 0.20)",
                  color: "#2F6B55",
                  fontWeight: 900,
                }}
              >
                No orders found. Try changing filters.
              </div>
            ) : null}

            {items.map((o) => {
              const customerName = o.customer?.name || o.customerName || "-";
              const route = `${o.fromText || "-"} → ${o.toText || "-"}`;
              const total = o.qty != null ? Number(o.qty) : null;
              const unit = o.unit || "";
              const tripped = o.qtyTripped != null ? Number(o.qtyTripped) : 0;
              const remaining = o.qtyRemaining != null ? Number(o.qtyRemaining) : null;

              const cargo =
                total == null
                  ? `${o.cargoName || "-"}`
                  : `${o.cargoName || "-"} • ${remaining != null ? remaining : "-"} / ${total} ${unit}`;


              return (
                <div
                  key={o.id}
                  style={{ ...rowCard, cursor: "pointer" }}
                  onClick={() => nav(`/orders/${o.id}`)}
                  title="Open order detail"
                >
                  <div>
                    <div style={{ fontWeight: 1000, fontSize: 16 }}>
                      {o.orderNo} — {customerName}
                    </div>
                    <div style={subLine}>
                      <span style={statusBadgeStyle(o.status)}>{String(o.status).replaceAll("_", " ")}</span>
                      {o?._count ? (
                        <span style={{ marginLeft: 10, opacity: 0.9 }}>
                          • Trips: {o._count.trips ?? 0} • Proofs: {o._count.proofs ?? 0}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ fontWeight: 900, color: "#0B2A1F" }}>{route}</div>

                  <div style={{ fontWeight: 900, color: "#0B2A1F" }}>{cargo}</div>

                  <div style={{ fontWeight: 1000 }}>{fmtDate(o.plannedAt)}</div>

                  <div style={{ textAlign: "right" }}>
                    <button
                      style={btnGhost}
                      onClick={(e) => {
                        e.stopPropagation();
                        nav(`/orders/${o.id}`);
                      }}
                    >
                      Open
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 14, color: "#2F6B55", fontWeight: 900, fontSize: 12 }}>
            Tip: Click an order row to view details, assign trips, and generate dispatch letters.
          </div>
        </div>
      </div>

      {/* Create Order Modal */}
      {showCreate ? (
        <div
          style={overlay}
          onMouseDown={() => {
            if (!creating) setShowCreate(false);
          }}
        >
          <div style={modalCard} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <h3 style={modalTitle}>Create New Order</h3>
                <div style={modalSub}>Fill the request, then you can assign trucks & generate dispatch letters.</div>
              </div>
              <button style={btnGhost} onClick={() => setShowCreate(false)} disabled={creating}>
                Close
              </button>
            </div>

            {createErr ? (
              <div style={{ marginTop: 10, color: "#B42318", fontWeight: 900 }}>{createErr}</div>
            ) : null}

            <div style={fieldGrid}>
              <input
                style={input}
                placeholder="Customer / Company name (Kepada Yth)"
                value={form.customerName}
                onChange={(e) => update("customerName", e.target.value)}
              />

              <input
                style={input}
                placeholder="Cargo / Product name"
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
                placeholder="Unit (TON / BAG / UNIT)"
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
                title="Planned date"
              />

              <textarea
                style={{ ...textarea, ...full }}
                placeholder="Notes / special instructions"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </div>

            {/* Proofs (REAL UPLOAD) */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 1000, marginBottom: 6 }}>Proof Upload — Image / PDF</div>

              {uploadErr ? (
                <div style={{ marginBottom: 8, color: "#B42318", fontWeight: 900 }}>{uploadErr}</div>
              ) : null}

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  disabled={creating || uploading}
                  onChange={async (e) => {
                    try {
                      setUploadErr("");
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;

                      setUploading(true);
                      const uploaded = await uploadFiles(files);

                      // merge into proofs list (same DB shape)
                      setProofs((p) => [
                        ...p,
                        ...uploaded.map((u) => ({
                          url: u.url,
                          fileName: u.fileName,
                          mimeType: u.mimeType,
                          size: u.size,
                        })),
                      ]);

                      // reset input
                      e.target.value = "";
                    } catch (err) {
                      setUploadErr(err?.message || "Upload failed");
                    } finally {
                      setUploading(false);
                    }
                  }}
                  style={{
                    height: 44,
                    padding: "10px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(15, 60, 45, 0.18)",
                    fontWeight: 800,
                    width: 360,
                  }}
                />

                <div style={{ color: "#2F6B55", fontWeight: 900, fontSize: 12 }}>
                  {uploading ? "Uploading..." : "You can select multiple files"}
                </div>
              </div>

              {proofs.length ? (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {proofs.map((p, idx) => {
                    const isPdf =
                      String(p.mimeType || "").includes("pdf") ||
                      String(p.url || "").toLowerCase().includes(".pdf");

                    return (
                      <div
                        key={`${p.url}-${idx}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: 10,
                          borderRadius: 14,
                          border: "1px solid rgba(15, 60, 45, 0.12)",
                          background: "linear-gradient(180deg, #FFFFFF 0%, #FBFFFD 100%)",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {isPdf ? (
                            <div style={{ fontWeight: 1000 }}>PDF</div>
                          ) : (
                            <img
                              src={p.url}
                              alt="proof"
                              style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 12 }}
                            />
                          )}

                          <div style={{ fontWeight: 900 }}>
                            <div style={{ color: "#0B2A1F" }}>{p.fileName || "Proof"}</div>
                            <a href={p.url} target="_blank" rel="noreferrer" style={{ color: "#2F6B55", fontWeight: 900, fontSize: 12 }}>
                              Open
                            </a>
                          </div>
                        </div>

                        <button style={btnGhost} onClick={() => removeProof(idx)} disabled={creating || uploading}>
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ marginTop: 8, color: "#2F6B55", fontWeight: 900, fontSize: 12 }}>
                  No proofs uploaded yet.
                </div>
              )}
            </div>


            {/* Actions */}
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button
                style={btnGhost}
                onClick={() => {
                  if (!creating) {
                    resetCreate();
                    setShowCreate(false);
                  }
                }}
                disabled={creating}
              >
                Cancel
              </button>

              <button style={btnGhost} onClick={() => createOrder("DRAFT")} disabled={creating}>
                {creating ? "Saving..." : "Save Draft"}
              </button>

              <button style={btnGreen} onClick={() => createOrder("CONFIRMED")} disabled={creating}>
                {creating ? "Saving..." : "Confirm Order"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
