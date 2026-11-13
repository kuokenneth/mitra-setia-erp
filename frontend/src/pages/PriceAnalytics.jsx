// Analitik Harga Sparepart — overview, sparepart detail (?item=) and supplier view (?supplier=).
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiActivity, FiAlertCircle, FiArrowDownRight, FiBox, FiDollarSign, FiFilter, FiInfo, FiPackage, FiRefreshCw, FiRotateCcw, FiSettings, FiTrendingUp, FiTruck,
} from "react-icons/fi";
import useApi from "./priceAnalytics/useApi";
import SparepartSearch from "./priceAnalytics/SparepartSearch";
import ItemDetail from "./priceAnalytics/ItemDetail";
import SupplierView from "./priceAnalytics/SupplierView";
import Opportunities from "./priceAnalytics/Opportunities";
import SettingsDialog from "./priceAnalytics/SettingsDialog";
import { MonthlyBars, ShareList } from "./priceAnalytics/charts";
import { ChangeBadge, EmptyState, ErrorState, Kpi, Pagination, Panel, Segment, SkeletonRows } from "./priceAnalytics/ui";
import { CATEGORY_LABEL, PERIODS, dateLabel, periodRange, qty as fmtQty, query, rupiah } from "./priceAnalytics/format";
import "./PriceAnalytics.css";

const SORTS = [
  { value: "value", label: "Nilai pembelian tertinggi" },
  { value: "increase", label: "Kenaikan harga terbesar" },
  { value: "decrease", label: "Penurunan harga terbesar" },
  { value: "frequency", label: "Paling sering dibeli" },
  { value: "recent", label: "Pembelian terbaru" },
];
const DEFAULT_FILTERS = { period: "1y", ...periodRange("1y"), category: "", supplierId: "", direction: "", sort: "value" };

