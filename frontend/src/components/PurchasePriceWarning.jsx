// Harga pembanding saat mengisi harga di Pembelian (penerimaan barang, invoice
// supplier) dan harga referensi di Buat PO. Hanya informasi — tidak pernah
// memblokir penyimpanan.
import { useEffect, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiExternalLink, FiInfo, FiTrendingDown } from "react-icons/fi";
import { api } from "../api";
import "./PurchasePriceWarning.css";

const money = (value) => (value == null ? "—" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2, maximumFractionDigits: 2 }).format(Number(value)).replace(/\s/g, ""));
const pct = (value) => `${Math.abs(Number(value)).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
const day = (value) => (value ? new Date(value).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" }) : "—");
const TITLE = { mild: "Perhatian", strong: "Perhatian", high: "Harga tinggi" };

export default function PurchasePriceWarning({ itemId, unit, price, supplierId, excludeReceiptItemIds, referenceOnly = false }) {
  const [state, setState] = useState({ key: null, data: null, error: null });
  const numeric = Number(price);
  const hasPrice = Number.isFinite(numeric) && numeric > 0;
  const exclude = (excludeReceiptItemIds || []).join(",");
  const active = Boolean(itemId) && (referenceOnly || hasPrice);
  const key = active ? [itemId, unit, referenceOnly ? "ref" : numeric, supplierId || "", exclude].join("|") : null;

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    const timer = setTimeout(() => {
      api("/price-analytics/check-price", {
        method: "POST",
        body: JSON.stringify({ itemId, unit, unitPrice: referenceOnly ? undefined : numeric, supplierId: supplierId || undefined, excludeReceiptItemIds: exclude ? exclude.split(",") : [] }),
      }).then(
        (data) => { if (alive) setState({ key, data, error: null }); },
        (error) => { if (alive) setState({ key, data: null, error: error.message }); },
      );
    }, referenceOnly ? 0 : 450);
    return () => { alive = false; clearTimeout(timer); };
  }, [key, itemId, unit, numeric, supplierId, exclude, referenceOnly]);

  if (!active) return null;
  const link = <a href={`/price-analytics?item=${encodeURIComponent(itemId)}`} target="_blank" rel="noreferrer" className="ppw-link">Riwayat harga <FiExternalLink aria-hidden="true" /></a>;
  if (state.key !== key) return <div className="ppw ppw-quiet" aria-live="polite"><span className="ppw-dot" aria-hidden="true" />{referenceOnly ? "Memuat harga referensi…" : "Membandingkan dengan riwayat harga…"}</div>;
  if (state.error) return null; // analytics problems must never get in the way of purchasing
  const { data } = state;
  const ref = data.reference;

  if (data.level === "incomparable") return <div className="ppw ppw-quiet"><FiInfo aria-hidden="true" /><span>{data.reason}</span></div>;
  if (!ref?.sufficient) {
    return <div className="ppw ppw-quiet"><FiInfo aria-hidden="true" /><span>Data historis belum cukup untuk menentukan harga referensi{ref?.totalHistoryCount ? ` (${ref.totalHistoryCount} pembelian tercatat)` : ""}.</span>{ref?.totalHistoryCount ? link : null}</div>;
  }
  if (referenceOnly) {
    return (
      <div className="ppw ppw-ref">
        <span>Harga referensi <b>{money(ref.price)}</b>/{unit} · {ref.supplierName} · {day(ref.date)}
          {data.supplierLatest && data.supplierLatest.supplierId !== ref.supplierId ? <> · terakhir dari supplier ini {money(data.supplierLatest.unitPrice)}</> : null}
        </span>
        {link}
      </div>
    );
  }

  const elevated = ["mild", "strong", "high"].includes(data.level);
  if (!elevated) {
    const lower = data.level === "lower";
    return (
      <div className={`ppw ${lower ? "ppw-good" : "ppw-ok"}`} role="status">
        {lower ? <FiTrendingDown aria-hidden="true" /> : <FiCheckCircle aria-hidden="true" />}
        <span>{lower ? `${pct(data.changePct)} lebih rendah` : "Sesuai"} dari harga referensi {money(ref.price)} ({ref.supplierName}, {day(ref.date)}).</span>
        {link}
      </div>
    );
  }
  return (
    <div className={`ppw ppw-alert ppw-${data.level}`} role="alert">
      <div className="ppw-head">
        <FiAlertTriangle aria-hidden="true" />
        <strong>{TITLE[data.level]}: Harga pembelian ini {pct(data.changePct)} lebih tinggi dibandingkan harga referensi {money(ref.price)}.</strong>
      </div>
      <dl>
        <div><dt>Supplier referensi</dt><dd>{ref.supplierName}</dd></div>
        <div><dt>Tanggal referensi</dt><dd>{day(ref.date)}</dd></div>
        <div><dt>Harga referensi</dt><dd>{money(ref.price)}/{unit}</dd></div>
        <div><dt>Minimum historis</dt><dd>{money(ref.historicalMinimum?.unitPrice)}</dd></div>
        <div><dt>Rata-rata {ref.lookbackDays} hari</dt><dd>{money(ref.recentAverage)}</dd></div>
      </dl>
      <p>Hanya peringatan — penyimpanan tetap bisa dilanjutkan. Harga historis per {unit}, sebelum pajak dan ongkos PO; bukan penawaran supplier saat ini. {link}</p>
    </div>
  );
}
