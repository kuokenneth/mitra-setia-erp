import { useEffect, useState } from "react";
import { api, uploadFiles } from "../api";
import { FiX } from "react-icons/fi";
import useDialogLifecycle from "./useDialogLifecycle";
import LoadingState from "./LoadingState";
import "./PurchaseReturnDialog.css";

export default function PurchaseReturnDialog({ entries, onClose, onSaved }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({}), [units, setUnits] = useState({});
  const [date, setDate] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()));
  const [reason, setReason] = useState(""), [notes, setNotes] = useState(""), [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const { dialogRef, titleId } = useDialogLifecycle(true, () => !busy && onClose());
  const receiptIds = entries.map(({ gr }) => gr.id).join(",");
  useEffect(() => {
    let active = true;
    api(`/purchasing/returns/candidates?receiptIds=${encodeURIComponent(receiptIds)}`)
      .then(result => { if (active) setRows(result.items); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [receiptIds]);
  async function submit(event) {
    event.preventDefault(); setError("");
    const items = rows.map(row => ({ receiptItemId: row.id, qty: row.serialized ? (units[row.id] || []).length : Number(quantities[row.id] || 0), stockUnitIds: units[row.id] || [] })).filter(row => row.qty > 0);
    if (!items.length) return setError("Pilih minimal satu barang untuk diretur");
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Foto bukti retur harus JPG, PNG, atau WEBP");
    setBusy(true);
    try {
      const proof = file ? (await uploadFiles([file]))[0] : null;
      const result = await api("/purchasing/returns", { method: "POST", body: JSON.stringify({ returnDate: date, reason, notes, proof, items }) });
      await onSaved(result.purchaseReturn);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="purchase-return-overlay" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
    <form className="purchase-return-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onSubmit={submit}>
      <header><div><h2 id={titleId}>Retur Pembelian</h2><p>{entries[0]?.po.supplier.name} · {entries.map(({ gr }) => gr.number).join(", ")}</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Tutup"><FiX /></button></header>
      <div className="purchase-return-body"><p className="purchase-return-notice">Stok berkurang setelah disimpan. Tagihan yang belum dibayar dikurangi; kelebihan pembayaran dicatat sebagai kredit supplier. Dana kas/bank belum berubah.</p>
        <fieldset disabled={busy}><label>Tanggal retur<input required type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
        {loading ? <LoadingState compact rows={2} label="Memuat barang retur" /> : <div className="purchase-return-lines">{rows.map(row => <section key={row.id}><div><strong>{row.name}</strong><small>{row.receiptNumber} · Diterima {row.qty} {row.unit} · Sudah diretur {row.returnedQty}</small><small>{row.unavailableReason || `Tersedia untuk retur: ${row.availableQty} ${row.unit}`}</small></div>{row.serialized ? <div className="purchase-return-serials">{row.units.map(unit => <label key={unit.id}><input type="checkbox" disabled={!!row.unavailableReason} checked={(units[row.id] || []).includes(unit.id)} onChange={event => setUnits(current => ({ ...current, [row.id]: event.target.checked ? [...(current[row.id] || []), unit.id] : current[row.id].filter(id => id !== unit.id) }))} />{unit.serialNumber}</label>)}{!row.units.length && <small>Tidak ada unit tersimpan di lokasi penerimaan.</small>}</div> : <label>Jumlah retur<input aria-label={`Jumlah retur ${row.name}`} type="number" min="0" max={row.availableQty} step="any" disabled={row.availableQty <= 0} value={quantities[row.id] || ""} placeholder="0" onChange={event => setQuantities(current => ({ ...current, [row.id]: event.target.value }))} /></label>}</section>)}</div>}
        <label>Alasan retur<textarea required rows={2} value={reason} onChange={event => setReason(event.target.value)} placeholder="Contoh: barang rusak atau tidak sesuai pesanan" /></label>
        <label>Foto bukti retur (opsional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] || null)} /></label>
        <label>Catatan (opsional)<textarea rows={2} value={notes} onChange={event => setNotes(event.target.value)} /></label></fieldset>
        {error && <p role="alert" className="form-error">{error}</p>}
      </div><footer><button type="button" disabled={busy} onClick={onClose}>Batal</button><button className="primary" disabled={busy || loading}>{busy ? "Menyimpan…" : "Konfirmasi Retur"}</button></footer>
    </form>
  </div>;
}
