import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiArrowLeft, FiAward, FiBox, FiCalendar, FiDownload, FiExternalLink, FiFileText, FiInfo, FiLayers, FiPackage,
  FiSearch, FiShoppingBag, FiTag, FiTruck, FiUsers,
} from "react-icons/fi";
import { openPrintDocument } from "../../api";
import { openProtectedFile } from "../../components/ProtectedFile";
import useApi from "./useApi";
import PriceChart from "./PriceChart";
import SparepartSearch from "./SparepartSearch";
import { ChangeBadge, Dialog, EmptyState, ErrorState, Pagination, Panel, Segment, SkeletonRows, SortHeader, StatusTag } from "./ui";
import {
  CATEGORY_LABEL, PERIODS, PRICE_STATUS, dateLabel, downloadFile, pctPlain, periodRange, qty as fmtQty, query, rupiah, supplierColor,
} from "./format";

function PriceCard({ label, icon, children, footer, tone = "" }) {
  return (
    <article className={`pa-price-card ${tone}`}>
      <span className="pa-price-card-label"><i aria-hidden="true">{icon}</i>{label}</span>
      {children}
      {footer && <footer>{footer}</footer>}
    </article>
  );
}

function ReferencePanel({ reference, unit, settings }) {
  if (!reference) return null;
  return (
    <Panel title="Harga Referensi Pembelian" subtitle="Patokan dari pembelian sebanding terakhir" className="pa-reference">
      <div className="pa-pad">
        {reference.sufficient ? (
          <>
            <div className="pa-ref-price"><strong>{rupiah(reference.price)}</strong><span>/{unit}</span></div>
            <p className="pa-ref-source">{reference.supplierName} · {dateLabel(reference.date)} · {reference.poNumber || "—"} <StatusTag status={reference.priceStatus} /></p>
          </>
        ) : (
          <div className="pa-ref-empty" role="status">
            <FiInfo aria-hidden="true" />
            <p><strong>Data historis belum cukup untuk menentukan harga referensi.</strong> Dalam {reference.lookbackDays} hari terakhir ada {reference.transactionCount} pembelian sebanding; dibutuhkan minimal {reference.minTransactions}.</p>
          </div>
        )}
        <dl className="pa-facts">
          <div><dt>Metode</dt><dd>Harga pembelian sebanding terakhir</dd></div>
          <div><dt>Transaksi digunakan</dt><dd>{reference.transactionCount} dari {reference.totalHistoryCount}</dd></div>
          <div><dt>Periode pembanding</dt><dd>{reference.lookbackDays} hari terakhir</dd></div>
          <div><dt>Pembelian sebanding terakhir</dt><dd>{reference.sufficient ? dateLabel(reference.date) : dateLabel(reference.latestAnyDate)}</dd></div>
          <div><dt>Rata-rata tertimbang</dt><dd>{reference.recentAverage ? rupiah(reference.recentAverage) : "—"}</dd></div>
          <div><dt>Minimum historis</dt><dd>{reference.historicalMinimum ? `${rupiah(reference.historicalMinimum.unitPrice)} · ${reference.historicalMinimum.supplierName}` : "—"}</dd></div>
        </dl>
        <p className="pa-fineprint">{reference.method} Bukan harga pasar terkini atau penawaran supplier.</p>
        {settings && (
          <div className="pa-thresholds" aria-label="Ambang peringatan harga di Pembelian">
            <span>Peringatan di Pembelian</span>
            <b className="mild">&gt;{settings.mildPct}%</b><b className="strong">&gt;{settings.strongPct}%</b><b className="high">&gt;{settings.highPct}%</b>
          </div>
        )}
      </div>
    </Panel>
  );
}

