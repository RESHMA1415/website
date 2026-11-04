import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { STORE_URL, api, discountPercent, formatINR, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import CategorySelect, { flattenCategories } from '../components/CategorySelect.jsx';
import { ACCEPT_IMAGES, DropZone, MediaPicker, useUploader } from '../components/MediaPicker.jsx';
import { ErrorNote, PageTitle, Panel, StatusPill } from '../components/ui.jsx';

// Variant options per product type (PRD §5.2)
const TYPE_OPTIONS = {
  clothing: { keys: ['colour', 'size'], labels: ['Colour', 'Size'], presets: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size', '28', '30', '32', '34', '36', '38', '40'] },
  fashion: { keys: ['colour', 'size'], labels: ['Colour', 'Size'], presets: ['One Size', 'UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'] },
  beauty: { keys: ['shade', 'volume'], labels: ['Shade / Variant', 'Volume / Weight'], presets: [] },
  accessories: { keys: ['colour', 'size'], labels: ['Colour / Finish', 'Size'], presets: ['One Size'] },
};
const TYPE_NAMES = { clothing: 'Clothing', fashion: 'Fashion (bags, footwear…)', beauty: 'Beauty', accessories: 'Accessories' };

// Starting swatch colours for common names; the owner can change any of them
const COMMON_COLOURS = {
  black: '#111111', white: '#FFFFFF', navy: '#14213D', blue: '#1E5AA8', 'sky blue': '#87CEEB', red: '#C62828', maroon: '#800000',
  pink: '#F48FB1', green: '#2E7D32', olive: '#708238', yellow: '#F9D71C', mustard: '#E1AD01', orange: '#FF7A00', grey: '#9E9E9E',
  gray: '#9E9E9E', brown: '#795548', beige: '#E8D8B8', cream: '#FFFDD0', tan: '#D2B48C', purple: '#6A1B9A', lavender: '#B39DDB',
  peach: '#FFCBA4', teal: '#008080', gold: '#D4AF37', silver: '#C0C0C0', khaki: '#C3B091', indigo: '#3F51B5', wine: '#722F37',
};

const splitList = (text) => [...new Set(text.split(',').map((s) => s.trim()).filter(Boolean))];
const keyOf = (combo) => combo.map((v) => v.toLowerCase()).join('|');

const EMPTY = {
  name: '', slug: '', subCategory: '', productType: 'clothing', brand: '', tags: '', shortDescription: '', description: '',
  mrp: '', sellingPrice: '', attributes: {}, sizeChart: '', images: [], videoUrl: '', status: 'draft',
  isFeatured: false, isNewArrival: false, isReturnable: true, lowStockLevel: 5, seo: { title: '', description: '' },
};

// Turns a saved product into form state
function fromProduct(p) {
  const { keys } = TYPE_OPTIONS[p.productType] || TYPE_OPTIONS.clothing;
  const values = (key) => [...new Set(p.variants.map((v) => v.options?.[key]).filter(Boolean))];
  const rows = {};
  const hex = {};
  for (const v of p.variants) {
    const combo = keys.map((k) => v.options?.[k]).filter(Boolean);
    rows[keyOf(combo)] = { _id: v._id, sku: v.sku, stock: v.stock, stockLoaded: v.stock, price: v.price ?? '', mrp: v.mrp ?? '' };
    if (v.options?.colour && v.options.colourHex) hex[v.options.colour] = v.options.colourHex;
  }
  return {
    form: {
      ...EMPTY,
      ...p,
      subCategory: p.subCategory || p.category || '',
      brand: p.brand || '',
      tags: (p.tags || []).join(', '),
      attributes: p.attributes || {},
      sizeChart: p.sizeChart || '',
      videoUrl: p.videoUrl || '',
      lowStockLevel: p.variants[0]?.lowStockLevel ?? 5,
      // Tells the server whether the admin changed the level, so per-option levels set in Inventory survive
      lowStockLevelLoaded: p.variants[0]?.lowStockLevel ?? 5,
      seo: { title: p.seo?.title || '', description: p.seo?.description || '' },
    },
    first: values(keys[0]).join(', '),
    second: values(keys[1]).join(', '),
    rows,
    hex,
  };
}

function Field({ label, id, children, hint, className = 'col-md-6' }) {
  return (
    <div className={className}>
      <label className="form-label" htmlFor={id}>{label}</label>
      {children}
      {hint && <div className="form-text">{hint}</div>}
    </div>
  );
}

function PhotoManager({ images, setImages, colours }) {
  const [picking, setPicking] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const { upload, uploading } = useUploader();
  const add = (items) =>
    setImages((list) => [
      ...list,
      ...items.filter((m) => !list.some((x) => x.url === m.url)).map((m) => ({ url: m.url, mediumUrl: m.mediumUrl, thumbUrl: m.thumbUrl, alt: '' })),
    ]);
  const move = (from, to) =>
    setImages((list) => {
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  return (
    <>
      {images.length > 0 && (
        <div className="photo-list mb-3">
          {images.map((img, i) => (
            <div
              key={img.url}
              className={`photo-item ${dragIndex === i ? 'dragging' : ''}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, i);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              <div className="pic">
                <img src={img.thumbUrl || img.url} alt="" />
                {i === 0 && <span className="main-badge">MAIN</span>}
              </div>
              <div className="tools">
                <button type="button" className="btn btn-light" aria-label="Move left" disabled={i === 0} onClick={() => move(i, i - 1)}><i className="bi bi-chevron-left" /></button>
                <button type="button" className="btn btn-light" aria-label="Move right" disabled={i === images.length - 1} onClick={() => move(i, i + 1)}><i className="bi bi-chevron-right" /></button>
                <button type="button" className="btn btn-light text-danger ms-auto" aria-label="Remove photo" onClick={() => setImages((list) => list.filter((_, j) => j !== i))}><i className="bi bi-trash" /></button>
              </div>
              {colours.length > 0 && (
                <select
                  className="form-select"
                  aria-label="Show this photo for colour"
                  value={img.colour || ''}
                  onChange={(e) => setImages((list) => list.map((x, j) => (j === i ? { ...x, colour: e.target.value || undefined } : x)))}
                >
                  <option value="">All colours</option>
                  {colours.map((c) => <option key={c} value={c}>{c} only</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="row g-2">
        <div className="col-sm-8">
          <DropZone accept={ACCEPT_IMAGES} uploading={uploading} compact onFiles={async (files) => add(await upload(files))} />
        </div>
        <div className="col-sm-4 d-grid">
          <button type="button" className="btn btn-light border" onClick={() => setPicking(true)}>
            <i className="bi bi-images d-block fs-4" />Choose from library
          </button>
        </div>
      </div>
      <div className="form-text">
        The first photo is the main one. Drag photos (or use the arrows) to change the order.
        {colours.length > 0 && ' Pick a colour under a photo to show it only when customers choose that colour.'} Up to 8 photos per colour.
      </div>
      {picking && <MediaPicker multiple onClose={() => setPicking(false)} onSelect={add} />}
    </>
  );
}

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { notify } = useAuth();
  const { data: categories } = useApi('/admin/categories');
  const { data: sizeCharts } = useApi('/admin/size-charts');
  const { data: saved, error: loadError, reload } = useApi(isEdit ? `/admin/products/${id}` : null);
  const { data: settings } = useApi('/settings');

  const [form, setForm] = useState(EMPTY);
  const [firstValues, setFirstValues] = useState('');
  const [secondValues, setSecondValues] = useState('');
  const [rows, setRows] = useState({});
  const [hex, setHex] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [videoPicker, setVideoPicker] = useState(false);
  const [bulkStock, setBulkStock] = useState('');

  useEffect(() => {
    if (!saved) return;
    const state = fromProduct(saved);
    setForm(state.form);
    setFirstValues(state.first);
    setSecondValues(state.second);
    setRows(state.rows);
    setHex(state.hex);
  }, [saved]);

  useEffect(() => {
    if (!isEdit && settings?.orders) setForm((f) => ({ ...f, lowStockLevel: f.lowStockLevel === 5 ? settings.orders.lowStockDefault ?? 5 : f.lowStockLevel }));
  }, [isEdit, settings]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setAttr = (key, value) => setForm((f) => ({ ...f, attributes: { ...f.attributes, [key]: value } }));
  const type = TYPE_OPTIONS[form.productType] || TYPE_OPTIONS.clothing;
  const isBeauty = form.productType === 'beauty';
  const discount = discountPercent(form.mrp, form.sellingPrice);
  const priceError = form.mrp !== '' && form.sellingPrice !== '' && Number(form.sellingPrice) > Number(form.mrp) ? 'Selling price cannot be more than MRP.' : '';

  // Every combination becomes its own variant with its own stock (PRD §5.2)
  const combos = useMemo(() => {
    const a = splitList(firstValues);
    const b = splitList(secondValues);
    if (!a.length) return b.map((y) => [y]);
    if (!b.length) return a.map((x) => [x]);
    return a.flatMap((x) => b.map((y) => [x, y]));
  }, [firstValues, secondValues]);
  const colours = type.keys[0] === 'colour' ? splitList(firstValues) : [];
  const removedVariants = isEdit
    ? Object.entries(rows).filter(([k, r]) => r._id && !combos.some((c) => keyOf(c) === k)).length
    : 0;

  const rowFor = (combo) => rows[keyOf(combo)] || { sku: '', stock: 0, price: '', mrp: '' };
  const setRow = (combo, patch) => setRows((r) => ({ ...r, [keyOf(combo)]: { ...rowFor(combo), ...patch } }));
  const hexFor = (colour) => hex[colour] || COMMON_COLOURS[colour.toLowerCase()] || '#CCCCCC';

  const chooseCategory = (value) => {
    const cat = flattenCategories(categories).find((c) => c._id === value);
    setForm((f) => {
      const productType = cat?.productType || f.productType;
      return { ...f, subCategory: value, productType, isReturnable: isEdit || productType === f.productType ? f.isReturnable : productType !== 'beauty' };
    });
  };
  const chooseType = (value) => setForm((f) => ({ ...f, productType: value, isReturnable: isEdit ? f.isReturnable : value !== 'beauty' }));

  const payload = () => {
    const [k1, k2] = type.keys;
    const a = splitList(firstValues);
    const variants = combos.map((combo) => {
      const row = rowFor(combo);
      const options = {};
      if (a.length && splitList(secondValues).length) {
        options[k1] = combo[0];
        options[k2] = combo[1];
      } else if (a.length) options[k1] = combo[0];
      else options[k2] = combo[0];
      if (options.colour) options.colourHex = hexFor(options.colour);
      return { _id: row._id, options, sku: row.sku, stock: row.stock === '' ? 0 : row.stock, stockLoaded: row.stockLoaded, price: row.price, mrp: row.mrp };
    });
    return { ...form, variants };
  };

  const save = async (event, statusOverride) => {
    event?.preventDefault();
    if (removedVariants && !window.confirm(`${removedVariants} option(s) you removed will be deleted along with their stock. Continue?`)) return;
    setSaving(true);
    setError('');
    try {
      const body = { ...payload(), ...(statusOverride ? { status: statusOverride } : {}) };
      const result = await api(isEdit ? `/admin/products/${id}` : '/admin/products', { method: isEdit ? 'PUT' : 'POST', body });
      notify(isEdit ? 'Product saved' : 'Product created');
      if (isEdit) reload();
      else navigate(`/products/${result._id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && loadError && !saved) {
    return (
      <div className="text-center py-5">
        <h1 className="h4">{loadError.message}</h1>
        <Link to="/products" className="btn btn-orange mt-2">Back to Products</Link>
      </div>
    );
  }
  if (isEdit && !saved) return <div className="text-muted">Loading product…</div>;

  const preview = form.images[0];
  const sizeChartsForType = (sizeCharts || []).filter((c) => (form.productType === 'fashion' ? true : c.type !== 'footwear'));

  return (
    <>
      <PageTitle
        title={isEdit ? `Edit: ${saved.name}` : 'Add Product'}
        subtitle={isEdit ? <>Status: <StatusPill status={saved.status} /> · last saved {new Date(saved.updatedAt).toLocaleString('en-IN')}</> : 'Fill in the details, choose the options and enter stock for each one'}
        actions={
          <>
            {isEdit && saved.status === 'active' && (
              <a href={`${STORE_URL}/product/${saved.slug}`} target="_blank" rel="noreferrer" className="btn btn-light"><i className="bi bi-box-arrow-up-right me-1" />View on store</a>
            )}
            <Link to="/products" className="btn btn-light">Back to list</Link>
          </>
        }
      />
      <ErrorNote error={error} />

      <form onSubmit={save}>
        <div className="row g-3">
          <div className="col-xl-8">
            <div className="d-flex flex-column gap-3">
              <Panel title="Basic Details">
                <div className="row g-3">
                  <Field label="Product name *" id="f-name" className="col-12" hint={`${form.name.length}/120 characters`}>
                    <input id="f-name" className="form-control" maxLength={120} required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Classic Cotton Crew T-Shirt" />
                  </Field>
                  <Field label="Category *" id="f-cat">
                    <CategorySelect id="f-cat" tree={categories} value={form.subCategory} onChange={chooseCategory} required />
                  </Field>
                  <Field label="Product type *" id="f-type" hint="Decides the options: sizes & colours, or shades & volumes for beauty.">
                    <select id="f-type" className="form-select" value={form.productType} onChange={(e) => chooseType(e.target.value)}>
                      {Object.entries(TYPE_NAMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </Field>
                  <Field label="Brand" id="f-brand">
                    <input id="f-brand" className="form-control" maxLength={60} value={form.brand} onChange={(e) => set('brand', e.target.value)} />
                  </Field>
                  <Field label="Tags" id="f-tags" hint="Separate with commas. Helps customers find it in search.">
                    <input id="f-tags" className="form-control" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="summer, party wear" />
                  </Field>
                  <Field label="Short description *" id="f-short" className="col-12" hint="1–2 lines shown near the price">
                    <input id="f-short" className="form-control" maxLength={300} required value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} />
                  </Field>
                  <Field label="Full description *" id="f-desc" className="col-12">
                    <textarea id="f-desc" className="form-control" rows={5} required value={form.description} onChange={(e) => set('description', e.target.value)} />
                  </Field>
                </div>
              </Panel>

              <Panel title="Price">
                <div className="row g-3 align-items-end">
                  <Field label="MRP (original price) *" id="f-mrp" className="col-sm-4">
                    <div className="input-group"><span className="input-group-text">₹</span>
                      <input id="f-mrp" type="number" min="1" step="1" className="form-control" required value={form.mrp} onChange={(e) => set('mrp', e.target.value)} />
                    </div>
                  </Field>
                  <Field label="Selling price *" id="f-price" className="col-sm-4">
                    <div className="input-group"><span className="input-group-text">₹</span>
                      <input id="f-price" type="number" min="1" step="1" className={`form-control ${priceError ? 'is-invalid' : ''}`} required value={form.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)} />
                    </div>
                  </Field>
                  <div className="col-sm-4">
                    <div className="p-2 rounded-3 text-center" style={{ background: '#fff6ee' }}>
                      <div className="small text-muted">Customers see</div>
                      <div className="fw-bold text-orange">{discount ? `${discount}% OFF` : 'No discount'}</div>
                      {discount > 0 && <div className="small text-muted">They save {formatINR(form.mrp - form.sellingPrice)}</div>}
                    </div>
                  </div>
                  {priceError && <div className="col-12 text-danger small">{priceError}</div>}
                  <div className="col-12 form-text mt-1">No GST is added. Delivery and Cash on Delivery charges are added at checkout from your Business Settings.</div>
                </div>
              </Panel>

              <Panel title="Options & Stock">
                <div className="row g-3 mb-3">
                  <Field label={`${type.labels[0]} (separate with commas)`} id="f-opt1">
                    <input id="f-opt1" className="form-control" value={firstValues} onChange={(e) => setFirstValues(e.target.value)} placeholder={isBeauty ? 'Ruby Red, Nude Pink' : 'Navy, White'} />
                  </Field>
                  <Field label={`${type.labels[1]} (separate with commas)`} id="f-opt2">
                    <input id="f-opt2" className="form-control" value={secondValues} onChange={(e) => setSecondValues(e.target.value)} placeholder={isBeauty ? '4 g, 30 ml' : 'S, M, L, XL'} />
                    {type.presets.length > 0 && (
                      <div className="d-flex flex-wrap gap-1 mt-2">
                        {type.presets.map((p) => (
                          <button key={p} type="button" className="btn btn-sm btn-light py-0" onClick={() => setSecondValues((v) => (splitList(v).includes(p) ? v : [...splitList(v), p].join(', ')))}>
                            + {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </Field>
                </div>

                {colours.length > 0 && (
                  <div className="mb-3">
                    <div className="form-label">Swatch colours (shown as round buttons on the product page)</div>
                    <div className="d-flex flex-wrap gap-3">
                      {colours.map((c) => (
                        <label key={c} className="d-flex align-items-center gap-2 small">
                          <input type="color" className="form-control form-control-color" value={hexFor(c)} onChange={(e) => setHex((h) => ({ ...h, [c]: e.target.value }))} aria-label={`Swatch colour for ${c}`} />
                          {c}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                  <div className="small text-muted">
                    {combos.length ? `${combos.length} option${combos.length === 1 ? '' : 's'} (each has its own stock):` : 'Type at least one value above to create the options.'}
                  </div>
                  {combos.length > 1 && (
                    <div className="d-flex gap-1 align-items-center">
                      <input type="number" min="0" className="form-control form-control-sm" style={{ width: 90 }} placeholder="Stock" value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} aria-label="Stock for all options" />
                      <button type="button" className="btn btn-sm btn-light border" disabled={bulkStock === ''} onClick={() => combos.forEach((c) => setRow(c, { stock: Number(bulkStock) }))}>
                        Set for all
                      </button>
                    </div>
                  )}
                </div>
                {combos.length > 0 && (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr><th>Option</th><th>SKU</th><th>Stock</th><th>Own price</th><th>Own MRP</th></tr>
                      </thead>
                      <tbody>
                        {combos.map((combo) => {
                          const row = rowFor(combo);
                          const label = combo.join(' / ');
                          return (
                            <tr key={keyOf(combo)}>
                              <td className="fw-semibold text-nowrap">
                                {colours.includes(combo[0]) && <span className="colour-dot me-2" style={{ background: hexFor(combo[0]) }} />}
                                {label}
                                {!row._id && isEdit && <span className="badge bg-light text-orange ms-2">new</span>}
                              </td>
                              <td><input className="form-control form-control-sm" style={{ minWidth: 150 }} placeholder="Auto" value={row.sku} onChange={(e) => setRow(combo, { sku: e.target.value.toUpperCase() })} aria-label={`SKU for ${label}`} /></td>
                              <td>
                                <input type="number" min="0" className={`form-control form-control-sm ${Number(row.stock) === 0 ? 'text-danger' : ''}`} style={{ width: 90 }} value={row.stock} onChange={(e) => setRow(combo, { stock: e.target.value === '' ? '' : Number(e.target.value) })} aria-label={`Stock for ${label}`} />
                              </td>
                              <td><input type="number" min="1" className="form-control form-control-sm" style={{ width: 100 }} placeholder="Same" value={row.price} onChange={(e) => setRow(combo, { price: e.target.value })} aria-label={`Price for ${label}`} /></td>
                              <td><input type="number" min="1" className="form-control form-control-sm" style={{ width: 100 }} placeholder="Same" value={row.mrp} onChange={(e) => setRow(combo, { mrp: e.target.value })} aria-label={`MRP for ${label}`} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="form-text">
                  Leave SKU blank to create one automatically. Leave “Own price” blank to use the main selling price (use it when e.g. XXL costs more).
                  {isEdit && ' Stock changes here are recorded in the stock history.'}
                </div>
                {removedVariants > 0 && <div className="alert alert-warning small py-2 mt-2 mb-0">{removedVariants} existing option(s) will be removed when you save.</div>}
              </Panel>

              <Panel title="Photos & Video">
                <PhotoManager images={form.images} setImages={(fn) => setForm((f) => ({ ...f, images: typeof fn === 'function' ? fn(f.images) : fn }))} colours={colours} />
                <hr />
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <div className="fw-semibold small">Product video (optional, 1 video, up to 60 seconds)</div>
                  {form.videoUrl ? (
                    <>
                      <video src={form.videoUrl} controls muted style={{ width: 160, borderRadius: 8 }} />
                      <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => set('videoUrl', '')}>Remove video</button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-sm btn-light border" onClick={() => setVideoPicker(true)}><i className="bi bi-camera-video me-1" />Add video</button>
                  )}
                </div>
                {videoPicker && <MediaPicker kind="video" onClose={() => setVideoPicker(false)} onSelect={(m) => set('videoUrl', m.url)} />}
              </Panel>

              <Panel title={isBeauty ? 'Ingredients & Usage' : 'Fabric, Fit & Care'}>
                {isBeauty ? (
                  <div className="row g-3">
                    <Field label="Ingredients" id="f-ing" className="col-12"><textarea id="f-ing" className="form-control" rows={2} value={form.attributes.ingredients || ''} onChange={(e) => setAttr('ingredients', e.target.value)} /></Field>
                    <Field label="How to use" id="f-how" className="col-12"><textarea id="f-how" className="form-control" rows={2} value={form.attributes.howToUse || ''} onChange={(e) => setAttr('howToUse', e.target.value)} /></Field>
                    <Field label="Skin type" id="f-skin"><input id="f-skin" className="form-control" value={form.attributes.skinType || ''} onChange={(e) => setAttr('skinType', e.target.value)} placeholder="All skin types" /></Field>
                    <Field label="Shelf life / expiry" id="f-life"><input id="f-life" className="form-control" value={form.attributes.shelfLife || ''} onChange={(e) => setAttr('shelfLife', e.target.value)} placeholder="24 months" /></Field>
                  </div>
                ) : (
                  <div className="row g-3">
                    <Field label="Fabric / material" id="f-fabric"><input id="f-fabric" className="form-control" value={form.attributes.fabric || ''} onChange={(e) => setAttr('fabric', e.target.value)} placeholder="100% Cotton" /></Field>
                    {form.productType === 'clothing' ? (
                      <Field label="Fit" id="f-fit">
                        <select id="f-fit" className="form-select" value={form.attributes.fit || ''} onChange={(e) => setAttr('fit', e.target.value)}>
                          <option value="">–</option><option value="slim">Slim</option><option value="regular">Regular</option><option value="relaxed">Relaxed</option><option value="oversized">Oversized</option>
                        </select>
                      </Field>
                    ) : <div className="col-md-6" />}
                    <Field label="Pattern" id="f-pattern" className="col-md-4"><input id="f-pattern" className="form-control" value={form.attributes.pattern || ''} onChange={(e) => setAttr('pattern', e.target.value)} placeholder="Solid, Printed…" /></Field>
                    <Field label="Sleeve / neck" id="f-sleeve" className="col-md-4"><input id="f-sleeve" className="form-control" value={form.attributes.sleeve || ''} onChange={(e) => setAttr('sleeve', e.target.value)} placeholder="Half sleeve" /></Field>
                    <Field label="Occasion" id="f-occ" className="col-md-4"><input id="f-occ" className="form-control" value={form.attributes.occasion || ''} onChange={(e) => setAttr('occasion', e.target.value)} placeholder="Casual, Festive…" /></Field>
                    <Field label="Wash / care instructions" id="f-care" className="col-12"><input id="f-care" className="form-control" value={form.attributes.care || ''} onChange={(e) => setAttr('care', e.target.value)} /></Field>
                    {(form.productType === 'clothing' || form.productType === 'fashion') && (
                      <Field label="Size chart" id="f-chart" hint={<>Shown as a “Size chart” link on the product page. <Link to="/size-charts">Manage size charts</Link></>}>
                        <select id="f-chart" className="form-select" value={form.sizeChart} onChange={(e) => set('sizeChart', e.target.value)}>
                          <option value="">No size chart</option>
                          {sizeChartsForType.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                      </Field>
                    )}
                  </div>
                )}
              </Panel>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="d-flex flex-column gap-3">
              <Panel title="Publish">
                <label className="form-label" htmlFor="f-status">Status</label>
                <select id="f-status" className="form-select mb-1" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="draft">Draft (not visible yet)</option>
                  <option value="active">Active (visible to customers)</option>
                  <option value="hidden">Hidden (taken off the store)</option>
                </select>
                {form.status === 'active' && !form.images.length && <div className="small text-danger mb-2">Add at least one photo to make it Active.</div>}
                <div className="mb-3" />
                {[
                  ['isFeatured', 'Feature on homepage'],
                  ['isNewArrival', 'Mark as New Arrival'],
                  ['isReturnable', 'Returnable (7-day returns)'],
                ].map(([key, label]) => (
                  <div key={key} className="form-check form-switch mb-2">
                    <input className="form-check-input" type="checkbox" id={`f-${key}`} checked={Boolean(form[key])} onChange={(e) => set(key, e.target.checked)} />
                    <label className="form-check-label" htmlFor={`f-${key}`}>{label}</label>
                  </div>
                ))}
                {isBeauty && form.isReturnable && <div className="small text-orange mb-2">Beauty products are usually non-returnable for hygiene reasons.</div>}
                <label className="form-label mt-2" htmlFor="f-low">Low-stock alert when an option has</label>
                <div className="input-group mb-3">
                  <input id="f-low" type="number" min="0" className="form-control" value={form.lowStockLevel} onChange={(e) => set('lowStockLevel', e.target.value)} />
                  <span className="input-group-text">or fewer left</span>
                </div>
                {isEdit && <div className="form-text mt-n2 mb-3">Changing this applies it to every option. Levels set per option in Inventory are kept otherwise.</div>}
                <button type="submit" className="btn btn-orange w-100" disabled={saving || Boolean(priceError)}>
                  {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Product'}
                </button>
                {form.status !== 'active' && form.images.length > 0 && (
                  <button type="button" className="btn btn-outline-secondary w-100 mt-2" disabled={saving} onClick={(e) => save(e, 'active')}>
                    Save & make Active
                  </button>
                )}
              </Panel>

              <Panel title="Customer Preview">
                <div className="preview-card">
                  <div className="pic">
                    {preview ? <img src={preview.mediumUrl || preview.url} alt="" /> : <span className="small"><i className="bi bi-image fs-2 d-block text-center" />No photo yet</span>}
                    {form.isNewArrival && <span className="badge bg-dark position-absolute top-0 start-0 m-2">NEW</span>}
                  </div>
                  <div className="p-3">
                    {form.brand && <div className="small text-muted text-uppercase">{form.brand}</div>}
                    <div className="fw-semibold">{form.name || 'Product name'}</div>
                    <div>
                      <strong>{formatINR(form.sellingPrice)}</strong>{' '}
                      {discount > 0 && <><s className="small text-muted">{formatINR(form.mrp)}</s> <span className="small off">{discount}% OFF</span></>}
                    </div>
                    {form.shortDescription && <div className="small text-muted mt-1">{form.shortDescription}</div>}
                  </div>
                </div>
                <div className="form-text">This is how the product card looks on your store.</div>
              </Panel>

              <Panel title="Search Engine (SEO)">
                <Field label="Web address" id="f-slug" className="mb-2" hint={`${STORE_URL.replace(/^https?:\/\//, '')}/product/${form.slug || 'auto-from-name'}`}>
                  <input id="f-slug" className="form-control" value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="Auto-filled from name" />
                </Field>
                <Field label="Page title" id="f-seo-title" className="mb-2">
                  <input id="f-seo-title" className="form-control" maxLength={70} value={form.seo.title} onChange={(e) => set('seo', { ...form.seo, title: e.target.value })} placeholder="Auto-filled from name" />
                </Field>
                <Field label="Description" id="f-seo-desc">
                  <textarea id="f-seo-desc" className="form-control" rows={2} maxLength={160} value={form.seo.description} onChange={(e) => set('seo', { ...form.seo, description: e.target.value })} placeholder="Auto-filled from short description" />
                </Field>
              </Panel>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
