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
  const [trips, setTrips] = useState([]);
  const [tripSearch, setTripSearch] = useState("");
  const [tripLoading, setTripLoading] = useState(false);

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
    tripId: "",
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
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${m}`;
  });

  const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");

  function resetForm() {
    setForm({
      tripId: "",
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
      setErr(e.message || "Gagal memuat expenses");
    } finally {
      setLoading(false);
    }
  }

  async function loadTrips(search = "") {
    setTripLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      params.set("status", "PLANNED");
      const data = await api(`/trips?${params.toString()}`);
      // Pertahanan tambahan: uang jalan hanya dibuat sebelum kendaraan berangkat.
      setTrips((data.items || []).filter((trip) => trip.status === "PLANNED"));
    } catch (e) {
      setErr(e.message || "Gagal memuat trips");
    } finally {
      setTripLoading(false);
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

  useEffect(() => {
    if (!allowed) return;
    const t = setTimeout(() => {
      loadTrips(tripSearch);
    }, 250);
    return () => clearTimeout(t);
  }, [tripSearch]);

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api("/expenses", {
        method: "POST",
        body: JSON.stringify({
          tripId: form.tripId || undefined,
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
      setErr(e.message || "Gagal membuat expense");
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
      setErr(e.message || "Gagal menghapus expense");
    }
  }

  function normalizeProofUrl(url) {
    if (!url) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  async function uploadProof(expenseId, file, replace = false) {
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
    if (!res.ok) throw new Error(data?.error || data?.message || "Gagal mengunggah");
    const item = data.items?.[0];
    if (!item?.url) throw new Error("Gagal mengunggah");

    await api(`/expenses/${expenseId}/proof`, {
      method: replace ? "PATCH" : "POST",
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

  function openDetail(item) {
    setDetailItem(item);
    setDetailOpen(true);
  }

  async function openMonthlyReport(openInSameTab = false) {
    if (!reportMonth) {
      setErr("Select a month first");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/expenses/report?month=${reportMonth}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });
      const html = await res.text();
      if (!res.ok) throw new Error(html || "Failed to generate report");
      if (openInSameTab) {
        document.open();
        document.write(html);
        document.close();
        return;
      }
      const w = window.open("", "_blank");
      if (!w) throw new Error("Popup blocked");
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
    } catch (e) {
      setErr(e.message || "Failed to open report");
    }
  }

  const s = useMemo(() => makeStyles(isMobile), [isMobile]);

  if (!allowed) {
    return (
      <div style={s.page}>
        <div style={s.panel}>
          <h1 style={s.hTitle}>Pengeluaran</h1>
          <div style={s.hSub}>Anda tidak memiliki izin untuk melihat halaman ini.</div>
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
          <h1 style={s.hTitle}>Pengeluaran</h1>
          <div style={s.hSub}>Catat dan pantau seluruh pengeluaran</div>
        </div>
        <div style={s.headerActions}>
          <span style={s.pill}>{total} total</span>
          <div style={s.reportActions}>
            <input
              type="month"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              style={s.monthInput}
            />
            <button style={s.secondaryBtn} onClick={() => openMonthlyReport(false)}>
              Print Monthly
            </button>
          </div>
          <button style={s.primaryBtn} onClick={() => setShowModal(true)}>
            + Pengeluaran Baru
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statLabel}>Diajukan</div>
          <div style={s.statValue}>{statusCounts.SUBMITTED}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>Dibayar</div>
          <div style={s.statValue}>{statusCounts.PAID}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>Disetujui</div>
          <div style={s.statValue}>{statusCounts.APPROVED}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>Ditampilkan</div>
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
            placeholder="Cari alasan, klien, atau bank..."
          />
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            style={s.selectPill}
          >
            <option value="">Semua metode</option>
            <option value="BANK_TRANSFER">Transfer Bank</option>
            <option value="CASH">Tunai</option>
            <option value="OTHER">Lainnya</option>
          </select>
        </div>

        {err ? <div style={s.alertErr}>{err}</div> : null}

        {/* Table */}
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Tanggal</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Metode</th>
                <th style={s.th}>Bank</th>
                <th style={s.th}>Rekening</th>
                <th style={s.th}>Jumlah</th>
                <th style={s.th}>Alasan</th>
                <th style={s.th}>Klien</th>
                <th style={s.th}>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id} style={s.rowClickable} onClick={() => openDetail(x)}>
                  <td style={s.td}>{x.createdAt ? new Date(x.createdAt).toLocaleDateString() : "-"}</td>
                  <td style={s.td}>
                    <div style={s.statusStack}>
                      <span style={{ ...s.statusPill, ...statusVariant(x.status) }}>
                        {x.status || "SUBMITTED"}
                      </span>
                      {x.duplicateFlag ? (
                        <span style={{ ...s.statusPill, ...s.dupPill }}>
                          Duplicate{typeof x.duplicateCount === "number" ? ` (${x.duplicateCount})` : ""}
                        </span>
                      ) : null}
                    </div>
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
                        <a
                          href={normalizeProofUrl(x.proofUrl)}
                          target="_blank"
                          rel="noreferrer"
                          style={s.linkBtn}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Lihat Bukti
                        </a>
                      ) : null}
                      {canUploadProof && x.status === "SUBMITTED" && (
                        <label style={s.linkBtn} onClick={(e) => e.stopPropagation()}>
                          Unggah Bukti
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
                                setErr(err.message || "Gagal mengunggah proof");
                              } finally {
                                e.target.value = "";
                              }
                            }}
                          />
                        </label>
                      )}
                      {canUploadProof && x.status === "PAID" && (
                        <label style={s.linkBtn} onClick={(e) => e.stopPropagation()}>
                          Ganti Bukti
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            style={{ display: "none" }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (!window.confirm("Ganti bukti pembayaran dengan file ini?")) {
                                e.target.value = "";
                                return;
                              }
                              try {
                                await uploadProof(x.id, file, true);
                                load();
                              } catch (err) {
                                setErr(err.message || "Gagal mengganti bukti");
                              } finally {
                                e.target.value = "";
                              }
                            }}
                          />
                        </label>
                      )}
                      {canApprove && x.status === "PAID" && (
                        <button
                          style={s.approveBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onApprove(x.id);
                          }}
                        >
                          Setujui
                        </button>
                      )}
                      {x.status === "SUBMITTED" && <button
                        style={s.deleteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(x.id);
                        }}
                      >
                        Hapus
                      </button>}
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && items.length === 0 ? (
                <tr>
                  <td style={s.empty} colSpan={9}>
                    Tidak ada expenses ditemukan.
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
            Halaman <strong>{page + 1}</strong> dari <strong>{pageCount}</strong>
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
              <div style={s.modalTitle}>Pengeluaran Baru</div>
              <button style={s.closeBtn} onClick={() => setShowModal(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <form onSubmit={onSubmit}>
              <div style={s.formGrid}>
                <div>
                  <label style={s.label}>Perjalanan (opsional)</label>
                  <input
                    style={s.input}
                    value={tripSearch}
                    onChange={(e) => setTripSearch(e.target.value)}
                    placeholder="Cari perjalanan berdasarkan kendaraan, pengemudi, atau tujuan..."
                  />
                  <select
                    value={form.tripId}
                    onChange={(e) => onChangeForm("tripId", e.target.value)}
                    style={{ ...s.select, marginTop: 8 }}
                  >
                    <option value="">
                      {tripLoading ? "Memuat perjalanan..." : "Pilih perjalanan"}
                    </option>
                    {trips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {(t.driverName || t.driverUser?.name || "Driver") +
                          " • " +
                          (t.truckPlate || t.truck?.plateNumber || "Truck") +
                          " • " +
                          (t.order?.fromText || t.fromText || "-") +
                          " → " +
                          (t.order?.toText || t.toText || "-")}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={s.label}>Metode Pembayaran</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => onChangeForm("paymentMethod", e.target.value)}
                    style={s.select}
                  >
                    <option value="BANK_TRANSFER">Transfer Bank</option>
                    <option value="CASH">Tunai</option>
                    <option value="OTHER">Lainnya</option>
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
                        placeholder="Nama bank"
                      />
                    </div>
                    <div>
                      <label style={s.label}>Nama Pemilik Rekening</label>
                      <input
                        style={s.input}
                        value={form.accountName}
                        onChange={(e) => onChangeForm("accountName", e.target.value)}
                        placeholder="Nama pemilik rekening"
                      />
                    </div>
                    <div>
                      <label style={s.label}>Nomor Rekening</label>
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
                  <label style={s.label}>Jumlah</label>
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
                  <label style={s.label}>Mata Uang</label>
                  <input
                    style={s.input}
                    value={form.currency}
                    onChange={(e) => onChangeForm("currency", e.target.value)}
                    placeholder="IDR"
                  />
                </div>
                <div>
                  <label style={s.label}>Alasan / Keperluan</label>
                  <input
                    style={s.input}
                    value={form.reason}
                    onChange={(e) => onChangeForm("reason", e.target.value)}
                    placeholder="Listrik, suku cadang, dan lainnya"
                  />
                </div>
                <div>
                  <label style={s.label}>Klien / Referensi</label>
                  <input
                    style={s.input}
                    value={form.clientName}
                    onChange={(e) => onChangeForm("clientName", e.target.value)}
                    placeholder="Nama klien (opsional)"
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={s.label}>Catatan</label>
                  <textarea
                    style={s.textarea}
                    rows={3}
                    value={form.notes}
                    onChange={(e) => onChangeForm("notes", e.target.value)}
                    placeholder="Catatan tambahan"
                  />
                </div>
              </div>
              <div style={s.formActions}>
                <button style={s.secondaryBtn} type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button style={s.primaryBtn} disabled={submitting}>
                  {submitting ? "Menyimpan..." : "Simpan Pengeluaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailOpen && detailItem && (
        <div style={s.modalOverlay} onClick={() => setDetailOpen(false)}>
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>Detail Pengeluaran</div>
              <button style={s.closeBtn} onClick={() => setDetailOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div style={s.detailGrid}>
              <div>
                <div style={s.detailLabel}>Perjalanan</div>
                <div style={s.detailValue}>{detailItem.trip?.id || "-"}</div>
              </div>
              <div>
                <div style={s.detailLabel}>Indikasi Duplikat</div>
                <div style={s.detailValue}>{detailItem.duplicateFlag ? "Yes" : "No"}</div>
              </div>
              <div>
                <div style={s.detailLabel}>Rute</div>
                <div style={s.detailValue}>
                  {(detailItem.trip?.order?.fromText || detailItem.trip?.fromText || "-") +
                    " → " +
                    (detailItem.trip?.order?.toText || detailItem.trip?.toText || "-")}
                </div>
              </div>
              <div>
                <div style={s.detailLabel}>Pengemudi</div>
                <div style={s.detailValue}>
                  {detailItem.trip?.driverUser?.name || detailItem.trip?.driverNameSnap || "-"}
                </div>
              </div>
              <div>
                <div style={s.detailLabel}>Kendaraan</div>
                <div style={s.detailValue}>
                  {detailItem.trip?.truck?.plateNumber || detailItem.trip?.plateNumberSnap || "-"}
                </div>
              </div>
              <div>
                <div style={s.detailLabel}>Alasan</div>
                <div style={s.detailValue}>{detailItem.reason || "-"}</div>
              </div>
              <div>
                <div style={s.detailLabel}>Jumlah</div>
                <div style={s.detailValue}>
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: detailItem.currency || "IDR",
                    maximumFractionDigits: 0,
                  }).format(detailItem.amount || 0)}
                </div>
              </div>
              <div>
                <div style={s.detailLabel}>Status</div>
                <div style={s.detailValue}>{detailItem.status || "SUBMITTED"}</div>
              </div>
              <div>
                <div style={s.detailLabel}>Metode Pembayaran</div>
                <div style={s.detailValue}>{detailItem.paymentMethod || "-"}</div>
              </div>
              <div>
                <div style={s.detailLabel}>Bank</div>
                <div style={s.detailValue}>{detailItem.bankName || "-"}</div>
              </div>
              <div>
                <div style={s.detailLabel}>Rekening</div>
                <div style={s.detailValue}>
                  {detailItem.accountName || detailItem.accountNumber || "-"}
                </div>
              </div>
              <div>
                <div style={s.detailLabel}>Klien</div>
                <div style={s.detailValue}>{detailItem.clientName || "-"}</div>
              </div>
              <div>
                <div style={s.detailLabel}>Catatan</div>
                <div style={s.detailValue}>{detailItem.notes || "-"}</div>
              </div>
              {detailItem.duplicateFlag && Array.isArray(detailItem.duplicates) ? (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={s.detailLabel}>Duplikat Dengan</div>
                  <div style={s.dupList}>
                    {detailItem.duplicates.map((d) => (
                      <div key={d.id} style={s.dupItem}>
                        <div style={s.dupRow}>
                          <span style={s.dupId}>{d.id.slice(0, 8)}</span>
                          <span style={s.dupAmount}>
                            {new Intl.NumberFormat(undefined, {
                              style: "currency",
                              currency: d.currency || "IDR",
                              maximumFractionDigits: 0,
                            }).format(d.amount || 0)}
                          </span>
                        </div>
                        <div style={s.dupMeta}>
                          {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "-"} •{" "}
                          {d.reason || "-"} • {d.status || "SUBMITTED"}
                        </div>
                        <div style={s.dupMeta}>
                          {(d.bankName || "-") + " / " + (d.accountName || d.accountNumber || "-")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
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
    reportActions: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap",
    },
    monthInput: {
      height: 38,
      padding: "0 10px",
      borderRadius: 6,
      border: `1px solid ${BRAND.border}`,
      background: BRAND.white,
      color: BRAND.text,
      fontSize: 13,
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
      minWidth: 860,
    },
    rowClickable: {
      cursor: "pointer",
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
    statusStack: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    dupPill: {
      border: "1px solid rgba(245, 158, 11, 0.4)",
      background: "rgba(245, 158, 11, 0.15)",
      color: "#92400E",
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
    detailGrid: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
      gap: 16,
      padding: 16,
    },
    detailLabel: {
      fontSize: 12,
      color: BRAND.textMuted,
      textTransform: "uppercase",
      letterSpacing: "0.4px",
      marginBottom: 4,
    },
    detailValue: {
      fontSize: 14,
      color: BRAND.text,
      fontWeight: 600,
      lineHeight: 1.4,
      wordBreak: "break-word",
    },
    dupList: {
      display: "grid",
      gap: 10,
      marginTop: 6,
    },
    dupItem: {
      border: `1px solid ${BRAND.border}`,
      borderRadius: 6,
      padding: 10,
      background: BRAND.secondary,
    },
    dupRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    dupId: {
      fontSize: 12,
      fontWeight: 700,
      color: BRAND.textMuted,
    },
    dupAmount: {
      fontSize: 13,
      fontWeight: 700,
      color: BRAND.text,
    },
    dupMeta: {
      marginTop: 4,
      fontSize: 12,
      color: BRAND.textMuted,
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