function SupplierComparison({ comparison, supplierOrder, unit, settings, onShowHistory, onOpenSupplier }) {
  const rows = comparison?.rows || [];
  const lowest = comparison?.lowest;
  return (
    <Panel id="pa-suppliers" title="Perbandingan Harga Supplier" subtitle="Harga historis dari pembelian yang sudah diterima dalam periode ini">
      {rows.length === 0 ? (
        <div className="pa-pad"><EmptyState icon={<FiUsers />} title="Belum ada pembelian dalam periode ini" compact>Pilih periode yang lebih panjang untuk membandingkan supplier.</EmptyState></div>
      ) : (
        <>
          {lowest && (
            <p className="pa-insight">
              <FiAward aria-hidden="true" />
              <span>
                <b>{lowest.supplierName}</b> memiliki harga pembelian terakhir terendah, yaitu <b>{rupiah(lowest.latestPrice)}</b> per {unit}
                {comparison.basis === "all" ? ` (tidak ada pembelian dalam ${settings?.lookbackDays || 180} hari terakhir; dibandingkan dari seluruh periode)` : ""}.
                {rows.length === 1 ? " Baru ada satu supplier untuk barang ini." : ""}
              </span>
            </p>
          )}
          <div className="pa-table-wrap">
            <table className="pa-table pa-supplier-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th className="num">Harga pembelian terakhir</th>
                  <th className="num">Termurah historis</th>
                  <th className="num">Rata-rata</th>
                  <th>Terakhir beli</th>
                  <th className="num">Transaksi</th>
                  <th className="num">Selisih vs terendah</th>
                  <th><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.supplierId} className={row.isLowest ? "is-best" : ""}>
                    <td data-label="Supplier">
                      <span className="pa-supplier-name">
                        <i style={{ background: supplierColor(supplierOrder, row.supplierId) }} aria-hidden="true" />
                        <button type="button" className="pa-text-link" onClick={() => onOpenSupplier(row.supplierId)}>{row.supplierName}</button>
                        {row.isLowest && <span className="pa-tag good">Terendah</span>}
                        {!row.recent && <span className="pa-tag muted" title={`Pembelian terakhir lebih dari ${settings?.lookbackDays || 180} hari lalu`}>Lama</span>}
                      </span>
                    </td>
                    <td data-label="Harga terakhir" className="num"><b>{rupiah(row.latestPrice)}</b> <StatusTag status={row.latestStatus} /></td>
                    <td data-label="Termurah historis" className="num">{rupiah(row.lowestPrice)}</td>
                    <td data-label="Rata-rata" className="num">{rupiah(row.averagePrice)}</td>
                    <td data-label="Terakhir beli">{dateLabel(row.latestDate)}</td>
                    <td data-label="Transaksi" className="num">{row.transactionCount}</td>
                    <td data-label="Selisih vs terendah" className="num">
                      {row.isLowest ? <span className="pa-muted">—</span> : <span className="pa-diff">+{rupiah(row.differenceToLowest)} <small>({pctPlain(row.differenceToLowestPct)})</small></span>}
                    </td>
                    <td className="pa-row-action"><button type="button" className="pa-btn small" onClick={() => onShowHistory(row.supplierId)}>Lihat Riwayat Supplier</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pa-fineprint pa-pad-x"><FiInfo aria-hidden="true" /> Semua harga di atas adalah <b>harga pembelian historis</b> (per {unit}, sebelum pajak, diskon, dan ongkos kirim PO) — bukan penawaran supplier saat ini. Penawaran harga supplier belum dicatat di sistem.</p>
        </>
      )}
    </Panel>
  );
}

