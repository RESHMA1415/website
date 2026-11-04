import { useEffect, useState } from 'react';
import { formatINR } from '../utils/format.js';

// Sidebar filters for shop, category, new arrival and search pages (PRD §13.3).
// Every filter lives in the page address, so a filtered page can be shared.

export const LIST_KEYS = ['size', 'colour', 'shade', 'brand', 'fabric', 'fit', 'occasion', 'skinType'];
export const FILTER_KEYS = [...LIST_KEYS, 'minPrice', 'maxPrice', 'rating', 'discount', 'inStock'];

const LABELS = {
  size: 'Size', colour: 'Colour', shade: 'Shade', brand: 'Brand', fabric: 'Fabric', fit: 'Fit', occasion: 'Occasion', skinType: 'Skin type',
};

export const readList = (params, key) => (params.get(key) || '').split(',').filter(Boolean);

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="filter-section">
      <button type="button" className="filter-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {title} <i className={`bi ${open ? 'bi-dash' : 'bi-plus'}`} />
      </button>
      {open && <div className="pt-2">{children}</div>}
    </div>
  );
}

function PriceRange({ bounds, params, onChange }) {
  const floor = Math.floor((bounds.min || 0) / 50) * 50;
  const ceil = Math.ceil((bounds.max || 0) / 50) * 50;
  const [low, setLow] = useState(Number(params.get('minPrice')) || floor);
  const [high, setHigh] = useState(Number(params.get('maxPrice')) || ceil);

  useEffect(() => {
    setLow(Number(params.get('minPrice')) || floor);
    setHigh(Number(params.get('maxPrice')) || ceil);
  }, [params, floor, ceil]);

  // Apply once the shopper stops dragging
  useEffect(() => {
    const timer = setTimeout(() => {
      const nextMin = low > floor ? String(low) : '';
      const nextMax = high < ceil ? String(high) : '';
      if (nextMin !== (params.get('minPrice') || '') || nextMax !== (params.get('maxPrice') || '')) {
        onChange({ minPrice: nextMin, maxPrice: nextMax });
      }
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [low, high]);

  if (ceil <= floor) return null;
  const pct = (v) => ((v - floor) / (ceil - floor)) * 100;
  return (
    <Section title="Price">
      <div className="d-flex justify-content-between small fw-semibold mb-2">
        <span>{formatINR(low)}</span>
        <span>{formatINR(high)}{high >= ceil ? '+' : ''}</span>
      </div>
      <div className="price-slider">
        <div className="track" />
        <div className="range" style={{ left: `${pct(low)}%`, right: `${100 - pct(high)}%` }} />
        <input type="range" min={floor} max={ceil} step={50} value={low} aria-label="Minimum price" onChange={(e) => setLow(Math.min(Number(e.target.value), high - 50))} />
        <input type="range" min={floor} max={ceil} step={50} value={high} aria-label="Maximum price" onChange={(e) => setHigh(Math.max(Number(e.target.value), low + 50))} />
      </div>
    </Section>
  );
}

export default function ShopFilters({ facets, params, onChange }) {
  if (!facets) return <div className="small text-muted py-2">Loading filters…</div>;

  const toggle = (key, value) => {
    const list = readList(params, key);
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    onChange({ [key]: next.join(',') });
  };
  const checkList = (key, values, render = (v) => v) =>
    values.length > 0 && (
      <Section title={LABELS[key]} defaultOpen={values.length <= 8 || readList(params, key).length > 0}>
        <div className="filter-options">
          {values.map((value) => (
            <label key={value} className="form-check small">
              <input className="form-check-input" type="checkbox" checked={readList(params, key).includes(value)} onChange={() => toggle(key, value)} />
              <span className="form-check-label text-capitalize-first">{render(value)}</span>
            </label>
          ))}
        </div>
      </Section>
    );

  return (
    <>
      <PriceRange bounds={facets.price} params={params} onChange={onChange} />

      {facets.sizes.length > 0 && (
        <Section title="Size">
          <div className="d-flex flex-wrap gap-2">
            {facets.sizes.map((size) => {
              const on = readList(params, 'size').includes(size);
              return (
                <button key={size} type="button" className={`option-btn option-btn-sm ${on ? 'selected' : ''}`} aria-pressed={on} onClick={() => toggle('size', size)}>
                  {size}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {facets.colours.length > 0 && (
        <Section title="Colour">
          <div className="d-flex flex-wrap gap-2">
            {facets.colours.map((c) => {
              const on = readList(params, 'colour').includes(c.name);
              return (
                <button
                  key={c.name}
                  type="button"
                  className={`swatch swatch-sm ${on ? 'selected' : ''}`}
                  style={{ background: c.hex || '#ccc' }}
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={on}
                  onClick={() => toggle('colour', c.name)}
                />
              );
            })}
          </div>
          {readList(params, 'colour').length > 0 && <div className="small text-muted mt-2">{readList(params, 'colour').join(', ')}</div>}
        </Section>
      )}

      {checkList('shade', facets.shades)}
      {checkList('brand', facets.brands)}
      {checkList('fabric', facets.fabrics)}
      {checkList('fit', facets.fits, (v) => v[0].toUpperCase() + v.slice(1))}
      {checkList('occasion', facets.occasions)}
      {checkList('skinType', facets.skinTypes)}

      <Section title="Customer rating">
        {[4, 3].map((r) => (
          <label key={r} className="form-check small">
            <input className="form-check-input" type="radio" name="rating" checked={params.get('rating') === String(r)} onChange={() => onChange({ rating: String(r) })} />
            <span className="form-check-label">{r}★ & above</span>
          </label>
        ))}
      </Section>

      <Section title="Discount">
        {[10, 25, 50].map((d) => (
          <label key={d} className="form-check small">
            <input className="form-check-input" type="radio" name="discount" checked={params.get('discount') === String(d)} onChange={() => onChange({ discount: String(d) })} />
            <span className="form-check-label">{d}% off or more</span>
          </label>
        ))}
      </Section>

      <div className="filter-section border-0">
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" id="f-instock" checked={params.get('inStock') === 'true'} onChange={(e) => onChange({ inStock: e.target.checked ? 'true' : '' })} />
          <label className="form-check-label small fw-semibold" htmlFor="f-instock">In stock only</label>
        </div>
      </div>
    </>
  );
}

// Chips above the results showing each active filter, with ×
export function ActiveFilters({ params, onChange, onClear }) {
  const chips = [];
  for (const key of LIST_KEYS) {
    for (const value of readList(params, key)) {
      chips.push({ label: `${LABELS[key]}: ${value}`, remove: () => onChange({ [key]: readList(params, key).filter((v) => v !== value).join(',') }) });
    }
  }
  if (params.get('minPrice') || params.get('maxPrice')) {
    chips.push({
      label: `Price: ${params.get('minPrice') ? formatINR(params.get('minPrice')) : '₹0'} – ${params.get('maxPrice') ? formatINR(params.get('maxPrice')) : 'any'}`,
      remove: () => onChange({ minPrice: '', maxPrice: '' }),
    });
  }
  if (params.get('rating')) chips.push({ label: `${params.get('rating')}★ & above`, remove: () => onChange({ rating: '' }) });
  if (params.get('discount')) chips.push({ label: `${params.get('discount')}%+ off`, remove: () => onChange({ discount: '' }) });
  if (params.get('inStock')) chips.push({ label: 'In stock', remove: () => onChange({ inStock: '' }) });
  if (!chips.length) return null;
  return (
    <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
      {chips.map((chip) => (
        <button key={chip.label} type="button" className="filter-chip" onClick={chip.remove} aria-label={`Remove filter ${chip.label}`}>
          {chip.label} <i className="bi bi-x" />
        </button>
      ))}
      <button type="button" className="btn btn-link btn-sm p-0" onClick={onClear}>Clear all</button>
    </div>
  );
}
