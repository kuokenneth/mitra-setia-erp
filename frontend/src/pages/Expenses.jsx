// src/pages/Expenses.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useState } from "react";
import { api, getAccessToken } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import { ProtectedFilePreview } from "../components/ProtectedFile";
import LoadingState from "../components/LoadingState";
import { FiArrowLeft, FiArrowRight, FiCalendar, FiCheckCircle, FiClock, FiCreditCard, FiFileText, FiPlus, FiSearch, FiTruck, FiX } from "react-icons/fi";
import "./Expenses.css";

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

const EXPENSE_CATEGORIES = {
  TRIP_ALLOWANCE: "Uang Jalan",
  REMAINING_TRIP_ALLOWANCE: "Sisa Uang Jalan",
  UNLOADING_FEE: "Uang Bongkar",
  FUEL_LOAN: "Pinjaman Minyak",
  DRIVER_SALARY: "Gaji Sopir",
  FUEL: "BBM",
  TOLL_PARKING: "Tol & Parkir",
  LOADING_UNLOADING: "Bongkar Muat",
  REPAIR_MAINTENANCE: "Perbaikan & Perawatan",
  SPAREPART: "Sparepart",
  OFFICE_OPERATIONAL: "Operasional Kantor",
  OTHER: "Lainnya",
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
  const [actionBusy, setActionBusy] = useState({});
  const [err, setErr] = useState("");
  const [trips, setTrips] = useState([]);
  const [expenseTrucks, setExpenseTrucks] = useState([]);
  const [tripSearch, setTripSearch] = useState("");
  const [tripLoading, setTripLoading] = useState(false);
  const [emptyReturnOpen, setEmptyReturnOpen] = useState(false);
  const [eligibleTrucks, setEligibleTrucks] = useState([]);
  const [emptyReturnLoading, setEmptyReturnLoading] = useState(false);
  const [emptyReturnSaving, setEmptyReturnSaving] = useState(false);
  const [emptyReturnForm, setEmptyReturnForm] = useState({ truckId: "", plannedDepartAt: "", reason: "Kembali ke Medan tanpa muatan" });

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
    truckId: "",
    category: "TRIP_ALLOWANCE",
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

  function setRowBusy(id, action) {
    setActionBusy(current => {
      if (action) return { ...current, [id]: action };
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function updateRow(id, updated) {
    setItems(current => current.map(item => item.id === id ? { ...item, ...updated } : item));
  }

  async function prepareProofFile(file) {
    if (!file?.type?.startsWith("image/") || file.size < 900 * 1024 || typeof createImageBitmap !== "function") return file;
    try {
      const bitmap = await createImageBitmap(file);
      const maxSide = 1800;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close?.();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "bukti"}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    } catch {
      return file;
    }
  }

  function resetForm() {
    setForm({
      tripId: "",
      truckId: "",
      category: "TRIP_ALLOWANCE",
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
      const data = await api(`/trips?${params.toString()}`);
      setTrips((data.items || []).filter((trip) => !["COMPLETED", "CANCELLED"].includes(trip.status)));
    } catch (e) {
      setErr(e.message || "Gagal memuat trips");
    } finally {
      setTripLoading(false);
    }
  }

  async function loadExpenseTrucks() {
    try {
      const data = await api("/trucks");
      setExpenseTrucks(data.items || []);
    } catch (e) {
      setErr(e.message || "Gagal memuat Master Armada");
    }
  }

  async function openEmptyReturn() {
    setEmptyReturnOpen(true);
    setEmptyReturnLoading(true);
    setErr("");
    try {
      const data = await api("/trucks");
      const outsideMedan = (data.items || []).filter((truck) => {
        const location = String(truck.currentLocation || "").trim().toLocaleLowerCase("id-ID");
        return truck.status === "WAITING_BACKHAUL" && location && !location.includes("medan");
      });
      setEligibleTrucks(outsideMedan);
      setEmptyReturnForm({ truckId: outsideMedan[0]?.id || "", plannedDepartAt: new Date().toISOString().slice(0, 16), reason: "Kembali ke Medan tanpa muatan" });
    } catch (e) {
      setErr(e.message || "Gagal memuat truk di luar Medan");
    } finally {
      setEmptyReturnLoading(false);
    }
  }

  async function createEmptyReturnTrip() {
    if (!emptyReturnForm.truckId) return setErr("Pilih truk yang akan kembali kosong");
    setEmptyReturnSaving(true);
    setErr("");
    try {
      const trip = await api("/trips/empty-return", {
        method: "POST",
        body: JSON.stringify({
          truckId: emptyReturnForm.truckId,
          plannedDepartAt: emptyReturnForm.plannedDepartAt || null,
          reason: emptyReturnForm.reason,
        }),
      });
      await loadTrips("");
      setForm((value) => ({ ...value, tripId: trip.id }));
      setTripSearch("");
      setEmptyReturnOpen(false);
    } catch (e) {
      setErr(e.message || "Gagal membuat trip kembali kosong");
    } finally {
      setEmptyReturnSaving(false);
    }
  }
  useLiveRefresh(load);

  useEffect(() => {
    if (!allowed) return;
    load();
  // load is intentionally retriggered only by pagination/filter state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, methodFilter]);

  useEffect(() => {
    if (!allowed) return;
    loadExpenseTrucks();
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    const t = setTimeout(() => {
      setPage(0);
      load();
    }, 250);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    if (!allowed) return;
    const t = setTimeout(() => {
      loadTrips(tripSearch);
    }, 250);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripSearch]);

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api("/expenses", {
        method: "POST",
        body: JSON.stringify({
          tripId: form.tripId || undefined,
          truckId: form.truckId || undefined,
          category: form.category,
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

  async function uploadProof(expenseId, file, replace = false) {
    const uploadFile = await prepareProofFile(file);
    const formData = new FormData();
    formData.append("files", uploadFile);

    const token = getAccessToken();
    const res = await fetch(`${API_BASE}/api/uploads`, {
      method: "POST",
      body: formData,
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || data?.message || "Gagal mengunggah");
    const item = data.items?.[0];
    if (!item?.url) throw new Error("Gagal mengunggah");

    const updated = await api(`/expenses/${expenseId}/proof`, {
      method: replace ? "PATCH" : "POST",
      body: JSON.stringify({
        proofUrl: item.url,
        proofFileName: item.fileName,
        proofMimeType: item.mimeType,
        proofSize: item.size,
      }),
    });
    return updated.expense || updated;
  }

  async function onApprove(id) {
    setRowBusy(id, "approve");
    try {
      const updated = await api(`/expenses/${id}/approve`, { method: "POST" });
      updateRow(id, updated);
    } catch (e) {
      setErr(e.message || "Failed to approve expense");
    } finally {
      setRowBusy(id, "");
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
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/expenses/report?month=${reportMonth}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    <div style={s.page} className="expense-page">
      {/* Header */}
      <div style={s.headerRow} className="expense-hero">
        <div>
          <div className="expense-eyebrow">KEUANGAN OPERASIONAL</div>
          <h1 style={s.hTitle}>Pengeluaran</h1>
          <div style={s.hSub}>Kelola biaya perjalanan, armada, dan operasional dalam satu tempat.</div>
        </div>
        <div style={s.headerActions}>
          <div style={s.reportActions}>
            <input
              type="month"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              style={s.monthInput}
            />
            <button style={s.secondaryBtn} onClick={() => openMonthlyReport(false)}>
              <FiFileText /> Cetak laporan
            </button>
          </div>
          <button className="expense-new-button" style={s.primaryBtn} onClick={() => setShowModal(true)}>
            <FiPlus /> Pengeluaran baru
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={s.statsRow}>
        <div style={s.statCard} className="expense-stat-card expense-stat-waiting">
          <span className="expense-stat-icon"><FiClock /></span>
          <div style={s.statLabel}>Diajukan</div>
          <div style={s.statValue}>{statusCounts.SUBMITTED}</div>
          <div className="expense-stat-note">Menunggu bukti pembayaran</div>
        </div>
        <div style={s.statCard} className="expense-stat-card expense-stat-paid">
          <span className="expense-stat-icon"><FiCreditCard /></span>
          <div style={s.statLabel}>Dibayar</div>
          <div style={s.statValue}>{statusCounts.PAID}</div>
          <div className="expense-stat-note">Menunggu persetujuan owner</div>
        </div>
        <div style={s.statCard} className="expense-stat-card expense-stat-approved">
          <span className="expense-stat-icon"><FiCheckCircle /></span>
          <div style={s.statLabel}>Disetujui</div>
          <div style={s.statValue}>{statusCounts.APPROVED}</div>
          <div className="expense-stat-note">Sudah terverifikasi</div>
        </div>
        <div style={s.statCard} className="expense-stat-card expense-stat-total">
          <span className="expense-stat-icon"><FiFileText /></span>
          <div style={s.statLabel}>Total transaksi</div>
          <div style={s.statValue}>{total}</div>
          <div className="expense-stat-note">Seluruh catatan pengeluaran</div>
        </div>
      </div>

      {/* Main Panel */}
      <div style={s.panel} className="expense-panel">
        <div className="expense-panel-heading">
          <div><div className="expense-eyebrow">DAFTAR TRANSAKSI</div><h2>Riwayat pengeluaran</h2></div>
          <span className="expense-result-count">{items.length} ditampilkan</span>
        </div>
        {/* Filters */}
        <div style={s.filtersRow} className="expense-filters">
          <div className="expense-search-wrap"><FiSearch /><input style={s.searchInput} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari keperluan, referensi, atau bank..." /></div>
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

        {err ? <div style={s.alertErr} className="expense-error">{err}</div> : null}

        {/* Table */}
        <div style={s.tableWrap} className="expense-table-wrap">
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Tanggal</th>
                <th style={s.th}>Pengeluaran</th>
                <th style={s.th}>Alokasi</th>
                <th style={s.th}>Pembayaran</th>
                <th style={s.th}>Nominal</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && <tr><td colSpan={7} style={{ padding: 14 }}><LoadingState compact label="Memuat pengeluaran" note="Mengambil transaksi dan status pembayaran…" rows={5} /></td></tr>}
              {items.map((x) => (
                <tr key={x.id} style={s.rowClickable} onClick={() => openDetail(x)}>
                  <td style={s.td}><div className="expense-date"><FiCalendar />{x.createdAt ? new Date(x.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</div></td>
                  <td style={s.td}><div className="expense-row-title">{x.reason || "Tanpa keterangan"}</div><div className="expense-row-meta">{EXPENSE_CATEGORIES[x.category] || "Lainnya"}{x.clientName ? ` · ${x.clientName}` : ""}</div></td>
                  <td style={s.td}><div className="expense-allocation"><span><FiTruck /></span><div><strong>{x.trip?.truck?.plateNumber || x.truck?.plateNumber || "Umum"}</strong><small>{x.trip ? (x.trip.order?.orderNo || "Perjalanan") : x.truck ? "Biaya armada" : "Operasional umum"}</small></div></div></td>
                  <td style={s.td}><div className="expense-row-title">{x.paymentMethod === "BANK_TRANSFER" ? "Transfer bank" : x.paymentMethod === "CASH" ? "Tunai" : "Lainnya"}</div><div className="expense-row-meta">{x.bankName || x.accountName || "—"}</div></td>
                  <td style={s.tdStrong}>{new Intl.NumberFormat("id-ID", { style: "currency", currency: x.currency || "IDR", maximumFractionDigits: 0 }).format(x.amount || 0)}</td>
                  <td style={s.td}>
                    <div style={s.statusStack}>
                      <span style={{ ...s.statusPill, ...statusVariant(x.status) }}>
                        {x.status === "APPROVED" ? "Disetujui" : x.status === "PAID" ? "Dibayar" : "Diajukan"}
                      </span>
                      {x.status === "APPROVED" && x.approvedBy?.name ? (
                        <small style={s.approverText}>Oleh {x.approvedBy.name}</small>
                      ) : null}
                      {x.duplicateFlag ? (
                        <span style={{ ...s.statusPill, ...s.dupPill }}>
                          Duplicate{typeof x.duplicateCount === "number" ? ` (${x.duplicateCount})` : ""}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td style={s.td} className="expense-actions-cell">
                    <div style={s.actionsRow} className="expense-actions">
                      {x.proofUrl ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <ProtectedFilePreview url={x.proofUrl} mimeType={x.proofMimeType} fileName={x.proofFileName || "Bukti expense"} imageStyle={{ width: 86, height: 58, objectFit: "cover", borderRadius: 7 }} onError={(e) => setErr(e.message)} />
                        </div>
                      ) : null}
                      {canUploadProof && x.status === "SUBMITTED" && (
                        <label style={s.linkBtn} className={`expense-action-button ${actionBusy[x.id] ? "is-busy" : ""}`} onClick={(e) => e.stopPropagation()}>
                          {actionBusy[x.id] === "upload" ? "Mengunggah…" : "Unggah Bukti"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            style={{ display: "none" }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setRowBusy(x.id, "upload");
                              try {
                                const updated = await uploadProof(x.id, file);
                                updateRow(x.id, updated);
                              } catch (err) {
                                setErr(err.message || "Gagal mengunggah proof");
                              } finally {
                                setRowBusy(x.id, "");
                                e.target.value = "";
                              }
                            }}
                          />
                        </label>
                      )}
                      {canUploadProof && x.status === "PAID" && (
                        <label style={s.linkBtn} className={`expense-action-button ${actionBusy[x.id] ? "is-busy" : ""}`} onClick={(e) => e.stopPropagation()}>
                          {actionBusy[x.id] === "replace" ? "Mengganti…" : "Ganti Bukti"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            style={{ display: "none" }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (!window.confirm("Ganti bukti pembayaran dengan file ini?")) {
                                e.target.value = "";
                                return;
                              }
                              setRowBusy(x.id, "replace");
                              try {
                                const updated = await uploadProof(x.id, file, true);
                                updateRow(x.id, updated);
                              } catch (err) {
                                setErr(err.message || "Gagal mengganti bukti");
                              } finally {
                                setRowBusy(x.id, "");
                                e.target.value = "";
                              }
                            }}
                          />
                        </label>
                      )}
                      {canApprove && x.status === "PAID" && (
                        <button
                          style={s.approveBtn}
                          className={`expense-action-button expense-action-approve ${actionBusy[x.id] ? "is-busy" : ""}`}
                          disabled={Boolean(actionBusy[x.id])}
                          onClick={(e) => {
                            e.stopPropagation();
                            onApprove(x.id);
                          }}
                        >
                          {actionBusy[x.id] === "approve" ? "Menyetujui…" : "Setujui"}
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
                  <td style={s.empty} colSpan={7}>
                    Belum ada pengeluaran yang sesuai.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={s.footer} className="expense-pagination">
          <button
            style={s.secondaryBtn}
            disabled={loading || page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <FiArrowLeft /> Sebelumnya
          </button>

          <div style={s.pageInfo}>
            Halaman <strong>{page + 1}</strong> dari <strong>{pageCount}</strong>
          </div>

          <button
            style={s.secondaryBtn}
            disabled={loading || page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya <FiArrowRight />
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div style={s.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={s.modalCard} className="expense-create-modal" onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader} className="expense-create-header">
              <div className="expense-modal-heading">
                <span className="expense-modal-icon"><FiCreditCard /></span>
                <div><div className="expense-eyebrow">PENCATATAN BIAYA</div><div style={s.modalTitle}>Pengeluaran baru</div><p>Pilih alokasi biaya, lengkapi pembayaran, lalu simpan untuk diajukan.</p></div>
              </div>
              <button style={s.closeBtn} onClick={() => setShowModal(false)} aria-label="Close">
                <FiX />
              </button>
            </div>
            <form className="expense-create-form" onSubmit={onSubmit}>
              <div style={s.formGrid} className="expense-create-fields">
                <div className="expense-form-section-title"><span>01</span><div><strong>Alokasi biaya</strong><small>Hubungkan ke perjalanan, armada, atau biarkan sebagai biaya umum.</small></div></div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 8 }}>
                    <div>
                      <label style={{ ...s.label, marginBottom: 3 }}>Perjalanan (opsional)</label>
                      <div style={{ color: BRAND.textMuted, fontSize: 11 }}>Trip dapat dipilih sampai status Tiba; trip Selesai tidak ditampilkan.</div>
                    </div>
                    <button type="button" onClick={openEmptyReturn} style={{ ...s.secondaryBtn, padding: "9px 13px", whiteSpace: "nowrap" }}>
                      + Kembali kosong
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                    <input
                      style={s.input}
                      value={tripSearch}
                      onChange={(e) => setTripSearch(e.target.value)}
                      placeholder="Cari kendaraan, pengemudi, atau tujuan..."
                    />
                    <select
                      value={form.tripId}
                      disabled={Boolean(form.truckId)}
                      onChange={(e) => {
                        const tripId = e.target.value;
                        setForm((current) => ({ ...current, tripId, truckId: tripId ? "" : current.truckId }));
                      }}
                      style={s.select}
                    >
                      <option value="">
                        {form.truckId
                          ? "Kosongkan armada langsung untuk memilih perjalanan"
                          : tripLoading
                            ? "Memuat perjalanan..."
                            : "Pilih perjalanan"}
                      </option>
                      {trips.map((t) => (
                        <option key={t.id} value={t.id}>
                          {(t.purpose === "EMPTY_RETURN" ? "KEMBALI KOSONG • " : "") +
                            (t.driverName || t.driverUser?.name || "Driver") + " • " +
                            (t.truckPlate || t.truck?.plateNumber || "Truck") + " • " +
                            (t.order?.fromText || t.fromText || "-") + " → " +
                            (t.order?.toText || t.toText || "-") + ` • ${t.status}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  {emptyReturnOpen && (
                    <div className="expense-empty-return" style={{ marginTop: 12, padding: isMobile ? 14 : 16, border: `1px solid #CFE1D5`, borderRadius: 12, background: "#F7FBF8" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                        <div><div style={{ color: BRAND.primary, fontWeight: 750, fontSize: 13 }}>PERJALANAN KEMBALI KOSONG</div><div style={{ color: BRAND.textMuted, fontSize: 11, marginTop: 3 }}>Hanya menampilkan truk yang menunggu backhaul di luar Medan.</div></div>
                        <button type="button" onClick={() => setEmptyReturnOpen(false)} style={{ border: 0, background: "transparent", color: BRAND.textMuted, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
                      </div>
                      {emptyReturnLoading ? <div style={{ color: BRAND.textMuted, fontSize: 12 }}>Memuat truk…</div> : eligibleTrucks.length === 0 ? (
                        <div style={{ color: BRAND.textMuted, fontSize: 12, padding: "12px 0" }}>Tidak ada truk berstatus menunggu backhaul di luar Medan.</div>
                      ) : (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.3fr) minmax(210px, .7fr)", gap: 10 }}>
                            <label style={s.label}>Truk dan rute<select style={{ ...s.select, marginTop: 6 }} value={emptyReturnForm.truckId} onChange={(e) => setEmptyReturnForm((value) => ({ ...value, truckId: e.target.value }))}>
                              {eligibleTrucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.plateNumber} • {truck.currentLocation} → {truck.baseLocation || "Medan"} • {truck.driverUser?.name || "Tanpa pengemudi"}</option>)}
                            </select></label>
                            <label style={s.label}>Rencana berangkat<input type="datetime-local" style={{ ...s.input, marginTop: 6 }} value={emptyReturnForm.plannedDepartAt} onChange={(e) => setEmptyReturnForm((value) => ({ ...value, plannedDepartAt: e.target.value }))} /></label>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) auto", gap: 10, alignItems: "end", marginTop: 10 }}>
                            <label style={s.label}>Alasan<input style={{ ...s.input, marginTop: 6 }} value={emptyReturnForm.reason} onChange={(e) => setEmptyReturnForm((value) => ({ ...value, reason: e.target.value }))} placeholder="Contoh: kendaraan rusak" /></label>
                            <button type="button" style={{ ...s.primaryBtn, minWidth: isMobile ? 0 : 170, height: 46 }} disabled={emptyReturnSaving} onClick={createEmptyReturnTrip}>{emptyReturnSaving ? "Membuat…" : "Buat & pilih trip"}</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={s.label}>Armada langsung (opsional)</label>
                  <select
                    value={form.truckId}
                    disabled={Boolean(form.tripId)}
                    onChange={(e) => {
                      const truckId = e.target.value;
                      setForm((current) => ({ ...current, truckId, tripId: truckId ? "" : current.tripId }));
                    }}
                    style={s.select}
                  >
                    <option value="">
                      {form.tripId ? "Armada mengikuti perjalanan yang dipilih" : "Tidak terkait armada tertentu"}
                    </option>
                    {expenseTrucks.map((truck) => (
                      <option key={truck.id} value={truck.id}>
                        {truck.plateNumber} • {[truck.brand, truck.model].filter(Boolean).join(" ") || "Armada"}
                      </option>
                    ))}
                  </select>
                  <div style={{ color: BRAND.textMuted, fontSize: 11, marginTop: 6 }}>
                    Pilih ini untuk pajak, servis, sparepart, atau biaya kendaraan yang tidak terkait dengan satu perjalanan tertentu.
                  </div>
                </div>

                <div className="expense-form-section-title"><span>02</span><div><strong>Pembayaran</strong><small>Catat tujuan pembayaran dan nilai transaksi.</small></div></div>

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

                <div className="expense-form-section-title"><span>03</span><div><strong>Rincian pengeluaran</strong><small>Berikan kategori dan keterangan agar mudah ditelusuri.</small></div></div>
                <div>
                  <label style={s.label}>Kategori Pengeluaran</label>
                  <select style={s.select} value={form.category} onChange={(e) => onChangeForm("category", e.target.value)}>
                    {Object.entries(EXPENSE_CATEGORIES).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
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
              <div style={s.formActions} className="expense-create-actions">
                <div className="expense-submit-note"><FiCheckCircle /> Disimpan sebagai pengajuan pengeluaran</div>
                <button style={s.secondaryBtn} type="button" onClick={() => setShowModal(false)}>Batal</button>
                <button style={s.primaryBtn} disabled={submitting}>
                  {submitting ? "Menyimpan..." : "Simpan pengeluaran"}
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
                  {detailItem.trip?.truck?.plateNumber || detailItem.trip?.plateNumberSnap || detailItem.truck?.plateNumber || "-"}
                </div>
              </div>
              <div>
                <div style={s.detailLabel}>Kategori</div>
                <div style={s.detailValue}>{EXPENSE_CATEGORIES[detailItem.category] || "Lainnya"}</div>
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
              {detailItem.status === "APPROVED" ? (
                <div>
                  <div style={s.detailLabel}>Disetujui oleh</div>
                  <div style={s.detailValue}>{detailItem.approvedBy?.name || "-"}</div>
                </div>
              ) : null}
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
    approverText: {
      color: BRAND.textMuted,
      fontSize: 10,
      fontWeight: 600,
      whiteSpace: "nowrap",
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