function DocumentDialog({ line, unit, onClose }) {
  const [error, setError] = useState("");
  if (!line) return null;
  const open = async (task) => {
    setError("");
    try { await task(); } catch (e) { setError(e.message || "Dokumen tidak dapat dibuka"); }
  };
  const status = PRICE_STATUS[line.priceStatus];
  return (
    <Dialog open title={`Pembelian ${line.poNumber || ""}`} subtitle={`${line.supplierName} · diterima ${dateLabel(line.date)}`} onClose={onClose}
      footer={<button type="button" className="pa-btn" onClick={onClose}>Tutup</button>}>
      <div className="pa-doc-summary">
        <div><span>Jumlah diterima</span><b>{fmtQty(line.qty)} {line.unit}</b></div>
        <div><span>Harga satuan</span><b>{rupiah(line.unitPrice)}</b></div>
        <div><span>Total</span><b>{rupiah(line.amount)}</b></div>
        <div><span>Perubahan</span><b><ChangeBadge value={line.change} /></b></div>
      </div>
      <p className={`pa-doc-status ${line.priceStatus === "INVOICE" ? "ok" : "warn"}`}><b>{status?.label}:</b> {status?.note}{line.priceStatus !== "INVOICE" && line.provisionalPrice ? ` Harga penerimaan: ${rupiah(line.provisionalPrice)}.` : ""}</p>
      {line.previousPrice != null && <p className="pa-fineprint">Pembelian sebanding sebelumnya: {rupiah(line.previousPrice)} dari {line.previousSupplierName}.</p>}
      {!line.comparable && <p className="pa-fineprint">Satuan pembelian ({line.unit}) berbeda dari satuan barang saat ini ({unit}); baris ini tidak dipakai dalam perbandingan harga.</p>}
      <h3 className="pa-doc-title">Dokumen sumber</h3>
      <ul className="pa-doc-list">
        <li>
          <FiShoppingBag aria-hidden="true" />
          <span><b>Purchase Order {line.poNumber}</b><small>Pesanan ke {line.supplierName}</small></span>
          {line.poId && <button type="button" className="pa-btn small" onClick={() => open(() => openPrintDocument(`/purchasing/orders/${line.poId}/print`))}><FiExternalLink /> Buka PO</button>}
        </li>
        <li>
          <FiPackage aria-hidden="true" />
          <span><b>Penerimaan {line.receiptNumber}</b><small>{line.deliveryNote ? `Surat jalan ${line.deliveryNote}` : "Tanpa nomor surat jalan"}</small></span>
          <span className="pa-doc-actions">
            {line.receiptId && <button type="button" className="pa-btn small" onClick={() => open(() => openPrintDocument(`/purchasing/receipts/${line.receiptId}/print`))}><FiExternalLink /> Buka penerimaan</button>}
            {line.deliveryNoteProofUrl && <button type="button" className="pa-btn small" onClick={() => open(() => openProtectedFile(line.deliveryNoteProofUrl))}><FiFileText /> Foto surat jalan</button>}
          </span>
        </li>
        {(line.invoices || []).map((invoice) => (
          <li key={invoice.id + invoice.qty}>
            <FiFileText aria-hidden="true" />
            <span><b>Invoice {invoice.invoiceNumber}</b><small>{dateLabel(invoice.invoiceDate)} · {fmtQty(invoice.qty)} {line.unit} × {rupiah(invoice.unitPrice)}</small></span>
            <span className="pa-doc-actions">
              {invoice.proofUrl && <button type="button" className="pa-btn small" onClick={() => open(() => openProtectedFile(invoice.proofUrl))}><FiFileText /> Lihat invoice</button>}
              <button type="button" className="pa-btn small" onClick={() => open(() => openPrintDocument(`/purchasing/bills/${invoice.id}/receipt-print`))}><FiExternalLink /> Tanda terima</button>
            </span>
          </li>
        ))}
        {!(line.invoices || []).length && <li className="pa-muted"><FiFileText aria-hidden="true" /><span><b>Invoice supplier</b><small>Belum ada invoice untuk penerimaan ini.</small></span></li>}
      </ul>
      {error && <p className="pa-form-error" role="alert">{error}</p>}
    </Dialog>
  );
}

const HISTORY_COLUMNS = 7;

