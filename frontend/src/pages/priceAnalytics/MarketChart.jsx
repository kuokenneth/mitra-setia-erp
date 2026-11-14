import { useState } from 'react';
import { dateLabel, rupiah, rupiahShort } from './format';
import { EmptyState } from './ui';
const SERIES = [{ key: 'internal', label: 'Pembelian internal', color: '#176749' }, { key: 'median', label: 'Median listing terverifikasi', color: '#4169b2' }, { key: 'lowest', label: 'Listing terendah', color: '#c78d37' }];
export default function MarketChart({ internal, observations }) {
  const [only, setOnly] = useState('all');
  const [focused, setFocused] = useState(null);
  const all = [...internal.map(p => ({ ...p, key: 'internal' })), ...observations.flatMap(p => [{ id: `median-${p.date}`, date: p.date, price: p.median, key: 'median', count: p.count }, { id: `low-${p.date}`, date: p.date, price: p.lowest, key: 'lowest', count: p.count }])].filter(p => p.price != null);
  if (!all.length) return <EmptyState title="Belum ada histori yang sebanding">Grafik terisi dari pembelian aktual dan tanggal pengamatan listing yang telah diverifikasi.</EmptyState>;
  const points = all.filter(p => only === 'all' || p.key === only);
  const t0 = Math.min(...all.map(p => +new Date(p.date))), t1 = Math.max(...all.map(p => +new Date(p.date)));
  const lo = Math.min(...all.map(p => p.price)) * .9, hi = Math.max(...all.map(p => p.price)) * 1.1;
  const x = p => 90 + ((+new Date(p.date) - t0) / (t1 - t0 || 1)) * 760;
  const y = v => 225 - ((v - lo) / (hi - lo || 1)) * 195;
  const selected = all.find(p => p.id === focused);
  return <div className="mp-chart"><div className="pa-legend"><button type="button" className={only === 'all' ? 'active' : ''} onClick={() => setOnly('all')}>Semua seri</button>{SERIES.map(s => <button type="button" key={s.key} className={only === s.key ? 'active' : ''} onClick={() => setOnly(s.key)}><i style={{ background: s.color }}/>{s.label}</button>)}</div>
    <svg viewBox="0 0 900 270" role="img" aria-label="Perbandingan harga pembelian dan pengamatan pasar">
      {[0, 1, 2, 3, 4].map(i => { const v = lo + (hi - lo) * i / 4; return <g key={i}><line x1="90" x2="850" y1={y(v)} y2={y(v)} stroke="#e6eeea"/><text x="80" y={y(v) + 4} textAnchor="end" fontSize="12" fill="#708178">{rupiahShort(v)}</text></g>; })}
      {SERIES.map(s => { const group = points.filter(p => p.key === s.key).sort((a, b) => +new Date(a.date) - +new Date(b.date)); return <g key={s.key}>{group.length > 1 && <path d={group.map((p, i) => `${i ? 'L' : 'M'}${x(p)},${y(p.price)}`).join(' ')} stroke={s.color} strokeDasharray={s.key === 'internal' ? undefined : '5 5'} fill="none" strokeWidth="2"/>}{group.map(p => <circle key={p.id} cx={x(p)} cy={y(p.price)} r={focused === p.id ? 7 : 5} fill={s.color} tabIndex={0} role="button" aria-label={`${s.label}, ${dateLabel(p.date)}, ${rupiah(p.price)}`} onFocus={() => setFocused(p.id)} onMouseEnter={() => setFocused(p.id)} onClick={() => setFocused(p.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setFocused(p.id); }}><title>{s.label} · {dateLabel(p.date)} · {rupiah(p.price)}</title></circle>)}</g>; })}
      <text x="90" y="255" fontSize="12" fill="#708178">{dateLabel(new Date(t0))}</text><text x="850" y="255" textAnchor="end" fontSize="12" fill="#708178">{dateLabel(new Date(t1))}</text>
    </svg><p className="mp-chart-detail" aria-live="polite">{selected ? `${SERIES.find(s => s.key === selected.key).label} · ${dateLabel(selected.date)} · ${rupiah(selected.price)}${selected.count ? ` · ${selected.count} listing` : ` · ${selected.supplier}`}` : 'Arahkan kursor atau pilih titik untuk melihat harga dan tanggalnya.'}</p><p className="pa-fineprint">Garis putus-putus menghubungkan tanggal pengamatan pasar, bukan transaksi pembelian. Harga di antara dua pengamatan tidak diketahui.</p></div>;
}
