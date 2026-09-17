import { useEffect, useMemo, useState } from "react";
import { FiArchive, FiArrowRight, FiCalendar, FiCamera, FiFileText, FiMapPin, FiPackage, FiPlus, FiSearch, FiTrash2, FiTruck, FiUser, FiX } from "react-icons/fi";
import { api, uploadFiles } from "../api";
import { openProtectedFile } from "../components/ProtectedFile";
import "./MaterialStock.css";
import "./MaterialStockButtons.css";
import "./MaterialStockEntry.css";
import "./MaterialStockProof.css";

const emptyLine=()=>({itemName:"",qty:"",unit:"PCS"});

export default function MaterialStock(){
  const [data,setData]=useState({customers:[],locations:[],storageLocations:[],destinations:[],receipts:[],trips:[]});
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[search,setSearch]=useState("");
  const [file,setFile]=useState(null);
  const [form,setForm]=useState({customerId:"",sourceName:"",receivedAt:new Date().toISOString().slice(0,10),locationId:"",notes:""});
  const [entryLines,setEntryLines]=useState([emptyLine()]);
  const [allocateOpen,setAllocateOpen]=useState(false),[available,setAvailable]=useState([]);
  const [allocation,setAllocation]=useState({customerId:"",tripId:"",destinationLocationId:"",selected:{},notes:""});

  async function load(){setError("");try{const [result,master]=await Promise.all([api("/material-stock/overview"),api("/customers")]);setData({...result,customers:master.items||result.customers||[]})}catch(e){setError(e.message||"Gagal memuat data Ambang / Material")}}
  async function openReceipt(){setError("");try{const master=await api("/customers");setData(current=>({...current,customers:master.items||[],locations:current.storageLocations||[]}));setOpen(true)}catch(e){setError("Master Customer gagal dimuat: "+e.message)}}
  function openAllocation(){setError("");setAllocation({customerId:"",tripId:"",destinationLocationId:"",selected:{},notes:""});setAvailable([]);setData(current=>({...current,locations:current.destinations||[]}));setAllocateOpen(true)}
  useEffect(()=>{load()},[]);
  const rows=useMemo(()=>{
    const groups=new Map();
    for(const receipt of data.receipts){
      const key=[receipt.customerId,receipt.itemName.trim().toLocaleLowerCase("id-ID"),receipt.unit.trim().toUpperCase(),receipt.locationId||""].join("|");
      const group=groups.get(key)||{...receipt,id:key,qtyReceived:0,qtyRemaining:0,receipts:[],proofs:[],deliveryNotes:[]};
      group.qtyReceived+=Number(receipt.qtyReceived||0);group.qtyRemaining+=Number(receipt.qtyRemaining||0);group.receipts.push(receipt);
      if(receipt.proofUrl)group.proofs.push(receipt);if(receipt.deliveryNote)group.deliveryNotes.push(receipt.deliveryNote);groups.set(key,group);
    }
    const needle=search.trim().toLocaleLowerCase("id-ID");
    return [...groups.values()].filter(row=>!needle||(row.customer.name+" "+row.itemName+" "+row.deliveryNotes.join(" ")+" "+(row.location?.name||"")).toLocaleLowerCase("id-ID").includes(needle));
  },[data.receipts,search]);
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
  async function selectAllocationCustomer(customerId){const result=customerId?await api("/material-stock/available/"+customerId):{groups:[]};setAvailable(result.groups||[]);setAllocation(current=>({...current,customerId,selected:{}}))}
  function toggleAllocationStock(stock,checked){setAllocation(current=>({...current,selected:{...current.selected,[stock.key]:{checked,qty:checked?(current.selected[stock.key]?.qty||""):""}}}))}
  function updateAllocationQty(stockKey,qty){setAllocation(current=>({...current,selected:{...current.selected,[stockKey]:{checked:true,qty}}}))}
  async function allocate(event){event.preventDefault();setBusy(true);setError("");try{const selectedStocks=available.filter(stock=>allocation.selected[stock.key]?.checked);const trip=data.trips.find(x=>x.id===allocation.tripId);if(!selectedStocks.length)throw new Error("Pilih minimal satu material");const lines=selectedStocks.map(stock=>({itemName:stock.itemName,unit:stock.unit,locationId:stock.locationId,qty:Number(allocation.selected[stock.key]?.qty)}));if(lines.some(line=>!(line.qty>0)))throw new Error("Jumlah setiap material terpilih wajib diisi");await api("/material-stock/allocate",{method:"POST",body:JSON.stringify({customerId:allocation.customerId,tripId:allocation.tripId,orderId:trip?.order?.cargoCategory==="MATERIAL"?trip.orderId:null,destinationLocationId:allocation.destinationLocationId,notes:allocation.notes,lines})});setAllocateOpen(false);await load()}catch(e){setError(e.message)}finally{setBusy(false)}}

  return <div className="material-stock-page">
    <header><div><span>OPERASIONAL</span><h1>Ambang / Material</h1><p>Stok titipan customer berdasarkan bukti penerimaan.</p></div><div className="material-head-actions"><button className="secondary" onClick={openAllocation}><FiPackage/> Alokasikan ke Trip</button><button onClick={openReceipt}><FiPlus/> Material Masuk</button></div></header>
    {error&&!open&&!allocateOpen&&<div className="material-error">{error}</div>}
    <section className="material-summary"><article><FiArchive/><span><small>JENIS STOK CUSTOMER</small><strong>{rows.length}</strong></span></article><article><FiPackage/><span><small>SALDO TERSEDIA</small><strong>{totalAvailable.toLocaleString("id-ID")}</strong></span></article><article><FiCamera/><span><small>BUKTI TERSIMPAN</small><strong>{data.receipts.filter(x=>x.proofUrl).length}</strong></span></article></section>
    <div className="material-board"><div className="material-tools"><label><FiSearch/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari customer, barang, atau nomor penerimaan"/></label></div>
      <table><thead><tr><th>Customer / Penerimaan</th><th>Material</th><th>Total Masuk</th><th>Sudah diangkut</th><th>Sisa</th><th>Lokasi</th><th>Bukti</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><b>{row.customer.name}</b><small>{row.receipts.length} penerimaan · terakhir {new Date(row.receipts[0].receivedAt).toLocaleDateString("id-ID")}</small></td><td><b>{row.itemName}</b><small>{row.unit} · saldo digabung</small></td><td>{row.qtyReceived.toLocaleString("id-ID")} {row.unit}</td><td>{(row.qtyReceived-row.qtyRemaining).toLocaleString("id-ID")} {row.unit}</td><td><strong className="material-balance">{row.qtyRemaining.toLocaleString("id-ID")} {row.unit}</strong></td><td>{row.location?.name||"—"}</td><td><details className="material-proof-menu"><summary><FiCamera/> {row.proofs.length} bukti</summary><div>{row.proofs.map(proof=><button type="button" key={proof.id} onClick={()=>openProtectedFile(proof.proofUrl).catch(e=>setError(e.message))}><span><b>{proof.number}</b><small>{new Date(proof.receivedAt).toLocaleDateString("id-ID")}</small></span><FiArrowRight/></button>)}</div></details></td></tr>)}</tbody></table>
      {!rows.length&&<div className="material-empty">Belum ada material masuk.</div>}
    </div>

    {open&&<div className="material-overlay" onMouseDown={()=>setOpen(false)}><form className="material-entry-modal material-modal-shell" onSubmit={save} onMouseDown={e=>e.stopPropagation()}>
      <div className="material-modal-head"><span><FiPackage/></span><div><small>PENERIMAAN INVENTORY</small><h2>Material Masuk</h2><p>Catat pemilik, lokasi penyimpanan, rincian barang, dan bukti penerimaan.</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="Tutup"><FiX/></button></div>
      <div className="material-form-body">
        <div className="material-modal-guide"><span className="active"><b>1</b><em>Informasi penerimaan</em></span><i/><span><b>2</b><em>Rincian material</em></span><i/><span><b>3</b><em>Bukti & catatan</em></span></div>
        <section className="material-entry-meta">
          <div className="material-section-heading"><span><FiFileText/></span><div><small>LANGKAH 1</small><h3>Informasi penerimaan</h3><p>Tentukan kepemilikan dan posisi stok.</p></div></div>
          <div className="material-entry-meta-grid">
            <label><span><FiUser/> Customer pemilik <b>Wajib</b></span><select required value={form.customerId} onChange={e=>setForm({...form,customerId:e.target.value})}><option value="">Pilih dari Master Customer</option>{data.customers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label><span><FiMapPin/> Lokasi penyimpanan <b>Wajib</b></span><select required value={form.locationId} onChange={e=>setForm({...form,locationId:e.target.value})}><option value="">Pilih Lokasi Inventory</option>{data.locations.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label><span><FiTruck/> Asal barang</span><input value={form.sourceName} onChange={e=>setForm({...form,sourceName:e.target.value})} placeholder="Penjual atau pemasok (opsional)"/></label>
            <label><span><FiCalendar/> Tanggal masuk <b>Wajib</b></span><input required type="date" value={form.receivedAt} onChange={e=>setForm({...form,receivedAt:e.target.value})}/></label>
          </div>
        </section>
        <section className="material-entry-document">
          <div className="material-entry-title"><div><small>LANGKAH 2 · RINCIAN BARANG</small><h3>Daftar material diterima</h3><p>Tambahkan satu baris untuk setiap jenis dan satuan barang.</p></div><span>{entryLines.length} baris</span></div>
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
          <label className={`material-upload ${file?"has-file":""}`}><input required type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)}/><i><FiCamera/></i><span><small>LANGKAH 3 · BUKTI WAJIB</small><b>{file?file.name:"Ambil foto bukti penerimaan"}</b><em>{file?"Bukti siap disimpan":"JPG, PNG, atau WEBP · satu bukti untuk seluruh barang"}</em></span></label>
          <label className="material-notes-field"><span><FiFileText/> Catatan penerimaan</span><textarea rows="3" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Tambahkan kondisi barang atau keterangan lain (opsional)"/></label>
        </div>
        {error&&<div className="material-error">{error}</div>}
      </div>
      <footer><span><FiArchive/><small>Saldo akan bertambah setelah penerimaan disimpan.</small></span><div><button type="button" onClick={()=>setOpen(false)}>Batal</button><button className="save" disabled={busy}>{busy?"Menyimpan...":"Simpan Penerimaan"}</button></div></footer>
    </form></div>}

    {allocateOpen&&<div className="material-overlay" onMouseDown={()=>setAllocateOpen(false)}><form className="material-allocation-modal material-modal-shell" onSubmit={allocate} onMouseDown={e=>e.stopPropagation()}>
      <div className="material-modal-head allocation"><span><FiTruck/></span><div><small>PENGELUARAN INVENTORY</small><h2>Alokasikan ke Trip</h2><p>Pilih stok customer, armada tujuan, dan jumlah material yang akan dimuat.</p></div><button type="button" onClick={()=>setAllocateOpen(false)} aria-label="Tutup"><FiX/></button></div>
      <div className="material-form-body allocation-body">
        <div className="material-allocation-grid">
          <section className="material-allocation-section">
            <div className="material-section-heading"><span><FiUser/></span><div><small>01 · PEMILIK STOK</small><h3>Pilih customer</h3><p>Material tersedia akan difilter berdasarkan pemilik.</p></div></div>
            <label><span>Customer pemilik <b>Wajib</b></span><select required value={allocation.customerId} onChange={e=>selectAllocationCustomer(e.target.value)}><option value="">Pilih Master Customer</option>{data.customers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          </section>
          <section className="material-allocation-section">
            <div className="material-section-heading"><span><FiTruck/></span><div><small>02 · TRIP TUJUAN</small><h3>Pilih perjalanan</h3><p>Trip aktif dapat menerima material sebagai muatan utama atau tambahan.</p></div></div>
            <label><span>Trip aktif <b>Wajib</b></span><select required value={allocation.tripId} onChange={e=>setAllocation({...allocation,tripId:e.target.value})}><option value="">Pilih trip dan armada</option>{data.trips.map(x=><option key={x.id} value={x.id}>{x.tripNo||x.order?.orderNo||"Trip"} · {x.truck?.plateNumber} · {x.order?.cargoName||x.cargoNameSnap||"Muatan"}</option>)}</select></label>
          </section>
        </div>
        <section className="material-allocation-section material-load-section">
          <div className="material-section-heading"><span><FiPackage/></span><div><small>03 · RINCIAN MUATAN</small><h3>Tentukan material dan tujuan bongkar</h3><p>Saldo dikurangi otomatis dengan metode FIFO setelah disimpan.</p></div></div>
          <div className="material-allocation-picker">
            <div className="material-allocation-picker-head"><span><strong>Material tersedia</strong><small>Centang barang lalu isi jumlah yang dimuat.</small></span><b>{available.filter(stock=>allocation.selected[stock.key]?.checked).length} dipilih</b></div>
            {!allocation.customerId?<div className="material-allocation-picker-empty">Pilih customer terlebih dahulu untuk melihat saldo material.</div>:!available.length?<div className="material-allocation-picker-empty">Customer ini belum memiliki saldo material.</div>:<div className="material-allocation-picker-list">
              <div className="material-allocation-picker-row heading"><span/><span>Material / lokasi</span><span>Saldo tersedia</span><span>Jumlah dimuat</span></div>
              {available.map(stock=>{const chosen=Boolean(allocation.selected[stock.key]?.checked);return <label key={stock.key} className={`material-allocation-picker-row ${chosen?"selected":""}`}><input type="checkbox" checked={chosen} onChange={e=>toggleAllocationStock(stock,e.target.checked)}/><span><strong>{stock.itemName}</strong><small>{stock.location?.name||"Tanpa lokasi"}</small></span><b>{Number(stock.availableQty).toLocaleString("id-ID")} {stock.unit}</b><div className="material-picker-quantity"><input aria-label={`Jumlah ${stock.itemName}`} required={chosen} disabled={!chosen} type="number" min="0.01" max={stock.availableQty} step="any" value={allocation.selected[stock.key]?.qty||""} onChange={e=>updateAllocationQty(stock.key,e.target.value)} placeholder="0"/><em>{stock.unit}</em></div></label>})}
            </div>}
          </div>
          <label className="material-destination-field"><span><FiMapPin/> Tujuan bongkar <b>Wajib</b></span><select required value={allocation.destinationLocationId} onChange={e=>setAllocation({...allocation,destinationLocationId:e.target.value})}><option value="">Pilih tujuan bongkar</option>{data.locations.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        </section>
        <label className="material-allocation-notes"><span><FiFileText/> Catatan perjalanan</span><textarea rows="2" value={allocation.notes} onChange={e=>setAllocation({...allocation,notes:e.target.value})} placeholder="Instruksi muat atau keterangan tambahan (opsional)"/></label>
        {error&&<div className="material-error">{error}</div>}
      </div>
      <footer><span><FiTruck/><small>Faktur Muatan dan tujuan bongkar dibuat otomatis.</small></span><div><button type="button" onClick={()=>setAllocateOpen(false)}>Batal</button><button className="save" disabled={busy||!available.some(stock=>allocation.selected[stock.key]?.checked)}>{busy?"Mengalokasikan...":`Alokasikan ${available.filter(stock=>allocation.selected[stock.key]?.checked).length||""} Material`}</button></div></footer>
    </form></div>}
  </div>
}