export default function ItemDetail({ itemId, onBack, onSelectItem, onOpenSupplier }) {
  const [period, setPeriod] = useState("1y");
  const range = periodRange(period);
  const detail = useApi(`/price-analytics/items/${itemId}${query(range)}`);
  const [history, setHistory] = useState({ page: 1, sort: { field: "date", order: "desc" }, supplierId: "", from: range.from, to: range.to, q: "" });
  const [searchText, setSearchText] = useState("");
  const [docLine, setDocLine] = useState(null);
  const [exporting, setExporting] = useState("");
  const [exportError, setExportError] = useState("");
  const historyRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setHistory((h) => (h.q === searchText.trim() ? h : { ...h, q: searchText.trim(), page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const historyFilters = { from: history.from, to: history.to, supplierId: history.supplierId, q: history.q, sort: history.sort.field, order: history.sort.order };
  const historyApi = useApi(`/price-analytics/items/${itemId}/history${query({ ...historyFilters, page: history.page, limit: 10 })}`);

  const data = detail.data && detail.data.item?.id === itemId ? detail.data : null;
  const item = data?.item;
  const summary = data?.summary;
  const supplierOrder = useMemo(() => data?.supplierOrder || [], [data]);
  const historyRows = historyApi.data?.items || [];

  function changePeriod(key) {
    const next = periodRange(key);
    setPeriod(key);
    setHistory((h) => ({ ...h, from: next.from, to: next.to, page: 1 }));
  }
  function showSupplierHistory(supplierId) {
    setHistory((h) => ({ ...h, supplierId, page: 1 }));
    historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function sortBy(field) {
    setHistory((h) => ({ ...h, page: 1, sort: { field, order: h.sort.field === field && h.sort.order === "desc" ? "asc" : "desc" } }));
  }
  async function exportHistory(format) {
    setExporting(format);
    setExportError("");
    try {
      await downloadFile(`/price-analytics/items/${itemId}/export${query({ ...historyFilters, format })}`, `riwayat-harga.${format}`);
    } catch (error) {
      setExportError(error.message);
    } finally {
      setExporting("");
    }
  }

  if (detail.error && !data) {
    return <div className="pa-detail"><button type="button" className="pa-back" onClick={onBack}><FiArrowLeft /> Kembali ke ringkasan</button><ErrorState message={detail.error} onRetry={detail.reload} /></div>;
  }

  const unit = item?.unit || "unit";
  const latest = summary?.latest;
  const lowest = summary?.lowest;
  const change = summary?.change;
  const periodLabel = PERIODS.find((p) => p.key === period)?.label;

  return (
    <div className="pa-detail">
      <div className="pa-detail-top">
        <button type="button" className="pa-back" onClick={onBack}><FiArrowLeft /> Ringkasan analitik</button>
        <SparepartSearch onSelect={(selected) => onSelectItem(selected.id)} compact />
      </div>

      <section className="pa-item-head" aria-busy={!data}>
        {!item ? (
          <div className="pa-item-head-skel"><span className="pa-skel" style={{ width: "40%", height: 28 }} /><span className="pa-skel" style={{ width: "60%" }} /></div>
        ) : (
          <>
            <div className="pa-item-id">
              <span className="pa-eyebrow">{CATEGORY_LABEL[item.category] || item.category}</span>
              <h1>{item.name}</h1>
              <div className="pa-item-tags">
                <span><FiTag aria-hidden="true" /> {item.sku}</span>
                {item.brand && <span>Merek <b>{item.brand}</b></span>}
                {item.partNumber && <span>No. part <b>{item.partNumber}</b></span>}
                <span>Satuan <b>{unit}</b></span>
              </div>
              {item.aliases?.length > 0 && <p className="pa-aliases">Juga dikenal sebagai: {item.aliases.join(", ")}</p>}
            </div>
            <dl className="pa-item-stats">
              <div><dt><FiBox aria-hidden="true" /> Stok saat ini</dt><dd>{fmtQty(item.stock)} <small>{unit}</small></dd></div>
              <div><dt><FiLayers aria-hidden="true" /> Total dibeli</dt><dd>{fmtQty(item.totalQtyPurchased)} <small>{unit}</small></dd></div>
              <div><dt><FiShoppingBag aria-hidden="true" /> Pembelian</dt><dd>{item.transactionCount}<small> kali</small></dd></div>
              <div><dt><FiTruck aria-hidden="true" /> Supplier</dt><dd>{item.supplierCount}</dd></div>
              <div><dt><FiCalendar aria-hidden="true" /> Pertama dibeli</dt><dd className="date">{dateLabel(item.firstPurchaseDate)}</dd></div>
            </dl>
          </>
        )}
      </section>

      <div className="pa-detail-toolbar">
        <div><span className="pa-toolbar-label">Periode analisis</span><Segment options={PERIODS} value={period} onChange={changePeriod} label="Periode analisis" /></div>
        <small>{range.from ? `${dateLabel(range.from)} – ${dateLabel(range.to)}` : "Seluruh riwayat"}{detail.loading && data ? " · memperbarui…" : ""}</small>
      </div>

      {data && item.transactionCount === 0 ? (
        <Panel><div className="pa-pad"><EmptyState icon={<FiPackage />} title="Belum ada riwayat pembelian untuk sparepart ini">Riwayat muncul setelah barang dari PO diterima di menu Pembelian. Tidak ada harga yang diperkirakan.</EmptyState></div></Panel>
      ) : (
        <>
          <div className="pa-price-cards">
            <PriceCard label="Harga Pembelian Terakhir" icon={<FiShoppingBag />} footer={latest ? <>{latest.supplierName}<br />{dateLabel(latest.date)} · {latest.poNumber} <StatusTag status={latest.priceStatus} /></> : null}>
              {data ? <strong>{latest ? rupiah(latest.unitPrice) : "—"}<small>/{unit}</small></strong> : <span className="pa-skel pa-skel-value" />}
              {data && !latest && <p className="pa-muted">Tidak ada pembelian dalam periode ini.</p>}
            </PriceCard>
            <PriceCard label="Harga Termurah Tercatat" icon={<FiAward />} tone="good" footer={lowest ? <>{lowest.supplierName}<br />{dateLabel(lowest.date)} · {lowest.poNumber}</> : null}>
              {data ? <strong>{lowest ? rupiah(lowest.unitPrice) : "—"}<small>/{unit}</small></strong> : <span className="pa-skel pa-skel-value" />}
              {data && summary.allTimeLowest && lowest && summary.allTimeLowest.unitPrice < lowest.unitPrice && <p className="pa-muted">Sepanjang waktu: {rupiah(summary.allTimeLowest.unitPrice)} ({dateLabel(summary.allTimeLowest.date)})</p>}
            </PriceCard>
            <PriceCard label="Harga Rata-rata" icon={<FiLayers />} footer={summary?.count ? <>Rata-rata tertimbang jumlah<br />{summary.count} pembelian · {fmtQty(summary.qty)} {unit}</> : null}>
              {data ? <strong>{summary.averagePrice ? rupiah(summary.averagePrice) : "—"}<small>/{unit}</small></strong> : <span className="pa-skel pa-skel-value" />}
            </PriceCard>
            <PriceCard label="Perubahan Harga" icon={<FiTag />} tone={change?.pct > 0 ? "up" : change?.pct < 0 ? "down" : ""}
              footer={change?.previousPrice != null ? <>Terakhir {rupiah(latest.unitPrice)} vs sebelumnya<br />{rupiah(change.previousPrice)} ({change.previousSupplierName})</> : null}>
              {data ? <strong className="pa-change-big"><ChangeBadge value={change?.pct ?? null} size="lg" /></strong> : <span className="pa-skel pa-skel-value" />}
              {data && change?.pct == null && <p className="pa-muted">Belum ada pembelian sebelumnya untuk dibandingkan.</p>}
            </PriceCard>
          </div>

          <div className="pa-detail-grid">
            <Panel title="Riwayat harga satuan" subtitle={`Setiap titik = satu penerimaan barang · ${periodLabel === "Semua" ? "seluruh riwayat" : periodLabel}`} className="pa-chart-panel">
              <div className="pa-pad">
                {!data ? <div className="pa-skel" style={{ height: 300 }} /> : (
                  <PriceChart points={data.points} supplierOrder={supplierOrder} average={summary.averagePrice} reference={data.reference} />
                )}
                {data?.truncated && <p className="pa-fineprint">Grafik menampilkan 2.000 pembelian terbaru. Persempit periode untuk melihat semuanya.</p>}
              </div>
            </Panel>
            {data ? <ReferencePanel reference={data.reference} unit={unit} settings={data.settings} /> : <Panel title="Harga Referensi Pembelian"><SkeletonRows rows={4} columns={2} /></Panel>}
          </div>

          {data && <SupplierComparison comparison={data.suppliers} supplierOrder={supplierOrder} unit={unit} settings={data.settings} onShowHistory={showSupplierHistory} onOpenSupplier={onOpenSupplier} />}

          {data?.quality?.otherUnitCount > 0 && (
            <p className="pa-note"><FiInfo aria-hidden="true" /> {data.quality.otherUnitCount} pembelian tercatat dengan satuan lain dan tidak ikut dibandingkan. Baris tersebut tetap tampil di riwayat dengan label satuan.</p>
          )}
        </>
      )}

      <div ref={historyRef} className="pa-anchor" />
      <Panel id="pa-history" title="Riwayat Harga Pembelian" subtitle="Satu baris = satu penerimaan barang. Klik baris untuk melihat PO, penerimaan, dan invoice."
        actions={<>
          <button type="button" className="pa-btn" onClick={() => exportHistory("csv")} disabled={Boolean(exporting)}><FiDownload /> {exporting === "csv" ? "Menyiapkan…" : "CSV"}</button>
          <button type="button" className="pa-btn" onClick={() => exportHistory("xlsx")} disabled={Boolean(exporting)}><FiDownload /> {exporting === "xlsx" ? "Menyiapkan…" : "Excel"}</button>
        </>}>
        <div className="pa-history-filters">
          <label className="pa-field pa-field-search"><span className="sr-only">Cari dalam riwayat</span><FiSearch aria-hidden="true" /><input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Cari supplier, no. PO, penerimaan, invoice…" /></label>
          <label className="pa-field"><span>Supplier</span>
            <select value={history.supplierId} onChange={(event) => setHistory((h) => ({ ...h, supplierId: event.target.value, page: 1 }))}>
              <option value="">Semua supplier</option>
              {supplierOrder.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="pa-field"><span>Dari</span><input type="date" value={history.from} max={history.to || undefined} onChange={(event) => setHistory((h) => ({ ...h, from: event.target.value, page: 1 }))} /></label>
          <label className="pa-field"><span>Sampai</span><input type="date" value={history.to} min={history.from || undefined} onChange={(event) => setHistory((h) => ({ ...h, to: event.target.value, page: 1 }))} /></label>
        </div>
        {exportError && <p className="pa-form-error pa-pad-x" role="alert">{exportError}</p>}
        {history.supplierId && (
          <p className="pa-filter-chip-row pa-pad-x">
            <span className="pa-filter-chip">Supplier: {supplierOrder.find((s) => s.id === history.supplierId)?.name || "—"}<button type="button" aria-label="Hapus filter supplier" onClick={() => setHistory((h) => ({ ...h, supplierId: "", page: 1 }))}>×</button></span>
          </p>
        )}
        {historyApi.error ? <div className="pa-pad"><ErrorState message={historyApi.error} onRetry={historyApi.reload} /></div> : historyApi.initial ? <SkeletonRows rows={6} columns={HISTORY_COLUMNS} /> : historyRows.length === 0 ? (
          <div className="pa-pad"><EmptyState icon={<FiSearch />} title="Tidak ada pembelian yang cocok" compact>Ubah kata kunci, supplier, atau rentang tanggal.</EmptyState></div>
        ) : (
          <div className={`pa-table-wrap ${historyApi.loading ? "is-loading" : ""}`}>
            <table className="pa-table pa-history-table">
              <thead>
                <tr>
                  <SortHeader label="Tanggal" field="date" sort={history.sort} onSort={sortBy} />
                  <SortHeader label="Supplier" field="supplier" sort={history.sort} onSort={sortBy} />
                  <th>No. PO</th>
                  <SortHeader label="Jumlah" field="qty" sort={history.sort} onSort={sortBy} align="right" />
                  <SortHeader label="Harga satuan" field="price" sort={history.sort} onSort={sortBy} align="right" />
                  <SortHeader label="Total" field="total" sort={history.sort} onSort={sortBy} align="right" />
                  <SortHeader label="Perubahan" field="change" sort={history.sort} onSort={sortBy} align="right" />
                </tr>
              </thead>
              <tbody>
                {historyRows.map((line) => (
                  <tr key={line.id} className="is-clickable" tabIndex={0} onClick={() => setDocLine(line)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setDocLine(line); } }}>
                    <td data-label="Tanggal" className="nowrap">{dateLabel(line.date)}</td>
                    <td data-label="Supplier"><span className="pa-supplier-name"><i style={{ background: supplierColor(supplierOrder, line.supplierId) }} aria-hidden="true" />{line.supplierName}</span></td>
                    <td data-label="No. PO"><span className="pa-docref">{line.poNumber}<small>{line.receiptNumber}{line.invoices?.length ? ` · ${line.invoices.map((i) => i.invoiceNumber).join(", ")}` : ""}</small></span></td>
                    <td data-label="Jumlah" className="num nowrap">{fmtQty(line.qty)} <small>{line.unit}</small>{!line.comparable && <span className="pa-tag muted">Satuan beda</span>}</td>
                    <td data-label="Harga satuan" className="num nowrap"><b>{rupiah(line.unitPrice)}</b><StatusTag status={line.priceStatus} /></td>
                    <td data-label="Total" className="num nowrap">{rupiah(line.amount)}</td>
                    <td data-label="Perubahan" className="num"><ChangeBadge value={line.change} size="sm" title={line.previousPrice != null ? `Sebelumnya ${rupiah(line.previousPrice)} (${line.previousSupplierName})` : undefined} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pa-panel-foot"><Pagination pagination={historyApi.data?.pagination} onPage={(page) => setHistory((h) => ({ ...h, page }))} label="pembelian" /></div>
      </Panel>
      <p className="pa-fineprint pa-legend-note">Perubahan = selisih terhadap pembelian sebanding sebelumnya (barang dan satuan sama, urut tanggal terima), dari supplier mana pun.</p>

      <DocumentDialog key={docLine?.id || "none"} line={docLine} unit={unit} onClose={() => setDocLine(null)} />
    </div>
  );
}
