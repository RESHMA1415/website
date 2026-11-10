import { useMemo, useRef, useState } from 'react';
import { formatINR } from '../api.js';

// Small hand-built charts (no chart library). Colours are the validated chart
// palette slots (blue #2a78d6, orange #eb6834); text always uses text colours.
export const SERIES = ['#2a78d6', '#eb6834'];
const GRID = '#e9ebf0';
const MUTED = '#6b7280';

const compact = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : `₹${n}`);

function niceMax(v) {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= v);
}

const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * Sales over time: one line with a light area wash, hover crosshair + tooltip.
 * points = [{ period: 'YYYY-MM-DD' | 'YYYY-Www' | 'YYYY-MM', sales, orders }]
 */
export function SalesLine({ points = [], height = 240, label = 'Net sales' }) {
  const box = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 640;
  const H = height;
  const pad = { l: 52, r: 16, t: 14, b: 28 };
  const max = niceMax(Math.max(0, ...points.map((p) => p.sales)));
  const x = (i) => pad.l + (points.length < 2 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.sales).toFixed(1)}`).join(' ');
  const area = points.length ? `${path} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : '';
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const isDay = /^\d{4}-\d{2}-\d{2}$/.test(points[0]?.period || '');
  const name = (p) => (isDay ? dayLabel(p.period) : p.period);
  const every = Math.max(1, Math.ceil(points.length / 7));

  const onMove = (e) => {
    if (!points.length) return;
    const rect = box.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  };
  const h = hover != null ? points[hover] : null;

  if (!points.length) return <div className="chart-empty">No sales in this period yet.</div>;
  return (
    <div className="chart-wrap" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${label} over time`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} onTouchStart={(e) => onMove(e.touches[0])}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{compact(t)}</text>
          </g>
        ))}
        {points.map((p, i) => (i % every === 0 || i === points.length - 1) && (
          <text key={p.period} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={MUTED}>{name(p)}</text>
        ))}
        <path d={area} fill={SERIES[0]} opacity="0.1" />
        <path d={path} fill="none" stroke={SERIES[0]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke={MUTED} strokeWidth="1" />
            <circle cx={x(hover)} cy={y(h.sales)} r="5" fill={SERIES[0]} stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <div className="fw-semibold">{name(h)}</div>
          <div>{label}: {formatINR(h.sales)}</div>
          <div>{h.orders} order{h.orders === 1 ? '' : 's'}</div>
        </div>
      )}
    </div>
  );
}

/** Horizontal bars (one series): rows = [{ label, value, sub? }] */
export function BarList({ rows = [], format = formatINR, empty = 'Nothing to show yet.', color = SERIES[0] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <div className="chart-empty">{empty}</div>;
  return (
    <ul className="bar-list">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${format(r.value)}${r.sub ? ` · ${r.sub}` : ''}`}>
          <div className="d-flex justify-content-between small gap-2">
            <span className="text-truncate">{r.label}</span>
            <span className="fw-semibold text-nowrap">{format(r.value)}{r.sub && <span className="text-muted fw-normal"> · {r.sub}</span>}</span>
          </div>
          <div className="bar-track"><div style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Two-part split (e.g. Online vs COD) with legend and values */
export function SplitBar({ parts = [], format = formatINR }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <div className="chart-empty">No sales in this period yet.</div>;
  return (
    <div>
      <div className="split-bar" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', ')}>
        {parts.map((p, i) => p.value > 0 && <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: SERIES[i] }} title={`${p.label}: ${format(p.value)}`} />)}
      </div>
      <ul className="list-unstyled small mt-2 mb-0">
        {parts.map((p, i) => (
          <li key={p.label} className="d-flex justify-content-between">
            <span><span className="legend-dot" style={{ background: SERIES[i] }} />{p.label}{p.sub ? <span className="text-muted"> · {p.sub}</span> : null}</span>
            <span className="fw-semibold">{format(p.value)} <span className="text-muted fw-normal">({Math.round((p.value / total) * 100)}%)</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Date range: Today / Last 7 days / This month / Custom ----------
const ymd = (d) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
export function presetRange(preset) {
  const today = new Date();
  const t = ymd(today);
  if (preset === 'today') return { from: t, to: t };
  if (preset === '7d') return { from: ymd(new Date(today.getTime() - 6 * 86400000)), to: t };
  if (preset === '30d') return { from: ymd(new Date(today.getTime() - 29 * 86400000)), to: t };
  if (preset === 'month') return { from: `${t.slice(0, 8)}01`, to: t };
  return null;
}

export function DateRange({ value, onChange, presets = [['today', 'Today'], ['7d', 'Last 7 days'], ['month', 'This month'], ['30d', 'Last 30 days']] }) {
  const [custom, setCustom] = useState(value.preset === 'custom');
  const pick = (preset) => {
    setCustom(false);
    onChange({ preset, ...presetRange(preset) });
  };
  return (
    <div className="d-flex flex-wrap gap-2 align-items-center">
      <div className="btn-group btn-group-sm flex-wrap" role="group" aria-label="Date range">
        {presets.map(([key, label]) => (
          <button key={key} type="button" className={`btn ${value.preset === key && !custom ? 'btn-navy' : 'btn-light'}`} onClick={() => pick(key)}>{label}</button>
        ))}
        <button type="button" className={`btn ${custom ? 'btn-navy' : 'btn-light'}`} onClick={() => setCustom(true)}>Custom</button>
      </div>
      {custom && (
        <>
          <input type="date" className="form-control form-control-sm" style={{ width: 'auto' }} aria-label="From date" value={value.from} max={value.to} onChange={(e) => onChange({ ...value, preset: 'custom', from: e.target.value })} />
          <span className="small text-muted">to</span>
          <input type="date" className="form-control form-control-sm" style={{ width: 'auto' }} aria-label="To date" value={value.to} min={value.from} onChange={(e) => onChange({ ...value, preset: 'custom', to: e.target.value })} />
        </>
      )}
    </div>
  );
}

export function useRange(preset = '30d') {
  return useState(() => ({ preset, ...presetRange(preset) }));
}

export function useRangeQuery(range, extra = {}) {
  return useMemo(() => new URLSearchParams({ from: range.from, to: range.to, ...extra }).toString(), [range.from, range.to, JSON.stringify(extra)]);
}
