import { useEffect, useMemo, useRef, useState } from "react";
import { FiTrendingUp } from "react-icons/fi";
import { EmptyState } from "./ui";
import { PRICE_STATUS, dateLabel, qty as fmtQty, rupiah, rupiahShort, supplierColor } from "./format";

const DAY = 86400000;
const wibDay = (value) => new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 10);

function niceTicks(min, max, count = 5) {
  if (min === max) { const pad = Math.max(1, Math.abs(min) * 0.1); min -= pad; max += pad; }
  const raw = (max - min) / Math.max(1, count - 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) || raw;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export default function PriceChart({ points, supplierOrder, average, reference }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(720);
  const [only, setOnly] = useState(null);
  const [hoverId, setHoverId] = useState(null);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const suppliers = useMemo(() => {
    const present = new Set(points.map((p) => p.supplierId));
    return supplierOrder.filter((s) => present.has(s.id));
  }, [points, supplierOrder]);
  const activeOnly = only && suppliers.some((s) => s.id === only) ? only : null;
  const visible = useMemo(
    () => points.filter((p) => !activeOnly || p.supplierId === activeOnly).map((p) => ({ ...p, t: new Date(p.date).getTime() })).sort((a, b) => a.t - b.t || a.unitPrice - b.unitPrice),
    [points, activeOnly],
  );

  const narrow = width < 560;
  const height = narrow ? 240 : 300;
  const margin = { top: 18, right: narrow ? 12 : 20, bottom: 34, left: narrow ? 58 : 74 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const scales = useMemo(() => {
    if (!visible.length) return null;
    let t0 = visible[0].t;
    let t1 = visible[visible.length - 1].t;
    if (t1 - t0 < 2 * DAY) { t0 -= 10 * DAY; t1 += 10 * DAY; }
    const pad = (t1 - t0) * 0.04;
    t0 -= pad; t1 += pad;
    const prices = visible.map((p) => p.unitPrice).concat(average ? [average] : []);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    const spread = hi - lo || hi * 0.1;
    const yTicks = niceTicks(Math.max(0, lo - spread * 0.15), hi + spread * 0.15, narrow ? 4 : 5);
    const y0 = yTicks[0];
    const y1 = yTicks[yTicks.length - 1];
    const x = (t) => margin.left + ((t - t0) / (t1 - t0)) * innerW;
    const y = (v) => margin.top + innerH - ((v - y0) / (y1 - y0)) * innerH;
    const span = t1 - t0;
    const xCount = narrow ? 3 : 5;
    const xTicks = Array.from({ length: xCount }, (_, i) => t0 + pad + ((span - 2 * pad) * i) / (xCount - 1));
    const xFmt = (t) => new Date(t).toLocaleDateString("id-ID", span > 300 * DAY ? { month: "short", year: "2-digit", timeZone: "Asia/Jakarta" } : { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
    return { x, y, yTicks, xTicks, xFmt };
  }, [visible, average, narrow, innerW, innerH, margin.left, margin.top]);

  const hovered = visible.find((p) => p.id === hoverId) || null;
  const sameDay = hovered ? visible.filter((p) => wibDay(p.date) === wibDay(hovered.date)) : [];

  function nearest(clientX, clientY) {
    if (!scales || !visible.length) return;
    const rect = wrapRef.current.querySelector("svg").getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    let best = null;
    let bestD = Infinity;
    for (const p of visible) {
      const dx = scales.x(p.t) - px;
      const dy = (scales.y(p.unitPrice) - py) * 0.35;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = p; }
    }
    setHoverId(best?.id ?? null);
  }

  function onKeyDown(event) {
    if (!visible.length) return;
    const index = visible.findIndex((p) => p.id === hoverId);
    if (event.key === "ArrowRight") { event.preventDefault(); setHoverId(visible[Math.min(visible.length - 1, index + 1)].id); }
    if (event.key === "ArrowLeft") { event.preventDefault(); setHoverId(visible[Math.max(0, index < 0 ? visible.length - 1 : index - 1)].id); }
    if (event.key === "Escape") setHoverId(null);
  }

  const tooltipLeft = hovered && scales ? Math.min(Math.max(scales.x(hovered.t), 130), width - 130) : 0;
  const tooltipTop = hovered && scales ? scales.y(hovered.unitPrice) : 0;
  const flipDown = tooltipTop < 150;

  return (
    <div className="pa-chart">
      {suppliers.length > 0 && (
        <div className="pa-legend" role="group" aria-label="Filter supplier pada grafik">
          <button type="button" className={!activeOnly ? "active" : ""} aria-pressed={!activeOnly} onClick={() => setOnly(null)}>Semua supplier</button>
          {suppliers.map((s) => (
            <button type="button" key={s.id} className={activeOnly === s.id ? "active" : ""} aria-pressed={activeOnly === s.id} onClick={() => setOnly(activeOnly === s.id ? null : s.id)}>
              <i style={{ background: supplierColor(supplierOrder, s.id) }} aria-hidden="true" />{s.name}
            </button>
          ))}
        </div>
      )}
      <div className="pa-chart-canvas" ref={wrapRef}>
        {visible.length < 2 ? (
          <div className="pa-chart-empty" style={{ height }}>
            <EmptyState icon={<FiTrendingUp />} title="Data historis belum cukup untuk grafik tren" compact>
              {visible.length === 1
                ? `Baru ada 1 pembelian dalam periode ini: ${rupiah(visible[0].unitPrice)} dari ${visible[0].supplierName} (${dateLabel(visible[0].date)}).`
                : "Tidak ada pembelian dalam periode ini. Coba periode yang lebih panjang."}
            </EmptyState>
          </div>
        ) : (
          <>
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={`Grafik harga satuan dari ${visible.length} pembelian. Gunakan panah kiri/kanan untuk melihat tiap pembelian.`}
              tabIndex={0}
              onKeyDown={onKeyDown}
              onPointerMove={(event) => nearest(event.clientX, event.clientY)}
              onPointerDown={(event) => nearest(event.clientX, event.clientY)}
              onPointerLeave={(event) => { if (event.pointerType === "mouse") setHoverId(null); }}
              onBlur={() => setHoverId(null)}
            >
              {scales.yTicks.map((v) => (
                <g key={v}>
                  <line x1={margin.left} x2={width - margin.right} y1={scales.y(v)} y2={scales.y(v)} className="pa-grid" />
                  <text x={margin.left - 10} y={scales.y(v)} className="pa-axis" textAnchor="end" dominantBaseline="middle">{rupiahShort(v)}</text>
                </g>
              ))}
              {scales.xTicks.map((t) => <text key={t} x={scales.x(t)} y={height - 10} className="pa-axis" textAnchor="middle">{scales.xFmt(t)}</text>)}
              {average > 0 && (
                <g>
                  <line x1={margin.left} x2={width - margin.right} y1={scales.y(average)} y2={scales.y(average)} className="pa-avg-line" />
                  <text x={width - margin.right - 4} y={scales.y(average) - 6} className="pa-avg-label" textAnchor="end">Rata-rata {rupiah(average)}</text>
                </g>
              )}
              {suppliers.filter((s) => !activeOnly || s.id === activeOnly).map((s) => {
                const series = visible.filter((p) => p.supplierId === s.id);
                if (series.length < 2) return null;
                const d = series.map((p, i) => `${i ? "L" : "M"}${scales.x(p.t).toFixed(1)},${scales.y(p.unitPrice).toFixed(1)}`).join(" ");
                return <path key={s.id} d={d} fill="none" stroke={supplierColor(supplierOrder, s.id)} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" opacity={hovered && hovered.supplierId !== s.id ? 0.35 : 1} />;
              })}
              {hovered && <line x1={scales.x(hovered.t)} x2={scales.x(hovered.t)} y1={margin.top} y2={margin.top + innerH} className="pa-crosshair" />}
              {visible.map((p) => {
                const active = hovered && p.id === hovered.id;
                const color = supplierColor(supplierOrder, p.supplierId);
                return (
                  <circle key={p.id} cx={scales.x(p.t)} cy={scales.y(p.unitPrice)} r={active ? 7 : 4.5}
                    fill={p.priceStatus === "INVOICE" ? color : "#fff"} stroke={color} strokeWidth={p.priceStatus === "INVOICE" ? 1.5 : 2.25} />
                );
              })}
            </svg>
            {hovered && (
              <div className={`pa-tooltip ${flipDown ? "down" : ""}`} style={{ left: tooltipLeft, top: tooltipTop }} role="status">
                <strong>{dateLabel(hovered.date)}{sameDay.length > 1 ? ` · ${sameDay.length} pembelian` : ""}</strong>
                {sameDay.map((p) => (
                  <div key={p.id} className={p.id === hovered.id ? "on" : ""}>
                    <i style={{ background: supplierColor(supplierOrder, p.supplierId) }} aria-hidden="true" />
                    <span>{p.supplierName}<small>{fmtQty(p.qty)} {p.unit} · {p.poNumber || "—"}{p.priceStatus !== "INVOICE" ? ` · ${PRICE_STATUS[p.priceStatus]?.label || ""}` : ""}</small></span>
                    <b>{rupiah(p.unitPrice)}</b>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <p className="pa-chart-note">
        <span><i className="dot solid" aria-hidden="true" /> Harga invoice</span>
        <span><i className="dot hollow" aria-hidden="true" /> Harga sementara (belum diinvoice)</span>
        {average > 0 && <span><i className="dash" aria-hidden="true" /> Rata-rata tertimbang periode</span>}
        {reference?.sufficient && <span>Referensi: {rupiah(reference.price)}</span>}
      </p>
    </div>
  );
}
