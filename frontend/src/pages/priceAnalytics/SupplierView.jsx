import { useState } from "react";
import { FiArrowLeft, FiAward, FiBox, FiClock, FiDollarSign, FiFileText, FiMail, FiMapPin, FiPhone, FiRepeat, FiTrendingUp } from "react-icons/fi";
import useApi from "./useApi";
import { ChangeBadge, EmptyState, ErrorState, Kpi, Pagination, Panel, Segment, SkeletonRows, StatusTag } from "./ui";
import { PERIODS, dateLabel, periodRange, pctPlain, qty as fmtQty, query, rupiah } from "./format";
import { MonthlyBars } from "./charts";

const SORTS = [
  { key: "value", label: "Nilai" },
  { key: "frequency", label: "Frekuensi" },
  { key: "recent", label: "Terbaru" },
];

export default function SupplierView({ supplierId, onBack, onOpenItem }) {
  const [period, setPeriod] = useState("1y");
  const [sort, setSort] = useState("value");
  const [page, setPage] = useState(1);
  const range = periodRange(period);
  const res = useApi(`/price-analytics/suppliers/${supplierId}${query({ ...range, sort, page, limit: 10 })}`);
  const data = res.data && res.data.supplier?.id === supplierId ? res.data : null;

  if (res.error && !data) {
    return <div className="pa-detail"><button type="button" className="pa-back" onClick={onBack}><FiArrowLeft /> Kembali</button><ErrorState message={res.error} onRetry={res.reload} /></div>;
  }
  const k = data?.kpis;
  return (
    <div className="pa-detail">
      <div className="pa-detail-top">
        <button type="button" className="pa-back" onClick={onBack}><FiArrowLeft /> Kembali</button>
      </div>
      <section className="pa-item-head">
        {!data ? <div className="pa-item-head-skel"><span className="pa-skel" style={{ width: "40%", height: 28 }} /></div> : (
          <div className="pa-item-id">
            <span className="pa-eyebrow">Analitik supplier</span>
            <h1>{data.supplier.name}</h1>
            <div className="pa-item-tags">
              {data.supplier.phone && <span><FiPhone aria-hidden="true" /> {data.supplier.phone}</span>}
              {data.supplier.email && <span><FiMail aria-hidden="true" /> {data.supplier.email}</span>}
              {data.supplier.address && <span><FiMapPin aria-hidden="true" /> {data.supplier.address}</span>}
            </div>
          </div>
        )}
      </section>

      <div className="pa-detail-toolbar">
        <div><span className="pa-toolbar-label">Periode</span><Segment options={PERIODS} value={period} onChange={(key) => { setPeriod(key); setPage(1); }} label="Periode analisis supplier" /></div>
        <small>{range.from ? `${dateLabel(range.from)} – ${dateLabel(range.to)}` : "Seluruh riwayat"}{res.loading && data ? " · memperbarui…" : ""}</small>
      </div>

      <section className="pa-kpis five" aria-label="Ringkasan supplier">
        <Kpi icon={<FiBox />} label="Jenis sparepart dipasok" value={k ? k.itemCount.toLocaleString("id-ID") : ""} loading={!k} />
        <Kpi icon={<FiDollarSign />} label="Total nilai pembelian" value={k ? rupiah(k.totalValue) : ""} loading={!k} detail={k ? "sebelum pajak & ongkos PO" : ""} />
        <Kpi icon={<FiFileText />} label="Jumlah pembelian" value={k ? `${k.purchaseCount} PO` : ""} loading={!k} detail={k ? `${k.receiptCount} penerimaan` : ""} tone="info" />
        <Kpi icon={<FiRepeat />} label="Rata-rata per PO" value={k ? rupiah(k.averageTransactionValue) : ""} loading={!k} tone="info" />
        <Kpi icon={<FiAward />} label="Harga terendah di" value={k ? `${k.cheapestCount} dari ${k.comparedCount}` : ""} loading={!k} detail={k ? "sparepart yang juga dibeli dari supplier lain" : ""} tone="neutral" />
      </section>

      {data && k.lineCount === 0 ? (
        <Panel><div className="pa-pad"><EmptyState title="Belum ada pembelian dari supplier ini dalam periode ini">Pilih periode yang lebih panjang.</EmptyState></div></Panel>
      ) : (
        <div className="pa-supplier-grid">
          <Panel title="Daftar Sparepart dari Supplier Ini" subtitle="Klik sparepart untuk membuka riwayat harganya" className="pa-span-2"
            actions={<Segment options={SORTS} value={sort} onChange={(key) => { setSort(key); setPage(1); }} label="Urutkan" />}>
            {!data ? <SkeletonRows rows={6} columns={6} /> : (
              <div className={`pa-table-wrap ${res.loading ? "is-loading" : ""}`}>
                <table className="pa-table pa-supplier-items">
                  <thead>
                    <tr>
                      <th>Sparepart</th>
                      <th className="num">Transaksi</th>
                      <th className="num">Total nilai</th>
                      <th className="num">Harga terakhir</th>
                      <th className="num">Perubahan</th>
                      <th className="num">Termurah di supplier lain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => (
                      <tr key={row.key} className="is-clickable" tabIndex={0} onClick={() => onOpenItem(row.itemId)} onKeyDown={(event) => { if (event.key === "Enter") onOpenItem(row.itemId); }}>
                        <td data-label="Sparepart"><span className="pa-item-cell"><b>{row.itemName}</b><small>{row.sku}{row.brand ? ` · ${row.brand}` : ""} · {fmtQty(row.qty)} {row.unit}</small></span></td>
                        <td data-label="Transaksi" className="num">{row.transactionCount}</td>
                        <td data-label="Total nilai" className="num">{rupiah(row.amount)}</td>
                        <td data-label="Harga terakhir" className="num"><b>{rupiah(row.latestPrice)}</b><small className="pa-sub">{dateLabel(row.latestDate)}</small></td>
                        <td data-label="Perubahan" className="num"><ChangeBadge value={row.change} size="sm" /></td>
                        <td data-label="Supplier lain" className="num">
                          {row.bestOtherPrice == null ? <span className="pa-muted">Tidak ada pembanding</span> : (
                            <span className="pa-compare">
                              <b>{rupiah(row.bestOtherPrice)}</b>
                              <small className="pa-sub">{row.bestOtherSupplierName}</small>
                              {row.differenceToBestOtherPct > 0 ? <span className="pa-tag warn">{pctPlain(row.differenceToBestOtherPct)} lebih mahal</span> : <span className="pa-tag good">Paling murah</span>}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="pa-panel-foot"><Pagination pagination={data?.pagination} onPage={setPage} label="sparepart" /></div>
          </Panel>

          <div className="pa-stack">
            <Panel title="Nilai pembelian per bulan">
              <div className="pa-pad">{data ? <MonthlyBars months={data.monthly} /> : <div className="pa-skel" style={{ height: 150 }} />}</div>
            </Panel>
            <Panel title="Paling sering dibeli">
              <ul className="pa-rank">
                {(data?.frequent || []).map((row, index) => (
                  <li key={row.key}><button type="button" onClick={() => onOpenItem(row.itemId)}><em>{index + 1}</em><span><b>{row.itemName}</b><small>{row.transactionCount} pembelian · {fmtQty(row.qty)} {row.unit}</small></span><strong>{rupiah(row.latestPrice)}</strong></button></li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel title="Perubahan harga dari supplier ini" subtitle="Dibandingkan dengan pembelian sebelumnya dari supplier yang sama">
            {!data ? <SkeletonRows rows={4} columns={3} /> : data.priceChanges.length === 0 ? <div className="pa-pad"><EmptyState icon={<FiTrendingUp />} title="Belum ada perubahan harga" compact /></div> : (
              <ul className="pa-list">
                {data.priceChanges.map((row) => (
                  <li key={row.id}><button type="button" onClick={() => onOpenItem(row.itemId)}><span><b>{row.itemName}</b><small>{rupiah(row.previousOwnPrice)} → {rupiah(row.unitPrice)} · {dateLabel(row.date)}</small></span><ChangeBadge value={row.ownChange} size="sm" /></button></li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Pembelian terbaru">
            {!data ? <SkeletonRows rows={4} columns={3} /> : (
              <ul className="pa-list">
                {data.latest.map((row) => (
                  <li key={row.id}><button type="button" onClick={() => onOpenItem(row.itemId)}><span><b>{row.itemName}</b><small><FiClock aria-hidden="true" /> {dateLabel(row.date)} · {row.poNumber} · {fmtQty(row.qty)} {row.unit}</small></span><span className="pa-list-price">{rupiah(row.unitPrice)}<StatusTag status={row.priceStatus} /></span></button></li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
