import { useEffect, useId, useMemo, useState } from "react";
import { FiAlertCircle, FiArrowRight, FiCheck, FiCreditCard, FiFileText, FiPlus, FiPrinter, FiRefreshCw, FiSend, FiX } from "react-icons/fi";
import { api, openPrintDocument } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import LoadingState from "../components/LoadingState";
import { openProtectedFile } from "../components/ProtectedFile";
import "./Receivables.css";

const rupiah = value => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
const tanggal = value => value ? new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const statusLabel = { DRAFT: "Draft", SENT: "Terkirim", PARTIALLY_PAID: "Dibayar Sebagian", PAID: "Lunas", OVERDUE: "Jatuh Tempo", VOID: "Dibatalkan" };
const initialData = { customers: [], trucks: [], invoices: [], eligibleOrders: [], eligibleSources: [], stats: { invoiced: 0, received: 0, outstanding: 0, overdue: 0 } };
const afterDays = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const customerKey = source => source?.customerId ? `id:${source.customerId}` : `name:${String(source?.customerName || "").trim().toLocaleLowerCase("id-ID")}`;
const sourcePlateNumbers = source => {
  const plates = source?.type === "ORDER"
    ? (source.order?.tripAllocations?.length
      ? source.order.tripAllocations.map(row => row.trip?.truck?.plateNumber || row.trip?.plateNumberSnap)
      : (source.order?.trips || []).map(trip => trip.truck?.plateNumber || trip.plateNumberSnap))
    : source?.type === "MATERIAL"
      ? (source.invoices || []).map(invoice => invoice.trip?.truck?.plateNumber || invoice.trip?.plateNumberSnap)
      : (source?.trips || []).map(trip => trip.truck?.plateNumber || trip.plateNumberSnap);
  return [...new Set(plates.filter(Boolean))];
};
const materialEvidence = invoices => [...new Map((invoices || []).flatMap(invoice => (invoice.lines || []).flatMap(line => (line.stockAllocations || []).map(allocation => allocation.receipt))).filter(Boolean).map(receipt => [receipt.id, receipt])).values()];
const deliveryEvidence = invoice => {
  const trips = invoice?.singleTripLines?.length
    ? invoice.singleTripLines.map(line => line.trip)
    : invoice?.singleTrip ? [invoice.singleTrip]
      : invoice?.order?.tripAllocations?.length ? invoice.order.tripAllocations.map(row => row.trip)
        : invoice?.order?.trips || [];
  return trips.flatMap(trip => (trip?.arrivalProofs || []).map(proof => ({ ...proof, trip })));
};
const manualLine = type => type === "MATERIAL" ? { date: new Date().toISOString().slice(0,10), truckId: "", documentNo: "", cargoName: "", qty: "", unit: "PCS", rate: "" } : { date: new Date().toISOString().slice(0,10), truckId: "", unloadingDate: "", cargoName: type === "CANGKANG" ? "Cangkang" : "Pupuk", sentPackages: "", sentKg: "", receivedPackages: "", receivedKg: "", billableKg: "", rate: "" };

