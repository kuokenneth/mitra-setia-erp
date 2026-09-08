import { useEffect, useMemo, useState } from "react";
import { FiArchive, FiCamera, FiPackage, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import { api, uploadFiles } from "../api";
import { ProtectedFilePreview } from "../components/ProtectedFile";
import "./MaterialStock.css";
import "./MaterialStockButtons.css";
import "./MaterialStockEntry.css";

const emptyLine=()=>({itemName:"",qty:"",unit:"PCS"});

export default function MaterialStock(){
  const [data,setData]=useState({customers:[],locations:[],storageLocations:[],destinations:[],receipts:[],trips:[]});
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[search,setSearch]=useState("");
  const [file,setFile]=useState(null);
  const [form,setForm]=useState({customerId:"",sourceName:"",receivedAt:new Date().toISOString().slice(0,10),locationId:"",notes:""});
  const [entryLines,setEntryLines]=useState([emptyLine()]);
  const [allocateOpen,setAllocateOpen]=useState(false),[available,setAvailable]=useState([]);
  const [allocation,setAllocation]=useState({customerId:"",tripId:"",destinationLocationId:"",stockKey:"",qty:"",notes:""});

  async function load(){setError("");try{const [result,master]=await Promise.all([api("/material-stock/overview"),api("/customers")]);setData({...result,customers:master.items||result.customers||[]})}catch(e){setError(e.message||"Gagal memuat data Ambang / Material")}}
  async function openReceipt(){setError("");try{const master=await api("/customers");setData(current=>({...current,customers:master.items||[],locations:current.storageLocations||[]}));setOpen(true)}catch(e){setError("Master Customer gagal dimuat: "+e.message)}}
  function openAllocation(){setError("");setData(current=>({...current,locations:current.destinations||[]}));setAllocateOpen(true)}
  useEffect(()=>{load()},[]);
  const rows=useMemo(()=>data.receipts.filter(row=>(row.customer.name+" "+row.itemName+" "+row.deliveryNote).toLowerCase().includes(search.toLowerCase())),[data,search]);
  const totalAvailable=data.receipts.filter(row=>row.qtyRemaining>0).reduce((sum,row)=>sum+row.qtyRemaining,0);
  function updateLine(index,key,value){setEntryLines(lines=>lines.map((line,i)=>i===index?{...line,[key]:value}:line))}
  function removeLine(index){setEntryLines(lines=>lines.length===1?lines:lines.filter((_,i)=>i!==index))}

  async function save(event){
    event.preventDefault();setBusy(true);setError("");
    try{
      if(!file)throw new Error("Foto bukti penerimaan wajib dipilih");
      const lines=entryLines.filter(line=>line.itemName.trim()||line.qty!=="");
      if(!lines.length)throw new Error("Tambahkan minimal satu barang");
      const proof=(await uploadFiles([file]))[0];
      await api("/material-stock/receipts",{method:"POST",body:JSON.stringify({...form,lines:lines.map(line=>({...line,qty:Number(line.qty)})),proof})});
      setOpen(false);setFile(null);setEntryLines([emptyLine()]);setForm(current=>({...current,sourceName:"",notes:""}));await load();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function selectAllocationCustomer(customerId){const result=customerId?await api("/material-stock/available/"+customerId):{groups:[]};setAvailable(result.groups||[]);setAllocation(current=>({...current,customerId,stockKey:"",qty:""}))}
  async function allocate(event){event.preventDefault();setBusy(true);setError("");try{const stock=available.find(x=>x.key===allocation.stockKey);const trip=data.trips.find(x=>x.id===allocation.tripId);if(!stock)throw new Error("Material wajib dipilih");await api("/material-stock/allocate",{method:"POST",body:JSON.stringify({customerId:allocation.customerId,tripId:allocation.tripId,orderId:trip?.orderId||null,destinationLocationId:allocation.destinationLocationId,notes:allocation.notes,lines:[{itemName:stock.itemName,unit:stock.unit,locationId:stock.locationId,qty:Number(allocation.qty)}]})});setAllocateOpen(false);await load()}catch(e){setError(e.message)}finally{setBusy(false)}}

  return <div className="material-stock-page">
    <header><div><span>OPERASIONAL</span><h1>Ambang / Material</h1><p>Stok titipan customer berdasarkan bukti penerimaan.</p></div><div className="material-head-actions"><button className="secondary" onClick={openAllocation}><FiPackage/> Alokasikan ke Trip</button><button onClick={openReceipt}><FiPlus/> Material Masuk</button></div></header>
    {error&&!open&&!allocateOpen&&<div className="material-error">{error}</div>}
    <section className="material-summary"><article><FiArchive/><span><small>BARIS BARANG MASUK</small><strong>{data.receipts.length}</strong></span></article><article><FiPackage/><span><small>SALDO TERSEDIA</small><strong>{totalAvailable.toLocaleString("id-ID")}</strong></span></article><article><FiCamera/><span><small>BUKTI TERSIMPAN</small><strong>{data.receipts.filter(x=>x.proofUrl).length}</strong></span></article></section>
    <div className="material-board"><div className="material-tools"><label><FiSearch/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari customer, barang, atau nomor penerimaan"/></label></div>
      <table><thead><tr><th>Customer / Penerimaan</th><th>Material</th><th>Masuk</th><th>Sudah diangkut</th><th>Sisa</th><th>Lokasi</th><th>Bukti</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><b>{row.customer.name}</b><small>{row.deliveryNote} · {new Date(row.receivedAt).toLocaleDateString("id-ID")}</small></td><td><b>{row.itemName}</b><small>{row.sourceName||"Sumber tidak dicatat"}</small></td><td>{row.qtyReceived.toLocaleString("id-ID")} {row.unit}</td><td>{(row.qtyReceived-row.qtyRemaining).toLocaleString("id-ID")} {row.unit}</td><td><strong className="material-balance">{row.qtyRemaining.toLocaleString("id-ID")} {row.unit}</strong></td><td>{row.location?.name||"—"}</td><td>{row.proofUrl?<ProtectedFilePreview url={row.proofUrl} mimeType={row.proofMimeType} fileName={row.proofFileName||"Bukti penerimaan"} imageStyle={{width:62,height:42,objectFit:"cover",borderRadius:7}}/>:"—"}</td></tr>)}</tbody></table>
      {!rows.length&&<div className="material-empty">Belum ada material masuk.</div>}
    </div>

    {open&&<div className="material-overlay" onMouseDown={()=>setOpen(false)}><form className="material-entry-modal" onSubmit={save} onMouseDown={e=>e.stopPropagation()}>
      <div className="material-modal-head"><span><FiPackage/></span><div><small>MATERIAL MASUK</small><h2>Catat penerimaan barang</h2><p>Satu penerimaan dapat berisi beberapa jenis barang.</p></div><button type="button" onClick={()=>setOpen(false)}>×</button></div>
      <div className="material-form-body">
        <section className="material-entry-meta">
          <label>Customer pemilik<select required value={form.customerId} onChange={e=>setForm({...form,customerId:e.target.value})}><option value="">Pilih dari Master Customer</option>{data.customers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Lokasi penyimpanan<select required value={form.locationId} onChange={e=>setForm({...form,locationId:e.target.value})}><option value="">Pilih Lokasi Inventory</option>{data.locations.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Asal barang<input value={form.sourceName} onChange={e=>setForm({...form,sourceName:e.target.value})} placeholder="Penjual / pemasok (opsional)"/></label>
          <label>Tanggal masuk<input required type="date" value={form.receivedAt} onChange={e=>setForm({...form,receivedAt:e.target.value})}/></label>
        </section>
        <section className="material-entry-document">
          <div className="material-entry-title"><div><small>RINCIAN BARANG</small><h3>Daftar material diterima</h3></div><span>{entryLines.length} baris</span></div>
          <div className="material-entry-line-head"><span>Nama material</span><span>Jumlah</span><span>Satuan</span><span/></div>
          {entryLines.map((line,index)=><div className="material-entry-line" key={index}>
            <input required value={line.itemName} onChange={e=>updateLine(index,"itemName",e.target.value)} placeholder="Contoh: Tabung oksigen"/>
            <input required min=".01" step="any" type="number" value={line.qty} onChange={e=>updateLine(index,"qty",e.target.value)} placeholder="0"/>
            <input required value={line.unit} onChange={e=>updateLine(index,"unit",e.target.value)} placeholder="Contoh: PCS"/>
            <button type="button" disabled={entryLines.length===1} onClick={()=>removeLine(index)} aria-label="Hapus baris"><FiTrash2/></button>
          </div>)}
          <button className="material-add-line" type="button" onClick={()=>setEntryLines(lines=>[...lines,emptyLine()])}><FiPlus/> Tambah barang</button>
        </section>
        <div className="material-entry-bottom">
          <label className="material-upload"><input required type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)}/><FiCamera/><span><b>{file?file.name:"Foto bukti penerimaan"}</b><small>Wajib · satu bukti untuk seluruh barang</small></span></label>
          <label>Catatan<textarea rows="2" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Catatan umum penerimaan (opsional)"/></label>
        </div>
        {error&&<div className="material-error">{error}</div>}
      </div>
      <footer><button type="button" onClick={()=>setOpen(false)}>Batal</button><button className="save" disabled={busy}>{busy?"Menyimpan...":"Simpan Penerimaan"}</button></footer>
    </form></div>}

    {allocateOpen&&<div className="material-overlay" onMouseDown={()=>setAllocateOpen(false)}><form onSubmit={allocate} onMouseDown={e=>e.stopPropagation()}><div className="material-modal-head"><span><FiPackage/></span><div><small>MUAT MATERIAL</small><h2>Alokasikan sebagian ke trip</h2><p>Saldo berkurang sesuai jumlah yang dipilih.</p></div><button type="button" onClick={()=>setAllocateOpen(false)}>×</button></div><div className="material-form-body"><label>Customer pemilik<select required value={allocation.customerId} onChange={e=>selectAllocationCustomer(e.target.value)}><option value="">Pilih Master Customer</option>{data.customers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Trip Ambang / Material<select required value={allocation.tripId} onChange={e=>setAllocation({...allocation,tripId:e.target.value})}><option value="">Pilih trip</option>{data.trips.map(x=><option key={x.id} value={x.id}>{x.tripNo||x.order?.orderNo||"Trip"} · {x.truck?.plateNumber}</option>)}</select></label><label>Material tersedia<select required value={allocation.stockKey} onChange={e=>setAllocation({...allocation,stockKey:e.target.value,qty:""})}><option value="">Pilih material</option>{available.map(x=><option key={x.key} value={x.key}>{x.itemName} · tersedia {x.availableQty} {x.unit} · {x.location?.name||"Tanpa lokasi"}</option>)}</select></label><div className="grid2"><label>Jumlah diangkut<input required min=".01" max={available.find(x=>x.key===allocation.stockKey)?.availableQty||undefined} step="any" type="number" value={allocation.qty} onChange={e=>setAllocation({...allocation,qty:e.target.value})}/></label><label>Tujuan<select required value={allocation.destinationLocationId} onChange={e=>setAllocation({...allocation,destinationLocationId:e.target.value})}><option value="">Pilih tujuan</option>{data.locations.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div><label>Catatan<input value={allocation.notes} onChange={e=>setAllocation({...allocation,notes:e.target.value})}/></label>{error&&<div className="material-error">{error}</div>}</div><footer><button type="button" onClick={()=>setAllocateOpen(false)}>Batal</button><button className="save" disabled={busy}>{busy?"Mengalokasikan...":"Masukkan ke Trip"}</button></footer></form></div>}
  </div>
}
