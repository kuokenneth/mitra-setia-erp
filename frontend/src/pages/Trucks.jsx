// src/pages/Trucks.jsx - Corporate Minimalist Design
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import {
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiTruck,
  FiCalendar,
  FiAlertTriangle,
  FiMapPin,
  FiEdit2,
} from "react-icons/fi";

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
  blue: "#3B82F6",
  blueBg: "#EFF6FF",
};

export default function Trucks() {
  const { user } = useAuth();
  const role = user?.role || "UNKNOWN";
  const allowed = role === "OWNER" || role === "ADMIN" || role === "STAFF";

  const [items, setItems] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [asgLoading, setAsgLoading] = useState(false);
  const [movErr, setMovErr] = useState("");
  const [movQ, setMovQ] = useState("");
  const [movFrom, setMovFrom] = useState("");
  const [movTo, setMovTo] = useState("");
  const [monthTotal, setMonthTotal] = useState(0);
  const [monthCurrency, setMonthCurrency] = useState("IDR");
  const [locationEdit, setLocationEdit] = useState(null);
  const [locationSaving, setLocationSaving] = useState(false);
  const [stnkRenewal, setStnkRenewal] = useState(null);
  const [stnkSaving, setStnkSaving] = useState(false);

  function gpsPosition(truck) {
    if (
      truck.lastGpsLatitude === null || truck.lastGpsLatitude === undefined || truck.lastGpsLatitude === "" ||
      truck.lastGpsLongitude === null || truck.lastGpsLongitude === undefined || truck.lastGpsLongitude === ""
    ) return null;
    const lat = Number(truck.lastGpsLatitude);
    const lng = Number(truck.lastGpsLongitude);
    if (
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180 ||
      (lat === 0 && lng === 0)
    ) return null;
    return {
      label: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      url: `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`,
    };
  }

  function gpsUpdatedAt(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const [pageSize, setPageSize] = useState(() => {
    const saved = Number(window.localStorage.getItem("armada-page-size"));
    return [10, 25, 50].includes(saved) ? saved : 10;
  });
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    plateNumber: "",
    brand: "",
    model: "",
    year: "",
    vin: "",
    stnkExpiry: "",
    status: "READY",
    driverUserId: "",
    baseLocation: "Medan",
    currentLocation: "Medan",
  });

  const driverOptions = useMemo(() => {
    const base = [{ id: "", name: "Unassigned" }];
    const mapped = (drivers || []).map((d) => ({
      id: d.id,
      name: d.name || d.email,
      email: d.email,
    }));
    return base.concat(mapped);
  }, [drivers]);

  const assignedDriverIds = useMemo(() => {
    const set = new Set();
    for (const t of items) {
      if (t.driverUser?.id) set.add(t.driverUser.id);
    }
    return set;
  }, [items]);

  function optionsForTruck(truck) {
    const base = [{ id: "", name: "Unassigned" }];
    const allowedDrivers = (drivers || []).filter((d) => {
      const id = d.id;
      const isAssignedSomewhere = assignedDriverIds.has(id);
      const isCurrentForThisTruck = truck.driverUser?.id === id;
      return !isAssignedSomewhere || isCurrentForThisTruck;
    });
    return base.concat(
      allowedDrivers.map((d) => ({ id: d.id, name: d.name || d.email, email: d.email }))
    );
  }

  async function load({ resetPage = false } = {}) {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());

      const [t, d] = await Promise.all([
        api(`/trucks?${params.toString()}`),
        api("/drivers"),
      ]);

      const truckList = t.items || [];
      setItems(truckList);
      setDrivers(d.items || []);

      if (selectedTruck?.id) {
        const stillExists = truckList.some((x) => x.id === selectedTruck.id);
        if (!stillExists) {
          setSelectedTruck(null);
          setAssignments([]);
        }
      }

      if (resetPage) setPage(1);
    } catch (e) {
      setErr(e.message || "Gagal memuat kendaraan");
    } finally {
      setLoading(false);
    }
  }
  useLiveRefresh(() => load());

  async function loadAssignments(truckId) {
    if (!truckId) return;
    setAsgLoading(true);
    setMovErr("");
    try {
      const params = new URLSearchParams();
      if (movQ.trim()) params.set("q", movQ.trim());
      if (movFrom) params.set("from", movFrom);
      if (movTo) params.set("to", movTo);

      const r = await api(`/trucks/${truckId}/spareparts?${params.toString()}`);
      const rows = r.rows || r.items || [];
      setAssignments(rows);
      setMonthTotal(Number(r.monthTotalCost || 0));
      setMonthCurrency(r.monthCurrency || "IDR");
    } catch (e) {
      setMovErr(e.message || "Gagal memuat spareparts");
      setAssignments([]);
    } finally {
      setAsgLoading(false);
    }
  }

  useEffect(() => {
    if (!allowed) return;
    load();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setShowAdd(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onSearch(e) {
    e.preventDefault();
    load({ resetPage: true });
  }

  async function onCreate(e) {
    e.preventDefault();
    setCreating(true);
    setErr("");

    try {
      const payload = {
        plateNumber: form.plateNumber,
        brand: form.brand || null,
        model: form.model || null,
        vin: form.vin || null,
        year: form.year ? Number(form.year) : null,
        stnkExpiry: form.stnkExpiry || null,
        status: form.status,
        driverUserId: form.driverUserId || null,
        baseLocation: form.baseLocation || null,
        currentLocation: form.currentLocation || form.baseLocation || null,
      };

      await api("/trucks", { method: "POST", body: JSON.stringify(payload) });

      setForm({
        plateNumber: "",
        brand: "",
        model: "",
        year: "",
        vin: "",
        stnkExpiry: "",
        status: "READY",
        driverUserId: "",
        baseLocation: "Medan",
        currentLocation: "Medan",
      });

      setShowAdd(false);
      await load({ resetPage: false });
    } catch (e) {
      setErr(e.message || "Gagal membuat truck");
    } finally {
      setCreating(false);
    }
  }

  async function onAssign(truckId, driverUserId) {
    try {
      await api(`/trucks/${truckId}/assign`, {
        method: "PUT",
        body: JSON.stringify({ driverUserId: driverUserId || null }),
      });
      await load({ resetPage: false });
    } catch (e) {
      alert(e.message || "Failed to assign driver");
    }
  }

  function openStnkRenewal(truck, date) {
    if (!date) return;
    setStnkRenewal({
      truckId: truck.id,
      plateNumber: truck.plateNumber,
      stnkExpiry: date,
      amount: "",
      paymentMethod: "BANK_TRANSFER",
      bankName: "",
      accountName: "",
      accountNumber: "",
      notes: "",
    });
  }

  async function saveStnkRenewal(e) {
    e.preventDefault();
    if (!stnkRenewal) return;
    setStnkSaving(true);
    try {
      await api(`/trucks/${stnkRenewal.truckId}/stnk-renewal`, {
        method: "POST",
        body: JSON.stringify({
          stnkExpiry: stnkRenewal.stnkExpiry,
          amount: Number(stnkRenewal.amount || 0),
          paymentMethod: stnkRenewal.paymentMethod,
          bankName: stnkRenewal.bankName,
          accountName: stnkRenewal.accountName,
          accountNumber: stnkRenewal.accountNumber,
          notes: stnkRenewal.notes,
        }),
      });
      setStnkRenewal(null);
      await load({ resetPage: false });
    } catch (e) {
      alert(e.message || "Gagal mencatat perpanjangan STNK");
    } finally {
      setStnkSaving(false);
    }
  }

  async function advanceEmptyReturn(truck) {
    const trip = truck.activeEmptyReturnTrip;
    const next = { PLANNED: "DISPATCHED", DISPATCHED: "ARRIVED", ARRIVED: "COMPLETED" }[trip?.status];
    if (!next) return;
    const message = next === "DISPATCHED"
      ? `Mulai perjalanan kembali kosong ${truck.plateNumber}?`
      : next === "ARRIVED"
        ? `Pastikan ${truck.plateNumber} sudah benar-benar sampai di ${trip.toText || "Medan"}.`
        : `Selesaikan trip ${truck.plateNumber} dan ubah status armada menjadi Ready?`;
    if (!confirm(message)) return;
    setErr("");
    try {
      await api(`/trips/${trip.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next, timestamp: new Date().toISOString() }),
      });
      await load({ resetPage: false });
    } catch (e) {
      setErr(e.message || "Gagal memperbarui perjalanan kembali kosong");
    }
  }

  async function saveLocation(e) {
    e.preventDefault();
    if (!locationEdit) return;
    setLocationSaving(true);
    try {
      await api(`/trucks/${locationEdit.id}/location`, {
        method: "PUT",
        body: JSON.stringify({
          currentLocation: locationEdit.currentLocation,
          baseLocation: locationEdit.baseLocation,
          availableForBackhaul: locationEdit.availableForBackhaul,
        }),
      });
      setLocationEdit(null);
      await load({ resetPage: false });
    } catch (e) {
      alert(e.message || "Gagal memperbarui lokasi truk");
    } finally {
      setLocationSaving(false);
    }
  }

  function onPickTruck(truck) {
    setSelectedTruck(truck);
    setAssignments([]);
    setMovErr("");
    loadAssignments(truck.id);
  }

  const totalPages = useMemo(() => {
    const n = Math.ceil((items.length || 0) / pageSize);
    return Math.max(1, n);
  }, [items.length, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return (items || []).slice(start, start + pageSize);
  }, [items, page, pageSize]);

  function changePageSize(value) {
    const nextSize = Number(value);
    setPageSize(nextSize);
    setPage(1);
    window.localStorage.setItem("armada-page-size", String(nextSize));
  }

  if (!allowed) {
    return (
      <div data-testid="trucks-page">
        <div style={s.header}>
          <h1 style={s.title}>Armada</h1>
          <p style={s.subtitle}>Anda tidak memiliki izin untuk melihat halaman ini.</p>
        </div>
        <div style={s.card}>
          <div style={s.alertErr}>Akses Ditolak</div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="trucks-page">
      {/* Header */}
      <div style={s.headerRow}>
        <div>
          <h1 style={s.title}>Armada</h1>
          <p style={s.subtitle}>Kelola armada dan penugasan pengemudi</p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setShowAdd(true)} style={s.primaryBtn} data-testid="add-truck-btn">
            <FiPlus size={16} />
            Tambah Kendaraan
          </button>
          <button onClick={() => load({ resetPage: false })} disabled={loading} style={s.secondaryBtn} data-testid="refresh-btn">
            <FiRefreshCw size={16} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {err && <div style={s.alertErr}>{err}</div>}

      {/* Fleet Card */}
      <div style={s.card}>
        <div style={s.cardHeaderRow}>
          <div>
            <h2 style={s.cardTitle}>Daftar Armada</h2>
            <p style={s.cardSubtitle}>Tekan baris kendaraan untuk melihat riwayat suku cadang.</p>
          </div>

          <form onSubmit={onSearch} style={s.searchRow}>
            <div style={s.inputWrap}>
              <FiSearch size={16} color={BRAND.textMuted} />
              <input
                style={s.searchInput}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search plate/brand/model…"
                data-testid="trucks-search-input"
              />
            </div>
            <button type="submit" disabled={loading} style={s.searchBtn} data-testid="trucks-search-btn">
              Search
            </button>
          </form>
        </div>

        {/* Pagination Bar */}
        <div style={s.paginationBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={s.paginationText}>
              Menampilkan <strong>{pagedItems.length}</strong> dari <strong>{items.length}</strong> kendaraan
            </span>
            <label style={{ ...s.paginationText, display: "inline-flex", alignItems: "center", gap: 7 }}>
              Per halaman
              <select value={pageSize} onChange={(e) => changePageSize(e.target.value)} style={{ ...s.dateInput, width: 72, padding: "7px 9px" }} aria-label="Jumlah armada per halaman">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          <div style={s.paginationBtns}>
            <button
              style={{ ...s.paginationBtn, opacity: page <= 1 ? 0.5 : 1 }}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="trucks-prev-btn"
            >
              <FiChevronLeft size={16} />
              Prev
            </button>

            <span style={s.pageInfo}>
              Halaman <strong>{page}</strong> / <strong>{totalPages}</strong>
            </span>

            <button
              style={{ ...s.paginationBtn, opacity: page >= totalPages ? 0.5 : 1 }}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              data-testid="trucks-next-btn"
            >
              Next
              <FiChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Nomor Polisi</th>
                <th style={s.th}>Kendaraan</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Kembali Kosong</th>
                <th style={s.th}>Lokasi Armada</th>
                <th style={s.th}>Pengemudi Bertugas</th>
                <th style={s.th}>Masa Berlaku STNK</th>
                <th style={s.th}>Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((t) => {
                const gps = gpsPosition(t);
                return (
                  <tr
                    key={t.id}
                    style={{ ...s.tr, background: BRAND.white, cursor: "pointer" }}
                    onClick={() => onPickTruck(t)}
                    data-testid={`truck-row-${t.id}`}
                  >
                    <td style={s.tdStrong}>{t.plateNumber}</td>
                    <td style={s.td}>
                      <div style={{ fontWeight: 600 }}>
                        {[t.brand, t.model].filter(Boolean).join(" ") || "-"}
                      </div>
                      <div style={s.smallMuted}>{t.vin ? `VIN: ${t.vin}` : "—"}</div>
                    </td>
                    <td style={s.td}>
                      <span style={statusPill(t.status || "READY")}>{t.status || "READY"}</span>
                    </td>
                    <td style={s.td} onClick={(e) => e.stopPropagation()}>
                      {t.activeEmptyReturnTrip ? (
                        <div style={{ minWidth: 145 }}>
                          <div style={{ fontWeight: 650, fontSize: 12 }}>
                            {t.activeEmptyReturnTrip.status === "PLANNED" ? "Belum berangkat" : t.activeEmptyReturnTrip.status === "DISPATCHED" ? "Dalam perjalanan" : "Sudah sampai"}
                          </div>
                          <div style={{ ...s.smallMuted, marginTop: 3 }}>{t.activeEmptyReturnTrip.fromText || "—"} → {t.activeEmptyReturnTrip.toText || "Medan"}</div>
                          <button
                            type="button"
                            style={{ ...s.iconBtn, width: "auto", marginTop: 7, padding: "6px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", color: t.activeEmptyReturnTrip.status === "DISPATCHED" ? "#92400E" : BRAND.primary, background: t.activeEmptyReturnTrip.status === "DISPATCHED" ? BRAND.warningBg : BRAND.white }}
                            onClick={() => advanceEmptyReturn(t)}
                          >
                            {t.activeEmptyReturnTrip.status === "PLANNED" ? "Berangkat" : t.activeEmptyReturnTrip.status === "DISPATCHED" ? "Sampai Medan" : "Selesaikan"}
                          </button>
                        </div>
                      ) : <span style={s.smallMuted}>—</span>}
                    </td>
                    <td style={s.td} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <FiMapPin size={15} color={BRAND.primary} style={{ marginTop: 2, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          {gps ? (
                            <a
                              href={gps.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontWeight: 700, color: BRAND.primary, textDecoration: "none" }}
                            >
                              {gps.label}
                            </a>
                          ) : (
                            <div style={{ fontWeight: 600 }}>{t.currentLocation || "Belum diatur"}</div>
                          )}
                          <div style={s.smallMuted}>
                            {gps
                              ? `GPS ${gpsUpdatedAt(t.lastGpsAt) || "terbaru"}${t.lastGpsSpeed != null ? ` · ${Number(t.lastGpsSpeed).toFixed(0)} km/jam` : ""}`
                              : t.availableForBackhaul
                              ? `Menunggu ${formatIdle(t.idleSince)}`
                              : t.baseLocation
                                ? `Base: ${t.baseLocation}`
                                : "Base belum diatur"}
                          </div>
                          {gps && (
                            <div style={{ ...s.smallMuted, marginTop: 2 }}>
                              Lokasi operasional: {t.currentLocation || "Belum diatur"}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          style={s.iconBtn}
                          title="Ubah lokasi"
                          disabled={t.status === "DISPATCH"}
                          onClick={() => setLocationEdit({
                            id: t.id,
                            plateNumber: t.plateNumber,
                            currentLocation: t.currentLocation || "",
                            baseLocation: t.baseLocation || "",
                            availableForBackhaul: Boolean(t.availableForBackhaul),
                          })}
                        >
                          <FiEdit2 size={13} />
                        </button>
                      </div>
                    </td>
                    <td style={s.td} onClick={(e) => e.stopPropagation()}>
                      <select
                        style={{ ...s.driverSelect, opacity: t.status === "INACTIVE" ? 0.55 : 1 }}
                        disabled={t.status === "INACTIVE"}
                        value={t.driverUser?.id || ""}
                        onChange={(e) => onAssign(t.id, e.target.value)}
                        data-testid={`driver-select-${t.id}`}
                      >
                        {optionsForTruck(t).map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <div style={s.smallMuted}>
                        {t.status === "INACTIVE" ? "Inactive truck" : t.driverUser?.email || "No driver"}
                      </div>
                    </td>
                    <td style={s.td} onClick={(e) => e.stopPropagation()}>
                      <div style={s.stnkWrap}>
                        <input
                          type="date"
                          value={t.stnkExpiry ? t.stnkExpiry.slice(0, 10) : ""}
                          onChange={(e) => openStnkRenewal(t, e.target.value)}
                          style={{ ...s.dateInput, ...stnkInputStyle(t.stnkExpiry) }}
                          data-testid={`stnk-input-${t.id}`}
                        />
                        {shouldShowStnkWarning(t.stnkExpiry) && (
                          <span style={stnkBadge(t.stnkExpiry)}>
                            <FiAlertTriangle size={10} />
                            {stnkLabel(t.stnkExpiry)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={s.td}>
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                );
              })}

              {!loading && pagedItems.length === 0 && (
                <tr>
                  <td style={s.empty} colSpan={8}>Tidak ada kendaraan ditemukan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p style={s.footerNote}>Only OWNER/ADMIN/STAFF can mengelola armada.</p>
      </div>

      {/* Modal Riwayat Pergerakan Suku Cadang */}
      {selectedTruck && (
        <div
          style={s.modalOverlay}
          onClick={() => { setSelectedTruck(null); setAssignments([]); }}
          data-testid="sparepart-movements-modal"
        >
          <div
            style={{ ...s.modalCard, width: "min(1080px, calc(100vw - 32px))", maxWidth: 1080, maxHeight: "calc(100vh - 40px)", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
          <div style={{ ...s.movHeader, padding: "20px 22px", borderBottom: `1px solid ${BRAND.border}` }}>
            <div>
              <h2 style={s.cardTitle}>
                Pergerakan Suku Cadang — <strong>{selectedTruck.plateNumber}</strong>
              </h2>
              <p style={s.cardSubtitle}>Menampilkan riwayat suku cadang kendaraan ini.</p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button style={s.secondaryBtn} onClick={() => { setSelectedTruck(null); setAssignments([]); }} data-testid="close-movements-btn">
                <FiX size={16} /> Tutup
              </button>
              <button style={s.primaryBtnSmall} disabled={asgLoading} onClick={() => loadAssignments(selectedTruck.id)} data-testid="refresh-movements-btn">
                {asgLoading ? "Memuat…" : "Muat Ulang"}
              </button>
            </div>
          </div>

          <div style={{ ...s.movFilters, padding: "18px 22px" }}>
            <div style={s.inputWrap}>
              <FiSearch size={16} color={BRAND.textMuted} />
              <input
                style={s.searchInput}
                value={movQ}
                onChange={(e) => setMovQ(e.target.value)}
                placeholder="Cari nama barang atau catatan…"
              />
            </div>

            <div style={s.movDates}>
              <input type="date" style={s.dateInput} value={movFrom} onChange={(e) => setMovFrom(e.target.value)} />
              <input type="date" style={s.dateInput} value={movTo} onChange={(e) => setMovTo(e.target.value)} />
            </div>

            <button style={s.primaryBtnSmall} disabled={asgLoading} onClick={() => loadAssignments(selectedTruck.id)}>Terapkan</button>
            <button style={s.ghostBtn} disabled={asgLoading} onClick={() => { setMovQ(""); setMovFrom(""); setMovTo(""); loadAssignments(selectedTruck.id); }}>Atur Ulang</button>

            <span style={s.monthBadge}>
              Bulan ini: {fmtMoney(monthTotal, monthCurrency)}
            </span>
          </div>

          {movErr && <div style={s.alertErr}>{movErr}</div>}

          <div style={{ ...s.tableWrap, margin: "0 22px 22px" }}>
            <table style={{ ...s.table, minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={s.th}>Dipasang</th>
                  <th style={s.th}>Dilepas</th>
                  <th style={s.th}>Barang</th>
                  <th style={s.th}>Serial / Barcode</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {asgLoading ? (
                  <tr><td style={s.empty} colSpan={6}>Memuat suku cadang…</td></tr>
                ) : assignments.length === 0 ? (
                  <tr><td style={s.empty} colSpan={6}>Belum ada riwayat suku cadang kendaraan ini.</td></tr>
                ) : (
                  assignments.map((a) => (
                    <tr key={a.id} style={s.tr}>
                      <td style={s.td}>{fmtDateTime(a.installedAt)}</td>
                      <td style={s.td}>{a.removedAt ? fmtDateTime(a.removedAt) : "-"}</td>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600 }}>{a.stockUnit?.item?.name || "-"}</div>
                        <div style={s.smallMuted}>{a.stockUnit?.item?.sku ? `SKU: ${a.stockUnit.item.sku}` : "—"}</div>
                      </td>
                      <td style={s.td}>
                        <div>{a.stockUnit?.serialNumber || "-"}</div>
                        <div style={s.smallMuted}>{a.stockUnit?.barcode ? `Barcode: ${a.stockUnit.barcode}` : "—"}</div>
                      </td>
                      <td style={s.td}>
                        <span style={a.removedAt ? statusPill("INACTIVE") : statusPill("READY")}>
                          {a.removedAt ? "REMOVED" : "INSTALLED"}
                        </span>
                      </td>
                      <td style={s.td}>
                        <div>{a.note || "-"}</div>
                        <div style={s.smallMuted}>{a.maintenance?.title ? `Maint: ${a.maintenance.title}` : "—"}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* Tambah Kendaraan Modal */}
      {showAdd && (
        <div style={s.modalOverlay} onClick={() => setShowAdd(false)} data-testid="add-truck-modal">
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>Tambah Kendaraan</h3>
                <p style={s.modalSubtitle}>Tambahkan kendaraan baru ke armada perusahaan.</p>
              </div>
              <button style={s.modalClose} onClick={() => setShowAdd(false)} data-testid="close-modal-btn">
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={onCreate} style={s.form}>
              <Field label="Plate Number *">
                <input style={s.input} value={form.plateNumber} onChange={(e) => setForm((f) => ({ ...f, plateNumber: e.target.value }))} placeholder="BK 1234 XX" data-testid="plate-input" />
              </Field>

              <div style={s.twoCol}>
                <Field label="Brand">
                  <input style={s.input} value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder="Hino" />
                </Field>
                <Field label="Model">
                  <input style={s.input} value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="Tronton" />
                </Field>
              </div>

              <div style={s.twoCol}>
                <Field label="Year">
                  <input style={s.input} value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} placeholder="2020" />
                </Field>
                <Field label="Status">
                  <select style={s.select} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="READY">Siap</option>
                    <option value="MAINTENANCE">Perawatan</option>
                    <option value="INACTIVE">Tidak Aktif</option>
                  </select>
                </Field>
              </div>

              <Field label="VIN (optional)">
                <input style={s.input} value={form.vin} onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))} placeholder="Vehicle identification number" />
              </Field>

              <Field label="Masa Berlaku STNK Date">
                <input type="date" style={s.input} value={form.stnkExpiry || ""} onChange={(e) => setForm((f) => ({ ...f, stnkExpiry: e.target.value }))} />
              </Field>

              <div style={s.twoCol}>
                <Field label="Base / Pool Utama">
                  <input style={s.input} value={form.baseLocation} onChange={(e) => setForm((f) => ({ ...f, baseLocation: e.target.value }))} placeholder="Medan" />
                </Field>
                <Field label="Lokasi Saat Ini">
                  <input style={s.input} value={form.currentLocation} onChange={(e) => setForm((f) => ({ ...f, currentLocation: e.target.value }))} placeholder="Medan" />
                </Field>
              </div>

              <Field label="Assign Driver (optional)">
                <select style={s.select} value={form.driverUserId} onChange={(e) => setForm((f) => ({ ...f, driverUserId: e.target.value }))}>
                  {driverOptions.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </Field>

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="submit" disabled={creating} style={{ ...s.primaryBtn, flex: 1, opacity: creating ? 0.7 : 1 }} data-testid="submit-truck-btn">
                  {creating ? "Adding…" : "Tambah Kendaraan"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} style={s.ghostBtn}>Batal</button>
              </div>

              <p style={s.tip}>Tip: You can assign a driver later from the fleet table.</p>
            </form>
          </div>
        </div>
      )}

      {stnkRenewal && (
        <div style={s.modalOverlay} onClick={() => !stnkSaving && setStnkRenewal(null)} data-testid="stnk-renewal-modal">
          <form style={{ ...s.modalCard, maxWidth: 560 }} onSubmit={saveStnkRenewal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>Perpanjangan STNK {stnkRenewal.plateNumber}</h3>
                <p style={s.modalSubtitle}>Tanggal baru dan biayanya akan dicatat bersama sebagai pengeluaran armada.</p>
              </div>
              <button type="button" style={s.modalClose} disabled={stnkSaving} onClick={() => setStnkRenewal(null)}><FiX size={18} /></button>
            </div>
            <div style={s.form}>
              <div style={s.twoCol}>
                <Field label="Berlaku sampai">
                  <input type="date" required style={s.input} value={stnkRenewal.stnkExpiry} onChange={(e) => setStnkRenewal((v) => ({ ...v, stnkExpiry: e.target.value }))} />
                </Field>
                <Field label="Biaya perpanjangan">
                  <input type="number" min="1" required style={s.input} value={stnkRenewal.amount} onChange={(e) => setStnkRenewal((v) => ({ ...v, amount: e.target.value }))} placeholder="Contoh: 2500000" />
                </Field>
              </div>
              <Field label="Metode pembayaran">
                <select style={s.select} value={stnkRenewal.paymentMethod} onChange={(e) => setStnkRenewal((v) => ({ ...v, paymentMethod: e.target.value }))}>
                  <option value="BANK_TRANSFER">Transfer Bank</option>
                  <option value="CASH">Tunai</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </Field>
              {stnkRenewal.paymentMethod === "BANK_TRANSFER" && (
                <>
                  <div style={s.twoCol}>
                    <Field label="Bank"><input style={s.input} value={stnkRenewal.bankName} onChange={(e) => setStnkRenewal((v) => ({ ...v, bankName: e.target.value }))} placeholder="Nama bank" /></Field>
                    <Field label="Nama pemilik rekening"><input style={s.input} value={stnkRenewal.accountName} onChange={(e) => setStnkRenewal((v) => ({ ...v, accountName: e.target.value }))} placeholder="Nama pemilik" /></Field>
                  </div>
                  <Field label="Nomor rekening"><input style={s.input} value={stnkRenewal.accountNumber} onChange={(e) => setStnkRenewal((v) => ({ ...v, accountNumber: e.target.value }))} placeholder="Nomor rekening tujuan" /></Field>
                </>
              )}
              <Field label="Catatan (opsional)"><textarea style={{ ...s.input, minHeight: 82, resize: "vertical" }} value={stnkRenewal.notes} onChange={(e) => setStnkRenewal((v) => ({ ...v, notes: e.target.value }))} placeholder="Pajak, administrasi, atau keterangan lainnya" /></Field>
              <div style={{ padding: 12, borderRadius: 7, background: BRAND.warningBg, color: "#92400E", fontSize: 13, lineHeight: 1.5 }}>
                Setelah disimpan, transaksi berstatus <strong>Diajukan</strong>. Unggah bukti pembayaran melalui halaman Pengeluaran agar dapat disetujui dan masuk ke laporan laba/rugi armada.
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button style={{ ...s.primaryBtn, flex: 1 }} disabled={stnkSaving}>{stnkSaving ? "Menyimpan…" : "Simpan & Catat Pengeluaran"}</button>
                <button type="button" style={s.ghostBtn} disabled={stnkSaving} onClick={() => setStnkRenewal(null)}>Batal</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {locationEdit && (
        <div style={s.modalOverlay} onClick={() => setLocationEdit(null)}>
          <form style={{ ...s.modalCard, maxWidth: 480 }} onSubmit={saveLocation} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>Lokasi {locationEdit.plateNumber}</h3>
                <p style={s.modalSubtitle}>Koreksi posisi armada atau tandai sedang menunggu muatan balik.</p>
              </div>
              <button type="button" style={s.modalClose} onClick={() => setLocationEdit(null)}><FiX size={18} /></button>
            </div>
            <div style={s.form}>
              <Field label="Base / Pool Utama">
                <input style={s.input} required value={locationEdit.baseLocation} onChange={(e) => setLocationEdit((v) => ({ ...v, baseLocation: e.target.value }))} placeholder="Medan" />
              </Field>
              <Field label="Lokasi Saat Ini">
                <input style={s.input} required value={locationEdit.currentLocation} onChange={(e) => setLocationEdit((v) => ({ ...v, currentLocation: e.target.value }))} placeholder="Banda Aceh" />
              </Field>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: BRAND.text }}>
                <input type="checkbox" checked={locationEdit.availableForBackhaul} onChange={(e) => setLocationEdit((v) => ({ ...v, availableForBackhaul: e.target.checked }))} />
                Tersedia dan sedang menunggu muatan balik
              </label>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button style={{ ...s.primaryBtn, flex: 1 }} disabled={locationSaving}>{locationSaving ? "Menyimpan…" : "Simpan Lokasi"}</button>
                <button type="button" style={s.ghostBtn} onClick={() => setLocationEdit(null)}>Batal</button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

/* Helpers */
function Field({ label, children }) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

function fmtDateTime(str) {
  if (!str) return "-";
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function fmtMoney(n, currency = "IDR") {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `${currency} ${v.toLocaleString()}`;
  }
}

function formatIdle(value) {
  if (!value) return "muatan balik";
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3600000));
  if (hours < 24) return `${hours} jam`;
  const days = Math.floor(hours / 24);
  return `${days} hari`;
}

function normalizeDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function stnkDiffDays(date) {
  if (!date) return null;
  const d = normalizeDay(date);
  const now = normalizeDay(new Date());
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}

function stnkLabel(date) {
  const diff = stnkDiffDays(date);
  if (diff === null) return "";
  if (diff < 0) return "Expired";
  return `${diff}d`;
}

function shouldShowStnkWarning(date) {
  const diff = stnkDiffDays(date);
  if (diff === null) return false;
  return diff <= 14;
}

function stnkInputStyle(date) {
  const diff = stnkDiffDays(date);
  if (diff === null) return {};
  if (diff < 0) return { borderColor: `${BRAND.error}60`, color: BRAND.error };
  if (diff <= 14) return { borderColor: `${BRAND.warning}60`, color: BRAND.warning };
  return {};
}

function stnkBadge(date) {
  const diff = stnkDiffDays(date);
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  };
  if (diff < 0) return { ...base, background: BRAND.errorBg, color: BRAND.error };
  return { ...base, background: BRAND.warningBg, color: BRAND.warning };
}

function statusPill(status) {
  const base = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  };
  if (status === "READY") return { ...base, background: BRAND.successBg, color: BRAND.success };
  if (status === "MAINTENANCE") return { ...base, background: BRAND.warningBg, color: BRAND.warning };
  if (status === "DISPATCH") return { ...base, background: BRAND.blueBg, color: BRAND.blue };
  if (status === "WAITING_BACKHAUL") return { ...base, background: "#FFF7ED", color: "#C2410C" };
  if (status === "RETURNING_EMPTY") return { ...base, background: "#F5F3FF", color: "#7C3AED" };
  return { ...base, background: "#F3F4F6", color: BRAND.textMuted };
}

/* Styles */
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
  iconBtn: {
    border: `1px solid ${BRAND.border}`,
    background: BRAND.white,
    color: BRAND.textMuted,
    borderRadius: 5,
    width: 28,
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },

  card: {
    borderRadius: 8,
    background: BRAND.white,
    border: `1px solid ${BRAND.border}`,
    padding: 24,
  },

  cardHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    marginBottom: 16,
    flexWrap: "wrap",
  },

  cardTitle: { margin: 0, fontSize: 18, fontWeight: 600, color: BRAND.text },
  cardSubtitle: { margin: "4px 0 0", fontSize: 14, color: BRAND.textMuted },

  searchRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

  inputWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    background: BRAND.white,
  },

  searchInput: {
    border: "none",
    outline: "none",
    fontSize: 14,
    fontWeight: 500,
    color: BRAND.text,
    width: 180,
    background: "transparent",
  },

  searchBtn: {
    padding: "10px 16px",
    borderRadius: 6,
    border: "none",
    background: BRAND.primary,
    color: BRAND.white,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },

  paginationBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "12px 16px",
    borderRadius: 6,
    background: BRAND.secondary,
    marginBottom: 16,
  },

  paginationText: { fontSize: 14, color: BRAND.textLight },
  paginationBtns: { display: "flex", gap: 10, alignItems: "center" },

  paginationBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "8px 12px",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    background: BRAND.white,
    fontSize: 13,
    fontWeight: 500,
    color: BRAND.textLight,
    cursor: "pointer",
  },

  pageInfo: { fontSize: 13, color: BRAND.textMuted },

  tableWrap: {
    overflowX: "auto",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
  },

  table: { width: "100%", borderCollapse: "collapse", minWidth: 900 },

  th: {
    textAlign: "left",
    fontSize: 12,
    fontWeight: 600,
    color: BRAND.textMuted,
    padding: "12px 16px",
    background: BRAND.secondary,
    borderBottom: `1px solid ${BRAND.border}`,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  tr: { transition: "background 0.2s ease" },

  td: {
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: 500,
    color: BRAND.text,
    borderBottom: `1px solid ${BRAND.border}`,
    verticalAlign: "top",
  },

  tdStrong: {
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: 700,
    color: BRAND.text,
    borderBottom: `1px solid ${BRAND.border}`,
    verticalAlign: "top",
  },

  smallMuted: { marginTop: 4, fontSize: 12, color: BRAND.textMuted },

  driverSelect: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    fontSize: 13,
    fontWeight: 500,
    color: BRAND.text,
    cursor: "pointer",
    outline: "none",
    background: BRAND.white,
  },

  stnkWrap: { display: "flex", flexDirection: "column", gap: 6 },

  dateInput: {
    padding: "8px 12px",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    fontSize: 13,
    fontWeight: 500,
    color: BRAND.text,
    outline: "none",
    background: BRAND.white,
  },

  empty: { padding: 32, textAlign: "center", color: BRAND.textMuted, fontWeight: 500 },
  footerNote: { marginTop: 16, fontSize: 12, color: BRAND.textMuted },

  movHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
  },

  movFilters: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 16,
  },

  movDates: { display: "flex", gap: 8, alignItems: "center" },

  monthBadge: {
    padding: "8px 14px",
    borderRadius: 6,
    background: BRAND.successBg,
    color: BRAND.success,
    fontWeight: 600,
    fontSize: 13,
  },

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

  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: "none",
    borderRadius: 6,
    padding: "10px 18px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    color: BRAND.white,
    background: BRAND.primary,
    transition: "all 0.2s ease",
  },

  primaryBtnSmall: {
    border: "none",
    borderRadius: 6,
    padding: "8px 14px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    color: BRAND.white,
    background: BRAND.primary,
  },

  secondaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 6,
    padding: "10px 16px",
    fontWeight: 500,
    fontSize: 14,
    cursor: "pointer",
    color: BRAND.textLight,
    background: BRAND.white,
    border: `1px solid ${BRAND.border}`,
  },

  ghostBtn: {
    borderRadius: 6,
    padding: "8px 14px",
    fontWeight: 500,
    fontSize: 13,
    cursor: "pointer",
    color: BRAND.textMuted,
    background: "transparent",
    border: `1px solid ${BRAND.border}`,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "grid",
    placeItems: "center",
    padding: 20,
    zIndex: 9999,
  },

  modalCard: {
    width: "min(600px, 100%)",
    borderRadius: 8,
    background: BRAND.white,
    border: `1px solid ${BRAND.border}`,
    padding: 24,
    maxHeight: "90vh",
    overflowY: "auto",
  },

  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20,
  },

  modalTitle: { margin: 0, fontSize: 18, fontWeight: 600, color: BRAND.text },
  modalSubtitle: { margin: "4px 0 0", fontSize: 14, color: BRAND.textMuted },

  modalClose: {
    border: `1px solid ${BRAND.border}`,
    background: BRAND.white,
    width: 36,
    height: 36,
    borderRadius: 6,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: BRAND.textMuted,
  },

  form: { display: "grid", gap: 16 },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

  label: {
    display: "block",
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
  },

  select: {
    width: "100%",
    borderRadius: 6,
    border: `1px solid ${BRAND.border}`,
    background: BRAND.white,
    padding: "12px 14px",
    outline: "none",
    fontWeight: 500,
    fontSize: 14,
    color: BRAND.text,
    cursor: "pointer",
  },

  tip: { marginTop: 8, fontSize: 12, color: BRAND.textMuted },
};
