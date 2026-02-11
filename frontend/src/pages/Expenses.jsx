// src/pages/Expenses.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Expenses() {
  const { user } = useAuth();
  const role = user?.role || "UNKNOWN";
  const allowed = role === "OWNER" || role === "ADMIN" || role === "STAFF";
  const canUploadProof = role === "OWNER" || role === "ADMIN" || role === "STAFF";
  const canApprove = role === "OWNER";

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [methodFilter, setMethodFilter] = useState("");

  const take = 20;
  const [page, setPage] = useState(0);
  const skip = useMemo(() => page * take, [page]);

  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia("(max-width: 900px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = () => setIsMobile(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  const [form, setForm] = useState({
    paymentMethod: "BANK_TRANSFER",
    bankName: "",
    accountName: "",
    accountNumber: "",
    amount: "",
    currency: "IDR",
    reason: "",
    clientName: "",
    notes: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");

  function resetForm() {
    setForm({
      paymentMethod: "BANK_TRANSFER",
      bankName: "",
      accountName: "",
      accountNumber: "",
      amount: "",
      currency: "IDR",
      reason: "",
      clientName: "",
      notes: "",
    });
  }

  function onChangeForm(field, value) {
    if (field === "paymentMethod" && value !== "BANK_TRANSFER") {
      setForm((f) => ({
        ...f,
        paymentMethod: value,
        bankName: "",
        accountName: "",
        accountNumber: "",
      }));
      return;
    }
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (methodFilter) params.set("paymentMethod", methodFilter);
      params.set("skip", String(skip));
      params.set("take", String(take));

      const data = await api(`/expenses?${params.toString()}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setErr(e.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!allowed) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, methodFilter]);

  useEffect(() => {
    if (!allowed) return;
    const t = setTimeout(() => {
      setPage(0);
      load();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api("/expenses", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: form.paymentMethod,
          bankName: form.bankName,
          accountName: form.accountName,
          accountNumber: form.accountNumber,
          amount: Number(form.amount || 0),
          currency: form.currency || "IDR",
          reason: form.reason,
          clientName: form.clientName,
          notes: form.notes,
        }),
      });
      resetForm();
      setPage(0);
      load();
    } catch (e) {
      setErr(e.message || "Failed to create expense");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id) {
    if (!confirm("Delete this expense?")) return;
    try {
      await api(`/expenses/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setErr(e.message || "Failed to delete expense");
    }
  }

  function normalizeProofUrl(url) {
    if (!url) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  async function uploadProof(expenseId, file) {
    const formData = new FormData();
    formData.append("files", file);

    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/api/uploads`, {
      method: "POST",
      body: formData,
      credentials: "include",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || data?.message || "Upload failed");
    const item = data.items?.[0];
    if (!item?.url) throw new Error("Upload failed");

    await api(`/expenses/${expenseId}/proof`, {
      method: "POST",
      body: JSON.stringify({
        proofUrl: item.url,
        proofFileName: item.fileName,
        proofMimeType: item.mimeType,
        proofSize: item.size,
      }),
    });
  }

  async function onApprove(id) {
    try {
      await api(`/expenses/${id}/approve`, { method: "POST" });
      load();
    } catch (e) {
      setErr(e.message || "Failed to approve expense");
    }
  }

  if (!allowed) {
    return (
      <div style={s.page}>
        <div style={s.headerRow}>
          <div>
            <div style={s.hTitle}>Expenses</div>
            <div style={s.hSub}>You don’t have permission to view this page.</div>
          </div>
        </div>
        <div style={s.alertErr}>Forbidden</div>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / take));
  const showBankFields = form.paymentMethod === "BANK_TRANSFER";

  const s = useMemo(() => makeStyles(isMobile), [isMobile]);
  const statusCounts = items.reduce(
    (acc, x) => {
      const st = x.status || "SUBMITTED";
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    },
    { SUBMITTED: 0, PAID: 0, APPROVED: 0 }
  );

  return (
    <div style={s.page}>
      <div style={s.headerRow}>
        <div>
          <div style={s.hTitle}>Expenses</div>
          <div style={s.hSub}>Record and track outgoing payments</div>
        </div>
        <div style={s.headerActions}>
          <div style={s.pill}>{total} total</div>
          <button style={s.primaryBtn} onClick={() => setShowModal(true)}>
            + New Expense
          </button>
        </div>
      </div>

      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statLabel}>Submitted</div>
          <div style={s.statValue}>{statusCounts.SUBMITTED}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>Paid</div>
          <div style={s.statValue}>{statusCounts.PAID}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>Approved</div>
          <div style={s.statValue}>{statusCounts.APPROVED}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>Showing</div>
          <div style={s.statValue}>{items.length}</div>
        </div>
      </div>

      <div style={s.filtersRow}>
        <input
          style={s.searchInput}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reason, client, bank..."
        />
        <div style={s.selectWrap}>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            style={s.selectPill}
          >
            <option value="">All methods</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CASH">Cash</option>
            <option value="OTHER">Other</option>
          </select>
          <span style={s.selectChevron}>▾</span>
        </div>
      </div>

      {err ? <div style={s.alertErr}>{err}</div> : null}

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Date</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Method</th>
              <th style={s.th}>Bank</th>
              <th style={s.th}>Account</th>
              <th style={s.th}>Amount</th>
              <th style={s.th}>Reason</th>
              <th style={s.th}>Client</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id} style={s.tr}>
                <td style={s.td}>{x.createdAt ? new Date(x.createdAt).toLocaleDateString() : "-"}</td>
                <td style={s.td}>
                  <span style={{ ...s.statusPill, ...statusVariant(x.status) }}>
                    {x.status || "SUBMITTED"}
                  </span>
                </td>
                <td style={s.td}>{x.paymentMethod}</td>
                <td style={s.td}>{x.bankName || "-"}</td>
                <td style={s.td}>{x.accountName || x.accountNumber || "-"}</td>
                <td style={s.tdStrong}>
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: x.currency || "IDR",
                    maximumFractionDigits: 0,
                  }).format(x.amount || 0)}
                </td>
                <td style={s.td}>{x.reason}</td>
                <td style={s.td}>{x.clientName || "-"}</td>
                <td style={s.td}>
                  <div style={s.actionsRow}>
                    {x.proofUrl ? (
                      <a href={normalizeProofUrl(x.proofUrl)} target="_blank" rel="noreferrer" style={s.linkBtn}>
                        View Proof
                      </a>
                    ) : null}
                    {canUploadProof && x.status === "SUBMITTED" && (
                      <label style={s.linkBtn}>
                        Upload Proof
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          style={{ display: "none" }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              await uploadProof(x.id, file);
                              load();
                            } catch (err) {
                              setErr(err.message || "Failed to upload proof");
                            } finally {
                              e.target.value = "";
                            }
                          }}
                        />
                      </label>
                    )}
                    {canApprove && x.status === "PAID" && (
                      <label style={s.approveCheck}>
                        <input
                          type="checkbox"
                          onChange={() => onApprove(x.id)}
                          style={s.approveInput}
                        />
                        <span style={s.approveBox}>✓</span>
                        <span style={s.approveLabel}>Approve</span>
                      </label>
                    )}
                    <button style={s.linkBtn} onClick={() => onDelete(x.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && items.length === 0 ? (
              <tr>
                <td style={s.empty} colSpan={9}>
                  No expenses found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={s.footer}>
        <button
          style={s.secondaryBtn}
          disabled={loading || page <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          Prev
        </button>

        <div style={s.pageInfo}>
          Page <b>{page + 1}</b> of <b>{pageCount}</b>
        </div>

        <button
          style={s.secondaryBtn}
          disabled={loading || page + 1 >= pageCount}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      {showModal && (
        <div style={s.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.formTitle}>New Expense</div>
              <button style={s.iconBtn} onClick={() => setShowModal(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <form onSubmit={onSubmit}>
              <div style={s.formGrid}>
                <div>
                  <label style={s.label}>Payment Method</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => onChangeForm("paymentMethod", e.target.value)}
                    style={s.select}
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                {showBankFields && (
                  <>
                    <div>
                      <label style={s.label}>Bank</label>
                      <input
                        style={s.input}
                        value={form.bankName}
                        onChange={(e) => onChangeForm("bankName", e.target.value)}
                        placeholder="Bank name"
                      />
                    </div>
                    <div>
                      <label style={s.label}>Account Name</label>
                      <input
                        style={s.input}
                        value={form.accountName}
                        onChange={(e) => onChangeForm("accountName", e.target.value)}
                        placeholder="Account holder"
                      />
                    </div>
                    <div>
                      <label style={s.label}>Account Number</label>
                      <input
                        style={s.input}
                        value={form.accountNumber}
                        onChange={(e) => onChangeForm("accountNumber", e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label style={s.label}>Amount</label>
                  <input
                    style={s.input}
                    type="number"
                    min="0"
                    value={form.amount}
                    onChange={(e) => onChangeForm("amount", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label style={s.label}>Currency</label>
                  <input
                    style={s.input}
                    value={form.currency}
                    onChange={(e) => onChangeForm("currency", e.target.value)}
                    placeholder="IDR"
                  />
                </div>
                <div>
                  <label style={s.label}>Reason / Use</label>
                  <input
                    style={s.input}
                    value={form.reason}
                    onChange={(e) => onChangeForm("reason", e.target.value)}
                    placeholder="Electricity, spareparts, etc."
                  />
                </div>
                <div>
                  <label style={s.label}>Client / Reference</label>
                  <input
                    style={s.input}
                    value={form.clientName}
                    onChange={(e) => onChangeForm("clientName", e.target.value)}
                    placeholder="Client name (optional)"
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={s.label}>Notes</label>
                  <textarea
                    style={s.textarea}
                    rows={3}
                    value={form.notes}
                    onChange={(e) => onChangeForm("notes", e.target.value)}
                    placeholder="Additional notes"
                  />
                </div>
              </div>
              <div style={s.formActions}>
                <button style={s.secondaryBtn} type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button style={s.primaryBtn} disabled={submitting}>
                  {submitting ? "Saving..." : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function makeStyles(isMobile) {
  return {
    page: { padding: isMobile ? 6 : 12 },
    headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
    headerActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  hTitle: { fontWeight: 900, fontSize: 28, color: "#0b1f16" },
  hSub: { marginTop: 4, fontSize: 14, color: "rgba(6, 78, 59, 0.75)", fontWeight: 700 },
  pill: {
    fontSize: 12,
    fontWeight: 900,
    padding: "7px 12px",
    borderRadius: 999,
    background: "#e1f3e7",
    border: "1px solid rgba(20,136,58,0.22)",
    color: "#0f6f2f",
  },
  formCard: {
    borderRadius: 16,
    background: "#ffffff",
    boxShadow: "0 12px 28px rgba(10, 58, 30, 0.10)",
    border: "1px solid rgba(10, 58, 30, 0.10)",
    padding: 16,
  },
  formTitle: { fontWeight: 900, marginBottom: 12 },
    formGrid: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 },
  formActions: { marginTop: 12, display: "flex", justifyContent: "flex-end" },
  label: { fontSize: 12, fontWeight: 800, color: "rgba(6, 78, 59, 0.75)" },
  input: {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(20,136,58,0.25)",
    background: "#ffffff",
    padding: "12px 14px",
    outline: "none",
    fontWeight: 700,
    color: "#0b1f16",
    boxSizing: "border-box",
  },
  searchInput: {
    width: isMobile ? "100%" : 220,
    borderRadius: 999,
    border: "2px solid rgba(20,136,58,0.28)",
    background: "#ffffff",
    padding: "12px 16px",
    outline: "none",
    fontWeight: 800,
    fontSize: 14,
    color: "#0b1f16",
    boxSizing: "border-box",
    boxShadow: "0 6px 16px rgba(20,136,58,0.08)",
  },
  textarea: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(10, 58, 30, 0.14)",
    background: "#ffffff",
    padding: "10px 12px",
    outline: "none",
    fontWeight: 600,
    color: "#0b1f16",
    boxSizing: "border-box",
  },
  selectWrap: {
    position: "relative",
    width: isMobile ? "100%" : 220,
  },
  selectPill: {
    width: "100%",
    borderRadius: 999,
    border: "2px solid rgba(20,136,58,0.28)",
    background: "#ffffff",
    padding: "12px 42px 12px 16px",
    outline: "none",
    fontWeight: 800,
    fontSize: 14,
    color: "#0b1f16",
    boxSizing: "border-box",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    boxShadow: "0 6px 16px rgba(20,136,58,0.10)",
  },
  selectChevron: {
    position: "absolute",
    right: 16,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#22c55e",
    fontWeight: 900,
    pointerEvents: "none",
  },
  primaryBtn: {
    border: "none",
    borderRadius: 14,
    padding: "12px 18px",
    fontWeight: 900,
    cursor: "pointer",
    color: "white",
    background: "linear-gradient(135deg, #178a3c, #0f6f2f)",
    boxShadow: "0 12px 24px rgba(20,136,58,0.26)",
  },
  secondaryBtn: {
    borderRadius: 12,
    padding: "9px 12px",
    fontWeight: 900,
    cursor: "pointer",
    color: "#0f6f2f",
    background: "rgba(20,136,58,0.10)",
    border: "1px solid rgba(20,136,58,0.22)",
  },
    filtersRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 14,
      alignItems: "center",
    },
    rightNote: { fontSize: 12, fontWeight: 800, color: "rgba(6, 78, 59, 0.75)" },
    statsRow: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))",
      gap: 10,
      marginBottom: 14,
    },
    statCard: {
      borderRadius: 14,
      background: "#ffffff",
      border: "1px solid rgba(20,136,58,0.14)",
      padding: "12px 14px",
      boxShadow: "0 8px 18px rgba(10, 58, 30, 0.08)",
    },
    statLabel: { fontSize: 11, fontWeight: 800, color: "rgba(6, 78, 59, 0.75)" },
    statValue: { fontSize: 18, fontWeight: 900, color: "#0b1f16", marginTop: 2 },
  tableWrap: {
    marginTop: 14,
    overflowX: "auto",
    borderRadius: 14,
    border: "1px solid rgba(10, 58, 30, 0.10)",
    background: "#ffffff",
  },
    table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 980 },
  th: {
    textAlign: "left",
    fontSize: 12,
    letterSpacing: 0.3,
    fontWeight: 1000,
    color: "rgba(6, 78, 59, 0.8)",
    padding: "12px 12px",
    background: "#eef8f1",
    borderBottom: "1px solid rgba(10, 58, 30, 0.10)",
  },
  tr: { background: "white" },
  td: {
    padding: "12px 12px",
    fontSize: 13,
    fontWeight: 700,
    color: "#0b1f16",
    borderBottom: "1px solid rgba(10, 58, 30, 0.06)",
    verticalAlign: "middle",
  },
  tdStrong: {
    padding: "12px 12px",
    fontSize: 13,
    fontWeight: 800,
    color: "#0b1f16",
    borderBottom: "1px solid rgba(10, 58, 30, 0.06)",
  },
  empty: { padding: 18, textAlign: "center", color: "rgba(6, 78, 59, 0.75)", fontWeight: 900 },
  footer: { marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  pageInfo: { fontSize: 12, fontWeight: 800, color: "rgba(6, 78, 59, 0.75)" },
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
  linkBtn: {
    border: "1px solid rgba(20,136,58,0.24)",
    background: "#f3fbf7",
    color: "#0b1f16",
    fontWeight: 800,
    cursor: "pointer",
    padding: "6px 10px",
    borderRadius: 10,
    fontSize: 12,
  },
  actionsRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  statusPill: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(10, 58, 30, 0.10)",
  },
  approveCheck: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    userSelect: "none",
  },
  approveInput: {
    position: "absolute",
    opacity: 0,
    pointerEvents: "none",
  },
  approveBox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    background: "#e9f7ee",
    border: "1px solid rgba(20,136,58,0.35)",
    color: "#0f6f2f",
    fontWeight: 900,
    fontSize: 12,
  },
  approveLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#0b1f16",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(2, 6, 23, 0.35)",
    display: "grid",
    placeItems: "center",
    zIndex: 50,
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 720,
    borderRadius: 16,
    background: "#ffffff",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
    border: "1px solid rgba(10, 58, 30, 0.10)",
    padding: 16,
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  iconBtn: {
    border: "none",
    background: "transparent",
    fontSize: 18,
    cursor: "pointer",
    color: "#0b1f16",
  },
  };
}

function statusVariant(status) {
  if (status === "PAID") {
    return { background: "rgba(59,130,246,0.12)", color: "#1d4ed8", border: "1px solid rgba(59,130,246,0.22)" };
  }
  if (status === "APPROVED") {
    return { background: "rgba(34,197,94,0.12)", color: "#065f46", border: "1px solid rgba(34,197,94,0.22)" };
  }
  return { background: "rgba(245,158,11,0.12)", color: "#92400e", border: "1px solid rgba(245,158,11,0.22)" };
}