function Overview({ meta, filters, setFilters, page, setPage, onOpenItem, onOpenSupplier }) {
  const apiFilters = { from: filters.from, to: filters.to, category: filters.category, supplierId: filters.supplierId };
  const res = useApi(`/price-analytics/overview${query({ ...apiFilters, direction: filters.direction, sort: filters.sort, page, limit: 10 })}`);
  const data = res.data;
  const k = data?.kpis;
  const update = (patch) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); };
  const changed = ["category", "supplierId", "direction"].some((key) => filters[key]) || filters.period !== "1y" || filters.sort !== "value";

  return (
    <>
      <section className="pa-filters" aria-label="Filter analitik">
        <div className="pa-filter-period">
          <span className="pa-toolbar-label"><FiFilter aria-hidden="true" /> Periode</span>
          <Segment options={PERIODS.slice(1)} value={filters.period} onChange={(key) => update({ period: key, ...periodRange(key) })} label="Periode cepat" />
        </div>
        <label className="pa-field"><span>Dari</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => update({ from: event.target.value, period: "custom" })} /></label>
        <label className="pa-field"><span>Sampai</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update({ to: event.target.value, period: "custom" })} /></label>
        <label className="pa-field"><span>Kategori</span>
          <select value={filters.category} onChange={(event) => update({ category: event.target.value })}>
            <option value="">Semua kategori</option>
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="pa-field"><span>Supplier</span>
          <select value={filters.supplierId} onChange={(event) => update({ supplierId: event.target.value })}>
            <option value="">Semua supplier</option>
            {(meta?.suppliers || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="pa-field"><span>Arah harga</span>
          <select value={filters.direction} onChange={(event) => update({ direction: event.target.value })}>
            <option value="">Naik & turun</option>
            <option value="up">Harga naik</option>
            <option value="down">Harga turun</option>
          </select>
        </label>
        <label className="pa-field"><span>Urutkan</span>
          <select value={filters.sort} onChange={(event) => update({ sort: event.target.value })}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        {changed && <button type="button" className="pa-btn ghost" onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}><FiRotateCcw /> Reset</button>}
      </section>

      {res.error && !data ? <ErrorState message={res.error} onRetry={res.reload} /> : (
        <>
          <section className="pa-kpis five" aria-label="Indikator harga pembelian" aria-busy={res.loading}>
            <Kpi icon={<FiBox />} label="Total Jenis Sparepart" value={k?.itemCount.toLocaleString("id-ID")} loading={!k} detail={k ? `${k.transactionCount.toLocaleString("id-ID")} penerimaan barang` : " "} />
            <Kpi icon={<FiDollarSign />} label="Total Nilai Pembelian" value={k ? rupiah(k.totalValue) : ""} loading={!k} detail="sebelum pajak, diskon & ongkos PO" />
            <Kpi icon={<FiTrendingUp />} label="Sparepart Mengalami Kenaikan Harga" tone="danger" value={k?.increasedCount.toLocaleString("id-ID")} loading={!k}
              detail={k ? <><FiArrowDownRight aria-hidden="true" /> {k.decreasedCount} turun · vs pembelian sebelumnya</> : " "}
              onClick={k ? () => update({ direction: "up", sort: "increase" }) : undefined} />
            <Kpi icon={<FiActivity />} label="Potensi Penghematan" tone="warn" value={k ? rupiah(k.potentialSavings) : ""} loading={!k}
              detail={k ? `Estimasi · ${k.savingsCount} pembelian di atas referensi` : " "}
              onClick={k ? () => document.getElementById("pa-savings")?.scrollIntoView({ behavior: "smooth" }) : undefined} />
            <Kpi icon={<FiTruck />} label="Supplier Aktif" tone="info" value={k?.supplierCount.toLocaleString("id-ID")} loading={!k} detail="dipakai dalam periode" />
          </section>

          <div className="pa-overview-grid">
            <Panel title="Sparepart dalam periode" subtitle="Harga dari penerimaan barang dan invoice supplier · klik untuk melihat riwayat lengkap" className="pa-span-2">
              {!data ? <SkeletonRows rows={8} columns={6} /> : data.items.length === 0 ? (
                <div className="pa-pad"><EmptyState icon={<FiPackage />} title="Belum ada pembelian yang cocok dengan filter ini">Riwayat harga diambil dari barang PO yang sudah diterima. Ubah periode atau filter.</EmptyState></div>
              ) : (
                <div className={`pa-table-wrap ${res.loading ? "is-loading" : ""}`}>
                  <table className="pa-table pa-items-table">
                    <thead>
                      <tr>
                        <th>Sparepart</th>
                        <th className="num">Pembelian</th>
                        <th className="num">Harga terakhir</th>
                        <th className="num">Rata-rata</th>
                        <th className="num">Perubahan</th>
                        <th className="num">Total nilai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((row) => (
                        <tr key={row.key} className="is-clickable" tabIndex={0} onClick={() => onOpenItem(row.itemId)} onKeyDown={(event) => { if (event.key === "Enter") onOpenItem(row.itemId); }}>
                          <td data-label="Sparepart"><span className="pa-item-cell"><b>{row.itemName}</b><small>{row.sku}{row.brand ? ` · ${row.brand}` : ""}{row.partNumber ? ` · ${row.partNumber}` : ""}</small></span></td>
                          <td data-label="Pembelian" className="num">{row.transactionCount}×<small className="pa-sub">{fmtQty(row.qty)} {row.unit} · {row.supplierCount} supplier</small></td>
                          <td data-label="Harga terakhir" className="num"><b>{rupiah(row.latestPrice)}</b><small className="pa-sub">{row.latestSupplierName} · {dateLabel(row.latestDate, false)}</small></td>
                          <td data-label="Rata-rata" className="num">{rupiah(row.averagePrice)}<small className="pa-sub">/{row.unit}</small></td>
                          <td data-label="Perubahan" className="num"><ChangeBadge value={row.change} size="sm" title={row.previousPrice != null ? `Sebelumnya ${rupiah(row.previousPrice)}` : undefined} /></td>
                          <td data-label="Total nilai" className="num"><b>{rupiah(row.amount)}</b></td>
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
              <Panel title="Supplier dengan nilai terbesar" subtitle="Klik untuk analitik supplier">
                <div className="pa-pad">{data ? <ShareList rows={data.topSuppliers} onOpen={onOpenSupplier} /> : <SkeletonRows rows={4} columns={1} />}</div>
              </Panel>
            </div>
          </div>

          <Opportunities filters={apiFilters} onOpenItem={onOpenItem} />

          {data && (data.quality.notInvoiced > 0 || data.quality.excluded?.NO_PRICE > 0) && (
            <p className="pa-note">
              <FiInfo aria-hidden="true" />
              <span>
                {data.quality.notInvoiced > 0 && <>{data.quality.notInvoiced} pembelian dalam filter ini masih memakai <b>harga sementara</b> dari penerimaan barang dan akan diperbarui saat invoice supplier dicatat. </>}
                {data.quality.excluded?.NO_PRICE > 0 && <>{data.quality.excluded.NO_PRICE} penerimaan lama tidak memiliki harga sama sekali sehingga tidak dihitung. </>}
              </span>
            </p>
          )}
        </>
      )}
    </>
  );
}

export default function PriceAnalytics() {
  const [params, setParams] = useSearchParams();
  const itemId = params.get("item");
  const supplierId = params.get("supplier");
  const meta = useApi("/price-analytics/meta");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsOverride, setSettingsOverride] = useState(null);
  const settings = settingsOverride || meta.data?.settings;

  useEffect(() => {
    document.querySelector(".erp-content")?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [itemId, supplierId]);

  const openItem = (id) => setParams({ item: id });
  const openSupplier = (id) => setParams({ supplier: id });
  const back = () => { if (window.history.length > 1) window.history.back(); else setParams({}); };

  return (
    <div className="pa-page">
      {!itemId && !supplierId && (
        <header className="pa-header">
          <div className="pa-header-copy">
            <span className="pa-eyebrow">Bengkel & Pembelian</span>
            <h1>Analitik Harga Sparepart</h1>
            <p>Cari sparepart, lihat kapan dan dari mana kita membelinya, dan bandingkan harga antar supplier sebelum membuat pembelian berikutnya.</p>
          </div>
          <div className="pa-header-tools">
            <button type="button" className="pa-icon-btn" onClick={meta.reload} aria-label="Muat ulang"><FiRefreshCw className={meta.loading ? "spin" : ""} /></button>
            {meta.data?.canEditSettings && settings && <button type="button" className="pa-btn" onClick={() => setSettingsOpen(true)}><FiSettings /> Ambang peringatan</button>}
          </div>
          <div className="pa-hero">
            <SparepartSearch onSelect={(item) => openItem(item.id)} />
            <p className="pa-hero-hint">
              {meta.data ? (meta.data.transactionCount
                ? <>Riwayat {meta.data.transactionCount.toLocaleString("id-ID")} penerimaan barang sejak {dateLabel(meta.data.firstDate)}. Harga final mengikuti invoice supplier.</>
                : <><FiAlertCircle aria-hidden="true" /> Belum ada penerimaan barang dengan harga. Analitik terisi otomatis setelah barang PO diterima.</>) : "Memuat riwayat pembelian…"}
            </p>
          </div>
        </header>
      )}

      {itemId ? (
        <ItemDetail key={itemId} itemId={itemId} onBack={back} onSelectItem={openItem} onOpenSupplier={openSupplier} />
      ) : supplierId ? (
        <SupplierView key={supplierId} supplierId={supplierId} onBack={back} onOpenItem={openItem} />
      ) : meta.error && !meta.data ? (
        <ErrorState message={meta.error} onRetry={meta.reload} />
      ) : (
        <Overview meta={meta.data} filters={filters} setFilters={setFilters} page={page} setPage={setPage} onOpenItem={openItem} onOpenSupplier={openSupplier} />
      )}

      {settingsOpen && settings && (
        <SettingsDialog settings={settings} onClose={() => setSettingsOpen(false)} onSaved={(saved) => { setSettingsOverride(saved); setSettingsOpen(false); meta.reload(); }} />
      )}
    </div>
  );
}
