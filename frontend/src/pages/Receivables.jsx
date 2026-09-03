import { useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiCheck, FiCreditCard, FiFileText, FiPlus, FiRefreshCw, FiSend, FiX } from "react-icons/fi";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import LoadingState from "../components/LoadingState";
import "./Receivables.css";

const rupiah = value => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
const tanggal = value => value ? new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const statusLabel = { DRAFT: "Draft", SENT: "Terkirim", PARTIALLY_PAID: "Dibayar Sebagian", PAID: "Lunas", OVERDUE: "Jatuh Tempo", VOID: "Dibatalkan" };
const initialData = { invoices: [], eligibleOrders: [], stats: { invoiced: 0, received: 0, outstanding: 0, overdue: 0 } };
const afterDays = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

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
  const [invoiceForm, setInvoiceForm] = useState({ orderId: "", customerName: "", customerPhone: "", billingAddress: "", dueAt: afterDays(30), contractSubtotal: "", tax: 0, discount: 0, notes: "" });
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
    const order = data.eligibleOrders[0];
    setInvoiceForm({ orderId: order?.id || "", customerName: order?.customer?.name || order?.customerName || "", customerPhone: order?.customer?.phone || "", billingAddress: order?.customer?.address || "", dueAt: afterDays(30), contractSubtotal: "", tax: 0, discount: 0, notes: "" });
    setError(""); setModal("invoice");
  }
  function chooseOrder(orderId) {
    const order = data.eligibleOrders.find(item => item.id === orderId);
    setInvoiceForm(form => ({ ...form, orderId, customerName: order?.customer?.name || order?.customerName || "", customerPhone: order?.customer?.phone || "", billingAddress: order?.customer?.address || "" }));
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

  const invoiceOrder = data.eligibleOrders.find(order => order.id === invoiceForm.orderId);
  const plannedQuantity = Number(invoiceOrder?.shipment?.planned || invoiceOrder?.qty || 0);
  const deliveredQuantity = Number(invoiceOrder?.shipment?.delivered || 0);
  const billableRatio = plannedQuantity > 0 ? Math.min(1, Math.max(0, deliveredQuantity / plannedQuantity)) : 1;
  const billableSubtotal = Math.round(Number(invoiceForm.contractSubtotal || 0) * billableRatio);
  const materialSubtotal = Number(invoiceOrder?.materialSubtotal || 0);
  const cargoLossAmount = Math.max(0, Number(invoiceForm.contractSubtotal || 0) - billableSubtotal);
  const total = billableSubtotal + materialSubtotal + Number(invoiceForm.tax || 0) - Number(invoiceForm.discount || 0);
  return <div className="ar-page">
    <header className="ar-head"><div><span className="ar-eyebrow">INVOICE & PIUTANG</span><h1>Piutang Pelanggan</h1><p>Pantau penagihan dan pembayaran pelanggan.</p></div><button className="ar-primary" onClick={openInvoice} disabled={!data.eligibleOrders.length}><FiPlus/> Buat Invoice</button></header>
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
        {rows.map(invoice => <tr key={invoice.id}><td><b>{invoice.number}</b><small>{invoice.order?.orderNo}</small>{invoice.order?.shipment?.loss > 0 && <small style={{ color: "#b45309" }}>Selisih {invoice.order.shipment.loss.toLocaleString("id-ID")} {invoice.order.shipment.unit || ""}</small>}</td><td><b>{invoice.customerName}</b><small>{invoice.order?.fromText} → {invoice.order?.toText}</small></td><td>{tanggal(invoice.dueAt)}</td><td>{rupiah(invoice.total)}</td><td className="paid">{rupiah(invoice.paid)}</td><td><b>{rupiah(invoice.balance)}</b></td><td><span className={`ar-status ${invoice.displayStatus}`}>{statusLabel[invoice.displayStatus]}</span></td><td><div className="ar-actions">{invoice.status === "DRAFT" && <button onClick={() => sendInvoice(invoice)} disabled={busy}><FiSend/> Kirim</button>}{["SENT", "PARTIALLY_PAID"].includes(invoice.status) && <button onClick={() => openPayment(invoice)}><FiCreditCard/> Bayar</button>}{canVoid && !invoice.payments.length && !["PAID", "VOID"].includes(invoice.status) && <button className="void" onClick={() => voidInvoice(invoice)}>Batalkan</button>}</div></td></tr>)}
      </tbody></table></div>
      {!loading && !rows.length && <div className="ar-empty"><FiFileText/><h3>Belum ada invoice</h3><p>{data.eligibleOrders.length ? "Buat invoice dari pesanan yang telah selesai." : "Selesaikan pesanan terlebih dahulu agar dapat ditagih."}</p></div>}
    </section>

    {modal === "invoice" && <div className="ar-overlay" onMouseDown={() => setModal("")}><form className="ar-modal ar-invoice-modal" onSubmit={createInvoice} onMouseDown={e => e.stopPropagation()}>
      <div className="ar-modal-head"><div><span className="ar-eyebrow">INVOICE BARU</span><h2>Buat tagihan pelanggan</h2><p>Pilih pesanan dan pastikan rincian tagihan sudah benar.</p></div><button type="button" aria-label="Tutup" onClick={() => setModal("")}><FiX/></button></div>
      <div className="ar-form ar-invoice-form">
        <section className="ar-form-section">
          <div className="ar-section-title"><span>1</span><div><strong>Pilih pesanan</strong><small>Hanya pesanan yang telah selesai dan belum memiliki invoice.</small></div></div>
          <label>Pesanan selesai<select required value={invoiceForm.orderId} onChange={e => chooseOrder(e.target.value)}><option value="">Pilih pesanan</option>{data.eligibleOrders.map(order => <option key={order.id} value={order.id}>{order.orderNo} — {order.customer?.name || order.customerName || "Tanpa nama"}</option>)}</select></label>
          {invoiceOrder && <div className="ar-order-summary"><span><small>Rute pengiriman</small><strong>{invoiceOrder.fromText || "—"} → {invoiceOrder.toText || "—"}</strong></span><span><small>Realisasi muatan</small><strong>{invoiceOrder.shipment?.delivered ?? 0} / {invoiceOrder.shipment?.planned ?? invoiceOrder.qty ?? 0} {invoiceOrder.unit || ""}</strong>{invoiceOrder.shipment?.loss > 0 && <small style={{ color: "#b45309" }}>Kehilangan {invoiceOrder.shipment.loss.toLocaleString("id-ID")} {invoiceOrder.unit || ""}</small>}</span></div>}
        </section>
        <section className="ar-form-section">
          <div className="ar-section-title"><span>2</span><div><strong>Informasi pelanggan</strong><small>Data ini akan dicantumkan pada invoice.</small></div></div>
          <div className="ar-grid2"><label>Nama pelanggan<input required value={invoiceForm.customerName} onChange={e => setInvoiceForm({...invoiceForm, customerName:e.target.value})} placeholder="Nama perusahaan atau pelanggan"/></label><label>Nomor telepon<input value={invoiceForm.customerPhone} onChange={e => setInvoiceForm({...invoiceForm, customerPhone:e.target.value})} placeholder="Contoh: 0812 3456 7890"/></label></div>
          <label>Alamat penagihan<textarea rows="2" value={invoiceForm.billingAddress} onChange={e => setInvoiceForm({...invoiceForm, billingAddress:e.target.value})} placeholder="Alamat lengkap untuk penagihan"/></label>
        </section>
        <section className="ar-form-section">
          <div className="ar-section-title"><span>3</span><div><strong>Rincian tagihan</strong><small>Isi nominal dalam Rupiah.</small></div></div>
          <div className="ar-grid2"><label>Jatuh tempo<input required type="date" value={invoiceForm.dueAt} onChange={e => setInvoiceForm({...invoiceForm, dueAt:e.target.value})}/></label><label>Harga kontrak utama<input required min="0" type="number" inputMode="numeric" value={invoiceForm.contractSubtotal} onChange={e => setInvoiceForm({...invoiceForm, contractSubtotal:e.target.value})} placeholder="0 jika hanya tagihan material"/></label></div>
          {invoiceOrder && plannedQuantity > 0 && <div className="ar-order-summary"><span><small>PERHITUNGAN OTOMATIS</small><strong>{deliveredQuantity.toLocaleString("id-ID")} / {plannedQuantity.toLocaleString("id-ID")} × {rupiah(invoiceForm.contractSubtotal)}</strong></span><span><small>Subtotal dapat ditagih</small><strong>{rupiah(billableSubtotal)}</strong>{cargoLossAmount > 0 && <small style={{ color: "#b45309" }}>Pengurangan kehilangan: {rupiah(cargoLossAmount)}</small>}</span></div>}
          {materialSubtotal > 0 && <div className="ar-order-summary"><span><small>FAKTUR MUATAN</small><strong>Tambahan material</strong></span><span><small>Subtotal material</small><strong>{rupiah(materialSubtotal)}</strong></span></div>}
          <div className="ar-grid2"><label>Pajak<input min="0" type="number" inputMode="numeric" value={invoiceForm.tax} onChange={e => setInvoiceForm({...invoiceForm, tax:e.target.value})}/></label><label>Diskon<input min="0" type="number" inputMode="numeric" value={invoiceForm.discount} onChange={e => setInvoiceForm({...invoiceForm, discount:e.target.value})}/></label></div>
          <label>Catatan <small className="ar-optional">Opsional</small><textarea rows="2" value={invoiceForm.notes} onChange={e => setInvoiceForm({...invoiceForm, notes:e.target.value})} placeholder="Keterangan tambahan untuk pelanggan"/></label>
          <div className="ar-total"><span><small>TOTAL TAGIHAN</small>Kontrak utama + Faktur Muatan + pajak − diskon</span><strong>{rupiah(total)}</strong></div>
        </section>
      </div>
      <div className="ar-modal-actions"><button type="button" className="secondary" onClick={() => setModal("")}>Batal</button><button className="ar-primary" disabled={busy}>{busy ? "Menyimpan..." : "Simpan Invoice"}</button></div>
    </form></div>}

    {modal === "payment" && selected && <div className="ar-overlay" onMouseDown={() => setModal("")}><form className="ar-modal ar-payment-modal" onSubmit={savePayment} onMouseDown={e => e.stopPropagation()}><div className="ar-modal-head"><div><span className="ar-eyebrow">PEMBAYARAN PIUTANG</span><h2>Catat pembayaran</h2><p>{selected.number} · {selected.customerName}</p></div><button type="button" onClick={() => setModal("")}><FiX/></button></div><div className="ar-form"><div className="ar-balance"><span>Sisa piutang</span><strong>{rupiah(selected.balance)}</strong></div><label>Jumlah diterima<input required min="1" max={selected.balance} type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount:e.target.value})}/></label><div className="ar-grid2"><label>Metode<select value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method:e.target.value})}><option value="BANK_TRANSFER">Transfer Bank</option><option value="CASH">Tunai</option><option value="OTHER">Lainnya</option></select></label><label>Tanggal diterima<input required type="date" value={paymentForm.receivedAt} onChange={e => setPaymentForm({...paymentForm, receivedAt:e.target.value})}/></label></div><label>Nomor referensi<input value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference:e.target.value})} placeholder="Nomor transfer atau kuitansi"/></label><label>Catatan<textarea rows="2" value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes:e.target.value})}/></label></div><div className="ar-modal-actions"><button type="button" className="secondary" onClick={() => setModal("")}>Batal</button><button className="ar-primary" disabled={busy}><FiCheck/> {busy ? "Menyimpan..." : "Simpan Pembayaran"}</button></div></form></div>}
  </div>;
}
