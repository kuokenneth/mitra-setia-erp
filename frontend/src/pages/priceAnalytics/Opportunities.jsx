import { useState } from "react";
import { FiInfo, FiTarget } from "react-icons/fi";
import useApi from "./useApi";
import { ChangeBadge, EmptyState, ErrorState, Pagination, Panel, SkeletonRows, StatusTag } from "./ui";
import { dateLabel, pctPlain, qty as fmtQty, query, rupiah } from "./format";

const TABS = [
  { key: "overpaid", label: "Di atas harga referensi", empty: "Tidak ada pembelian yang jauh di atas harga sebanding sebelumnya." },
  { key: "increases", label: "Kenaikan harga", empty: "Tidak ada kenaikan harga yang signifikan." },
  { key: "spread", label: "Selisih antar supplier", empty: "Tidak ada selisih harga signifikan antar supplier." },
  { key: "spend", label: "Belanja tertinggi", empty: "Belum ada sparepart yang dibeli berulang dalam 12 bulan." },
  { key: "competition", label: "Supplier tunggal", empty: "Semua sparepart yang sering dibeli sudah punya lebih dari satu supplier." },
];

const ItemCell = ({ row }) => <span className="pa-item-cell"><b>{row.itemName}</b><small>{row.sku}{row.brand ? ` · ${row.brand}` : ""}</small></span>;

function Rows({ type, items, onOpenItem }) {
  const open = (row) => ({ className: "is-clickable", tabIndex: 0, onClick: () => onOpenItem(row.itemId), onKeyDown: (event) => { if (event.key === "Enter") onOpenItem(row.itemId); } });
  if (type === "overpaid") {
    return (
      <table className="pa-table">
        <thead><tr><th>Sparepart</th><th>Pembelian</th><th className="num">Harga dibeli</th><th className="num">Harga referensi</th><th className="num">Selisih</th><th className="num">Potensi hemat</th></tr></thead>
        <tbody>{items.map((row) => (
          <tr key={row.id} {...open(row)}>
            <td data-label="Sparepart"><ItemCell row={row} /></td>
            <td data-label="Pembelian"><span className="pa-docref">{row.supplierName}<small>{dateLabel(row.date)} · {row.poNumber} · {fmtQty(row.qty)} {row.unit}</small></span></td>
            <td data-label="Harga dibeli" className="num"><b>{rupiah(row.unitPrice)}</b><StatusTag status={row.priceStatus} /></td>
            <td data-label="Harga referensi" className="num">{rupiah(row.referencePrice)}<small className="pa-sub">{row.referenceSupplierName} · {dateLabel(row.referenceDate)}</small></td>
            <td data-label="Selisih" className="num"><span className="pa-diff">+{rupiah(row.difference)}</span><small className="pa-sub">{pctPlain(row.differencePct)} lebih tinggi</small></td>
            <td data-label="Potensi hemat" className="num"><b className="pa-save">{rupiah(row.savings)}</b></td>
          </tr>
        ))}</tbody>
      </table>
    );
  }
  if (type === "increases") {
    return (
      <table className="pa-table">
        <thead><tr><th>Sparepart</th><th className="num">Harga sebelumnya</th><th className="num">Harga terakhir</th><th className="num">Kenaikan</th><th>Supplier terakhir</th></tr></thead>
        <tbody>{items.map((row) => (
          <tr key={row.key} {...open(row)}>
            <td data-label="Sparepart"><ItemCell row={row} /></td>
            <td data-label="Sebelumnya" className="num">{rupiah(row.previousPrice)}<small className="pa-sub">{row.previousSupplierName}</small></td>
            <td data-label="Terakhir" className="num"><b>{rupiah(row.latestPrice)}</b><small className="pa-sub">{dateLabel(row.latestDate)}</small></td>
            <td data-label="Kenaikan" className="num"><ChangeBadge value={row.change} size="sm" /></td>
            <td data-label="Supplier">{row.latestSupplierName}</td>
          </tr>
        ))}</tbody>
      </table>
    );
  }
  if (type === "spread") {
    return (
      <table className="pa-table">
        <thead><tr><th>Sparepart</th><th className="num">Termurah</th><th className="num">Termahal</th><th className="num">Selisih</th><th className="num">Potensi hemat</th></tr></thead>
        <tbody>{items.map((row) => (
          <tr key={row.key} {...open(row)}>
            <td data-label="Sparepart"><ItemCell row={row} /><small className="pa-sub">{row.supplierCount} supplier · {row.transactionCount} pembelian</small></td>
            <td data-label="Termurah" className="num"><b>{rupiah(row.lowestSupplierPrice)}</b><small className="pa-sub">{row.lowestSupplierName}</small></td>
            <td data-label="Termahal" className="num">{rupiah(row.highestSupplierPrice)}<small className="pa-sub">{row.highestSupplierName}</small></td>
            <td data-label="Selisih" className="num"><span className="pa-diff">{pctPlain(row.spreadPct)}</span></td>
            <td data-label="Potensi hemat" className="num"><b className="pa-save">{rupiah(row.potentialSavings)}</b></td>
          </tr>
        ))}</tbody>
      </table>
    );
  }
  // spend + competition share the same shape
  return (
    <table className="pa-table">
      <thead><tr><th>Sparepart</th><th>{type === "competition" ? "Supplier tunggal" : "Supplier"}</th><th className="num">Pembelian</th><th className="num">Total nilai</th><th className="num">Harga terakhir</th><th className="num">Perubahan</th></tr></thead>
      <tbody>{items.map((row) => (
        <tr key={row.key} {...open(row)}>
          <td data-label="Sparepart"><ItemCell row={row} /></td>
          <td data-label="Supplier">{type === "competition" ? row.latestSupplierName : `${row.supplierCount} supplier`}</td>
          <td data-label="Pembelian" className="num">{row.transactionCount}×<small className="pa-sub">{fmtQty(row.qty)} {row.unit}</small></td>
          <td data-label="Total nilai" className="num"><b>{rupiah(row.amount)}</b></td>
          <td data-label="Harga terakhir" className="num">{rupiah(row.latestPrice)}</td>
          <td data-label="Perubahan" className="num"><ChangeBadge value={row.change} size="sm" /></td>
        </tr>
      ))}</tbody>
    </table>
  );
}

