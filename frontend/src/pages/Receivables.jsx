import { useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiArrowRight, FiCheck, FiCreditCard, FiFileText, FiPlus, FiPrinter, FiRefreshCw, FiSend, FiX } from "react-icons/fi";
import { api, openPrintDocument } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import LoadingState from "../components/LoadingState";
import "./Receivables.css";

const rupiah = value => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
const tanggal = value => value ? new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const statusLabel = { DRAFT: "Draft", SENT: "Terkirim", PARTIALLY_PAID: "Dibayar Sebagian", PAID: "Lunas", OVERDUE: "Jatuh Tempo", VOID: "Dibatalkan" };
const initialData = { invoices: [], eligibleOrders: [], eligibleSources: [], stats: { invoiced: 0, received: 0, outstanding: 0, overdue: 0 } };
const afterDays = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const customerKey = source => `name:${String(source?.customerName || "").trim().toLocaleLowerCase("id-ID")}`;

export default function Receivables() {
  const { user } = useAuth();
  const canVoid = ["OWNER", "ADMIN"].includes(user?.role);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ billingCustomerKey: "", sourceKey: "", sourceType: "ORDER", orderId: "", materialInvoiceIds: [], singleTripId: "", singleTripIds: [], ratePerKg: "", customerName: "", customerPhone: "", billingAddress: "", dueAt: afterDays(30), contractSubtotal: "", tax: 0, discount: 0, notes: "" });
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "BANK_TRANSFER", reference: "", receivedAt: new Date().toISOString().slice(0, 10), notes: "" });

  async function load() {
    setLoading(true); setError("");
    try { setData(await api("/receivables/overview")); }
    catch (err) { setError(err.message || "Gagal memuat piutang"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useLiveRefresh(load);

  const rows = useMemo(() => data.invoices.filter(invoice => {
    const matchesStatus = filter === "ALL" || invoice.displayStatus === filter;
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || [invoice.number, invoice.customerName, invoice.order?.orderNo].some(value => String(value || "").toLowerCase().includes(needle));
    return matchesStatus && matchesQuery;
  }), [data.invoices, filter, query]);

  function openInvoice() {
    setInvoiceForm({ billingCustomerKey: "", sourceKey: "", sourceType: "ORDER", orderId: "", materialInvoiceIds: [], singleTripId: "", singleTripIds: [], ratePerKg: "", customerName: "", customerPhone: "", billingAddress: "", dueAt: afterDays(30), contractSubtotal: "", tax: 0, discount: 0, notes: "" });
    setError(""); setModal("invoice");
  }
  function chooseCustomer(key) {
    const source = data.eligibleSources.find(item => customerKey(item) === key);
    setInvoiceForm(form => ({ ...form, billingCustomerKey: key, sourceKey: "", sourceType: "ORDER", orderId: "", materialInvoiceIds: [], singleTripId: "", singleTripIds: [], ratePerKg: "", customerName: source?.customerName || "", customerPhone: source?.customerPhone || "", billingAddress: source?.billingAddress || "", contractSubtotal: "" }));
  }
  function chooseOrder(sourceKey) {
    const source = data.eligibleSources.find(item => `${item.type}:${item.id}` === sourceKey);
    setInvoiceForm(form => ({ ...form, sourceKey, sourceType: source?.type || "ORDER", orderId: source?.type === "ORDER" ? source.id : "", materialInvoiceIds: source?.materialInvoiceIds || [], singleTripId: source?.singleTripId || "", singleTripIds: source?.singleTripIds || [], ratePerKg: "", customerName: source?.customerName || "", customerPhone: source?.customerPhone || "", billingAddress: source?.billingAddress || "", contractSubtotal: ["MATERIAL", "SINGLE_TRIP_GROUP"].includes(source?.type) ? "0" : "" }));
  }
  async function createInvoice(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api("/receivables/invoices", { method: "POST", body: JSON.stringify(invoiceForm) }); setModal(""); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function sendInvoice(invoice) {
    setBusy(true); setError("");
    try { await api(`/receivables/invoices/${invoice.id}/send`, { method: "PATCH" }); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  function openPayment(invoice) {
    setSelected(invoice); setPaymentForm({ amount: String(invoice.balance), method: "BANK_TRANSFER", reference: "", receivedAt: new Date().toISOString().slice(0, 10), notes: "" }); setError(""); setModal("payment");
  }
  async function savePayment(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api(`/receivables/invoices/${selected.id}/payments`, { method: "POST", body: JSON.stringify(paymentForm) }); setModal(""); setSelected(null); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function voidInvoice(invoice) {
    if (!window.confirm(`Batalkan ${invoice.number}?`)) return;
    setBusy(true); setError("");
    try { await api(`/receivables/invoices/${invoice.id}/void`, { method: "PATCH" }); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function printInvoice(invoice) {
    setError("");
    try { await openPrintDocument(`/receivables/invoices/${invoice.id}/print`); }
    catch (err) { setError(err.message || "Gagal membuka invoice"); }
  }

  function toggleMaterialInvoice(id) {
    setInvoiceForm(form => ({ ...form, materialInvoiceIds: form.materialInvoiceIds.includes(id) ? form.materialInvoiceIds.filter(item => item !== id) : [...form.materialInvoiceIds, id] }));
  }
  function toggleSingleTrip(id) {
    setInvoiceForm(form => ({ ...form, singleTripIds: form.singleTripIds.includes(id) ? form.singleTripIds.filter(item => item !== id) : [...form.singleTripIds, id] }));
  }

  const selectedSource = data.eligibleSources?.find(source => `${source.type}:${source.id}` === invoiceForm.sourceKey);
  const billingCustomers = useMemo(() => {
    const values = new Map();
    (data.eligibleSources || []).forEach(source => { const key = customerKey(source); if (source.customerName && !values.has(key)) values.set(key, { key, name: source.customerName, count: 0 }); values.get(key) && (values.get(key).count += 1); });
    return [...values.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [data.eligibleSources]);
  const customerSources = (data.eligibleSources || []).filter(source => customerKey(source) === invoiceForm.billingCustomerKey);
  const invoiceOrder = selectedSource?.order;
  const plannedQuantity = Number(invoiceOrder?.shipment?.planned || invoiceOrder?.qty || 0);
  const deliveredQuantity = Number(invoiceOrder?.shipment?.delivered || 0);
  const billableRatio = plannedQuantity > 0 ? Math.min(1, Math.max(0, deliveredQuantity / plannedQuantity)) : 1;
  const billableSubtotal = Math.round(Number(invoiceForm.contractSubtotal || 0) * billableRatio);
  const selectedMaterialInvoices = selectedSource?.type === "MATERIAL"
    ? (selectedSource.invoices || []).filter(invoice => invoiceForm.materialInvoiceIds.includes(invoice.id))
    : [];
  const selectedMaterialSubtotal = selectedMaterialInvoices.flatMap(invoice => invoice.lines || []).reduce((sum, line) => sum + Number(line.totalAmount || 0), 0);
  const materialSubtotal = selectedSource?.type === "MATERIAL" ? selectedMaterialSubtotal : Number(invoiceOrder?.materialSubtotal ?? 0);
  const selectedSingleTrips = selectedSource?.type === "SINGLE_TRIP_GROUP" ? (selectedSource.trips || []).filter(trip => invoiceForm.singleTripIds.includes(trip.id)) : [];
  const tripWeightKg = trip => String(trip.unitSnap || "").toUpperCase() === "TON" ? Number(trip.qtyActual || 0) * 1000 : Number(trip.qtyActual || 0);
  const selectedSingleWeightKg = selectedSingleTrips.reduce((sum, trip) => sum + tripWeightKg(trip), 0);
  const singleTripSubtotal = Math.round(selectedSingleWeightKg * Number(invoiceForm.ratePerKg || 0));
  const cargoLossAmount = Math.max(0, Number(invoiceForm.contractSubtotal || 0) - billableSubtotal);
  const total = (selectedSource?.type === "SINGLE_TRIP_GROUP" ? singleTripSubtotal : billableSubtotal + materialSubtotal) + Number(invoiceForm.tax || 0) - Number(invoiceForm.discount || 0);
  const invoiceBlockReason = !invoiceForm.billingCustomerKey ? "Pilih customer tagihan terlebih dahulu" : !selectedSource ? "Pilih sumber tagihan customer ini" : selectedSource.type === "MATERIAL" && !invoiceForm.materialInvoiceIds.length ? "Pilih minimal satu Faktur Muatan" : selectedSource.type === "SINGLE_TRIP_GROUP" && !invoiceForm.singleTripIds.length ? "Pilih minimal satu Trip Tunggal" : selectedSource.type === "SINGLE_TRIP_GROUP" && Number(invoiceForm.ratePerKg) <= 0 ? "Masukkan harga per kg" : selectedSource.type === "ORDER" && Number(invoiceForm.contractSubtotal) <= 0 && materialSubtotal <= 0 ? "Masukkan harga kontrak utama" : total <= 0 ? "Total tagihan harus lebih dari nol" : "";
  const canSaveInvoice = !busy && !invoiceBlockReason;
  return <div className="ar-page">
    <header className="ar-head"><div><span className="ar-eyebrow">INVOICE & PIUTANG</span><h1>Piutang Pelanggan</h1><p>Pantau penagihan dan pembayaran pelanggan.</p></div><button className="ar-primary ar-create-invoice" onClick={openInvoice}><FiPlus/> Buat Invoice</button></header>
    <section className="ar-stats">
      <article><span>Total Ditagih</span><strong>{rupiah(data.stats.invoiced)}</strong><small>Seluruh invoice aktif</small></article>
      <article><span>Sudah Diterima</span><strong>{rupiah(data.stats.received)}</strong><small>Pembayaran pelanggan</small></article>
      <article><span>Sisa Piutang</span><strong>{rupiah(data.stats.outstanding)}</strong><small>Belum dilunasi</small></article>
      <article className={data.stats.overdue ? "danger" : ""}><span>Jatuh Tempo</span><strong>{rupiah(data.stats.overdue)}</strong><small>Perlu ditindaklanjuti</small></article>
    </section>
    {error && <div className="ar-alert"><FiAlertCircle/><span>{error}</span><button onClick={() => setError("")}><FiX/></button></div>}
    <section className="ar-panel">
      <div className="ar-tools"><input className="ar-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nomor invoice, pesanan, atau pelanggan..."/><select className="ar-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">Semua Status</option><option value="DRAFT">Draft</option><option value="SENT">Terkirim</option><option value="PARTIALLY_PAID">Dibayar Sebagian</option><option value="PAID">Lunas</option><option value="OVERDUE">Jatuh Tempo</option><option value="VOID">Dibatalkan</option></select><button className="ar-refresh" onClick={load} aria-label="Muat ulang"><FiRefreshCw className={loading ? "ar-spin" : ""}/></button></div>
      <div className="ar-table-wrap">{loading && !rows.length && <LoadingState label="Memuat piutang" note="Menghitung invoice, pembayaran, dan sisa tagihan…" rows={5} />}<table><thead><tr><th>Invoice</th><th>Pelanggan</th><th>Jatuh Tempo</th><th>Total</th><th>Dibayar</th><th>Sisa</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>
        {rows.map(invoice => <tr key={invoice.id}><td><b>{invoice.number}</b><small>{invoice.order?.orderNo || (invoice.materialInvoices?.length ? `${invoice.materialInvoices.length} Faktur Muatan` : invoice.singleTrip?.tripNo)}</small>{invoice.order?.shipment?.loss > 0 && <small style={{ color: "#b45309" }}>Selisih {invoice.order.shipment.loss.toLocaleString("id-ID")} {invoice.order.shipment.unit || ""}</small>}</td><td><b>{invoice.customerName}</b><small>{invoice.order?.fromText} {invoice.order && "→"} {invoice.order?.toText}</small></td><td>{tanggal(invoice.dueAt)}</td><td>{rupiah(invoice.total)}</td><td className="paid">{rupiah(invoice.paid)}</td><td><b>{rupiah(invoice.balance)}</b></td><td><span className={`ar-status ${invoice.displayStatus}`}>{statusLabel[invoice.displayStatus]}</span></td><td><div className="ar-actions"><button onClick={() => printInvoice(invoice)}><FiPrinter/> Cetak</button>{invoice.status === "DRAFT" && <button onClick={() => sendInvoice(invoice)} disabled={busy}><FiSend/> Kirim</button>}{["SENT", "PARTIALLY_PAID"].includes(invoice.status) && <button onClick={() => openPayment(invoice)}><FiCreditCard/> Bayar</button>}{canVoid && !invoice.payments.length && !["PAID", "VOID"].includes(invoice.status) && <button className="void" onClick={() => voidInvoice(invoice)}>Batalkan</button>}</div></td></tr>)}
      </tbody></table></div>
      {!loading && !rows.length && <div className="ar-empty"><FiFileText/><h3>Belum ada invoice</h3><p>{data.eligibleSources?.length ? "Buat invoice dari order, Faktur Muatan, atau Trip Tunggal yang siap ditagih." : "Selesaikan perjalanan terlebih dahulu agar dapat ditagih."}</p></div>}
    </section>

    {modal === "invoice" && <div className="ar-overlay" onMouseDown={() => setModal("")}><form className="ar-modal ar-invoice-modal" onSubmit={createInvoice} onMouseDown={e => e.stopPropagation()}>
      <div className="ar-modal-head"><div><span className="ar-eyebrow">INVOICE BARU</span><h2>Buat tagihan pelanggan</h2><p>Pilih sumber dan pastikan rincian tagihan sudah benar.</p></div><button type="button" aria-label="Tutup" onClick={() => setModal("")}><FiX/></button></div>
      <div className="ar-form ar-invoice-form">
        <section className="ar-form-section">
          <div className="ar-section-title"><span>1</span><div><strong>Pilih customer dan sumber tagihan</strong><small>Hanya pesanan, trip, dan Faktur Muatan customer terpilih yang belum ditagih akan ditampilkan.</small></div></div>
          <div className="ar-source-guide"><span><b>Customer tagihan</b><small>Perusahaan yang akan menerima invoice</small></span><FiArrowRight/><span><b>Sumber tagihan</b><small>Pekerjaan yang membentuk nilai invoice</small></span></div>
          <div className="ar-grid2"><label>Customer tagihan<select required value={invoiceForm.billingCustomerKey} onChange={e => chooseCustomer(e.target.value)}><option value="">Pilih customer</option>{billingCustomers.map(customer => <option key={customer.key} value={customer.key}>{customer.name} · {customer.count} sumber</option>)}</select></label><label>Sumber tagihan<select required disabled={!invoiceForm.billingCustomerKey} value={invoiceForm.sourceKey} onChange={e => chooseOrder(e.target.value)}><option value="">{invoiceForm.billingCustomerKey ? "Pilih pesanan atau kelompok trip" : "Pilih customer terlebih dahulu"}</option>{customerSources.map(source => <option key={`${source.type}:${source.id}`} value={`${source.type}:${source.id}`}>{source.label}</option>)}</select></label></div>
          {invoiceOrder && <div className="ar-order-summary"><span><small>Rute pengiriman</small><strong>{invoiceOrder.fromText || "—"} → {invoiceOrder.toText || "—"}</strong></span><span><small>Realisasi muatan</small><strong>{invoiceOrder.shipment?.delivered ?? 0} / {invoiceOrder.shipment?.planned ?? invoiceOrder.qty ?? 0} {invoiceOrder.unit || ""}</strong>{invoiceOrder.shipment?.loss > 0 && <small style={{ color: "#b45309" }}>Kehilangan {invoiceOrder.shipment.loss.toLocaleString("id-ID")} {invoiceOrder.unit || ""}</small>}</span></div>}
          {selectedSource?.type === "MATERIAL" && <div className="ar-material-picker">
            <div className="ar-material-picker-head"><div><small>FAKTUR CUSTOMER</small><strong>{selectedSource.customerName}</strong><span>{invoiceForm.materialInvoiceIds.length} dari {selectedSource.materialInvoiceIds.length} faktur dipilih</span></div><button type="button" onClick={() => setInvoiceForm(form => ({ ...form, materialInvoiceIds: form.materialInvoiceIds.length === selectedSource.materialInvoiceIds.length ? [] : [...selectedSource.materialInvoiceIds] }))}>{invoiceForm.materialInvoiceIds.length === selectedSource.materialInvoiceIds.length ? "Batalkan semua" : "Pilih semua"}</button></div>
            <div className="ar-material-list">{(selectedSource.invoices || []).map(invoice => {
              const invoiceTotal = (invoice.lines || []).reduce((sum, line) => sum + Number(line.totalAmount || 0), 0);
              const itemNames = [...new Set((invoice.lines || []).map(line => line.itemName).filter(Boolean))].join(", ");
              return <label className={`ar-material-item ${invoiceForm.materialInvoiceIds.includes(invoice.id) ? "selected" : ""}`} key={invoice.id}><input type="checkbox" checked={invoiceForm.materialInvoiceIds.includes(invoice.id)} onChange={() => toggleMaterialInvoice(invoice.id)}/><span><b>{invoice.number}</b><small>{tanggal(invoice.issuedAt)} · {invoice.trip?.truck?.plateNumber || "Tanpa armada"}</small><small>{invoice.destinationLocation?.name || invoice.destinationText || "Tujuan belum dicatat"}</small><em>{itemNames || "Ambang / Material"}</em></span><strong>{rupiah(invoiceTotal)}</strong></label>;
            })}</div>
            <div className="ar-material-subtotal"><span>Subtotal faktur terpilih</span><strong>{rupiah(selectedMaterialSubtotal)}</strong></div>
          </div>}
          {selectedSource?.type === "SINGLE_TRIP_GROUP" && <div className="ar-material-picker">
            <div className="ar-material-picker-head"><div><small>TRIP SIAP DITAGIH</small><strong>{selectedSource.customerName} · {selectedSource.cargoCategory === "FERTILIZER" ? "Pupuk" : "Cangkang"}</strong><span>{invoiceForm.singleTripIds.length} dari {selectedSource.singleTripIds.length} trip dipilih</span></div><button type="button" onClick={() => setInvoiceForm(form => ({ ...form, singleTripIds: form.singleTripIds.length === selectedSource.singleTripIds.length ? [] : [...selectedSource.singleTripIds] }))}>{invoiceForm.singleTripIds.length === selectedSource.singleTripIds.length ? "Batalkan semua" : "Pilih semua"}</button></div>
            <div className="ar-material-list">{(selectedSource.trips || []).map(trip => <label className={`ar-material-item ${invoiceForm.singleTripIds.includes(trip.id) ? "selected" : ""}`} key={trip.id}><input type="checkbox" checked={invoiceForm.singleTripIds.includes(trip.id)} onChange={() => toggleSingleTrip(trip.id)}/><span><b>{trip.tripNo}</b><small>{tanggal(trip.completedAt)} · {trip.truck?.plateNumber || "Tanpa armada"}</small><small>{trip.fromText || "—"} → {trip.toText || "—"}</small><em>{trip.cargoNameSnap || "Muatan"}</em></span><strong>{tripWeightKg(trip).toLocaleString("id-ID")} kg</strong></label>)}</div>
            <div className="ar-material-subtotal"><span>Total berat aktual terpilih</span><strong>{selectedSingleWeightKg.toLocaleString("id-ID")} kg</strong></div>
          </div>}
          {selectedSource?.type === "SINGLE_TRIP" && <div className="ar-order-summary"><span><small>{selectedSource.trip?.tripNo || "TRIP TANPA PESANAN"}</small><strong>{selectedSource.trip?.truck?.plateNumber || "Armada"}</strong></span><span><small>Muatan</small><strong>{selectedSource.trip?.cargoNameSnap || "Muatan"}</strong></span></div>}
        </section>
        <section className="ar-form-section">
          <div className="ar-section-title"><span>2</span><div><strong>Informasi pelanggan</strong><small>Data ini akan dicantumkan pada invoice.</small></div></div>
          <div className="ar-grid2"><label>Nama pelanggan<input required readOnly={["MATERIAL", "SINGLE_TRIP_GROUP"].includes(selectedSource?.type)} value={invoiceForm.customerName} onChange={e => setInvoiceForm({...invoiceForm, customerName:e.target.value})} placeholder="Nama perusahaan atau pelanggan"/></label><label>Nomor telepon<input value={invoiceForm.customerPhone} onChange={e => setInvoiceForm({...invoiceForm, customerPhone:e.target.value})} placeholder="Contoh: 0812 3456 7890"/></label></div>
          <label>Alamat penagihan<textarea rows="2" value={invoiceForm.billingAddress} onChange={e => setInvoiceForm({...invoiceForm, billingAddress:e.target.value})} placeholder="Alamat lengkap untuk penagihan"/></label>
        </section>
        <section className="ar-form-section">
          <div className="ar-section-title"><span>3</span><div><strong>Rincian tagihan</strong><small>Isi nominal dalam Rupiah.</small></div></div>
          <div className={selectedSource?.type === "MATERIAL" ? "" : "ar-grid2"}><label>Jatuh tempo<input required type="date" value={invoiceForm.dueAt} onChange={e => setInvoiceForm({...invoiceForm, dueAt:e.target.value})}/></label>{selectedSource?.type === "SINGLE_TRIP_GROUP" ? <label>Harga per kg<input required min="1" type="number" inputMode="numeric" value={invoiceForm.ratePerKg} onChange={e => setInvoiceForm({...invoiceForm, ratePerKg:e.target.value})} placeholder="Contoh: 150"/></label> : selectedSource?.type !== "MATERIAL" && <label>Harga kontrak utama<input required min="0" type="number" inputMode="numeric" value={invoiceForm.contractSubtotal} onChange={e => setInvoiceForm({...invoiceForm, contractSubtotal:e.target.value})} placeholder="Nilai ongkos angkut"/></label>}</div>
          {selectedSource?.type === "SINGLE_TRIP_GROUP" && <div className="ar-order-summary"><span><small>PERHITUNGAN OTOMATIS</small><strong>{selectedSingleWeightKg.toLocaleString("id-ID")} kg × {rupiah(invoiceForm.ratePerKg || 0)}</strong></span><span><small>Subtotal trip</small><strong>{rupiah(singleTripSubtotal)}</strong></span></div>}
          {invoiceOrder && plannedQuantity > 0 && <div className="ar-order-summary"><span><small>PERHITUNGAN OTOMATIS</small><strong>{deliveredQuantity.toLocaleString("id-ID")} / {plannedQuantity.toLocaleString("id-ID")} × {rupiah(invoiceForm.contractSubtotal)}</strong></span><span><small>Subtotal dapat ditagih</small><strong>{rupiah(billableSubtotal)}</strong>{cargoLossAmount > 0 && <small style={{ color: "#b45309" }}>Pengurangan kehilangan: {rupiah(cargoLossAmount)}</small>}</span></div>}
          {materialSubtotal > 0 && <div className="ar-order-summary"><span><small>FAKTUR MUATAN</small><strong>Tambahan material</strong></span><span><small>Subtotal material</small><strong>{rupiah(materialSubtotal)}</strong></span></div>}
          <div className="ar-grid2"><label>Pajak<input min="0" type="number" inputMode="numeric" value={invoiceForm.tax} onChange={e => setInvoiceForm({...invoiceForm, tax:e.target.value})}/></label><label>Diskon<input min="0" type="number" inputMode="numeric" value={invoiceForm.discount} onChange={e => setInvoiceForm({...invoiceForm, discount:e.target.value})}/></label></div>
          <label>Catatan <small className="ar-optional">Opsional</small><textarea rows="2" value={invoiceForm.notes} onChange={e => setInvoiceForm({...invoiceForm, notes:e.target.value})} placeholder="Keterangan tambahan untuk pelanggan"/></label>
          <div className="ar-total"><span><small>TOTAL TAGIHAN</small>{selectedSource?.type === "SINGLE_TRIP_GROUP" ? "Berat aktual × harga/kg + pajak − diskon" : "Kontrak utama + Faktur Muatan + pajak − diskon"}</span><strong>{rupiah(total)}</strong></div>
        </section>
      </div>
      <div className="ar-modal-actions"><span className={`ar-save-hint ${invoiceBlockReason ? "waiting" : "ready"}`}>{invoiceBlockReason || "Invoice siap disimpan"}</span><button type="button" className="secondary" onClick={() => setModal("")}>Batal</button><button className="ar-primary ar-save-invoice" disabled={!canSaveInvoice} title={invoiceBlockReason || "Simpan invoice sebagai draft"}>{busy ? <><FiRefreshCw className="ar-spin"/> Menyimpan...</> : <><FiCheck/> Simpan Invoice</>}</button></div>
    </form></div>}

    {modal === "payment" && selected && <div className="ar-overlay" onMouseDown={() => setModal("")}><form className="ar-modal ar-payment-modal" onSubmit={savePayment} onMouseDown={e => e.stopPropagation()}><div className="ar-modal-head"><div><span className="ar-eyebrow">PEMBAYARAN PIUTANG</span><h2>Catat pembayaran</h2><p>{selected.number} · {selected.customerName}</p></div><button type="button" onClick={() => setModal("")}><FiX/></button></div><div className="ar-form"><div className="ar-balance"><span>Sisa piutang</span><strong>{rupiah(selected.balance)}</strong></div><label>Jumlah diterima<input required min="1" max={selected.balance} type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount:e.target.value})}/></label><div className="ar-grid2"><label>Metode<select value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method:e.target.value})}><option value="BANK_TRANSFER">Transfer Bank</option><option value="CASH">Tunai</option><option value="OTHER">Lainnya</option></select></label><label>Tanggal diterima<input required type="date" value={paymentForm.receivedAt} onChange={e => setPaymentForm({...paymentForm, receivedAt:e.target.value})}/></label></div><label>Nomor referensi<input value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference:e.target.value})} placeholder="Nomor transfer atau kuitansi"/></label><label>Catatan<textarea rows="2" value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes:e.target.value})}/></label></div><div className="ar-modal-actions"><button type="button" className="secondary" onClick={() => setModal("")}>Batal</button><button className="ar-primary" disabled={busy}><FiCheck/> {busy ? "Menyimpan..." : "Simpan Pembayaran"}</button></div></form></div>}
  </div>;
}
