import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiCheck, FiChevronLeft, FiChevronRight, FiFileText, FiPackage, FiPlus, FiPrinter, FiRefreshCw, FiSearch, FiShoppingCart, FiUploadCloud, FiXCircle } from "react-icons/fi";
import { api, openPrintDocument, uploadFiles } from "../api";
import { useAuth } from "../AuthContext";
import { useLiveRefresh } from "../liveUpdates";
import "./Purchasing.css";
import LoadingState from "../components/LoadingState";
import { ProtectedFilePreview } from "../components/ProtectedFile";
import ImageAnnotationEditor from "../components/ImageAnnotationEditor";
import "./PurchasingForm.css";

const money = n => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
const label = s => ({ OPEN: "Belum dibayar", WAITING_APPROVAL: "Menunggu approval", WAITING_PAYMENT_APPROVAL: "Menunggu approval pembayaran", PAID: "Dibayar", PARTIALLY_PAID: "Dibayar sebagian", APPROVED: "Disetujui", REJECTED: "Ditolak", DRAFT: "Draft", PARTIALLY_RECEIVED: "Diterima sebagian", FULLY_RECEIVED: "Diterima penuh", SENT_TO_SUPPLIER: "Dikirim ke supplier", CANCELLED: "Dibatalkan" }[s] || s);
const poTotal = po => po.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0) + po.tax + po.shippingCost - po.discount;
const receiptValue = receipt => receipt.items.reduce((sum, row) => sum + Number(row.qty) * Number(row.purchaseOrderItem?.unitPrice || 0), 0);
const requestProgress = (request, orders) => {
  if (request.status === "CANCELLED") return { text: "Dibatalkan", className: "CANCELLED" };
  if (request.status === "REJECTED") return { text: "Ditolak", className: "REJECTED" };
  if (request.status === "WAITING_APPROVAL") return { text: "Menunggu persetujuan", className: "WAITING_APPROVAL" };
  if (request.status === "DRAFT") return { text: "Draft", className: "DRAFT" };
  const activeOrders = orders.filter(order => order.request?.id === request.id && order.status !== "CANCELLED");
  if (!activeOrders.length) return { text: "Disetujui · siap dibuat PO", className: "APPROVED" };
  if (activeOrders.every(order => order.status === "FULLY_RECEIVED")) return { text: "Barang sudah tiba", className: "FULLY_RECEIVED", orderNumber: activeOrders.map(order => order.number).join(", ") };
  if (activeOrders.some(order => order.status === "PARTIALLY_RECEIVED" || order.status === "FULLY_RECEIVED")) return { text: "Diterima sebagian", className: "PARTIALLY_RECEIVED", orderNumber: activeOrders.map(order => order.number).join(", ") };
  if (activeOrders.some(order => order.status === "SENT_TO_SUPPLIER")) return { text: "Sudah dipesan · menunggu tiba", className: "SENT_TO_SUPPLIER", orderNumber: activeOrders.map(order => order.number).join(", ") };
  return { text: "PO dibuat · belum dikirim", className: "APPROVED", orderNumber: activeOrders.map(order => order.number).join(", ") };
};

