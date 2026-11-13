import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import '../pages/PriceAnalytics.css';
const money=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0));
export default function PurchasePriceWarning({itemId,unit,price,referenceOnly=false}){
 const [state,setState]=useState(null);
 useEffect(()=>{
  if(!itemId||(!referenceOnly&&!(Number(price)>0)))return;
  let active=true;const controller=new AbortController();
  const timer=setTimeout(()=>api('/price-analytics/validate-price',{method:'POST',signal:controller.signal,body:JSON.stringify({itemId,unit,unitPrice:referenceOnly?1:Number(price)})}).then(data=>{if(active)setState({data,itemId,price});}).catch(e=>{if(active)setState({error:e.message,itemId,price});}),400);
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[itemId,unit,price,referenceOnly]);
 if(!itemId||(!referenceOnly&&!(Number(price)>0)))return null;
 if(!state||state.itemId!==itemId||state.price!==price)return <div className="price-warning normal" role="status">Memeriksa harga historis…</div>;
 if(state.error)return <div className="price-warning">Pembanding harga belum dapat dimuat: {state.error}</div>;
 const {data}=state,ref=data.reference;
 if(!ref.sufficient)return <div className="price-warning insufficient">Data historis belum cukup untuk menentukan harga referensi. <Link to={`/price-analytics?item=${itemId}`} target="_blank">Lihat analitik</Link></div>;
 const elevated=!referenceOnly&&['mild','strong','high'].includes(data.level);
 return <div role={elevated?'alert':'status'} className={`price-warning ${referenceOnly?'normal':data.level}`}><strong>{elevated?`Perhatian: Harga pembelian ini ${Number(data.change).toLocaleString('id-ID',{maximumFractionDigits:1})}% lebih tinggi dibandingkan harga referensi ${money(ref.unitPrice)}.`:`Harga referensi pembelian: ${money(ref.unitPrice)} / ${unit}`}</strong><p>{ref.supplierName} · {new Date(ref.date).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta'})}</p><small>Minimum historis {money(ref.minimum)} · Rata-rata tertimbang {money(ref.average)} · {ref.count} transaksi / {ref.lookbackDays} hari</small><small>Barang dan satuan identik · IDR · sebelum penyesuaian pajak, diskon, dan ongkos PO. Harga historis bukan penawaran terkini.</small><Link to={`/price-analytics?item=${itemId}`} target="_blank">Lihat riwayat harga</Link></div>;
}
