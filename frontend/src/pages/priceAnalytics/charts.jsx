import { monthLabel, rupiah, rupiahShort } from "./format";

// Monthly purchase value as simple bars (no chart library needed).
export function MonthlyBars({ months }) {
  if (!months?.length) return <p className="pa-muted">Belum ada pembelian.</p>;
  const max = Math.max(...months.map((m) => m.amount), 1);
  const peak = months.reduce((a, b) => (b.amount > a.amount ? b : a));
  const step = months.length > 14 ? 3 : months.length > 7 ? 2 : 1;
  return (
    <figure className="pa-bars" aria-label="Nilai pembelian per bulan">
      <div className="pa-bars-plot">
        {months.map((m) => (
          <div key={m.month} className={`pa-bar ${m.month === peak.month ? "peak" : ""}`} title={`${monthLabel(m.month)}: ${rupiah(m.amount)}`}>
            <i style={{ height: `${Math.max(m.amount ? 3 : 0, (m.amount / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="pa-bars-axis" aria-hidden="true">
        {months.map((m, i) => <span key={m.month}>{i % step === 0 || i === months.length - 1 ? monthLabel(m.month) : ""}</span>)}
      </div>
      <figcaption>Tertinggi <b>{monthLabel(peak.month)}</b> · {rupiahShort(peak.amount)}</figcaption>
    </figure>
  );
}

export function ShareList({ rows, onOpen }) {
  if (!rows?.length) return <p className="pa-muted">Belum ada pembelian.</p>;
  return (
    <ul className="pa-share">
      {rows.map((row) => (
        <li key={row.supplierId}>
          <button type="button" onClick={() => onOpen(row.supplierId)}>
            <span className="pa-share-top"><b>{row.supplierName}</b><strong>{rupiahShort(row.amount)}</strong></span>
            <span className="pa-share-bar"><i style={{ width: `${Math.max(2, row.share)}%` }} /></span>
            <small>{row.share.toLocaleString("id-ID")}% · {row.transactionCount} pembelian</small>
          </button>
        </li>
      ))}
    </ul>
  );
}
