import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiChevronRight, FiPackage, FiPlus, FiRefreshCw, FiShoppingCart } from "react-icons/fi";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import "./Purchasing.css";
import "./PurchasingForm.css";

const money = n => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
const label = s => ({ WAITING_APPROVAL: "Menunggu approval", WAITING_PAYMENT_APPROVAL: "Menunggu approval", PAID: "Dibayar", PARTIALLY_PAID: "Dibayar sebagian", APPROVED: "Disetujui", REJECTED: "Ditolak", DRAFT: "Draft", PARTIALLY_RECEIVED: "Diterima sebagian", FULLY_RECEIVED: "Diterima penuh", SENT_TO_SUPPLIER: "Dikirim ke supplier" }[s] || s);
const poTotal = po => po.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0) + po.tax + po.shippingCost - po.discount;

export default function Purchasing() {
  const { user } = useAuth(); const owner = ["OWNER", "ADMIN"].includes(user?.role);
  const [data, setData] = useState({ requests: [], orders: [], items: [], suppliers: [], locations: [] });
  const [tab, setTab] = useState("requests"); const [modal, setModal] = useState(""); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ urgency: "NORMAL", purpose: "STOCK", reason: "", itemId: "", qty: 1 });
  const [newItem, setNewItem] = useState(false);
  const [itemForm, setItemForm] = useState({ sku: "", name: "", unit: "PCS", isSerialized: false });
  const [formError, setFormError] = useState("");
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [poRequest, setPoRequest] = useState(null);
  const [newSupplier, setNewSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "" });
  const [poForm, setPoForm] = useState({ supplierId: "", prices: {}, tax: 0, shippingCost: 0, discount: 0, paymentTerms: "30 hari", deliveryAddress: "", estimatedArrival: "" });
  const [receiptPo, setReceiptPo] = useState(null);
  const [receiptForm, setReceiptForm] = useState({ locationId: "", locationName: "Gudang Utama", quantities: {}, serials: {}, deliveryNote: "", notes: "" });
  const [paymentPo, setPaymentPo] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "BANK_TRANSFER", reference: "" });
  async function load() {
    setBusy(true);
    try {
      const [overview, inventory] = await Promise.all([
        api("/purchasing/overview"),
        api("/inventory/items"),
      ]);
      setData({ ...overview, items: inventory.items || overview.items || [] });
    } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);
  useLiveRefresh(load);
  async function loadInventoryItems() {
    setItemsLoading(true); setItemsError("");
    try {
      const inventory = await api("/inventory/items");
      const items = Array.isArray(inventory?.items) ? inventory.items : [];
      setData(current => ({ ...current, items }));
      if (!items.length) setItemsError("Endpoint Inventory berhasil dimuat, tetapi tidak mengirim item.");
      return items;
    } catch (err) {
      setItemsError(`Gagal memuat sparepart: ${err.message}`);
      return [];
    } finally { setItemsLoading(false); }
  }
  async function openRequestForm() {
    setModal("request"); setFormError("");
    await loadInventoryItems();
  }
  const stats = useMemo(() => ({ waiting: data.requests.filter(x => x.status === "WAITING_APPROVAL").length, open: data.orders.filter(x => !["FULLY_RECEIVED"].includes(x.status)).length, spend: data.orders.reduce((a, x) => a + x.items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + x.tax + x.shippingCost - x.discount, 0) }), [data]);
  async function createRequest(e) {
    e.preventDefault(); setBusy(true); setFormError("");
    try {
      let itemId = form.itemId;
      if (newItem) {
        const created = await api("/inventory/items", { method: "POST", body: JSON.stringify(itemForm) });
        itemId = created.item.id;
      }
      await api("/purchasing/requests", { method: "POST", body: JSON.stringify({ ...form, items: [{ itemId, qty: form.qty }] }) });
      setModal(""); setForm({ urgency: "NORMAL", purpose: "STOCK", reason: "", itemId: "", qty: 1 });
      setItemForm({ sku: "", name: "", unit: "PCS", isSerialized: false }); setNewItem(false); await load();
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }
  async function approve(r, approved) { await api(`/purchasing/requests/${r.id}/approval`, { method: "PATCH", body: JSON.stringify({ approved, quantities: Object.fromEntries(r.items.map(i => [i.id, i.originalQty])) }) }); load(); }
  function openPoForm(request) {
    setPoRequest(request); setFormError(""); setNewSupplier(!data.suppliers.length);
    setPoForm({ supplierId: data.suppliers[0]?.id || "", prices: Object.fromEntries(request.items.map(i => [i.itemId, ""])), tax: 0, shippingCost: 0, discount: 0, paymentTerms: "30 hari", deliveryAddress: "", estimatedArrival: "" });
    setModal("po");
  }
  async function createPurchaseOrder(e) {
    e.preventDefault(); setBusy(true); setFormError("");
    try {
      let supplierId = poForm.supplierId;
      if (newSupplier) {
        const created = await api("/purchasing/suppliers", { method: "POST", body: JSON.stringify(supplierForm) });
        supplierId = created.supplier.id;
      }
      await api("/purchasing/orders", { method: "POST", body: JSON.stringify({ ...poForm, requestId: poRequest.id, supplierId, items: poRequest.items.map(i => ({ itemId: i.itemId, qty: i.approvedQty ?? i.originalQty, unitPrice: poForm.prices[i.itemId] })) }) });
      setModal(""); setPoRequest(null); setSupplierForm({ name: "", phone: "", email: "" }); setTab("orders"); await load();
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }
  async function changePoStatus(po, status) {
    setBusy(true); try { await api(`/purchasing/orders/${po.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }
  function openReceiptForm(po) {
    setReceiptPo(po); setFormError("");
    setReceiptForm({ locationId: data.locations[0]?.id || "", locationName: "Gudang Utama", quantities: Object.fromEntries(po.items.map(i => [i.id, i.qty - i.receivedQty])), serials: Object.fromEntries(po.items.map(i => [i.id, ""])), deliveryNote: "", notes: "" }); setModal("receipt");
  }
  async function createReceipt(e) {
    e.preventDefault(); setBusy(true); setFormError("");
    try {
      let locationId = receiptForm.locationId;
      if (!locationId) { const created = await api("/inventory/locations", { method: "POST", body: JSON.stringify({ name: receiptForm.locationName }) }); locationId = created.location.id; }
      await api("/purchasing/receipts", { method: "POST", body: JSON.stringify({ purchaseOrderId: receiptPo.id, locationId, deliveryNote: receiptForm.deliveryNote, notes: receiptForm.notes, items: receiptPo.items.map(i => ({ purchaseOrderItemId: i.id, qty: Number(receiptForm.quantities[i.id] || 0), condition: "GOOD", units: i.item.isSerialized ? String(receiptForm.serials[i.id] || "").split("\n").map(x => x.trim()).filter(Boolean).map(serialNumber => ({ serialNumber })) : undefined })).filter(i => i.qty > 0) }) });
      setModal(""); setReceiptPo(null); setTab("receipts"); await load();
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }
  function openPaymentForm(po) {
    const committed = po.payments.filter(p => p.status !== "UNPAID").reduce((sum, p) => sum + p.amount, 0);
    setPaymentPo(po); setFormError(""); setPaymentForm({ amount: String(Math.max(0, poTotal(po) - committed)), method: "BANK_TRANSFER", reference: "" }); setModal("payment");
  }
  async function createPayment(e) {
    e.preventDefault(); setBusy(true); setFormError("");
    try { await api("/purchasing/payments", { method: "POST", body: JSON.stringify({ ...paymentForm, purchaseOrderId: paymentPo.id }) }); setModal(""); setPaymentPo(null); setTab("payments"); await load(); }
    catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }
  async function approvePayment(payment) {
    setBusy(true); try { await api(`/purchasing/payments/${payment.id}/approve`, { method: "PATCH" }); await load(); } finally { setBusy(false); }
  }
  return <div className="purchasing">
    <header className="p-head"><div><div className="eyebrow">PROCURE-TO-PAY</div><h1>Pembelian Sparepart</h1></div><button className="primary" onClick={openRequestForm}><FiPlus/> Buat Permintaan</button></header>
    <section className="p-stats"><article><span>Menunggu persetujuan</span><strong>{stats.waiting}</strong><small>Purchase request</small></article><article><span>PO masih berjalan</span><strong>{stats.open}</strong><small>Belum diterima penuh</small></article><article><span>Nilai pembelian</span><strong>{money(stats.spend)}</strong><small>Seluruh purchase order</small></article></section>
    <nav className="p-tabs"><button className={tab==="requests"?"active":""} onClick={()=>setTab("requests")}>Permintaan Pembelian <i>{data.requests.length}</i></button><button className={tab==="orders"?"active":""} onClick={()=>setTab("orders")}>Pesanan Pembelian <i>{data.orders.length}</i></button><button onClick={()=>setTab("receipts")} className={tab==="receipts"?"active":""}>Penerimaan Barang</button><button onClick={()=>setTab("payments")} className={tab==="payments"?"active":""}>Pembayaran</button><button className="refresh" onClick={load}><FiRefreshCw className={busy?"spin":""}/></button></nav>
    <section className="p-panel">
      {tab==="requests" && <div className="table-wrap"><table><thead><tr><th>Nomor</th><th>Kebutuhan</th><th>Untuk</th><th>Urgensi</th><th>Status</th><th></th></tr></thead><tbody>{data.requests.map(r=>{const hasPo=data.orders.some(po=>po.request?.id===r.id);return <tr key={r.id}><td><b>{r.number}</b><small>{new Date(r.createdAt).toLocaleDateString("id-ID")}</small></td><td>{r.items.map(i=><div key={i.id}>{i.item.name} · {i.approvedQty??i.originalQty} {i.item.unit}</div>)}<small>{r.reason}</small></td><td>{r.purpose || "Stok umum"}</td><td><span className={`urg ${r.urgency}`}>{r.urgency}</span></td><td><span className={`status ${r.status}`}>{hasPo?"PO dibuat":label(r.status)}</span></td><td>{owner&&r.status==="WAITING_APPROVAL"&&<div className="actions"><button onClick={()=>approve(r,true)}><FiCheck/> Setujui</button><button className="reject" onClick={()=>approve(r,false)}>Tolak</button></div>}{r.status==="APPROVED"&&!hasPo&&<button className="create-po-btn" onClick={()=>openPoForm(r)}><FiShoppingCart/> Buat PO</button>}{hasPo&&<button className="view-po-btn" onClick={()=>setTab("orders")}>Lihat PO <FiChevronRight/></button>}</td></tr>})}</tbody></table>{!data.requests.length&&<Empty text="Belum ada permintaan pembelian"/>}</div>}
      {tab==="orders" && <div className="cards">{data.orders.map(po=>{const total=poTotal(po);const paid=po.payments.filter(p=>p.status==="PAID").reduce((s,p)=>s+p.amount,0);return <article className="po-card" key={po.id}><div><span className={`status ${po.status}`}>{label(po.status)}</span><h3>{po.number}</h3><p>{po.supplier.name} · dari {po.request.number}</p></div><div className="po-items">{po.items.map(i=><span key={i.id}>{i.item.name}<b>{i.receivedQty}/{i.qty} {i.item.unit}</b></span>)}</div><div className="po-progress"><span style={{width:`${Math.min(100,po.items.reduce((s,i)=>s+i.receivedQty,0)/Math.max(1,po.items.reduce((s,i)=>s+i.qty,0))*100)}%`}}/></div><footer><div><strong>{money(total)}</strong><small>{po.paymentTerms||"Termin belum diisi"}</small></div>{paid>0&&<small>Dibayar {money(paid)}</small>}</footer><div className="po-actions">{owner&&po.status==="DRAFT"&&<button onClick={()=>changePoStatus(po,"APPROVED")}><FiCheck/> Setujui PO</button>}{owner&&po.status==="APPROVED"&&<button onClick={()=>changePoStatus(po,"SENT_TO_SUPPLIER")}>Tandai dikirim</button>}{["SENT_TO_SUPPLIER","PARTIALLY_RECEIVED"].includes(po.status)&&<button onClick={()=>openReceiptForm(po)}><FiPackage/> Terima barang</button>}{["PARTIALLY_RECEIVED","FULLY_RECEIVED"].includes(po.status)&&total>po.payments.filter(p=>p.status!=="UNPAID").reduce((s,p)=>s+p.amount,0)&&<button onClick={()=>openPaymentForm(po)}><FiShoppingCart/> Ajukan bayar</button>}</div></article>})}{!data.orders.length&&<Empty text="PO akan tampil setelah permintaan disetujui"/>}</div>}
      {tab==="receipts" && <div className="activity-list">{data.orders.flatMap(po=>po.receipts.map(gr=><article key={gr.id}><div className="activity-icon"><FiPackage/></div><div><span className="status FULLY_RECEIVED">Barang diterima</span><h3>{gr.number}</h3><p>{po.number} · {po.supplier.name} · {gr.location?.name}</p><div className="receipt-lines">{gr.items.map(i=><span key={i.id}>{i.purchaseOrderItem?.item?.name}<b>{i.qty} {i.purchaseOrderItem?.item?.unit}</b></span>)}</div></div><time>{new Date(gr.receivedAt).toLocaleDateString("id-ID")}</time></article>))}{!data.orders.some(po=>po.receipts.length)&&<Empty icon={<FiPackage/>} text="Belum ada penerimaan barang"/>}</div>}
      {tab==="payments" && <div className="activity-list">{data.orders.flatMap(po=>po.payments.map(pay=><article key={pay.id}><div className="activity-icon money-icon">Rp</div><div><span className={`status ${pay.status}`}>{label(pay.status)}</span><h3>{pay.number}</h3><p>{po.number} · {po.supplier.name} · {pay.method.replaceAll("_"," ")}</p><strong>{money(pay.amount)}</strong>{pay.reference&&<small>Ref: {pay.reference}</small>}</div><div className="payment-side"><time>{new Date(pay.createdAt).toLocaleDateString("id-ID")}</time>{owner&&pay.status==="WAITING_PAYMENT_APPROVAL"&&<button onClick={()=>approvePayment(pay)}><FiCheck/> Setujui pembayaran</button>}</div></article>))}{!data.orders.some(po=>po.payments.length)&&<Empty icon={<FiShoppingCart/>} text="Belum ada pengajuan pembayaran"/>}</div>}
    </section>
    {modal==="request"&&<div className="overlay" onMouseDown={()=>setModal("")}><form className="modal purchase-request-modal" onSubmit={createRequest} onMouseDown={e=>e.stopPropagation()}><div className="modal-heading"><span className="eyebrow">PERMINTAAN PEMBELIAN</span><h2>Permintaan sparepart baru</h2><p>Isi kebutuhan bengkel atau stok umum.</p></div>
      <div className="item-mode"><button type="button" className={!newItem?"selected":""} onClick={()=>setNewItem(false)}>Pilih dari persediaan</button><button type="button" className={newItem?"selected":""} onClick={()=>setNewItem(true)}><FiPlus/> Sparepart baru</button></div>
      {!newItem ? <label>Sparepart<select required disabled={itemsLoading} value={form.itemId} onChange={e=>setForm({...form,itemId:e.target.value})}><option value="">{itemsLoading ? "Memuat sparepart..." : data.items.length ? "Pilih sparepart" : "Sparepart tidak berhasil dimuat"}</option>{data.items.map(i=><option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}</select>{itemsError&&<span className="items-error">{itemsError}<button type="button" onClick={loadInventoryItems}>Muat ulang</button></span>}{!itemsLoading&&!itemsError&&data.items.length>0&&<small className="items-loaded">{data.items.length} item tersedia, termasuk item dengan stok 0.</small>}</label> : <div className="new-item-box"><div className="grid2"><label>Kode / SKU<input required placeholder="Contoh: BRK-HINO-01" value={itemForm.sku} onChange={e=>setItemForm({...itemForm,sku:e.target.value})}/></label><label>Satuan<select value={itemForm.unit} onChange={e=>setItemForm({...itemForm,unit:e.target.value})}><option>PCS</option><option>SET</option><option>UNIT</option><option>LITER</option></select></label></div><label>Nama sparepart<input required placeholder="Contoh: Kampas rem Hino" value={itemForm.name} onChange={e=>setItemForm({...itemForm,name:e.target.value})}/></label><label className="check-label"><input type="checkbox" checked={itemForm.isSerialized} onChange={e=>setItemForm({...itemForm,isSerialized:e.target.checked})}/> Memiliki serial number</label></div>}
      <div className="request-details"><div className="grid2"><label>Jumlah<input required min="0.01" step="0.01" inputMode="decimal" type="number" value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})}/></label><label>Urgensi<select value={form.urgency} onChange={e=>setForm({...form,urgency:e.target.value})}><option value="NORMAL">Normal</option><option value="URGENT">Urgent</option><option value="CRITICAL">Kritis</option></select></label></div><label>Untuk<select value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value})}><option value="STOCK">Stok umum</option><option value="TRUCK">Truk tertentu</option></select></label><label>Alasan<textarea required rows="3" placeholder="Contoh: stok kampas rem tersisa dua set" value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label></div>{formError&&<div className="form-error">{formError}</div>}<div className="modal-actions"><button className="secondary-btn" type="button" onClick={()=>setModal("")}>Batal</button><button className="primary" disabled={busy}>{busy?"Menyimpan...":"Kirim untuk persetujuan"}</button></div></form></div>}
    {modal==="po"&&poRequest&&<div className="overlay" onMouseDown={()=>setModal("")}><form className="modal purchase-request-modal po-modal" onSubmit={createPurchaseOrder} onMouseDown={e=>e.stopPropagation()}><div className="modal-heading"><span className="eyebrow">PESANAN PEMBELIAN</span><h2>Buat PO dari {poRequest.number}</h2><p>Isi detail pembelian dan harga supplier.</p></div><div className="po-form-body">
      <div className="item-mode"><button type="button" className={!newSupplier?"selected":""} onClick={()=>setNewSupplier(false)}>Supplier terdaftar</button><button type="button" className={newSupplier?"selected":""} onClick={()=>setNewSupplier(true)}><FiPlus/> Supplier baru</button></div>
      {!newSupplier?<label>Supplier<select required value={poForm.supplierId} onChange={e=>setPoForm({...poForm,supplierId:e.target.value})}><option value="">Pilih supplier</option>{data.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>:<div className="new-item-box"><label>Nama supplier<input required value={supplierForm.name} onChange={e=>setSupplierForm({...supplierForm,name:e.target.value})} placeholder="Nama perusahaan / toko"/></label><div className="grid2"><label>Telepon<input value={supplierForm.phone} onChange={e=>setSupplierForm({...supplierForm,phone:e.target.value})} placeholder="08..."/></label><label>Email<input type="email" value={supplierForm.email} onChange={e=>setSupplierForm({...supplierForm,email:e.target.value})} placeholder="supplier@email.com"/></label></div></div>}
      <div className="po-price-list"><div className="section-label">ITEM & HARGA</div>{poRequest.items.map(i=><div className="po-price-row" key={i.id}><div><strong>{i.item.name}</strong><small>{i.item.sku} · {i.approvedQty??i.originalQty} {i.item.unit}</small></div><label>Harga satuan<input required min="0" step="1" type="number" value={poForm.prices[i.itemId]??""} onChange={e=>setPoForm({...poForm,prices:{...poForm.prices,[i.itemId]:e.target.value}})} placeholder="Rp 0"/></label></div>)}</div>
      <div className="grid3"><label>Ongkir<input min="0" step="1" type="number" value={poForm.shippingCost} onChange={e=>setPoForm({...poForm,shippingCost:e.target.value})}/></label><label>Pajak<input min="0" step="1" type="number" value={poForm.tax} onChange={e=>setPoForm({...poForm,tax:e.target.value})}/></label><label>Diskon<input min="0" step="1" type="number" value={poForm.discount} onChange={e=>setPoForm({...poForm,discount:e.target.value})}/></label></div>
      <div className="po-total"><span>Total Pesanan Pembelian</span><strong>{money(poRequest.items.reduce((sum,i)=>sum+(Number(i.approvedQty??i.originalQty)*Number(poForm.prices[i.itemId]||0)),0)+Number(poForm.shippingCost||0)+Number(poForm.tax||0)-Number(poForm.discount||0))}</strong></div>
      <div className="grid2"><label>Termin pembayaran<input value={poForm.paymentTerms} onChange={e=>setPoForm({...poForm,paymentTerms:e.target.value})} placeholder="Contoh: 30 hari"/></label><label>Estimasi tiba<input type="date" value={poForm.estimatedArrival} onChange={e=>setPoForm({...poForm,estimatedArrival:e.target.value})}/></label></div><label>Alamat pengiriman<textarea rows="2" value={poForm.deliveryAddress} onChange={e=>setPoForm({...poForm,deliveryAddress:e.target.value})} placeholder="Alamat bengkel / gudang"/></label>
      {formError&&<div className="form-error">{formError}</div>}</div><div className="modal-actions"><button className="secondary-btn" type="button" onClick={()=>setModal("")}>Batal</button><button className="primary" disabled={busy}>{busy?"Membuat PO...":"Buat Pesanan Pembelian"}</button></div></form></div>}
    {modal==="receipt"&&receiptPo&&<div className="overlay" onMouseDown={()=>setModal("")}><form className="modal purchase-request-modal transaction-modal" onSubmit={createReceipt} onMouseDown={e=>e.stopPropagation()}><div className="modal-heading"><span className="eyebrow">PENERIMAAN BARANG</span><h2>Terima barang {receiptPo.number}</h2><p>Stok bertambah otomatis setelah penerimaan disimpan.</p></div><div className="po-form-body">
      {data.locations.length?<label>Lokasi gudang<select required value={receiptForm.locationId} onChange={e=>setReceiptForm({...receiptForm,locationId:e.target.value})}>{data.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>:<label>Lokasi gudang baru<input required value={receiptForm.locationName} onChange={e=>setReceiptForm({...receiptForm,locationName:e.target.value})}/><small className="items-loaded">Lokasi ini akan dibuat otomatis.</small></label>}
      <div className="po-price-list"><div className="section-label">JUMLAH DITERIMA SEKARANG</div>{receiptPo.items.map(i=>{const remaining=i.qty-i.receivedQty;return <div className={`po-price-row ${i.item.isSerialized?"serialized-receipt-row":""}`} key={i.id}><div><strong>{i.item.name}</strong><small>PO {i.qty} · Sudah diterima {i.receivedQty} · Sisa {remaining} {i.item.unit}</small>{i.item.isSerialized&&<span className="serialized-badge">BERSERIAL</span>}</div><label>Qty diterima<input required min="0" max={remaining} step={i.item.isSerialized?"1":"0.01"} type="number" value={receiptForm.quantities[i.id]??0} onChange={e=>setReceiptForm({...receiptForm,quantities:{...receiptForm.quantities,[i.id]:e.target.value}})}/></label>{i.item.isSerialized&&<label className="serial-entry">Serial number — satu per baris<textarea required={Number(receiptForm.quantities[i.id]||0)>0} rows="3" value={receiptForm.serials[i.id]||""} onChange={e=>setReceiptForm({...receiptForm,serials:{...receiptForm.serials,[i.id]:e.target.value}})} placeholder={`Masukkan ${receiptForm.quantities[i.id]||0} serial number\nContoh: ${i.item.sku}-0001`}/><small>Jumlah baris harus sama dengan qty diterima.</small></label>}</div>})}</div>
      <div className="grid2"><label>Nomor surat jalan<input value={receiptForm.deliveryNote} onChange={e=>setReceiptForm({...receiptForm,deliveryNote:e.target.value})} placeholder="SJ-..."/></label><label>Catatan<input value={receiptForm.notes} onChange={e=>setReceiptForm({...receiptForm,notes:e.target.value})} placeholder="Kondisi barang baik"/></label></div>{formError&&<div className="form-error">{formError}</div>}
      </div><div className="modal-actions"><button className="secondary-btn" type="button" onClick={()=>setModal("")}>Batal</button><button className="primary" disabled={busy}><FiPackage/> {busy?"Menyimpan...":"Terima & tambah stok"}</button></div></form></div>}
    {modal==="payment"&&paymentPo&&<div className="overlay" onMouseDown={()=>setModal("")}><form className="modal purchase-request-modal transaction-modal payment-modal" onSubmit={createPayment} onMouseDown={e=>e.stopPropagation()}><div className="modal-heading"><span className="eyebrow">PENGAJUAN PEMBAYARAN</span><h2>Ajukan pembayaran</h2><p>{paymentPo.number} · {paymentPo.supplier.name}</p></div><div className="po-form-body"><div className="payment-summary"><span>Sisa tagihan</span><strong>{money(poTotal(paymentPo)-paymentPo.payments.filter(p=>p.status!=="UNPAID").reduce((s,p)=>s+p.amount,0))}</strong></div><label>Jumlah dibayar<input required min="1" step="1" type="number" value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})}/></label><div className="grid2"><label>Metode pembayaran<select value={paymentForm.method} onChange={e=>setPaymentForm({...paymentForm,method:e.target.value})}><option value="BANK_TRANSFER">Transfer bank</option><option value="CASH">Tunai</option><option value="OTHER">Lainnya</option></select></label><label>Nomor referensi<input value={paymentForm.reference} onChange={e=>setPaymentForm({...paymentForm,reference:e.target.value})} placeholder="Nomor transfer / kuitansi"/></label></div><div className="approval-note"><FiCheck/><span>Setelah diajukan, Pemilik harus menyetujui sebelum pembayaran berstatus dibayar.</span></div>{formError&&<div className="form-error">{formError}</div>}</div><div className="modal-actions"><button className="secondary-btn" type="button" onClick={()=>setModal("")}>Batal</button><button className="primary" disabled={busy}>{busy?"Mengajukan...":"Ajukan pembayaran"}</button></div></form></div>}
  </div>;
}
function Empty({icon,text}) { return <div className="empty">{icon||<FiShoppingCart/>}<h3>{text}</h3><p>Data dan aktivitas akan muncul di sini.</p></div> }