export default function Opportunities({ filters, onOpenItem }) {
  const [type, setType] = useState("overpaid");
  const [page, setPage] = useState(1);
  const res = useApi(`/price-analytics/opportunities${query({ ...filters, type, page, limit: 8 })}`);
  const data = res.data;
  const counts = data?.counts || {};
  const tab = TABS.find((t) => t.key === type);
  const showing = data && data.type === type;

  return (
    <Panel id="pa-savings" title="Peluang Penghematan Pembelian" subtitle="Dihitung otomatis dari riwayat pembelian dalam filter yang dipilih">
      <div className="pa-tabs" role="tablist" aria-label="Jenis peluang">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={type === t.key} className={type === t.key ? "active" : ""} onClick={() => { setType(t.key); setPage(1); }}>
            {t.label}{counts[t.key] != null && <b>{counts[t.key]}</b>}
          </button>
        ))}
      </div>
      <p className="pa-estimate">
        <FiInfo aria-hidden="true" />
        <span>
          <b>Estimasi.</b> {type === "overpaid" && showing ? <>Total potensi <b>{rupiah(data.totalSavings)}</b> = (harga dibeli − harga sebanding termurah dalam {data.settings.lookbackDays} hari sebelumnya) × jumlah yang benar-benar dibeli, hanya bila selisih &gt;{data.settings.mildPct}%. </> : null}
          Harga historis yang lebih rendah adalah bahan negosiasi dengan supplier, bukan jaminan penghematan.
        </span>
      </p>
      {res.error ? <div className="pa-pad"><ErrorState message={res.error} onRetry={res.reload} /></div>
        : !showing ? <SkeletonRows rows={5} columns={6} />
          : data.items.length === 0 ? <div className="pa-pad"><EmptyState icon={<FiTarget />} title={tab.empty} compact /></div>
            : <div className={`pa-table-wrap ${res.loading ? "is-loading" : ""}`}><Rows type={type} items={data.items} onOpenItem={onOpenItem} /></div>}
      <div className="pa-panel-foot"><Pagination pagination={showing ? data.pagination : null} onPage={setPage} label="baris" /></div>
    </Panel>
  );
}
