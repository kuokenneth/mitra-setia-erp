// src/pages/Expenses.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

// Corporate Green Color Palette (matching Landing/Dashboard)
const BRAND = {
  primary: "#0D7C3D",
  primaryDark: "#0A6331",
  primaryLight: "#10A050",
  secondary: "#F5F9F7",
  accent: "#D4E8DC",
  text: "#1A1A1A",
  textMuted: "#6B7280",
  white: "#FFFFFF",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  danger: "#DC2626",
  dangerLight: "#FEE2E2",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  info: "#3B82F6",
  infoLight: "#DBEAFE",
};

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
  }, [skip, methodFilter]);

  useEffect(() => {
    if (!allowed) return;
    const t = setTimeout(() => {
      setPage(0);
      load();
    }, 250);
    return () => clearTimeout(t);
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
      setShowModal(false);
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

  const s = useMemo(() => makeStyles(isMobile), [isMobile]);

  if (!allowed) {
    return (
      <div style={s.page}>
        <div style={s.panel}>
          <h1 style={s.hTitle}>Expenses</h1>
          <div style={s.hSub}>You don't have permission to view this page.</div>
        </div>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / take));
  const showBankFields = form.paymentMethod === "BANK_TRANSFER";

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
      {/* Header */}
      <div style={s.headerRow}>
        <div>
          <h1 style={s.hTitle}>Expenses</h1>
          <div style={s.hSub}>Record and track outgoing payments</div>
        </div>
        <div style={s.headerActions}>
          <span style={s.pill}>{total} total</span>
          <button style={s.primaryBtn} onClick={() => setShowModal(true)}>
            + New Expense
          </button>
        </div>
      </div>

      {/* Stats */}
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

      {/* Main Panel */}
      <div style={s.panel}>
        {/* Filters */}
        <div style={s.filtersRow}>
          <input
            style={s.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reason, client, bank..."
          />
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
        </div>

        {err ? <div style={s.alertErr}>{err}</div> : null}

        {/* Table */}
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
                <tr key={x.id}>
                  <td style={s.td}>{x.createdAt ? new Date(x.createdAt).toLocaleDateString() : "-"}</td>
                  <td style={s.td}>
                    <span style={{ ...s.statusPill, ...statusVariant(x.status) }}>
                      {x.status || "SUBMITTED"}
                    </span>
                  </td>
                  <td style={s.td}>{x.paymentMethod}</td>
                  <td style={s.tdSoft}>{x.bankName || "-"}</td>
                  <td style={s.tdSoft}>{x.accountName || x.accountNumber || "-"}</td>
                  <td style={s.tdStrong}>
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: x.currency || "IDR",
                      maximumFractionDigits: 0,
                    }).format(x.amount || 0)}
                  </td>
                  <td style={s.td}>{x.reason}</td>
                  <td style={s.tdSoft}>{x.clientName || "-"}</td>
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
                        <button style={s.approveBtn} onClick={() => onApprove(x.id)}>
                          Approve
                        </button>
                      )}
                      <button style={s.deleteBtn} onClick={() => onDelete(x.id)}>
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

        {/* Pagination */}
        <div style={s.footer}>
          <button
            style={s.secondaryBtn}
            disabled={loading || page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </button>

          <div style={s.pageInfo}>
            Page <strong>{page + 1}</strong> of <strong>{pageCount}</strong>
          </div>

          <button
            style={s.secondaryBtn}
            disabled={loading || page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div style={s.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>New Expense</div>
              <button style={s.closeBtn} onClick={() => setShowModal(false)} aria-label="Close">
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
    page: {
      minHeight: "100vh",
      padding: 24,
      background: BRAND.secondary,
      color: BRAND.text,
    },
    panel: {
      background: BRAND.white,
      borderRadius: 8,
      border: `1px solid ${BRAND.border}`,
      padding: 24,
    },
    headerRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 20,
      flexWrap: "wrap",
    },
    headerActions: {
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap",
    },
    hTitle: {
      fontSize: 28,
      fontWeight: 700,
      margin: 0,
      color: BRAND.text,
    },
    hSub: {
      marginTop: 4,
      color: BRAND.textMuted,
      fontSize: 14,
    },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      padding: "6px 12px",
      borderRadius: 6,
      border: `1px solid ${BRAND.border}`,
      background: BRAND.secondary,
      color: BRAND.text,
      fontWeight: 500,
      fontSize: 13,
    },
    statsRow: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
      gap: 12,
      marginBottom: 20,
    },
    statCard: {
      background: BRAND.white,
      borderRadius: 8,
      border: `1px solid ${BRAND.border}`,
      padding: 16,
    },
    statLabel: {
      fontSize: 12,
      fontWeight: 500,
      color: BRAND.textMuted,
      textTransform: "uppercase",
    },
    statValue: {
      fontSize: 24,
      fontWeight: 700,
      color: BRAND.text,
      marginTop: 4,
    },
    filtersRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 16,
      alignItems: "center",
    },
    searchInput: {
      height: 42,
      width: isMobile ? "100%" : 260,
      padding: "0 14px",
      borderRadius: 6,
      border: `1px solid ${BRAND.border}`,
      outline: "none",
      background: BRAND.white,
      color: BRAND.text,
      fontWeight: 500,
      fontSize: 14,
      boxSizing: "border-box",
    },
    selectPill: {
      height: 42,
      minWidth: 160,
      padding: "0 36px 0 14px",
      borderRadius: 6,
      border: `1px solid ${BRAND.border}`,
      outline: "none",
      background: BRAND.white,
      color: BRAND.text,
      fontWeight: 500,
      fontSize: 14,
      appearance: "none",
      WebkitAppearance: "none",
      MozAppearance: "none",
      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
      backgroundPosition: "right 10px center",
      backgroundSize: "16px",
      backgroundRepeat: "no-repeat",
      cursor: "pointer",
    },
    alertErr: {
      marginBottom: 16,
      padding: 12,
      borderRadius: 6,
      background: BRAND.dangerLight,
      border: `1px solid ${BRAND.danger}30`,
      color: BRAND.danger,
      fontWeight: 500,
      fontSize: 14,
    },
    tableWrap: {
      overflowX: "auto",
      borderRadius: 8,
      border: `1px solid ${BRAND.border}`,
    },
    table: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: 0,
      minWidth: 1000,
    },
    th: {
      textAlign: "left",
      padding: "12px 14px",
      fontSize: 12,
      color: BRAND.textMuted,
      background: BRAND.secondary,
      borderBottom: `1px solid ${BRAND.border}`,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    td: {
      padding: "12px 14px",
      borderBottom: `1px solid ${BRAND.borderLight}`,
      verticalAlign: "middle",
      fontWeight: 500,
      fontSize: 14,
      color: BRAND.text,
    },
    tdSoft: {
      padding: "12px 14px",
      borderBottom: `1px solid ${BRAND.borderLight}`,
      verticalAlign: "middle",
      fontWeight: 500,
      fontSize: 14,
      color: BRAND.textMuted,
    },
    tdStrong: {
      padding: "12px 14px",
      borderBottom: `1px solid ${BRAND.borderLight}`,
      verticalAlign: "middle",
      fontWeight: 600,
      fontSize: 14,
      color: BRAND.text,
    },
    empty: {
      padding: 24,
      textAlign: "center",
      color: BRAND.textMuted,
    },
    statusPill: {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 500,
    },
    actionsRow: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      alignItems: "center",
    },
    linkBtn: {
      padding: "6px 10px",
      borderRadius: 4,
      border: `1px solid ${BRAND.border}`,
      background: BRAND.white,
      color: BRAND.text,
      fontWeight: 500,
      fontSize: 12,
      cursor: "pointer",
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
    },
    approveBtn: {
      padding: "6px 10px",
      borderRadius: 4,
      border: `1px solid ${BRAND.primary}30`,
      background: BRAND.accent,
      color: BRAND.primary,
      fontWeight: 500,
      fontSize: 12,
      cursor: "pointer",
    },
    deleteBtn: {
      padding: "6px 10px",
      borderRadius: 4,
      border: `1px solid ${BRAND.danger}30`,
      background: BRAND.dangerLight,
      color: BRAND.danger,
      fontWeight: 500,
      fontSize: 12,
      cursor: "pointer",
    },
    footer: {
      marginTop: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },
    pageInfo: {
      fontSize: 14,
      color: BRAND.textMuted,
    },
    primaryBtn: {
      height: 42,
      padding: "0 16px",
      borderRadius: 6,
      border: `1px solid ${BRAND.primary}`,
      background: BRAND.primary,
      color: BRAND.white,
      fontWeight: 500,
      fontSize: 14,
      cursor: "pointer",
      transition: "all 0.2s ease",
    },
    secondaryBtn: {
      height: 42,
      padding: "0 16px",
      borderRadius: 6,
      border: `1px solid ${BRAND.border}`,
      background: BRAND.white,
      color: BRAND.text,
      fontWeight: 500,
      fontSize: 14,
      cursor: "pointer",
      transition: "all 0.2s ease",
    },
    modalOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 999,
      padding: 16,
    },
    modalCard: {
      width: "100%",
      maxWidth: 700,
      background: BRAND.white,
      borderRadius: 8,
      border: `1px solid ${BRAND.border}`,
      boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
      overflow: "hidden",
    },
    modalHeader: {
      padding: 16,
      borderBottom: `1px solid ${BRAND.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: BRAND.text,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 6,
      border: `1px solid ${BRAND.border}`,
      background: BRAND.white,
      color: BRAND.textMuted,
      fontSize: 16,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    formGrid: {
      padding: 20,
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
      gap: 16,
    },
    formActions: {
      padding: "16px 20px",
      borderTop: `1px solid ${BRAND.border}`,
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
    },
    label: {
      display: "block",
      fontSize: 12,
      fontWeight: 600,
      color: BRAND.textMuted,
      marginBottom: 6,
    },
    input: {
      width: "100%",
      height: 42,
      padding: "0 14px",
      borderRadius: 6,
      border: `1px solid ${BRAND.border}`,
      outline: "none",
      background: BRAND.white,
      color: BRAND.text,
      fontWeight: 500,
      fontSize: 14,
      boxSizing: "border-box",
    },
    select: {
      width: "100%",
      height: 42,
      padding: "0 36px 0 14px",
      borderRadius: 6,
      border: `1px solid ${BRAND.border}`,
      outline: "none",
      background: BRAND.white,
      color: BRAND.text,
      fontWeight: 500,
      fontSize: 14,
      boxSizing: "border-box",
      appearance: "none",
      WebkitAppearance: "none",
      MozAppearance: "none",
      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
      backgroundPosition: "right 10px center",
      backgroundSize: "16px",
      backgroundRepeat: "no-repeat",
      cursor: "pointer",
    },
    textarea: {
      width: "100%",
      padding: 12,
      borderRadius: 6,
      border: `1px solid ${BRAND.border}`,
      outline: "none",
      background: BRAND.white,
      color: BRAND.text,
      fontWeight: 500,
      fontSize: 14,
      boxSizing: "border-box",
      resize: "vertical",
    },
  };
}

function statusVariant(status) {
  if (status === "PAID") {
    return { background: BRAND.infoLight, color: BRAND.info, border: `1px solid ${BRAND.info}30` };
  }
  if (status === "APPROVED") {
    return { background: BRAND.accent, color: BRAND.primary, border: `1px solid ${BRAND.primary}30` };
  }
  return { background: BRAND.warningLight, color: "#92400E", border: `1px solid ${BRAND.warning}30` };
}