function TruckSearch({ trucks, value, onChange }) {
  const listId = useId();
  const selected = trucks.find(truck => truck.id === value);
  const truckLabel = truck => `${truck.plateNumber}${truck.brand || truck.model ? ` · ${[truck.brand, truck.model].filter(Boolean).join(" ")}` : ""}`;
  const [query, setQuery] = useState(selected ? truckLabel(selected) : "");
  useEffect(() => {
    // Keep typed search text aligned when the selected truck changes externally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(selected ? truckLabel(selected) : "");
  }, [selected]);
  return <div className="ar-truck-search">
    <input required list={listId} value={query} placeholder="Cari no. polisi..." autoComplete="off" onChange={event => { const text = event.target.value; const match = trucks.find(truck => truckLabel(truck).toLocaleLowerCase("id-ID") === text.trim().toLocaleLowerCase("id-ID")); setQuery(text); onChange(match?.id || ""); }}/>
    <datalist id={listId}>{trucks.map(truck => <option key={truck.id} value={truckLabel(truck)}/>)}</datalist>
  </div>;
}

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
  const [invoiceForm, setInvoiceForm] = useState({ billingCustomerKey: "", sourceKey: "", sourceType: "ORDER", orderId: "", customerId: "", materialInvoiceIds: [], materialLineAmounts: {}, singleTripId: "", singleTripIds: [], ratePerKg: "", tolerancePercent: "0", customerName: "", customerPhone: "", billingAddress: "", dueAt: afterDays(30), contractSubtotal: "", tax: 0, discount: 0, notes: "" });
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "BANK_TRANSFER", reference: "", receivedAt: new Date().toISOString().slice(0, 10), notes: "" });
  const [pricingForm, setPricingForm] = useState({ contractSubtotal: "", ratePerKg: "", tolerancePercent: "0", materialLineRates: {}, tax: 0, discount: 0, dueAt: afterDays(30), notes: "" });
  const [manualForm, setManualForm] = useState({ type: "FERTILIZER", customerId: "", dueAt: afterDays(30), title: "Rincian ongkos angkut pupuk", fromText: "", toText: "", reference: "", tax: 0, discount: 0, notes: "", lines: [manualLine("FERTILIZER")] });

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
    setInvoiceForm({ billingCustomerKey: "", sourceKey: "", sourceType: "ORDER", orderId: "", customerId: "", materialInvoiceIds: [], materialLineAmounts: {}, singleTripId: "", singleTripIds: [], ratePerKg: "", tolerancePercent: "0", customerName: "", customerPhone: "", billingAddress: "", dueAt: afterDays(30), contractSubtotal: "", tax: 0, discount: 0, notes: "" });
    setError(""); setModal("invoice");
  }
  function openManualInvoice() { setManualForm({ type: "FERTILIZER", customerId: "", dueAt: afterDays(30), title: "Rincian ongkos angkut pupuk", fromText: "", toText: "", reference: "", tax: 0, discount: 0, notes: "", lines: [manualLine("FERTILIZER")] }); setError(""); setModal("manual-invoice"); }
  function changeManualType(type) { setManualForm(form => ({ ...form, type, title: type === "FERTILIZER" ? "Rincian ongkos angkut pupuk" : type === "CANGKANG" ? "Rekap ongkos angkut cangkang" : "Rincian ongkos angkut ambang / material", lines: [manualLine(type)] })); }
  function updateManualLine(index, key, value) { setManualForm(form => ({ ...form, lines: form.lines.map((line, i) => i === index ? { ...line, [key]: value } : line) })); }
  async function createManualInvoice(event) { event.preventDefault(); setBusy(true); setError(""); try { const lines = manualForm.lines.map(line => { const quantity = manualForm.type === "MATERIAL" ? Number(line.qty || 0) : Number(line.billableKg || line.receivedKg || line.sentKg || 0); return { ...line, billableKg: quantity, amount: Math.round(quantity * Number(line.rate || 0)) }; }); await api("/receivables/manual-invoices", { method: "POST", body: JSON.stringify({ ...manualForm, lines }) }); setModal(""); await load(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  function chooseCustomer(key) {
    const customer = data.customers.find(item => `id:${item.id}` === key);
    const source = data.eligibleSources.find(item => customerKey(item) === key);
    setInvoiceForm(form => ({ ...form, billingCustomerKey: key, sourceKey: "", sourceType: "ORDER", orderId: "", customerId: customer?.id || source?.customerId || "", materialInvoiceIds: [], materialLineAmounts: {}, singleTripId: "", singleTripIds: [], ratePerKg: "", tolerancePercent: String(customer?.cargoLossTolerancePercent ?? 0), customerName: customer?.name || source?.customerName || "", customerPhone: customer?.phone || source?.customerPhone || "", billingAddress: customer?.address || source?.billingAddress || "", contractSubtotal: "" }));
  }
  function chooseOrder(sourceKey) {
    const source = data.eligibleSources.find(item => `${item.type}:${item.id}` === sourceKey);
    setInvoiceForm(form => ({ ...form, sourceKey, sourceType: source?.type || "ORDER", orderId: source?.type === "ORDER" ? source.id : "", customerId: source?.customerId || "", materialInvoiceIds: source?.materialInvoiceIds || [], materialLineAmounts: {}, singleTripId: source?.singleTripId || "", singleTripIds: source?.singleTripIds || [], ratePerKg: "", customerName: source?.customerName || "", customerPhone: source?.customerPhone || "", billingAddress: source?.billingAddress || "", contractSubtotal: ["MATERIAL", "SINGLE_TRIP_GROUP"].includes(source?.type) ? "0" : "" }));
  }
  async function createInvoice(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api("/receivables/invoices", { method: "POST", body: JSON.stringify(invoiceForm) }); setModal(""); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function sendInvoice(invoice) {
    setBusy(true); setError("");
    try {
      const result = await api(`/receivables/invoices/${invoice.id}/send`, { method: "PATCH" });
      setData(current => ({ ...current, invoices: current.invoices.map(item => item.id === result.invoice.id ? result.invoice : item) }));
    }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  function openInvoiceDetail(invoice) {
    const rates = {};
    (invoice.materialInvoices || []).flatMap(row => row.lines || []).forEach(line => { rates[line.id] = line.qty > 0 && line.totalAmount > 0 ? String(Math.round(line.totalAmount / line.qty)) : ""; });
    setSelected(invoice);
    setPricingForm({ contractSubtotal: invoice.contractSubtotal > 0 ? String(invoice.contractSubtotal) : "", ratePerKg: invoice.singleTripLines?.[0]?.ratePerKg > 0 ? String(invoice.singleTripLines[0].ratePerKg) : invoice.ratePerKg > 0 ? String(invoice.ratePerKg) : "", tolerancePercent: String(invoice.tolerancePercent ?? invoice.customer?.cargoLossTolerancePercent ?? 0), materialLineRates: rates, tax: invoice.tax || 0, discount: invoice.discount || 0, dueAt: String(invoice.dueAt || "").slice(0, 10) || afterDays(30), notes: invoice.notes || "" });
    setError(""); setModal("invoice-detail");
  }
  async function saveInvoicePricing(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api(`/receivables/invoices/${selected.id}/draft`, { method: "PATCH", body: JSON.stringify(pricingForm) }); setModal(""); setSelected(null); await load(); }
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
    (data.customers || []).forEach(customer => values.set(`id:${customer.id}`, { key: `id:${customer.id}`, name: customer.name, count: 0 }));
    (data.eligibleSources || []).forEach(source => { const key = customerKey(source); if (source.customerName && !values.has(key)) values.set(key, { key, name: source.customerName, count: 0 }); values.get(key) && (values.get(key).count += 1); });
    return [...values.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [data.customers, data.eligibleSources]);
  const customerSources = (data.eligibleSources || []).filter(source => customerKey(source) === invoiceForm.billingCustomerKey);
  const invoiceOrder = selectedSource?.order;
  const plannedQuantity = Number(invoiceOrder?.shipment?.planned || invoiceOrder?.qty || 0);
  const deliveredQuantity = Number(invoiceOrder?.shipment?.delivered || 0);
  const billableRatio = plannedQuantity > 0 ? Math.min(1, Math.max(0, deliveredQuantity / plannedQuantity)) : 1;
  const billableSubtotal = Math.round(Number(invoiceForm.contractSubtotal || 0) * billableRatio);
  const selectedMaterialInvoices = selectedSource?.type === "MATERIAL"
    ? (selectedSource.invoices || []).filter(invoice => invoiceForm.materialInvoiceIds.includes(invoice.id))
    : [];
  const selectedMaterialSubtotal = selectedMaterialInvoices.flatMap(invoice => invoice.lines || []).reduce((sum, line) => sum + (invoiceForm.materialLineAmounts[line.id] !== undefined ? Number(line.qty || 0) * Number(invoiceForm.materialLineAmounts[line.id] || 0) : Number(line.totalAmount || 0)), 0);
  const materialSubtotal = selectedSource?.type === "MATERIAL" ? selectedMaterialSubtotal : Number(invoiceOrder?.materialSubtotal ?? 0);
  const selectedSingleTrips = selectedSource?.type === "SINGLE_TRIP_GROUP" ? (selectedSource.trips || []).filter(trip => invoiceForm.singleTripIds.includes(trip.id)) : [];
  const tripWeightKg = trip => String(trip.unitSnap || "").toUpperCase() === "TON" ? Number(trip.qtyActual || 0) * 1000 : Number(trip.qtyActual || 0);
  const selectedSingleWeightKg = selectedSingleTrips.reduce((sum, trip) => sum + tripWeightKg(trip), 0);
  const singleTripSubtotal = Math.round(selectedSingleWeightKg * Number(invoiceForm.ratePerKg || 0));
  const total = (selectedSource?.type === "SINGLE_TRIP_GROUP" ? singleTripSubtotal : billableSubtotal + materialSubtotal) + Number(invoiceForm.tax || 0) - Number(invoiceForm.discount || 0);
  const invoiceBlockReason = !invoiceForm.billingCustomerKey ? "Pilih customer tagihan terlebih dahulu" : !selectedSource ? "Pilih sumber tagihan customer ini" : selectedSource.type === "MATERIAL" && !invoiceForm.materialInvoiceIds.length ? "Pilih minimal satu Faktur Muatan" : selectedSource.type === "SINGLE_TRIP_GROUP" && !invoiceForm.singleTripIds.length ? "Pilih minimal satu Trip Tunggal" : "";
  const canSaveInvoice = !busy && !invoiceBlockReason;
  return <div className="ar-page">
    <header className="ar-head"><div className="ar-head-copy"><span className="ar-eyebrow">KEUANGAN · PIUTANG</span><h1>Piutang Pelanggan</h1><p>Susun Draft, lengkapi harga, kirim invoice, dan pantau pembayaran dalam satu tempat.</p></div><div className="ar-head-side"><span><small>Sumber siap ditagih</small><strong>{data.eligibleSources?.length || 0}</strong></span><button className="ar-manual-button" onClick={openManualInvoice}><FiPlus/> Tagihan Tunggal</button><button className="ar-primary ar-create-invoice" onClick={openInvoice}><FiPlus/> Buat Draft Invoice</button></div></header>
    <section className="ar-stats">
      <article className="billed"><i>01</i><div><span>Total Ditagih</span><strong>{rupiah(data.stats.invoiced)}</strong><small>Seluruh invoice aktif</small></div></article>
      <article className="received"><i>02</i><div><span>Sudah Diterima</span><strong>{rupiah(data.stats.received)}</strong><small>Pembayaran pelanggan</small></div></article>
      <article className="outstanding"><i>03</i><div><span>Sisa Piutang</span><strong>{rupiah(data.stats.outstanding)}</strong><small>Belum dilunasi</small></div></article>
      <article className={`overdue ${data.stats.overdue ? "danger" : ""}`}><i>04</i><div><span>Jatuh Tempo</span><strong>{rupiah(data.stats.overdue)}</strong><small>Perlu ditindaklanjuti</small></div></article>
    </section>
    {error && <div className="ar-alert"><FiAlertCircle/><span>{error}</span><button onClick={() => setError("")}><FiX/></button></div>}
    <section className="ar-panel">
      <div className="ar-panel-heading"><div><span>DAFTAR INVOICE</span><h2>Tagihan & pembayaran</h2><p>{rows.length} invoice ditampilkan</p></div><div className="ar-status-legend"><span><i className="draft"/>Draft</span><span><i className="sent"/>Terkirim</span><span><i className="paid"/>Lunas</span></div></div>
      <div className="ar-tools"><input className="ar-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nomor invoice, pesanan, atau pelanggan..."/><select className="ar-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">Semua Status</option><option value="DRAFT">Draft</option><option value="SENT">Terkirim</option><option value="PARTIALLY_PAID">Dibayar Sebagian</option><option value="PAID">Lunas</option><option value="OVERDUE">Jatuh Tempo</option><option value="VOID">Dibatalkan</option></select><button className="ar-refresh" onClick={load} aria-label="Muat ulang"><FiRefreshCw className={loading ? "ar-spin" : ""}/></button></div>
      <div className={`ar-table-wrap ${loading && !rows.length ? "initial-loading" : ""}`}>{loading && !rows.length && <LoadingState label="Memuat piutang" note="Menghitung invoice, pembayaran, dan sisa tagihan…" rows={5} />}<table className="ar-invoice-table"><colgroup><col className="invoice"/><col className="customer"/><col className="due"/><col className="money"/><col className="money"/><col className="money"/><col className="status"/><col className="actions"/></colgroup><thead><tr><th>Invoice</th><th>Pelanggan</th><th>Jatuh Tempo</th><th>Total</th><th>Dibayar</th><th>Sisa</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>
        {rows.map(invoice => <tr key={invoice.id}>
          <td className="ar-invoice-cell" data-label="Invoice"><b>{invoice.number}</b><small>{invoice.sourceType?.startsWith("MANUAL_") ? `Tagihan Tunggal · ${invoice.sourceType.replace("MANUAL_FERTILIZER","Pupuk").replace("MANUAL_CANGKANG","Cangkang").replace("MANUAL_MATERIAL","Ambang / Material")}` : invoice.order?.orderNo || (invoice.materialInvoices?.length ? `${invoice.materialInvoices.length} Faktur Muatan` : invoice.singleTrip?.tripNo)}</small>{invoice.order?.shipment?.loss > 0 && <small className="ar-loss">Selisih {invoice.order.shipment.loss.toLocaleString("id-ID")} {invoice.order.shipment.unit || ""}</small>}</td>
          <td className="ar-customer-cell" data-label="Pelanggan"><b>{invoice.customerName}</b><small>{invoice.order?.fromText} {invoice.order && "→"} {invoice.order?.toText}</small></td>
          <td data-label="Jatuh Tempo"><span className="ar-date-value">{tanggal(invoice.dueAt)}</span></td>
          <td className="ar-money-cell" data-label="Total">{rupiah(invoice.total)}</td>
          <td className="ar-money-cell paid" data-label="Dibayar">{rupiah(invoice.paid)}</td>
          <td className="ar-money-cell ar-balance-cell" data-label="Sisa"><b>{rupiah(invoice.balance)}</b></td>
          <td data-label="Status"><span className={`ar-status ${invoice.displayStatus}`}>{statusLabel[invoice.displayStatus]}</span></td>
          <td className="ar-action-cell" data-label="Tindakan"><div className="ar-actions">{invoice.status === "DRAFT" && !invoice.sourceType?.startsWith("MANUAL_") && <button onClick={() => openInvoiceDetail(invoice)}><FiFileText/> Detail</button>}<button onClick={() => printInvoice(invoice)}><FiPrinter/> Cetak</button>{invoice.status === "DRAFT" && <button onClick={() => sendInvoice(invoice)} disabled={busy || invoice.total <= 0} title={invoice.total <= 0 ? "Lengkapi harga terlebih dahulu" : "Kirim invoice"}><FiSend/> Kirim</button>}{["SENT", "PARTIALLY_PAID"].includes(invoice.status) && <button onClick={() => openPayment(invoice)}><FiCreditCard/> Bayar</button>}{canVoid && !invoice.payments.length && !["PAID", "VOID"].includes(invoice.status) && <button className="void" onClick={() => voidInvoice(invoice)}>Batalkan</button>}</div></td>
        </tr>)}
      </tbody></table></div>
      {!loading && !rows.length && <div className="ar-empty"><FiFileText/><h3>Belum ada invoice</h3><p>{data.eligibleSources?.length ? "Buat invoice dari order, Faktur Muatan, atau Trip Tunggal yang siap ditagih." : "Selesaikan perjalanan terlebih dahulu agar dapat ditagih."}</p></div>}
    </section>

    {modal === "manual-invoice" && <div className="ar-overlay" onMouseDown={() => setModal("")}><form className="ar-modal ar-manual-modal" onSubmit={createManualInvoice} onMouseDown={e => e.stopPropagation()}><div className="ar-modal-head"><div><span className="ar-eyebrow">TAGIHAN TANPA PESANAN / TRIP</span><h2>Buat Tagihan Tunggal</h2><p>Masukkan rincian angkutan secara manual sesuai dokumen customer.</p></div><button type="button" onClick={() => setModal("")}><FiX/></button></div><div className="ar-form">
      <div className="ar-manual-types"><button type="button" className={manualForm.type==="FERTILIZER"?"active":""} onClick={()=>changeManualType("FERTILIZER")}><b>Pupuk</b><small>Zak, KG kirim dan diterima</small></button><button type="button" className={manualForm.type==="CANGKANG"?"active":""} onClick={()=>changeManualType("CANGKANG")}><b>Cangkang</b><small>Timbang kebun dan bongkar</small></button><button type="button" className={manualForm.type==="MATERIAL"?"active":""} onClick={()=>changeManualType("MATERIAL")}><b>Ambang / Material</b><small>Beberapa barang dan satuan</small></button></div>
      <section className="ar-form-section ar-manual-info"><div className="ar-section-title"><span>1</span><div><strong>Customer dan keterangan</strong><small>Invoice tetap terhubung ke Master Customer.</small></div></div><div className="ar-grid2"><label>Customer tagihan<select required value={manualForm.customerId} onChange={e=>setManualForm({...manualForm,customerId:e.target.value})}><option value="">Pilih customer</option>{data.customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label>Jatuh tempo<input required type="date" value={manualForm.dueAt} onChange={e=>setManualForm({...manualForm,dueAt:e.target.value})}/></label></div><label>Judul tagihan<input required value={manualForm.title} onChange={e=>setManualForm({...manualForm,title:e.target.value})}/></label><div className="ar-grid2"><label>Angkut dari<input value={manualForm.fromText} onChange={e=>setManualForm({...manualForm,fromText:e.target.value})}/></label><label>Tujuan<input value={manualForm.toText} onChange={e=>setManualForm({...manualForm,toText:e.target.value})}/></label></div><label>Referensi <small className="ar-optional">SO / PO / DO</small><input value={manualForm.reference} onChange={e=>setManualForm({...manualForm,reference:e.target.value})}/></label></section>
      <section className="ar-form-section ar-manual-lines"><div className="ar-section-title"><span>2</span><div><strong>Rincian tagihan</strong><small>Tambahkan satu baris untuk setiap kendaraan atau barang.</small></div></div><div className="ar-manual-table"><div className={`ar-manual-row heading ${manualForm.type.toLowerCase()}`}>{manualForm.type==="MATERIAL"?<><span>Tanggal</span><span>No. Polisi</span><span>Surat/Faktur</span><span>Nama barang</span><span>Qty</span><span>Satuan</span><span>Harga</span><span/></>:manualForm.type==="FERTILIZER"?<><span>Tanggal</span><span>No. Polisi</span><span>Zak kirim</span><span>KG kirim</span><span>Zak terima</span><span>KG terima</span><span>KG ditagih</span><span>Harga/KG</span><span/></>:<><span>Tgl SP</span><span>No. Polisi</span><span>Tgl bongkar</span><span>KG kirim</span><span>KG bongkar</span><span>KG ditagih</span><span>Harga/KG</span><span/></>}</div>{manualForm.lines.map((line,index)=><div className={`ar-manual-row ${manualForm.type.toLowerCase()}`} key={index}>{manualForm.type==="MATERIAL"?<><input required type="date" value={line.date} onChange={e=>updateManualLine(index,"date",e.target.value)}/><TruckSearch trucks={data.trucks} value={line.truckId} onChange={value=>updateManualLine(index,"truckId",value)}/><input value={line.documentNo} onChange={e=>updateManualLine(index,"documentNo",e.target.value)} placeholder="No. surat"/><input required value={line.cargoName} onChange={e=>updateManualLine(index,"cargoName",e.target.value)} placeholder="Nama barang"/><input required min="0.01" step="0.01" type="number" value={line.qty} onChange={e=>updateManualLine(index,"qty",e.target.value)}/><input required value={line.unit} onChange={e=>updateManualLine(index,"unit",e.target.value)}/><input required min="1" type="number" value={line.rate} onChange={e=>updateManualLine(index,"rate",e.target.value)}/></>:manualForm.type==="FERTILIZER"?<><input required type="date" value={line.date} onChange={e=>updateManualLine(index,"date",e.target.value)}/><TruckSearch trucks={data.trucks} value={line.truckId} onChange={value=>updateManualLine(index,"truckId",value)}/><input min="0" type="number" value={line.sentPackages} onChange={e=>updateManualLine(index,"sentPackages",e.target.value)}/><input required min="0" type="number" value={line.sentKg} onChange={e=>updateManualLine(index,"sentKg",e.target.value)}/><input min="0" type="number" value={line.receivedPackages} onChange={e=>updateManualLine(index,"receivedPackages",e.target.value)}/><input required min="0" type="number" value={line.receivedKg} onChange={e=>updateManualLine(index,"receivedKg",e.target.value)}/><input required min="0" type="number" value={line.billableKg} onChange={e=>updateManualLine(index,"billableKg",e.target.value)}/><input required min="1" type="number" value={line.rate} onChange={e=>updateManualLine(index,"rate",e.target.value)}/></>:<><input required type="date" value={line.date} onChange={e=>updateManualLine(index,"date",e.target.value)}/><TruckSearch trucks={data.trucks} value={line.truckId} onChange={value=>updateManualLine(index,"truckId",value)}/><input required type="date" value={line.unloadingDate} onChange={e=>updateManualLine(index,"unloadingDate",e.target.value)}/><input required min="0" type="number" value={line.sentKg} onChange={e=>updateManualLine(index,"sentKg",e.target.value)}/><input required min="0" type="number" value={line.receivedKg} onChange={e=>updateManualLine(index,"receivedKg",e.target.value)}/><input required min="0" type="number" value={line.billableKg} onChange={e=>updateManualLine(index,"billableKg",e.target.value)}/><input required min="1" type="number" value={line.rate} onChange={e=>updateManualLine(index,"rate",e.target.value)}/></>}<button type="button" className="ar-remove-line" disabled={manualForm.lines.length===1} onClick={()=>setManualForm(form=>({...form,lines:form.lines.filter((_,i)=>i!==index)}))}><FiX/></button></div>)}</div><button type="button" className="ar-add-line" onClick={()=>setManualForm(form=>({...form,lines:[...form.lines,manualLine(form.type)]}))}><FiPlus/> Tambah baris</button></section>
      <section className="ar-form-section ar-manual-summary"><div className="ar-grid2"><label>Pajak<input min="0" type="number" value={manualForm.tax} onChange={e=>setManualForm({...manualForm,tax:e.target.value})}/></label><label>Diskon<input min="0" type="number" value={manualForm.discount} onChange={e=>setManualForm({...manualForm,discount:e.target.value})}/></label></div><label>Catatan<textarea rows="2" value={manualForm.notes} onChange={e=>setManualForm({...manualForm,notes:e.target.value})}/></label><div className="ar-manual-total"><span><small>ESTIMASI TOTAL TAGIHAN</small><b>{rupiah(manualForm.lines.reduce((sum,line)=>sum+(manualForm.type==="MATERIAL"?Number(line.qty||0):Number(line.billableKg||line.receivedKg||line.sentKg||0))*Number(line.rate||0),0)+Number(manualForm.tax||0)-Number(manualForm.discount||0))}</b></span><em>{manualForm.lines.length} baris rincian</em></div></section></div><div className="ar-modal-actions"><span className="ar-manual-action-note">Invoice disimpan sebagai Draft dan dapat diperiksa sebelum dikirim.</span><button type="button" className="secondary" onClick={()=>setModal("")}>Batal</button><button className="ar-primary" disabled={busy}><FiCheck/> {busy?"Menyimpan...":"Buat Tagihan Tunggal"}</button></div></form></div>}

    {modal === "invoice" && <div className="ar-overlay" onMouseDown={() => setModal("")}><form noValidate className="ar-modal ar-invoice-modal ar-create-modal" onSubmit={createInvoice} onMouseDown={e => e.stopPropagation()}>
      <div className="ar-modal-head"><div><span className="ar-eyebrow">INVOICE BARU</span><h2>Buat tagihan pelanggan</h2><p>Pilih sumber dan pastikan rincian tagihan sudah benar.</p></div><button type="button" aria-label="Tutup" onClick={() => setModal("")}><FiX/></button></div>
      <div className="ar-form ar-invoice-form">
        <section className="ar-form-section">
          <div className="ar-section-title"><span>1</span><div><strong>Pilih customer dan sumber tagihan</strong><small>Hanya pesanan, trip, dan Faktur Muatan customer terpilih yang belum ditagih akan ditampilkan.</small></div></div>
          <div className="ar-source-guide"><span><b>Customer tagihan</b><small>Perusahaan yang menerima invoice</small></span><FiArrowRight/><span><b>Checklist sumber</b><small>Pilih pekerjaan yang akan dibuatkan Draft</small></span></div>
          <label>Customer tagihan<select required value={invoiceForm.billingCustomerKey} onChange={e => chooseCustomer(e.target.value)}><option value="">Pilih customer</option>{billingCustomers.map(customer => <option key={customer.key} value={customer.key}>{customer.name} · {customer.count} sumber</option>)}</select></label>
          <div className="ar-source-picker"><div className="ar-source-picker-title"><span>Sumber yang siap ditagih</span><small>{invoiceForm.billingCustomerKey ? `${customerSources.length} kelompok tersedia` : "Pilih customer terlebih dahulu"}</small></div>
            {!invoiceForm.billingCustomerKey ? <div className="ar-source-empty">Customer belum dipilih.</div> : !customerSources.length ? <div className="ar-source-empty">Belum ada order, trip, atau Faktur Muatan yang sudah selesai dan siap ditagih.</div> : customerSources.map(source => {
              const sourceKey = `${source.type}:${source.id}`;
              const selected = invoiceForm.sourceKey === sourceKey;
              const isOrder = source.type === "ORDER";
              const isMaterial = source.type === "MATERIAL";
              const category = isMaterial ? "Ambang / Material" : source.type === "SINGLE_TRIP_GROUP" ? (source.cargoCategory === "FERTILIZER" ? "Pupuk" : "Cangkang") : (source.order?.cargoName || "Pesanan");
              const numbers = isOrder ? source.order?.orderNo : isMaterial ? (source.invoices || []).map(row => row.number).join(", ") : (source.trips || []).map(row => row.tripNo).join(", ");
              const weight = isOrder ? `${Number(source.order?.shipment?.delivered || 0).toLocaleString("id-ID")} ${source.order?.unit || ""}` : isMaterial ? (source.invoices || []).flatMap(row => row.lines || []).map(line => `${line.qty} ${line.unit}`).join(" · ") : `${Number(source.totalWeightKg || 0).toLocaleString("id-ID")} kg`;
              const count = isOrder ? `${source.order?.shipment?.delivered ? "Realisasi selesai" : "Order selesai"}` : `${isMaterial ? source.invoices?.length : source.trips?.length} ${isMaterial ? "faktur" : "trip"}`;
              const plateNumbers = sourcePlateNumbers(source);
              return <button type="button" key={sourceKey} className={`ar-source-choice ${selected ? "selected" : ""}`} onClick={() => chooseOrder(sourceKey)}><i>{selected && <FiCheck/>}</i><span><small>{category}</small><b>{numbers || source.label}</b><em>{count}{plateNumbers.length ? ` · Armada: ${plateNumbers.join(", ")}` : " · Armada belum tercatat"}</em></span><strong>{weight || "—"}</strong></button>;
            })}
          </div>
          {invoiceOrder && <div className="ar-order-summary"><span><small>Rute pengiriman</small><strong>{invoiceOrder.fromText || "—"} → {invoiceOrder.toText || "—"}</strong></span><span><small>Realisasi muatan</small><strong>{invoiceOrder.shipment?.delivered ?? 0} / {invoiceOrder.shipment?.planned ?? invoiceOrder.qty ?? 0} {invoiceOrder.unit || ""}</strong>{invoiceOrder.shipment?.loss > 0 && <small style={{ color: "#b45309" }}>Kehilangan {invoiceOrder.shipment.loss.toLocaleString("id-ID")} {invoiceOrder.unit || ""}</small>}</span></div>}
          {selectedSource?.type === "MATERIAL" && <div className="ar-material-picker">
            <div className="ar-material-picker-head"><div><small>FAKTUR CUSTOMER</small><strong>{selectedSource.customerName}</strong><span>{invoiceForm.materialInvoiceIds.length} dari {selectedSource.materialInvoiceIds.length} faktur dipilih</span></div><button type="button" onClick={() => setInvoiceForm(form => ({ ...form, materialInvoiceIds: form.materialInvoiceIds.length === selectedSource.materialInvoiceIds.length ? [] : [...selectedSource.materialInvoiceIds] }))}>{invoiceForm.materialInvoiceIds.length === selectedSource.materialInvoiceIds.length ? "Batalkan semua" : "Pilih semua"}</button></div>
            <div className="ar-material-list">{(selectedSource.invoices || []).map(invoice => {
              const invoiceTotal = (invoice.lines || []).reduce((sum, line) => sum + Number(line.totalAmount || 0), 0);
              const itemNames = [...new Set((invoice.lines || []).map(line => line.itemName).filter(Boolean))].join(", ");
              return <label className={`ar-material-item ${invoiceForm.materialInvoiceIds.includes(invoice.id) ? "selected" : ""}`} key={invoice.id}><input type="checkbox" checked={invoiceForm.materialInvoiceIds.includes(invoice.id)} onChange={() => toggleMaterialInvoice(invoice.id)}/><span><b>{invoice.number}</b><small>{tanggal(invoice.issuedAt)} · {invoice.trip?.truck?.plateNumber || "Tanpa armada"}</small><small>{invoice.destinationLocation?.name || invoice.destinationText || "Tujuan belum dicatat"}</small><em>{itemNames || "Ambang / Material"}</em>{invoiceForm.materialInvoiceIds.includes(invoice.id)&&(invoice.lines||[]).map(line=><span className="ar-material-rate" key={line.id}><small>{line.itemName} · {line.qty} {line.unit}</small><input required min="1" type="number" value={invoiceForm.materialLineAmounts[line.id]??""} onClick={e=>e.stopPropagation()} onChange={e=>setInvoiceForm(form=>({...form,materialLineAmounts:{...form.materialLineAmounts,[line.id]:e.target.value}}))} placeholder={`Harga per ${line.unit}`}/></span>)}</span><strong>{rupiah(invoiceForm.materialInvoiceIds.includes(invoice.id)?(invoice.lines||[]).reduce((sum,line)=>sum+Number(line.qty||0)*Number(invoiceForm.materialLineAmounts[line.id]||0),0):invoiceTotal)}</strong></label>;
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
          <div className="ar-grid2"><label>Jatuh tempo<input required type="date" value={invoiceForm.dueAt} onChange={e => setInvoiceForm({...invoiceForm, dueAt:e.target.value})}/></label>{selectedSource?.type !== "MATERIAL" && <label>Persentase susut (%)<input required min="0" max="100" step="0.01" type="number" value={invoiceForm.tolerancePercent} onChange={e => setInvoiceForm({...invoiceForm, tolerancePercent:e.target.value})}/><small className="ar-optional">Default customer; dapat diubah untuk penagihan ini.</small></label>}</div>
          {selectedSource?.type !== "MATERIAL" && <div className="ar-order-summary"><span><small>HARGA DIISI SETELAH DRAFT</small><strong>Berat ditagih × harga per kg</strong></span><span><small>Susut yang digunakan</small><strong>{Number(invoiceForm.tolerancePercent || 0).toLocaleString("id-ID")} %</strong></span></div>}
          {materialSubtotal > 0 && <div className="ar-order-summary"><span><small>FAKTUR MUATAN</small><strong>Tambahan material</strong></span><span><small>Subtotal material</small><strong>{rupiah(materialSubtotal)}</strong></span></div>}
          <div className="ar-grid2"><label>Pajak<input min="0" type="number" inputMode="numeric" value={invoiceForm.tax} onChange={e => setInvoiceForm({...invoiceForm, tax:e.target.value})}/></label><label>Diskon<input min="0" type="number" inputMode="numeric" value={invoiceForm.discount} onChange={e => setInvoiceForm({...invoiceForm, discount:e.target.value})}/></label></div>
          <label>Catatan <small className="ar-optional">Opsional</small><textarea rows="2" value={invoiceForm.notes} onChange={e => setInvoiceForm({...invoiceForm, notes:e.target.value})} placeholder="Keterangan tambahan untuk pelanggan"/></label>
          <div className="ar-total"><span><small>DRAFT TAGIHAN</small>Harga dilengkapi melalui Detail &amp; Harga setelah Draft dibuat</span><strong>{selectedSource?.type === "MATERIAL" ? rupiah(total) : "Belum dihitung"}</strong></div>
        </section>
      </div>
      <div className="ar-modal-actions"><span className={`ar-save-hint ${invoiceBlockReason ? "waiting" : "ready"}`}>{invoiceBlockReason || "Sumber siap disimpan sebagai Draft"}</span><button type="button" className="secondary" onClick={() => setModal("")}>Batal</button><button className="ar-primary ar-save-invoice" disabled={!canSaveInvoice} title={invoiceBlockReason || "Buat Draft Invoice"}>{busy ? <><FiRefreshCw className="ar-spin"/> Menyimpan...</> : <><FiCheck/> Buat Draft</>}</button></div>
    </form></div>}

    {modal === "invoice-detail" && selected && <div className="ar-overlay" onMouseDown={() => setModal("")}><form className="ar-modal ar-invoice-modal" onSubmit={saveInvoicePricing} onMouseDown={e => e.stopPropagation()}>
      <div className="ar-modal-head"><div><span className="ar-eyebrow">DETAIL INVOICE DRAFT</span><h2>{selected.number}</h2><p>{selected.customerName} · Lengkapi harga sebelum invoice dikirim.</p></div><button type="button" onClick={() => setModal("")}><FiX/></button></div>
      <div className="ar-form ar-invoice-form">
        <section className="ar-form-section"><div className="ar-section-title"><span>1</span><div><strong>Sumber tagihan</strong><small>Sumber sudah dikunci pada Draft ini.</small></div></div>
          {selected.materialInvoices?.length ? <><div className="ar-material-list">{selected.materialInvoices.flatMap(invoice => (invoice.lines || []).map(line => <div className="ar-material-rate ar-detail-rate" key={line.id}><span><b>{line.itemName}</b><small>{line.qty} {line.unit} · {invoice.number} · {invoice.trip?.truck?.plateNumber || "-"}</small></span><input required min="1" type="number" value={pricingForm.materialLineRates[line.id] ?? ""} onChange={e => setPricingForm(form => ({ ...form, materialLineRates: { ...form.materialLineRates, [line.id]: e.target.value } }))} placeholder={`Harga per ${line.unit}`}/></div>))}</div><div className="ar-material-evidence"><header><strong>Bukti penerimaan material</strong><small>{materialEvidence(selected.materialInvoices).length} bukti sumber alokasi FIFO</small></header><div>{materialEvidence(selected.materialInvoices).map(receipt => <article key={receipt.id}><span><b>{receipt.number}</b><small>{receipt.itemName} · {Number(receipt.qtyReceived).toLocaleString("id-ID")} {receipt.unit}</small><small>{receipt.location?.name || "Tanpa lokasi"} · {tanggal(receipt.receivedAt)}</small></span><button type="button" onClick={()=>openProtectedFile(receipt.proofUrl).catch(error=>setError(error.message))}>Lihat bukti</button></article>)}</div></div></> : selected.singleTripLines?.length ? <><div className="ar-order-summary"><span><small>TRIP TERPILIH</small><strong>{selected.singleTripLines.length} trip · kirim {selected.singleTripLines.reduce((sum,line)=>sum+Number(line.plannedWeightKg ?? line.actualWeightKg ?? 0),0).toLocaleString("id-ID")} kg</strong><small>Diterima {selected.singleTripLines.reduce((sum,line)=>sum+Number(line.actualWeightKg||0),0).toLocaleString("id-ID")} kg</small></span><span><small>BERAT DITAGIH</small><strong>{selected.singleTripLines.reduce((sum,line)=>sum+Number(line.billableWeightKg ?? line.actualWeightKg ?? 0),0).toLocaleString("id-ID")} kg</strong><small>Toleransi {Number(selected.tolerancePercent || 0).toLocaleString("id-ID")} %</small></span></div><label>Harga per kg<input required min="1" type="number" value={pricingForm.ratePerKg} onChange={e=>setPricingForm({...pricingForm,ratePerKg:e.target.value})}/></label></> : <><div className="ar-order-summary"><span><small>PESANAN</small><strong>{selected.order?.orderNo || "Pesanan reguler"}</strong><small>Kirim {Number(selected.plannedQuantity || 0).toLocaleString("id-ID")} kg · diterima {Number(selected.deliveredQuantity || 0).toLocaleString("id-ID")} kg</small></span><span><small>BERAT DITAGIH</small><strong>{Number(selected.billableQuantity || 0).toLocaleString("id-ID")} kg</strong><small>Toleransi {Number(selected.tolerancePercent || 0).toLocaleString("id-ID")} %</small></span></div><label>Harga per kg<input required min="1" type="number" value={pricingForm.ratePerKg} onChange={e=>setPricingForm({...pricingForm,ratePerKg:e.target.value})}/></label></>}
          {!selected.materialInvoices?.length && <label>Toleransi susut customer (%)<input required min="0" max="100" step="0.01" type="number" value={pricingForm.tolerancePercent} onChange={e=>setPricingForm({...pricingForm,tolerancePercent:e.target.value})}/><small className="ar-optional">Disimpan ke Master Customer dan digunakan untuk tagihan berikutnya.</small></label>}
          {!!deliveryEvidence(selected).length && <div className="ar-material-evidence ar-delivery-evidence"><header><strong>Bukti pengiriman / timbangan</strong><small>{deliveryEvidence(selected).length} bukti dari trip yang ditagih</small></header><div>{deliveryEvidence(selected).map(proof => <article key={proof.id}><span><b>{proof.proofType === "LOADING" ? "Timbang muat" : "Timbang sampai"} · {proof.trip?.tripNo || "Trip"}</b><small>{proof.trip?.truck?.plateNumber || proof.trip?.plateNumberSnap || "Tanpa nopol"} · {tanggal(proof.createdAt)}</small><small>{proof.fileName || "Bukti pengiriman"}</small></span><button type="button" onClick={()=>openProtectedFile(proof.url).catch(error=>setError(error.message))}>Lihat bukti</button></article>)}</div></div>}
        </section>
        <section className="ar-form-section"><div className="ar-section-title"><span>2</span><div><strong>Penyesuaian tagihan</strong><small>Atur tanggal, pajak, diskon, dan catatan.</small></div></div><label>Jatuh tempo<input required type="date" value={pricingForm.dueAt} onChange={e=>setPricingForm({...pricingForm,dueAt:e.target.value})}/></label><div className="ar-grid2"><label>Pajak<input min="0" type="number" value={pricingForm.tax} onChange={e=>setPricingForm({...pricingForm,tax:e.target.value})}/></label><label>Diskon<input min="0" type="number" value={pricingForm.discount} onChange={e=>setPricingForm({...pricingForm,discount:e.target.value})}/></label></div><label>Catatan<textarea rows="2" value={pricingForm.notes} onChange={e=>setPricingForm({...pricingForm,notes:e.target.value})}/></label></section>
      </div><div className="ar-modal-actions"><button type="button" className="secondary" onClick={()=>setModal("")}>Batal</button><button className="ar-primary" disabled={busy}><FiCheck/> {busy ? "Menyimpan..." : "Simpan Harga"}</button></div>
    </form></div>}

    {modal === "payment" && selected && <div className="ar-overlay" onMouseDown={() => setModal("")}><form className="ar-modal ar-payment-modal" onSubmit={savePayment} onMouseDown={e => e.stopPropagation()}><div className="ar-modal-head"><div><span className="ar-eyebrow">PEMBAYARAN PIUTANG</span><h2>Catat pembayaran</h2><p>{selected.number} · {selected.customerName}</p></div><button type="button" onClick={() => setModal("")}><FiX/></button></div><div className="ar-form"><div className="ar-balance"><span>Sisa piutang</span><strong>{rupiah(selected.balance)}</strong></div><label>Jumlah diterima<input required min="1" max={selected.balance} type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount:e.target.value})}/></label><div className="ar-grid2"><label>Metode<select value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method:e.target.value})}><option value="BANK_TRANSFER">Transfer Bank</option><option value="CASH">Tunai</option><option value="OTHER">Lainnya</option></select></label><label>Tanggal diterima<input required type="date" value={paymentForm.receivedAt} onChange={e => setPaymentForm({...paymentForm, receivedAt:e.target.value})}/></label></div><label>Nomor referensi<input value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference:e.target.value})} placeholder="Nomor transfer atau kuitansi"/></label><label>Catatan<textarea rows="2" value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes:e.target.value})}/></label></div><div className="ar-modal-actions"><button type="button" className="secondary" onClick={() => setModal("")}>Batal</button><button className="ar-primary" disabled={busy}><FiCheck/> {busy ? "Menyimpan..." : "Simpan Pembayaran"}</button></div></form></div>}
  </div>;
}