export default function Purchasing() {
  const { user } = useAuth(); const owner = ["OWNER", "ADMIN"].includes(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const emailApprovalHandled = useRef(false);
  const [data, setData] = useState({ requests: [], orders: [], items: [], suppliers: [], locations: [], retreadingUnits: [], bills: [] });
  const [tab, setTab] = useState("requests"); const [modal, setModal] = useState(""); const [busy, setBusy] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestDamagePhoto, setRequestDamagePhoto] = useState(null);
  const [showRequestPhotoEditor, setShowRequestPhotoEditor] = useState(false);
  const [stockAcknowledged, setStockAcknowledged] = useState(false);
  const [form, setForm] = useState({ urgency: "NORMAL", purpose: "STOCK", reason: "", itemId: "", retreadUnitId: "", qty: 1 });
  const [newItem, setNewItem] = useState(false);
  const [retreadRequest, setRetreadRequest] = useState(false);
  const [itemForm, setItemForm] = useState({ sku: "", name: "", unit: "PCS", isSerialized: false });
  const [formError, setFormError] = useState("");
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [poRequest, setPoRequest] = useState(null);
  const [newSupplier, setNewSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "" });
  const [poForm, setPoForm] = useState({ supplierId: "", prices: {}, tax: 0, shippingCost: 0, discount: 0, paymentTerms: "30 hari", deliveryAddress: "", estimatedArrival: "" });
  const [receiptPo, setReceiptPo] = useState(null);
  const [receiptPoIds, setReceiptPoIds] = useState([]);
  const [receiptForm, setReceiptForm] = useState({ locationId: "", locationName: "Gudang Utama", quantities: {}, prices: {}, serials: {}, retreadUnitIds: {}, repairUnitIds: {}, deliveryNote: "", notes: "" });
  const [receiptProofFile, setReceiptProofFile] = useState(null);
  const [paymentPo, setPaymentPo] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "BANK_TRANSFER", reference: "" });
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [billForm, setBillForm] = useState({ supplierId: "", invoiceNumber: "", invoiceDate: "", dueDate: "", notes: "", receiptIds: [], itemIds: [], itemPrices: {} });
  const [billProofFiles, setBillProofFiles] = useState([]);
  const [listFilters, setListFilters] = useState({ requests: "", orders: "", receipts: "", payments: "" });
  const [listPages, setListPages] = useState({ requests: 1, orders: 1, receipts: 1, payments: 1 });
  const [cancelPo, setCancelPo] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
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
  useEffect(() => {
    const requestId = searchParams.get("approveRequest");
    if (!requestId || busy || emailApprovalHandled.current || !data.requests.length) return;
    emailApprovalHandled.current = true;
    const request = data.requests.find(row => row.id === requestId);
    const clearAction = () => setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.delete("approveRequest");
      return next;
    }, { replace: true });
    if (!owner) {
      window.alert("Hanya OWNER atau ADMIN yang dapat menyetujui permintaan pembelian.");
      clearAction();
      return;
    }
    if (!request || request.status !== "WAITING_APPROVAL") {
      window.alert(request ? `Permintaan ${request.number} sudah diproses sebelumnya.` : "Permintaan pembelian tidak ditemukan.");
      clearAction();
      return;
    }
    setBusy(true);
    api(`/purchasing/requests/${request.id}/approval`, {
      method: "PATCH",
      body: JSON.stringify({
        approved: true,
        acknowledgeAvailableStock: true,
        quantities: Object.fromEntries(request.items.map(item => [item.id, item.originalQty])),
      }),
    }).then(() => {
      window.alert(`${request.number} berhasil disetujui.`);
      return load();
    }).catch(error => {
      window.alert(error.message || "Permintaan gagal disetujui.");
    }).finally(() => {
      clearAction();
      setBusy(false);
    });
  }, [busy, data.requests, owner, searchParams, setSearchParams]);
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
    setModal("request"); setFormError(""); setStockAcknowledged(false);
    await loadInventoryItems();
  }
  const selectedRequestItem = useMemo(() => data.items.find(item => item.id === form.itemId) || null, [data.items, form.itemId]);
  const selectedRequestStock = Number(selectedRequestItem?.qtyTotal || 0);
  const receiptOrderOptions = useMemo(() => receiptPo ? data.orders.filter(po => po.supplierId === receiptPo.supplierId && ["SENT_TO_SUPPLIER", "PARTIALLY_RECEIVED"].includes(po.status)) : [], [data.orders, receiptPo]);
  const selectedReceiptOrders = useMemo(() => receiptOrderOptions.filter(po => receiptPoIds.includes(po.id)), [receiptOrderOptions, receiptPoIds]);
  const stats = useMemo(() => ({ waiting: data.requests.filter(x => x.status === "WAITING_APPROVAL").length, open: data.orders.filter(x => !["FULLY_RECEIVED", "CANCELLED"].includes(x.status)).length, spend: data.orders.filter(x => x.status !== "CANCELLED").reduce((a, x) => a + x.items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + x.tax + x.shippingCost - x.discount, 0) }), [data]);
  async function createRequest(e) {
    e.preventDefault();
    if (!newItem && !retreadRequest && selectedRequestStock > 0 && !stockAcknowledged) {
      setStockAcknowledged(true);
      setFormError(`Peringatan: stok ${selectedRequestItem.name} masih tersedia ${selectedRequestStock.toLocaleString("id-ID")} ${selectedRequestItem.unit}. Periksa Inventory terlebih dahulu, atau klik Tetap Kirim Permintaan jika pembelian memang diperlukan.`);
      return;
    }
    setRequestBusy(true); setFormError("");
    try {
      if (!requestDamagePhoto) throw new Error("Foto bukti barang rusak wajib dipilih");
      const damageProof = (await uploadFiles([requestDamagePhoto]))[0];
      let itemId = form.itemId;
      if (newItem) {
        const created = await api("/inventory/items", { method: "POST", body: JSON.stringify(itemForm) });
        itemId = created.item.id;
      }
      await api("/purchasing/requests", { method: "POST", body: JSON.stringify({ ...form, acknowledgeAvailableStock: stockAcknowledged, damageProofUrl: damageProof?.url, damageProofFileName: damageProof?.fileName, damageProofMimeType: damageProof?.mimeType, damageProofSize: damageProof?.size, items: [{ itemId, qty: retreadRequest ? 1 : form.qty, retreadUnitId: retreadRequest ? form.retreadUnitId : undefined }] }) });
      setModal(""); setForm({ urgency: "NORMAL", purpose: "STOCK", reason: "", itemId: "", retreadUnitId: "", qty: 1 });
      setItemForm({ sku: "", name: "", unit: "PCS", isSerialized: false }); setNewItem(false); setRetreadRequest(false); setStockAcknowledged(false); setRequestDamagePhoto(null); await load();
    } catch (err) {
      if (String(err.message || "").startsWith("Stok masih tersedia:")) setStockAcknowledged(true);
      setFormError(err.message);
    } finally { setRequestBusy(false); }
  }
  async function approve(r, approved) {
    const available = approved
      ? r.items.map(row => {
          const catalogItem = data.items.find(item => item.id === row.itemId);
          return { item: catalogItem || row.item, qty: Number(catalogItem?.qtyTotal || 0), special: Boolean(row.tireRetreadId || row.partRepairId) };
        }).filter(row => !row.special && row.qty > 0)
      : [];
    let acknowledgeAvailableStock = false;
    if (available.length) {
      const stockList = available.map(row => `${row.item.name}: ${row.qty.toLocaleString("id-ID")} ${row.item.unit}`).join("\n");
      acknowledgeAvailableStock = window.confirm(`PERINGATAN STOK\n\nBarang berikut masih tersedia di Inventory:\n${stockList}\n\nApakah Anda tetap ingin menyetujui permintaan pembelian ini?`);
      if (!acknowledgeAvailableStock) return;
    }

    const submitApproval = (acknowledged) => api(`/purchasing/requests/${r.id}/approval`, {
      method: "PATCH",
      body: JSON.stringify({ approved, acknowledgeAvailableStock: acknowledged, quantities: Object.fromEntries(r.items.map(i => [i.id, i.originalQty])) }),
    });

    try {
      await submitApproval(acknowledgeAvailableStock);
      await load();
    } catch (err) {
      const message = String(err.message || "Gagal memproses persetujuan");
      if (approved && message.startsWith("Stok masih tersedia:")) {
        const confirmed = window.confirm(`PERINGATAN STOK TERBARU\n\n${message}\n\nTetap setujui permintaan pembelian?`);
        if (confirmed) {
          await submitApproval(true);
          await load();
        }
        return;
      }
      window.alert(message);
    }
  }
  function openPoForm(request) {
    setPoRequest(request); setFormError(""); setNewSupplier(!data.suppliers.length);
    const retreadSupplierId = request.items.find(i => i.tireRetread?.supplierId)?.tireRetread?.supplierId;
    setPoForm({ supplierId: retreadSupplierId || data.suppliers[0]?.id || "", prices: {}, tax: 0, shippingCost: 0, discount: 0, paymentTerms: "Ditagihkan kemudian", deliveryAddress: "", estimatedArrival: "" });
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
      await api("/purchasing/orders", { method: "POST", body: JSON.stringify({ ...poForm, requestId: poRequest.id, supplierId, items: poRequest.items.map(i => ({ purchaseRequestItemId: i.id, itemId: i.itemId, qty: i.tireRetreadId || i.partRepairId ? 1 : (i.approvedQty ?? i.originalQty) })) }) });
      setModal(""); setPoRequest(null); setSupplierForm({ name: "", phone: "", email: "" }); setTab("orders"); await load();
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }
  async function changePoStatus(po, status) {
    setBusy(true); try { await api(`/purchasing/orders/${po.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }
  function openCancelPo(po) {
    setCancelPo(po); setCancellationReason(""); setFormError(""); setModal("cancel-po");
  }
  async function cancelPurchaseOrder(event) {
    event.preventDefault(); setBusy(true); setFormError("");
    try {
      await api(`/purchasing/orders/${cancelPo.id}/cancel`, { method: "PATCH", body: JSON.stringify({ reason: cancellationReason }) });
      setModal(""); setCancelPo(null); setCancellationReason(""); await load();
    } catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  }
  function openReceiptForm(po) {
    setReceiptPo(po); setFormError("");
    const candidates = data.orders.filter(order => order.supplierId === po.supplierId && ["SENT_TO_SUPPLIER", "PARTIALLY_RECEIVED"].includes(order.status));
    const candidateItems = candidates.flatMap(order => order.items);
    setReceiptPoIds([po.id]);
    setReceiptForm({ locationId: data.locations[0]?.id || "", locationName: "Gudang Utama", quantities: Object.fromEntries(candidateItems.map(i => [i.id, i.qty - i.receivedQty])), prices: Object.fromEntries(candidateItems.map(i => [i.id, i.unitPrice > 0 ? String(i.unitPrice) : ""])), serials: Object.fromEntries(candidateItems.map(i => [i.id, ""])), retreadUnitIds: Object.fromEntries(candidateItems.map(i => [i.id, i.tireRetread?.stockUnitId ? [i.tireRetread.stockUnitId] : []])), repairUnitIds: Object.fromEntries(candidateItems.map(i => [i.id, i.partRepair?.stockUnitId ? [i.partRepair.stockUnitId] : []])), deliveryNote: "", notes: "" });
    setReceiptProofFile(null);
    setModal("receipt");
  }
  function toggleReceiptOrder(poId) {
    setReceiptPoIds(current => current.includes(poId) ? current.filter(id => id !== poId) : [...current, poId]);
  }
  async function createReceipt(e) {
    e.preventDefault(); setBusy(true); setFormError("");
    try {
      let locationId = receiptForm.locationId;
      if (!locationId) { const created = await api("/inventory/locations", { method: "POST", body: JSON.stringify({ name: receiptForm.locationName }) }); locationId = created.location.id; }
      if (!receiptProofFile) throw new Error("Foto bukti surat penerimaan wajib dipilih");
      const proof = (await uploadFiles([receiptProofFile]))[0];
      if (!selectedReceiptOrders.length) throw new Error("Pilih minimal satu PO yang diterima");
      const receiptItems = po => po.items.map(i => ({
          purchaseOrderItemId: i.id,
          qty: Number(receiptForm.quantities[i.id] || 0),
          unitPrice: Number(receiptForm.prices[i.id] || 0),
          condition: "GOOD",
          units: i.item.isSerialized ? [
            ...(receiptForm.retreadUnitIds[i.id] || []).map(retreadUnitId => ({ retreadUnitId })),
            ...(receiptForm.repairUnitIds[i.id] || []).map(repairUnitId => ({ repairUnitId })),
            ...String(receiptForm.serials[i.id] || "").split("\n").map(x => x.trim()).filter(Boolean).map(serialNumber => ({ serialNumber })),
          ] : undefined,
        })).filter(i => i.qty > 0);
      await api("/purchasing/receipts/batch", { method: "POST", body: JSON.stringify({ locationId, deliveryNote: receiptForm.deliveryNote, deliveryNoteProofUrl: proof?.url, deliveryNoteFileName: proof?.fileName, deliveryNoteMimeType: proof?.mimeType, deliveryNoteSize: proof?.size, notes: receiptForm.notes, receipts: selectedReceiptOrders.map(po => ({ purchaseOrderId: po.id, items: receiptItems(po) })) }) });
      setModal(""); setReceiptPo(null); setReceiptPoIds([]); setTab("receipts"); await load();
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }
  function openBillForm() {
    const first = data.suppliers.find(supplier => data.orders.some(po => po.supplierId === supplier.id && po.receipts.some(receipt => receipt.items.some(item => !item.supplierBillItem))));
    setBillForm({ supplierId: first?.id || "", invoiceNumber: "", invoiceDate: new Date().toISOString().slice(0, 10), dueDate: "", notes: "", receiptIds: [], itemIds: [], itemPrices: {} });
    setBillProofFiles([]); setFormError(""); setModal("bill");
  }
  function toggleBillReceipt(receipt) {
    setBillForm(current => {
      const removing = current.receiptIds.includes(receipt.id);
      const selected = removing ? current.receiptIds.filter(id => id !== receipt.id) : [...current.receiptIds, receipt.id];
      const availableItems = receipt.items.filter(item => !item.supplierBillItem);
      const itemIds = removing ? current.itemIds.filter(id => !availableItems.some(item => item.id === id)) : [...new Set([...current.itemIds, ...availableItems.map(item => item.id)])];
      const itemPrices = { ...current.itemPrices };
      if (removing) availableItems.forEach(item => delete itemPrices[item.id]);
      else availableItems.forEach(item => { itemPrices[item.id] = item.purchaseOrderItem?.unitPrice > 0 ? String(item.purchaseOrderItem.unitPrice) : ""; });
      return { ...current, receiptIds: selected, itemIds, itemPrices };
    });
  }
  function toggleBillItem(item) {
    setBillForm(current => {
      const removing = current.itemIds.includes(item.id);
      const itemIds = removing ? current.itemIds.filter(id => id !== item.id) : [...current.itemIds, item.id];
      const itemPrices = { ...current.itemPrices };
      if (removing) delete itemPrices[item.id];
      else itemPrices[item.id] = item.purchaseOrderItem?.unitPrice > 0 ? String(item.purchaseOrderItem.unitPrice) : "";
      return { ...current, itemIds, itemPrices };
    });
  }
  async function createBill(e) {
    e.preventDefault(); setBusy(true); setFormError("");
    try {
      if (!billProofFiles.length) throw new Error("Lampirkan minimal satu invoice supplier untuk proses pencocokan");
      const proofs = await uploadFiles(billProofFiles);
      await api("/purchasing/bills", { method: "POST", body: JSON.stringify({ ...billForm, proofs }) });
      setModal(""); setTab("payments"); await load();
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }
  function openPaymentForm(bill) {
    const committed = bill.payments.filter(p => p.status !== "UNPAID").reduce((sum, p) => sum + p.amount, 0);
    setPaymentPo(bill); setFormError(""); setPaymentForm({ amount: String(Math.max(0, bill.amount - committed)), method: "BANK_TRANSFER", reference: "" }); setPaymentProofFile(null); setModal("payment");
  }
  async function createPayment(e) {
    e.preventDefault(); setBusy(true); setFormError("");
    try { if (!paymentProofFile) throw new Error("Bukti pembayaran wajib dipilih"); const proof=(await uploadFiles([paymentProofFile]))[0]; await api("/purchasing/payments", { method: "POST", body: JSON.stringify({ ...paymentForm, supplierBillId: paymentPo.id, proofUrl:proof?.url, proofFileName:proof?.fileName, proofMimeType:proof?.mimeType, proofSize:proof?.size }) }); setModal(""); setPaymentPo(null); setPaymentProofFile(null); setTab("payments"); await load(); }
    catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }
  async function approvePayment(payment) {
    setBusy(true); try { await api(`/purchasing/payments/${payment.id}/approve`, { method: "PATCH" }); await load(); } finally { setBusy(false); }
  }
  const billReceipts = data.orders.filter(po=>po.supplierId===billForm.supplierId).flatMap(po=>po.receipts.map(receipt=>({receipt,po}))).filter(({receipt})=>billForm.receiptIds.includes(receipt.id));
  const selectableBillReceipts = data.orders.filter(po=>po.supplierId===billForm.supplierId).flatMap(po=>po.receipts.map(receipt=>({receipt,po}))).filter(({receipt})=>receipt.items.some(item=>!item.supplierBillItem));
  const billItemCandidates = billReceipts.flatMap(({receipt,po})=>receipt.items.filter(item=>!item.supplierBillItem).map(item=>({item,receipt,po})));
  const billItems = billItemCandidates.filter(({item})=>billForm.itemIds.includes(item.id));
  const billTotal = billItems.reduce((sum,row)=>sum+Number(row.item.qty||0)*Number(billForm.itemPrices[row.item.id]||0),0);
  const billPricesValid = billItems.length > 0 && billItems.every(({item}) => {
    const value = billForm.itemPrices[item.id];
    const price = Number(value);
    return value !== undefined && value !== "" && Number.isFinite(price) && price >= 0 && (item.purchaseOrderItem?.partRepairId || price > 0);
  });
  const normalizedQuery = String(listFilters[tab] || "").trim().toLocaleLowerCase("id-ID");
  const matchesQuery = values => !normalizedQuery || values.flat(Infinity).filter(Boolean).join(" ").toLocaleLowerCase("id-ID").includes(normalizedQuery);
  const filteredRequests = data.requests.filter(row => matchesQuery([row.number,row.reason,row.purpose,row.status,row.maintenance?.truck?.plateNumber,row.items.map(item=>[item.item?.name,item.item?.sku])]));
  const filteredOrders = data.orders.filter(row => matchesQuery([row.number,row.status,row.supplier?.name,row.request?.number,row.items.map(item=>[item.item?.name,item.item?.sku])]));
  const filteredReceipts = data.orders.flatMap(po=>po.receipts.map(gr=>({po,gr}))).filter(({po,gr})=>matchesQuery([gr.number,gr.deliveryNote,gr.notes,gr.location?.name,po.number,po.supplier?.name,gr.items.map(item=>[item.purchaseOrderItem?.item?.name,item.purchaseOrderItem?.item?.sku])]));
  const filteredBills = data.bills.filter(row => matchesQuery([row.number,row.invoiceNumber,row.status,row.supplier?.name,row.receipts.map(item=>item.receipt?.number),row.items?.map(item=>item.receiptItem?.purchaseOrderItem?.item?.name)]));
  const PAGE_SIZE = 10;
  const pageSlice = rows => rows.slice((Math.max(1,listPages[tab]||1)-1)*PAGE_SIZE,Math.max(1,listPages[tab]||1)*PAGE_SIZE);
  const pagedRequests = pageSlice(filteredRequests), pagedOrders = pageSlice(filteredOrders), pagedReceipts = pageSlice(filteredReceipts), pagedBills = pageSlice(filteredBills);
  const currentTotal = ({requests:filteredRequests.length,orders:filteredOrders.length,receipts:filteredReceipts.length,payments:filteredBills.length})[tab]||0;
  const searchPlaceholder = ({requests:"Cari nomor permintaan, barang, alasan, atau kendaraan…",orders:"Cari nomor PO, supplier, permintaan, atau barang…",receipts:"Cari nomor penerimaan, PO, supplier, surat jalan, atau barang…",payments:"Cari nomor invoice, supplier, penerimaan, atau barang…"})[tab];
  return <div className="purchasing">
    <header className="p-head"><div><div className="eyebrow">BENGKEL & PEMBELIAN</div><h1>Pembelian</h1><p>Kelola permintaan, pemesanan, penerimaan, hingga tagihan supplier.</p></div><button className="primary p-new-request" onClick={openRequestForm}><FiPlus/> Buat Permintaan</button></header>
    <section className="p-stats"><article><div className="p-stat-icon"><FiFileText/></div><div><span>Perlu persetujuan</span><strong>{stats.waiting}</strong><small>Permintaan menunggu tindakan</small></div></article><article><div className="p-stat-icon"><FiShoppingCart/></div><div><span>PO berjalan</span><strong>{stats.open}</strong><small>Belum diterima penuh</small></div></article><article><div className="p-stat-icon"><FiPackage/></div><div><span>Nilai pembelian</span><strong>{money(stats.spend)}</strong><small>Akumulasi seluruh PO</small></div></article></section>
    <nav className="p-tabs"><button className={tab==="requests"?"active":""} onClick={()=>setTab("requests")}>Permintaan Pembelian <i>{data.requests.length}</i></button><button className={tab==="orders"?"active":""} onClick={()=>setTab("orders")}>Pesanan Pembelian <i>{data.orders.length}</i></button><button onClick={()=>setTab("receipts")} className={tab==="receipts"?"active":""}>Penerimaan Barang</button><button onClick={()=>setTab("payments")} className={tab==="payments"?"active":""}>Tagihan & Pembayaran <i>{data.bills.length}</i></button><button className="refresh" onClick={load}><FiRefreshCw className={busy?"spin":""}/></button></nav>
    <section className={`p-panel ${busy && !data.requests.length && !data.orders.length ? "initial-loading" : ""}`}>
      {busy && !data.requests.length && !data.orders.length && <LoadingState label="Memuat pembelian" note="Menyiapkan permintaan, PO, penerimaan, dan pembayaran…" rows={5} />}
      <div className="p-list-tools"><label><FiSearch/><input value={listFilters[tab]||""} onChange={e=>{setListFilters(current=>({...current,[tab]:e.target.value}));setListPages(current=>({...current,[tab]:1}))}} placeholder={searchPlaceholder}/></label><span>Maksimal 10 data per halaman</span></div>
      {tab==="requests" && <div className="table-wrap"><table className="request-table"><thead><tr><th>Nomor</th><th>Kebutuhan</th><th>Bukti foto</th><th>Untuk</th><th>Urgensi</th><th>Status proses</th><th></th></tr></thead><tbody>{pagedRequests.map(r=>{const progress=requestProgress(r,data.orders);const hasPo=data.orders.some(po=>po.request?.id===r.id&&po.status!=="CANCELLED");return <tr key={r.id} className={r.maintenance?"direct-maintenance-row":""}><td><b>{r.number}</b><small>{new Date(r.createdAt).toLocaleDateString("id-ID")}</small>{r.maintenance&&<span className="direct-use-badge">UNTUK SERVIS</span>}</td><td>{r.items.map(i=><div key={i.id}>{i.item.name} · {i.approvedQty??i.originalQty} {i.item.unit}</div>)}<small>{r.reason}</small></td><td>{r.damageProofUrl?<div className="request-row-proof"><ProtectedFilePreview url={r.damageProofUrl} mimeType={r.damageProofMimeType} fileName={r.damageProofFileName||"Bukti barang rusak"} imageStyle={{width:64,height:48,objectFit:"cover",borderRadius:8}} onError={error=>setFormError(error.message)}/><span><b>Lihat bukti</b><small>Barang rusak</small></span></div>:<span className="request-proof-empty">Tidak ada bukti</span>}</td><td>{r.maintenance?<><b>Servis {r.maintenance?.truck?.plateNumber||"kendaraan"}</b><small>{r.maintenance?.title}</small></>:r.purpose||"Stok umum"}</td><td><span className={`urg ${r.urgency}`}>{r.urgency}</span></td><td><span className={`status ${progress.className}`}>{progress.text}</span>{progress.orderNumber&&<small className="request-progress-order">{progress.orderNumber}</small>}{r.status==="APPROVED"&&r.approvedBy?.name&&<small className="approval-person">Disetujui oleh {r.approvedBy.name}</small>}</td><td>{owner&&r.status==="WAITING_APPROVAL"&&<div className="actions request-decision-actions"><button type="button" className="approve" onClick={()=>approve(r,true)}><FiCheck/> Setujui</button><button type="button" className="reject" onClick={()=>approve(r,false)}>Tolak</button></div>}{r.status==="APPROVED"&&!hasPo&&<button type="button" className="create-po-btn" onClick={()=>openPoForm(r)}><FiShoppingCart/> Buat PO</button>}{hasPo&&<button type="button" className="view-po-btn" onClick={()=>setTab("orders")}>Lihat PO <FiChevronRight/></button>}</td></tr>})}</tbody></table>{!busy&&!filteredRequests.length&&<Empty text={normalizedQuery?"Permintaan tidak ditemukan":"Belum ada permintaan pembelian"}/>}</div>}
      {tab==="orders" && <div className="cards">{pagedOrders.map(po=>{const total=poTotal(po);return <article className={`po-card ${po.status==="CANCELLED"?"cancelled":""}`} key={po.id}><div><span className={`status ${po.status}`}>{label(po.status)}</span><h3>{po.number}</h3><p>{po.supplier.name} · dari {po.request.number}</p>{po.status==="CANCELLED"&&<small className="po-cancellation-note">Alasan: {po.cancellationReason}</small>}</div><div className="po-items">{po.items.map(i=><span key={i.id}>{i.item.name}<b>{i.receivedQty}/{i.qty} {i.item.unit}</b></span>)}</div><div className="po-progress"><span style={{width:`${Math.min(100,po.items.reduce((s,i)=>s+i.receivedQty,0)/Math.max(1,po.items.reduce((s,i)=>s+i.qty,0))*100)}%`}}/></div><footer><div><strong>{total>0?money(total):"Harga menyusul"}</strong><small>{total>0?"Sesuai tagihan supplier":po.paymentTerms||"Ditagihkan kemudian"}</small></div></footer><div className="po-actions"><button type="button" onClick={()=>openPrintDocument(`/purchasing/orders/${po.id}/print`).catch(err=>setFormError(err.message))}><FiPrinter/> Print PO</button>{owner&&["DRAFT","APPROVED"].includes(po.status)&&<button type="button" onClick={()=>changePoStatus(po,"SENT_TO_SUPPLIER")}>Tandai dikirim</button>}{owner&&["DRAFT","APPROVED","SENT_TO_SUPPLIER"].includes(po.status)&&!po.receipts.length&&<button type="button" className="cancel-po-btn" onClick={()=>openCancelPo(po)}><FiXCircle/> Batalkan PO</button>}{["SENT_TO_SUPPLIER","PARTIALLY_RECEIVED"].includes(po.status)&&<button type="button" className="receive" onClick={()=>openReceiptForm(po)}><FiPackage/> Terima barang</button>}</div></article>})}{!filteredOrders.length&&<Empty text={normalizedQuery?"Pesanan tidak ditemukan":"PO akan tampil setelah permintaan disetujui"}/>}</div>}
      {tab==="receipts" && <div className="receipt-list">{pagedReceipts.map(({po,gr})=><article className="receipt-card" key={gr.id}>
        <header className="receipt-card-head"><div className="receipt-card-identity"><span className="receipt-card-icon"><FiPackage/></span><div><span className="status FULLY_RECEIVED">Barang diterima</span><h3>{gr.number}</h3><p>{po.number} · {po.supplier.name}</p></div></div><div className="receipt-card-date"><small>TANGGAL TERIMA</small><time>{new Date(gr.receivedAt).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})}</time><span>{gr.location?.name||"Lokasi tidak dicatat"}</span></div></header>
        <div className="receipt-card-body"><section className="receipt-goods"><header><span>Barang diterima</span><b>{gr.items.length} jenis</b></header><div className="receipt-goods-table"><div className="receipt-goods-heading"><span>Nama barang</span><span>Jumlah</span></div>{gr.items.map(i=><div className="receipt-goods-row" key={i.id}><span><strong>{i.purchaseOrderItem?.item?.name}</strong><small>{i.purchaseOrderItem?.item?.sku||"Tanpa SKU"}</small></span><b>{i.qty} {i.purchaseOrderItem?.item?.unit}</b></div>)}</div></section>
          <aside className="receipt-summary"><div className="receipt-summary-row"><span><small>STATUS TAGIHAN</small><strong>{gr.items.every(item=>item.supplierBillItem)?`${gr.supplierBillLines.length} invoice · lengkap`:gr.items.some(item=>item.supplierBillItem)?`${gr.supplierBillLines.length} invoice · sebagian`:"Belum ditagihkan"}</strong></span><FiFileText/></div><div className="receipt-summary-row"><span><small>NILAI PENERIMAAN</small><strong>{receiptValue(gr)>0?money(receiptValue(gr)):"Harga belum tersedia"}</strong></span></div>{gr.deliveryNoteProofUrl&&<div className="receipt-proof"><div className="receipt-proof-preview"><ProtectedFilePreview url={gr.deliveryNoteProofUrl} mimeType={gr.deliveryNoteMimeType} fileName={gr.deliveryNoteFileName||"Bukti surat penerimaan"} imageStyle={{width:"100%",height:126,objectFit:"cover"}} onError={e=>setFormError(e.message)}/></div><span><small>BUKTI PENERIMAAN</small><strong title={gr.deliveryNoteFileName||"Foto tersimpan"}>{gr.deliveryNoteFileName||"Foto tersimpan"}</strong></span></div>}</aside>
        </div>
        <footer className="receipt-card-foot"><span>Surat jalan: <b>{gr.deliveryNote||"—"}</b>{gr.notes&&<em>· {gr.notes}</em>}</span><button type="button" onClick={()=>openPrintDocument(`/purchasing/receipts/${gr.id}/print`).catch(err=>setFormError(err.message))}><FiPrinter/> Cetak penerimaan</button></footer>
      </article>)}{!filteredReceipts.length&&<Empty icon={<FiPackage/>} text={normalizedQuery?"Penerimaan tidak ditemukan":"Belum ada penerimaan barang"}/>}</div>}
      {tab==="payments" && <div className="supplier-billing"><div className="supplier-billing-toolbar"><div><strong>Tagihan supplier</strong><small>Gabungkan penerimaan, cocokkan barang dan harga, lalu ajukan pembayaran.</small></div><button className="primary supplier-bill-create" onClick={openBillForm}><span><FiPlus/></span><b>Catat Tagihan Supplier</b></button></div><div className="activity-list">{pagedBills.map(bill=>{const paid=bill.payments.filter(row=>row.status==="PAID").reduce((sum,row)=>sum+row.amount,0);return <article key={bill.id}><div className="activity-icon money-icon">Rp</div><div><span className={`status ${bill.status}`}>{label(bill.status)}</span><h3>{bill.invoiceNumber}</h3><p>{bill.supplier.name} · {bill.receipts.length} penerimaan · {bill.items?.length||0} barang dicocokkan</p><strong>{money(bill.amount)}</strong><small>Sisa {money(bill.amount-paid)}</small>{bill.payments.filter(pay=>pay.status==="PAID"&&pay.approvedBy?.name).map(pay=><small className="approval-person" key={pay.id}>Pembayaran {money(pay.amount)} disetujui oleh {pay.approvedBy.name}</small>)}</div><div className="payment-side"><time>{new Date(bill.invoiceDate).toLocaleDateString("id-ID")}</time>{bill.status!=="PAID"&&!bill.payments.some(row=>row.status==="WAITING_PAYMENT_APPROVAL")&&<button onClick={()=>openPaymentForm(bill)}>Ajukan pembayaran</button>}{bill.payments.map(pay=>owner&&pay.status==="WAITING_PAYMENT_APPROVAL"?<div className="payment-approval-proof" key={pay.id}>{pay.proofUrl&&<ProtectedFilePreview url={pay.proofUrl} mimeType={pay.proofMimeType} fileName={pay.proofFileName||"Bukti pembayaran"} imageStyle={{width:72,height:48,objectFit:"cover",borderRadius:7}} onError={e=>setFormError(e.message)}/>}<button onClick={()=>approvePayment(pay)}><FiCheck/> Setujui {money(pay.amount)}</button></div>:null)}</div></article>})}{!filteredBills.length&&<Empty icon={<FiShoppingCart/>} text={normalizedQuery?"Tagihan tidak ditemukan":"Belum ada tagihan dari supplier"}/>}</div></div>}
      <ListPager total={currentTotal} page={listPages[tab]||1} pageSize={PAGE_SIZE} onPage={page=>setListPages(current=>({...current,[tab]:page}))}/>
    </section>
    {modal==="request"&&<div className="overlay" onMouseDown={()=>setModal("")}><form className="modal purchase-request-modal request-redesign-modal" onSubmit={createRequest} onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-heading request-modal-heading"><div className="request-heading-icon"><FiShoppingCart/></div><div><span className="eyebrow">PERMINTAAN PEMBELIAN</span><h2>Buat permintaan barang</h2><p>Pilih barang yang dibutuhkan, lalu kirim untuk persetujuan.</p></div><button type="button" className="request-close" onClick={()=>setModal("")}>×</button></div>
      <div className="request-modal-body">
        <section className="request-form-section"><div className="request-section-title"><b>01</b><span><strong>Sumber barang</strong><small>Pilih dari katalog, ban masak, atau daftarkan barang baru.</small></span></div><div className="item-mode request-item-mode"><button type="button" className={!newItem&&!retreadRequest?"selected":""} onClick={()=>{setNewItem(false);setRetreadRequest(false);setStockAcknowledged(false);setFormError("");}}><FiPackage/> Katalog inventory</button><button type="button" className={retreadRequest?"selected":""} onClick={()=>{setNewItem(false);setRetreadRequest(true);setStockAcknowledged(false);setFormError("");}}><FiRefreshCw/> Ban masak</button><button type="button" className={newItem?"selected":""} onClick={()=>{setNewItem(true);setRetreadRequest(false);setStockAcknowledged(false);setFormError("");}}><FiPlus/> Barang baru</button></div>
          <div className="request-item-fields">{retreadRequest ? <label>Ban berstatus retreading<select required value={form.retreadUnitId} onChange={e=>{setStockAcknowledged(false);setForm({...form,retreadUnitId:e.target.value,qty:1});}}><option value="">Pilih nomor seri ban</option>{(data.retreadingUnits||[]).map(unit=>{const active=unit.tireRetreads?.[0];return <option key={unit.id} value={unit.id}>{unit.serialNumber||unit.barcode||unit.id} — {unit.item?.name} → {active?.toItem?.name}</option>})}</select>{data.retreadingUnits?.length?<small className="items-loaded">Item tujuan mengikuti pilihan saat Lepas & Masak.</small>:<small className="field-help">Belum ada ban berstatus retreading.</small>}</label> : !newItem ? <label>Pilih barang<select required disabled={itemsLoading} value={form.itemId} onChange={e=>{setStockAcknowledged(false);setFormError("");setForm({...form,itemId:e.target.value});}}><option value="">{itemsLoading ? "Memuat barang..." : data.items.length ? "Cari dan pilih barang" : "Barang tidak berhasil dimuat"}</option>{data.items.map(i=><option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}</select>{itemsError&&<span className="items-error">{itemsError}<button type="button" onClick={loadInventoryItems}>Muat ulang</button></span>}{!itemsLoading&&!itemsError&&data.items.length>0&&<small className="items-loaded">{data.items.length} barang tersedia termasuk stok kosong.</small>}{selectedRequestStock > 0 && <span className="stock-available-warning">⚠ Stok masih tersedia: <b>{selectedRequestStock.toLocaleString("id-ID")} {selectedRequestItem.unit}</b>. Periksa Inventory sebelum membeli.</span>}</label> : <div className="new-item-box"><div className="grid2"><label>Kode / SKU<input required placeholder="Contoh: BRK-HINO-01" value={itemForm.sku} onChange={e=>setItemForm({...itemForm,sku:e.target.value})}/></label><label>Satuan<select value={itemForm.unit} onChange={e=>setItemForm({...itemForm,unit:e.target.value})}><option>PCS</option><option>SET</option><option>UNIT</option><option>LITER</option></select></label></div><label>Nama barang<input required placeholder="Contoh: Kampas rem Hino" value={itemForm.name} onChange={e=>setItemForm({...itemForm,name:e.target.value})}/></label><label className="check-label"><input type="checkbox" checked={itemForm.isSerialized} onChange={e=>setItemForm({...itemForm,isSerialized:e.target.checked})}/> Barang memiliki nomor serial</label></div>}</div>
        </section>
        <section className="request-form-section"><div className="request-section-title"><b>02</b><span><strong>Detail kebutuhan</strong><small>Tentukan jumlah, tujuan, dan tingkat urgensinya.</small></span></div><div className="request-details"><div className="grid2"><label>Jumlah dibutuhkan<input required min="0.01" step="0.01" inputMode="decimal" type="number" disabled={retreadRequest} value={retreadRequest?1:form.qty} onChange={e=>setForm({...form,qty:e.target.value})}/></label><label>Urgensi<select value={form.urgency} onChange={e=>setForm({...form,urgency:e.target.value})}><option value="NORMAL">Normal</option><option value="URGENT">Mendesak</option><option value="CRITICAL">Kritis</option></select></label></div><label>Tujuan permintaan<select value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value})}><option value="STOCK">Persediaan umum</option><option value="TRUCK">Kebutuhan truk tertentu</option></select></label><label>Alasan permintaan<textarea required rows="3" placeholder={retreadRequest?"Contoh: penerimaan kembali ban selesai dimasak":"Jelaskan alasan dan kebutuhan barang ini..."} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label></div></section>
        <label className={`request-damage-proof ${requestDamagePhoto?"has-file":""}`}><input required type="file" accept="image/*" capture="environment" onChange={e=>{const file=e.target.files?.[0]||null;setRequestDamagePhoto(file);setShowRequestPhotoEditor(Boolean(file));}}/><span className="request-proof-icon"><FiUploadCloud/></span><span className="request-proof-copy"><strong>{requestDamagePhoto?"Foto siap dikirim":"Ketuk untuk tambah foto barang rusak"}</strong><small>{requestDamagePhoto?`${requestDamagePhoto.name} · Ketuk kembali untuk mengganti`:"Gunakan kamera atau pilih foto dari galeri"}</small></span></label>
        {requestDamagePhoto&&<button type="button" className="request-proof-annotate" onClick={()=>setShowRequestPhotoEditor(true)}>Tandai bagian yang rusak</button>}
        {formError&&<div className="form-error">{formError}</div>}
      </div><div className="modal-actions"><span className="request-footer-note">Permintaan akan masuk ke daftar persetujuan.</span><button className="secondary-btn" type="button" disabled={requestBusy} onClick={()=>setModal("")}>Batal</button><button className="primary" disabled={requestBusy||itemsLoading}><FiCheck/>{requestBusy?"Mengirim...":stockAcknowledged?"Tetap Kirim Permintaan":"Kirim Permintaan"}</button></div></form></div>}
    {modal==="po"&&poRequest&&<div className="overlay" onMouseDown={()=>setModal("")}><form className="modal purchase-request-modal po-modal" onSubmit={createPurchaseOrder} onMouseDown={e=>e.stopPropagation()}><div className="modal-heading"><span className="eyebrow">PESANAN PEMBELIAN</span><h2>Buat PO dari {poRequest.number}</h2><p>Pilih supplier dan pastikan barang serta jumlah yang dipesan.</p></div><div className="po-form-body">
      <div className="item-mode"><button type="button" className={!newSupplier?"selected":""} onClick={()=>setNewSupplier(false)}>Supplier terdaftar</button><button type="button" className={newSupplier?"selected":""} onClick={()=>setNewSupplier(true)}><FiPlus/> Supplier baru</button></div>
      {!newSupplier?<label>Supplier<select required value={poForm.supplierId} onChange={e=>setPoForm({...poForm,supplierId:e.target.value})}><option value="">Pilih supplier</option>{data.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>:<div className="new-item-box"><label>Nama supplier<input required value={supplierForm.name} onChange={e=>setSupplierForm({...supplierForm,name:e.target.value})} placeholder="Nama perusahaan / toko"/></label><div className="grid2"><label>Telepon<input value={supplierForm.phone} onChange={e=>setSupplierForm({...supplierForm,phone:e.target.value})} placeholder="08..."/></label><label>Email<input type="email" value={supplierForm.email} onChange={e=>setSupplierForm({...supplierForm,email:e.target.value})} placeholder="supplier@email.com"/></label></div></div>}
      <div className="po-price-list"><div className="section-label">BARANG YANG DIPESAN</div>{poRequest.items.map(i=><div className="po-price-row" key={i.id}><div><strong>{i.item.name}</strong><small>{i.item.sku}</small></div><b>{i.approvedQty??i.originalQty} {i.item.unit}</b></div>)}</div>
      <div className="approval-note"><span className="approval-note-icon"><FiFileText/></span><span><strong>Harga menyusul dari tagihan supplier</strong><small>PO mencatat barang dan jumlah. Harga dicocokkan per barang setelah invoice supplier datang.</small></span></div>
      <div className="grid2"><label>Termin pembayaran<input value={poForm.paymentTerms} onChange={e=>setPoForm({...poForm,paymentTerms:e.target.value})} placeholder="Contoh: 30 hari"/></label><label>Estimasi tiba<input type="date" value={poForm.estimatedArrival} onChange={e=>setPoForm({...poForm,estimatedArrival:e.target.value})}/></label></div><label>Alamat pengiriman<textarea rows="2" value={poForm.deliveryAddress} onChange={e=>setPoForm({...poForm,deliveryAddress:e.target.value})} placeholder="Alamat bengkel / gudang"/></label>
      {formError&&<div className="form-error">{formError}</div>}</div><div className="modal-actions"><button className="secondary-btn" type="button" onClick={()=>setModal("")}>Batal</button><button className="primary" disabled={busy}>{busy?"Membuat PO...":"Buat Pesanan Pembelian"}</button></div></form></div>}
    {modal==="cancel-po"&&cancelPo&&<div className="overlay" onMouseDown={()=>setModal("")}><form className="modal purchase-request-modal po-cancel-modal" onSubmit={cancelPurchaseOrder} onMouseDown={e=>e.stopPropagation()}><div className="modal-heading"><span className="eyebrow">PEMBATALAN PESANAN PEMBELIAN</span><h2>Batalkan {cancelPo.number}</h2><p>PO tetap tersimpan sebagai riwayat dan tidak akan dapat menerima barang.</p></div><div className="po-form-body"><div className="po-cancel-warning"><FiXCircle/><span><strong>{cancelPo.supplier?.name}</strong><small>{cancelPo.items?.map(item=>`${item.item?.name} · ${item.qty} ${item.item?.unit}`).join(", ")}</small></span></div><label>Alasan pembatalan<textarea required minLength="3" rows="4" value={cancellationReason} onChange={event=>setCancellationReason(event.target.value)} placeholder="Contoh: kebutuhan dibatalkan atau supplier tidak dapat memenuhi pesanan"/></label>{formError&&<div className="form-error">{formError}</div>}</div><div className="modal-actions"><button className="secondary-btn" type="button" disabled={busy} onClick={()=>setModal("")}>Kembali</button><button className="danger-btn" disabled={busy||cancellationReason.trim().length<3}>{busy?"Membatalkan...":"Batalkan PO"}</button></div></form></div>}
    {modal==="receipt"&&receiptPo&&<div className="overlay" onMouseDown={()=>setModal("")}><form className="modal purchase-request-modal transaction-modal batch-receipt-modal" onSubmit={createReceipt} onMouseDown={e=>e.stopPropagation()}><div className="modal-heading"><span className="eyebrow">PENERIMAAN BARANG GABUNGAN</span><h2>Terima barang dari {receiptPo.supplier.name}</h2><p>Pilih beberapa PO dari supplier yang sama. Satu surat jalan dan satu bukti dapat digunakan untuk seluruh penerimaan ini.</p>{selectedReceiptOrders.some(po=>(po.request.directUse||po.request.purpose==="MAINTENANCE_STOCK_REQUEST")&&po.request.maintenance)&&<div className="direct-receipt-notice"><strong>LANGSUNG DIPAKAI KE MOBIL</strong><small>{selectedReceiptOrders.filter(po=>(po.request.directUse||po.request.purpose==="MAINTENANCE_STOCK_REQUEST")&&po.request.maintenance).map(po=>`${po.request.maintenance.truck?.plateNumber||"Kendaraan"} · ${po.request.maintenance.title}`).join(" | ")}</small><small>Sistem mencatat IN ke gudang lalu OUT ke mobil servis secara otomatis.</small></div>}</div><div className="po-form-body">
      <section className="batch-receipt-orders"><header><span><small>PILIH PESANAN</small><strong>PO dalam pengiriman yang sama</strong></span><b>{selectedReceiptOrders.length} dipilih</b></header><div>{receiptOrderOptions.map(po=>{const selected=receiptPoIds.includes(po.id);const direct=(po.request.directUse||po.request.purpose==="MAINTENANCE_STOCK_REQUEST")&&po.request.maintenance;return <label key={po.id} className={selected?"selected":""}><input type="checkbox" checked={selected} onChange={()=>toggleReceiptOrder(po.id)}/><i>{selected&&<FiCheck/>}</i><span><strong>{po.number}{direct?` · UNTUK ${po.request.maintenance.truck?.plateNumber||"SERVIS"}`:""}</strong><small>{po.items.map(item=>`${item.item.name} · ${item.qty-item.receivedQty} ${item.item.unit}`).join(", ")}</small>{direct&&<small>Langsung dipakai: {po.request.maintenance.title}</small>}</span></label>})}</div></section>
      {data.locations.length?<label>Lokasi gudang<select required value={receiptForm.locationId} onChange={e=>setReceiptForm({...receiptForm,locationId:e.target.value})}>{data.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>:<label>Lokasi gudang baru<input required value={receiptForm.locationName} onChange={e=>setReceiptForm({...receiptForm,locationName:e.target.value})}/><small className="items-loaded">Lokasi ini akan dibuat otomatis.</small></label>}
      <div className="po-price-list receipt-entry-table"><div className="receipt-table-title"><span><small>RINCIAN PENERIMAAN</small><strong>Jumlah diterima sekarang</strong></span><b>{selectedReceiptOrders.reduce((sum,po)=>sum+po.items.length,0)} barang · {selectedReceiptOrders.length} PO</b></div><div className="receipt-table-head"><span>Barang</span><span>Sisa PO</span><span>Qty diterima</span><span>Harga satuan sementara</span></div>{selectedReceiptOrders.flatMap(po=>po.items.map(i=>{
        const remaining=i.qty-i.receivedQty;
        const typedSerialCount=String(receiptForm.serials[i.id]||"").split("\n").map(x=>x.trim()).filter(Boolean).length;
        const requiredSerials=!i.tireRetreadId&&!i.partRepairId&&Number(receiptForm.quantities[i.id]||0)>0;
        return <div className={`po-price-row receipt-item-row ${i.item.isSerialized?"serialized-receipt-row":""}`} key={i.id}><div className="receipt-item-identity"><strong>{i.item.name}</strong><small>{po.number} · {i.item.sku||"Tanpa SKU"}</small><div><span>PO {i.qty} {i.item.unit}</span><span>Sudah diterima {i.receivedQty}</span>{i.item.isSerialized&&<em>BERSERIAL</em>}</div></div><div className="receipt-remaining"><strong>{remaining}</strong><small>{i.item.unit}</small></div><label className="receipt-qty-field"><span>Qty diterima</span><input required min="0" max={remaining} step={i.item.isSerialized?"1":"0.01"} type="number" value={receiptForm.quantities[i.id]??0} onChange={e=>setReceiptForm({...receiptForm,quantities:{...receiptForm.quantities,[i.id]:e.target.value}})}/></label><label className="receipt-price-field"><span>Harga satuan sementara</span><div><span>Rp</span><input required={Number(receiptForm.quantities[i.id]||0)>0} disabled={!(Number(receiptForm.quantities[i.id]||0)>0)} min="1" step="1" type="number" value={receiptForm.prices[i.id]??""} onChange={e=>setReceiptForm({...receiptForm,prices:{...receiptForm.prices,[i.id]:e.target.value}})} placeholder="0"/></div></label>
          {i.item.isSerialized&&<div className="serial-entry">
            {i.tireRetread?<div className="retread-purchase-picker"><strong>Ban selesai retreading</strong><div className="retread-unit-option selected"><span><b>{i.tireRetread.stockUnit?.serialNumber||i.tireRetread.stockUnit?.barcode||i.tireRetread.stockUnitId}</b><small>{i.tireRetread.fromItem?.name} → {i.tireRetread.toItem?.name}</small></span></div><small>Serial sudah ditentukan dari Permintaan Pembelian dan akan masuk stok setelah penerimaan disetujui.</small></div>:i.partRepair?<div className="retread-purchase-picker"><strong>Sparepart selesai diperbaiki</strong><div className="retread-unit-option selected"><span><b>{i.partRepair.stockUnit?.serialNumber||i.partRepair.stockUnit?.barcode||i.partRepair.stockUnitId}</b><small>Unit yang sama akan kembali ke Inventory berstatus tersedia.</small></span></div><small>Tidak membuat unit baru; riwayat perbaikan tetap terhubung ke servis asal.</small></div>:<label>Serial baru — satu per baris<textarea required={requiredSerials} rows="3" value={receiptForm.serials[i.id]||""} onChange={e=>setReceiptForm({...receiptForm,serials:{...receiptForm.serials,[i.id]:e.target.value}})} placeholder={`Masukkan ${receiptForm.quantities[i.id]||0} serial number\nContoh: ${i.item.sku}-0001`}/><small>Serial baru: {typedSerialCount} · Harus sama dengan qty diterima.</small></label>}
          </div>}
        </div>}))}<div className="receipt-table-note"><span>i</span><p><strong>Harga ini masih sementara.</strong> Nilainya dipakai untuk biaya armada sampai invoice supplier dicocokkan.</p></div></div>
      <div className="grid2"><label>Nomor surat jalan<input value={receiptForm.deliveryNote} onChange={e=>setReceiptForm({...receiptForm,deliveryNote:e.target.value})} placeholder="SJ-..."/></label><label>Catatan<input value={receiptForm.notes} onChange={e=>setReceiptForm({...receiptForm,notes:e.target.value})} placeholder="Kondisi barang baik"/></label></div><label className="receipt-upload required-proof"><input required type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>setReceiptProofFile(e.target.files?.[0]||null)}/><span className="receipt-upload-icon"><FiUploadCloud/></span><span><strong>{receiptProofFile?receiptProofFile.name:"Foto surat penerimaan / surat jalan"}</strong><small>{receiptProofFile?"Foto siap disimpan · klik untuk mengganti":"Wajib · ambil foto atau pilih JPG, PNG, WEBP"}</small></span></label>{formError&&<div className="form-error">{formError}</div>}
      </div><div className="modal-actions"><button className="secondary-btn" type="button" onClick={()=>setModal("")}>Batal</button><button className="primary" disabled={busy||!selectedReceiptOrders.length}><FiPackage/> {busy?"Menyimpan...":selectedReceiptOrders.some(po=>(po.request.directUse||po.request.purpose==="MAINTENANCE_STOCK_REQUEST")&&po.request.maintenance)?`Terima ${selectedReceiptOrders.length} PO & langsung pakai`:`Terima ${selectedReceiptOrders.length} PO & tambah stok`}</button></div></form></div>}
    <ImageAnnotationEditor file={requestDamagePhoto} open={showRequestPhotoEditor} onClose={()=>setShowRequestPhotoEditor(false)} onSave={file=>{setRequestDamagePhoto(file);setShowRequestPhotoEditor(false);}}/>
    {modal==="bill"&&<div className="overlay" onMouseDown={()=>setModal("")}><form className="modal purchase-request-modal transaction-modal supplier-bill-modal" onSubmit={createBill} onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-heading"><span className="eyebrow">REKONSILIASI TAGIHAN SUPPLIER</span><h2>Cocokkan invoice dengan barang diterima</h2><p>Pilih surat penerimaan, lalu masukkan harga tiap barang sesuai invoice supplier.</p></div>
      <div className="po-form-body"><label>Supplier<select required value={billForm.supplierId} onChange={e=>setBillForm({...billForm,supplierId:e.target.value,receiptIds:[],itemIds:[],itemPrices:{}})}><option value="">Pilih supplier</option>{data.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <section className="bill-receipt-section"><header><span><small>LANGKAH 1</small><strong>Pilih penerimaan yang ditagihkan</strong></span><b>{billForm.receiptIds.length} dipilih</b></header><div className="bill-receipt-picker">{selectableBillReceipts.map(({receipt,po})=>{const selected=billForm.receiptIds.includes(receipt.id);return <label key={receipt.id} className={selected?"selected":""}><input type="checkbox" checked={selected} onChange={()=>toggleBillReceipt(receipt)}/><i>{selected&&<FiCheck/>}</i><span><strong>{receipt.number}</strong><small>{po.number} · Surat jalan {receipt.deliveryNote||"-"}</small><em>{new Date(receipt.receivedAt).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})}</em></span><b>{receipt.items.length} barang</b></label>})}{billForm.supplierId&&!selectableBillReceipts.length&&<div className="bill-receipt-empty"><FiCheck/><span><strong>Tidak ada penerimaan tersedia</strong><small>Semua penerimaan supplier ini sudah masuk tagihan.</small></span></div>}</div></section>
        {!!billReceipts.length&&<div className="bill-proof-compare">{billReceipts.map(({receipt})=><div key={receipt.id}>{receipt.deliveryNoteProofUrl?<ProtectedFilePreview url={receipt.deliveryNoteProofUrl} mimeType={receipt.deliveryNoteMimeType} fileName={receipt.deliveryNoteFileName||"Bukti surat penerimaan"} imageStyle={{width:88,height:60,objectFit:"cover",borderRadius:7}} onError={e=>setFormError(e.message)}/>:<FiFileText/>}<span><strong>{receipt.number}</strong><small>Surat jalan {receipt.deliveryNote||"-"}</small></span></div>)}</div>}
        {!!billItemCandidates.length&&<div className="bill-item-pricing"><div className="bill-item-row heading"><span>Pilih · Barang / Penerimaan</span><span>Jumlah</span><span>Harga satuan</span><span>Jumlah harga</span></div>{billItemCandidates.map(({item,receipt})=>{const selected=billForm.itemIds.includes(item.id);return <div className={`bill-item-row ${selected?"selected":"muted"}`} key={item.id}><span className="bill-item-choice"><button type="button" aria-label={`${selected?"Batalkan":"Pilih"} ${item.purchaseOrderItem?.item?.name}`} onClick={()=>toggleBillItem(item)}>{selected&&<FiCheck/>}</button><span><strong>{item.purchaseOrderItem?.item?.name}</strong><small>{receipt.number} · {item.purchaseOrderItem?.item?.sku}{item.purchaseOrderItem?.partRepairId ? " · Perbaikan (boleh Rp0)" : ""}</small></span></span><b>{item.qty} {item.purchaseOrderItem?.item?.unit}</b><input disabled={!selected} required={selected} min={item.purchaseOrderItem?.partRepairId?"0":"1"} step="1" type="number" value={billForm.itemPrices[item.id]??""} onChange={e=>setBillForm(current=>({...current,itemPrices:{...current.itemPrices,[item.id]:e.target.value}}))} placeholder={selected?"Rp 0":"Tidak dipilih"}/><strong>{selected?money(Number(item.qty||0)*Number(billForm.itemPrices[item.id]||0)):"—"}</strong></div>})}</div>}
        <div className="grid3"><label>Nomor invoice<input required value={billForm.invoiceNumber} onChange={e=>setBillForm({...billForm,invoiceNumber:e.target.value})}/></label><label>Tanggal invoice<input required type="date" value={billForm.invoiceDate} onChange={e=>setBillForm({...billForm,invoiceDate:e.target.value})}/></label><label>Jatuh tempo<input type="date" value={billForm.dueDate} onChange={e=>setBillForm({...billForm,dueDate:e.target.value})}/></label></div>
        <div className="po-total"><span>Total hasil pencocokan</span><strong>{money(billTotal)}</strong></div>
        <label className="receipt-upload required-proof bill-multi-upload"><input required={!billProofFiles.length} multiple type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>{const incoming=[...(e.target.files||[])];setBillProofFiles(current=>[...current,...incoming.filter(file=>!current.some(saved=>saved.name===file.name&&saved.size===file.size&&saved.lastModified===file.lastModified))]);e.target.value=""}}/><span className="receipt-upload-icon"><FiUploadCloud/></span><span><strong>{billProofFiles.length?`${billProofFiles.length} file invoice dipilih`:"Lampirkan invoice supplier"}</strong><small>Klik lagi untuk menambahkan file · JPG, PNG, WEBP atau PDF</small></span></label>{!!billProofFiles.length&&<div className="bill-upload-list">{billProofFiles.map((file,index)=><div key={`${file.name}-${file.size}-${file.lastModified}`}><span><b>{index+1}</b><strong title={file.name}>{file.name}</strong><small>{(file.size/1024/1024).toLocaleString("id-ID",{maximumFractionDigits:2})} MB</small></span><button type="button" onClick={()=>setBillProofFiles(files=>files.filter((_,fileIndex)=>fileIndex!==index))} aria-label={`Hapus ${file.name}`}>×</button></div>)}</div>}<label>Catatan<textarea rows="2" value={billForm.notes} onChange={e=>setBillForm({...billForm,notes:e.target.value})}/></label>{formError&&<div className="form-error">{formError}</div>}
      </div><div className="modal-actions"><button className="secondary-btn" type="button" onClick={()=>setModal("")}>Batal</button><button className="primary" disabled={busy||!billPricesValid||!billProofFiles.length}>{busy?"Mencocokkan...":"Cocok & Simpan Tagihan"}</button></div></form></div>}
    {modal==="payment"&&paymentPo&&<div className="overlay" onMouseDown={()=>setModal("")}><form className="modal purchase-request-modal transaction-modal payment-modal" onSubmit={createPayment} onMouseDown={e=>e.stopPropagation()}><div className="modal-heading"><span className="eyebrow">PENGAJUAN PEMBAYARAN</span><h2>Ajukan pembayaran</h2><p>{paymentPo.invoiceNumber} <span>•</span> {paymentPo.supplier.name}</p></div><div className="po-form-body"><div className="payment-summary"><span>Sisa tagihan<small>Total yang masih harus dibayar</small></span><strong>{money(paymentPo.amount-paymentPo.payments.filter(p=>p.status!=="UNPAID").reduce((s,p)=>s+p.amount,0))}</strong></div><label className="payment-amount-field">Jumlah dibayar<div className="money-input"><span>Rp</span><input required min="1" step="1" type="number" value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})}/></div></label><div className="grid2 payment-form-grid"><label><span className="payment-field-label">Metode pembayaran</span><select value={paymentForm.method} onChange={e=>setPaymentForm({...paymentForm,method:e.target.value})}><option value="BANK_TRANSFER">Transfer bank</option><option value="CASH">Tunai</option><option value="OTHER">Lainnya</option></select></label><label><span className="payment-field-label">Nomor referensi <small>Opsional</small></span><input value={paymentForm.reference} onChange={e=>setPaymentForm({...paymentForm,reference:e.target.value})} placeholder="Nomor transfer / kuitansi"/></label></div><label className="receipt-upload required-proof"><input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setPaymentProofFile(e.target.files?.[0]||null)}/><span className="receipt-upload-icon"><FiUploadCloud/></span><span><strong>{paymentProofFile?paymentProofFile.name:"Lampirkan bukti pembayaran"}</strong><small>Wajib · foto transfer, kuitansi, atau PDF pembayaran</small></span></label><div className="approval-note"><span className="approval-note-icon"><FiCheck/></span><span><strong>Memerlukan persetujuan Pemilik</strong><small>Pengajuan belum dianggap dibayar sebelum disetujui.</small></span></div>{formError&&<div className="form-error">{formError}</div>}</div><div className="modal-actions"><button className="secondary-btn" type="button" onClick={()=>setModal("")}>Batal</button><button className="primary" disabled={busy||!paymentProofFile}>{busy?"Mengajukan...":"Ajukan pembayaran"}</button></div></form></div>}
  </div>;
}
function ListPager({total,page,pageSize,onPage}) { const pages=Math.max(1,Math.ceil(total/pageSize));const current=Math.min(page,pages);if(total<=pageSize)return null;return <nav className="p-list-pager" aria-label="Navigasi halaman"><span>Menampilkan {(current-1)*pageSize+1}–{Math.min(current*pageSize,total)} dari {total}</span><div><button type="button" disabled={current<=1} onClick={()=>onPage(current-1)}><FiChevronLeft/> Sebelumnya</button><b>Halaman {current} / {pages}</b><button type="button" disabled={current>=pages} onClick={()=>onPage(current+1)}>Berikutnya <FiChevronRight/></button></div></nav> }
function Empty({icon,text}) { return <div className="empty">{icon||<FiShoppingCart/>}<h3>{text}</h3><p>Data dan aktivitas akan muncul di sini.</p></div> }
