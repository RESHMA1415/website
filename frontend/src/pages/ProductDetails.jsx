import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import Price from '../components/Price.jsx';
import ProductGrid from '../components/ProductGrid.jsx';
import ProductGallery from '../components/ProductGallery.jsx';
import Stars from '../components/Stars.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { formatINR, whatsappLink } from '../utils/format.js';

const RECENT_KEY = 'shopme.recentlyViewed';
const OPTION_LABELS = { colour: 'Colour', size: 'Size', shade: 'Shade', volume: 'Size' };

function optionKeysFor(product) {
  return product.productType === 'beauty' ? ['shade', 'volume'] : ['colour', 'size'];
}

function readRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

function rememberViewed(product) {
  try {
    const summary = {
      _id: product._id, slug: product.slug, name: product.name, brand: product.brand,
      sellingPrice: product.sellingPrice, mrp: product.mrp, discountPercent: product.discountPercent,
      inStock: product.inStock, images: product.images?.slice(0, 1), productType: product.productType,
      createdAt: product.createdAt, isNewArrival: product.isNewArrival,
      ratingAverage: product.ratingAverage, ratingCount: product.ratingCount,
    };
    const list = [summary, ...readRecent().filter((p) => p.slug !== product.slug)].slice(0, 9);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Browser storage unavailable; recently viewed is optional
  }
}

function matches(variant, selection, skipKey) {
  return Object.entries(selection).every(([key, value]) => key === skipKey || !value || variant.options?.[key] === value);
}

function VariantPicker({ product, selection, setSelection }) {
  const keys = optionKeysFor(product);
  return keys.map((key) => {
    const values = [...new Set(product.variants.map((v) => v.options?.[key]).filter(Boolean))];
    if (!values.length) return null;
    const isAvailable = (value) =>
      product.variants.some((v) => v.options?.[key] === value && v.stock > 0 && matches(v, selection, key));
    const isSwatch = key === 'colour';
    return (
      <div key={key} className="mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="fw-semibold">
            {OPTION_LABELS[key]}: <span className="text-muted fw-normal">{selection[key] || 'Select'}</span>
          </span>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {values.map((value) => {
            const available = isAvailable(value);
            const selected = selection[key] === value;
            if (isSwatch) {
              const hex = product.variants.find((v) => v.options?.colour === value)?.options?.colourHex;
              return (
                <button
                  key={value}
                  type="button"
                  className={`swatch ${selected ? 'selected' : ''}`}
                  style={{ background: hex || '#ccc' }}
                  title={available ? value : `${value} (sold out)`}
                  aria-label={value}
                  aria-pressed={selected}
                  disabled={!available}
                  onClick={() => setSelection((s) => ({ ...s, [key]: value }))}
                />
              );
            }
            return (
              <button
                key={value}
                type="button"
                className={`option-btn ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                disabled={!available}
                title={available ? value : `${value} is sold out`}
                onClick={() => setSelection((s) => ({ ...s, [key]: value }))}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>
    );
  });
}

function SizeChartModal({ chart, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="shop-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="shop-modal" role="dialog" aria-modal="true" aria-label="Size chart">
        <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
          <h2 className="h5 mb-0">Size chart{chart.name ? `: ${chart.name}` : ''}</h2>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </div>
        <div className="p-3">
          {chart.columns?.length > 0 && chart.rows?.length > 0 && (
            <div className="table-responsive mb-3">
              <table className="table table-sm table-bordered text-center mb-0">
                <thead className="table-light">
                  <tr>{chart.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {chart.rows.map((row, r) => (
                    <tr key={r}>{chart.columns.map((_, c) => <td key={c} className={c === 0 ? 'fw-semibold' : ''}>{row[c]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {chart.imageUrl && <img src={chart.imageUrl} alt={`${chart.name || ''} size guide`} className="img-fluid rounded-3" />}
          <p className="small text-muted mb-0 mt-2">Measurements are of your body. If you’re between sizes, choose the larger one.</p>
        </div>
      </div>
    </div>
  );
}

function DetailsAccordion({ product, settings }) {
  const [open, setOpen] = useState('description');
  const a = product.attributes || {};
  const isBeauty = product.productType === 'beauty';
  const sections = [
    { id: 'description', title: 'Description', body: <p className="mb-0">{product.description}</p> },
    isBeauty
      ? {
          id: 'ingredients',
          title: 'Ingredients & How to Use',
          body: (
            <ul className="mb-0">
              {a.ingredients && <li><strong>Ingredients:</strong> {a.ingredients}</li>}
              {a.howToUse && <li><strong>How to use:</strong> {a.howToUse}</li>}
              {a.skinType && <li><strong>Skin type:</strong> {a.skinType}</li>}
              {a.shelfLife && <li><strong>Shelf life:</strong> {a.shelfLife}</li>}
            </ul>
          ),
        }
      : {
          id: 'fabric',
          title: 'Fabric & Care',
          body: (
            <ul className="mb-0">
              {a.fabric && <li><strong>Material:</strong> {a.fabric}</li>}
              {a.fit && <li className="text-capitalize"><strong>Fit:</strong> {a.fit}</li>}
              {a.pattern && <li><strong>Pattern:</strong> {a.pattern}</li>}
              {a.sleeve && <li><strong>Sleeve / neck:</strong> {a.sleeve}</li>}
              {a.occasion && <li><strong>Occasion:</strong> {a.occasion}</li>}
              {a.care && <li><strong>Care:</strong> {a.care}</li>}
              {!a.fabric && !a.care && <li>Details coming soon.</li>}
            </ul>
          ),
        },
    {
      id: 'shipping',
      title: 'Shipping & Returns',
      body: (
        <ul className="mb-0">
          <li>Free delivery on orders above {formatINR(settings.delivery.freeDeliveryThreshold)}; {formatINR(settings.delivery.deliveryCharge)} below that.</li>
          <li>Delivered in {settings.delivery.estimateMinDays}–{settings.delivery.estimateMaxDays} business days anywhere in India.</li>
          <li>
            {product.isReturnable
              ? `Easy returns or exchange within ${settings.orders.returnWindowDays} days of delivery.`
              : 'This item cannot be returned for hygiene reasons, unless it arrives damaged or incorrect.'}
          </li>
          {settings.cod.enabled && <li>Cash on Delivery available (+{formatINR(settings.cod.charge)}).</li>}
        </ul>
      ),
    },
  ];

  return (
    <div className="accordion mt-4">
      {sections.map((section) => (
        <div key={section.id} className="accordion-item">
          <h2 className="accordion-header">
            <button
              type="button"
              className={`accordion-button ${open === section.id ? '' : 'collapsed'}`}
              aria-expanded={open === section.id}
              onClick={() => setOpen(open === section.id ? null : section.id)}
            >
              {section.title}
            </button>
          </h2>
          {open === section.id && <div className="accordion-body small">{section.body}</div>}
        </div>
      ))}
    </div>
  );
}

function ReviewsSummary({ product }) {
  const total = product.ratingCount || 0;
  return (
    <section className="section pb-0" id="reviews">
      <h2 className="section-title mb-4">Ratings & Reviews</h2>
      <div className="row g-4">
        <div className="col-md-4">
          <div className="card-soft p-4 text-center">
            <div className="display-5 fw-bold text-navy">{total ? product.ratingAverage.toFixed(1) : '–'}</div>
            <Stars value={product.ratingAverage} className="fs-5" />
            <div className="small text-muted mt-1">{total} review{total === 1 ? '' : 's'}</div>
            <div className="mt-3">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = product.ratingBreakdown?.[star] || 0;
                return (
                  <div key={star} className="d-flex align-items-center gap-2 small mb-1">
                    <span style={{ width: 28 }}>{star}★</span>
                    <div className="rating-bar"><div style={{ width: total ? `${(count / total) * 100}%` : 0 }} /></div>
                    <span className="text-muted" style={{ width: 24 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="col-md-8">
          <div className="card-soft p-4 h-100 d-flex flex-column justify-content-center text-center">
            <i className="bi bi-chat-square-heart fs-1 text-orange" />
            <h3 className="h5 mt-2">No reviews yet</h3>
            <p className="text-muted small mb-0">
              Only customers who bought and received this product can review it, with photos or a video.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ProductDetails() {
  const { slug } = useParams();
  const { settings, notify, setWhatsappMessage } = useStore();
  const { data: product, loading, error } = useApi(`/products/${slug}`);
  const [selection, setSelection] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [showSizeChart, setShowSizeChart] = useState(false);

  const subSlug = product?.subCategory?.slug;
  const { data: related } = useApi(subSlug ? `/products?category=${subSlug}&limit=5` : null);
  const recent = useMemo(() => readRecent().filter((p) => p.slug !== slug).slice(0, 4), [slug]);

  useEffect(() => {
    if (!product) return undefined;
    rememberViewed(product);
    setQuantity(1);
    setShowSizeChart(false);
    // Pre-select any option with a single value, and the first in-stock colour/shade
    const initial = {};
    for (const key of optionKeysFor(product)) {
      const values = [...new Set(product.variants.map((v) => v.options?.[key]).filter(Boolean))];
      if (values.length === 1) initial[key] = values[0];
    }
    const firstKey = optionKeysFor(product)[0];
    if (!initial[firstKey]) {
      initial[firstKey] = product.variants.find((v) => v.stock > 0)?.options?.[firstKey];
    }
    setSelection(initial);
    setWhatsappMessage(`Hi ${settings.store.name}, I'm interested in ${product.name} – ${window.location.href}`);
    return () => setWhatsappMessage(null);
  }, [product, settings.store.name, setWhatsappMessage]);

  if (loading) {
    return (
      <div className="container py-5">
        <div className="row g-4">
          <div className="col-md-6"><div className="skeleton" style={{ aspectRatio: '3 / 4' }} /></div>
          <div className="col-md-6"><div className="skeleton mb-3" style={{ height: 32 }} /><div className="skeleton" style={{ height: 200 }} /></div>
        </div>
      </div>
    );
  }
  if (error || !product) {
    return (
      <div className="container">
        <EmptyState icon="bi-emoji-frown" title="Product not found" text="This product may have been removed or is no longer available." actionLabel="Continue shopping" />
      </div>
    );
  }

  const keys = optionKeysFor(product);
  const requiredKeys = keys.filter((key) => product.variants.some((v) => v.options?.[key]));
  const selected = requiredKeys.every((key) => selection[key])
    ? product.variants.find((v) => requiredKeys.every((key) => v.options?.[key] === selection[key]))
    : null;
  const price = selected?.price ?? product.sellingPrice;
  const mrp = selected?.mrp ?? product.mrp;
  const discount = mrp > price ? Math.floor(((mrp - price) / mrp) * 100) : 0;
  const maxQty = Math.min(settings.orders.maxQtyPerItem, selected?.stock || 1);

  let stockMessage;
  if (!product.inStock) stockMessage = <span className="text-danger fw-semibold">Out of stock</span>;
  else if (!selected) stockMessage = <span className="text-muted">Select your {requiredKeys.map((k) => OPTION_LABELS[k].toLowerCase()).join(' and ')}</span>;
  else if (selected.stock === 0) stockMessage = <span className="text-danger fw-semibold">This option is sold out</span>;
  else if (selected.stock <= 3) stockMessage = <span className="text-orange fw-semibold">Only {selected.stock} left! Order soon.</span>;
  else stockMessage = <span className="text-success fw-semibold"><i className="bi bi-check-circle me-1" />In stock</span>;

  const addToCart = (buyNow) => {
    if (!selected) {
      notify(`Please select a ${requiredKeys.map((k) => OPTION_LABELS[k].toLowerCase()).join(' and ')} first.`);
      return;
    }
    notify(buyNow ? 'Checkout arrives in Phase 4.' : 'The shopping cart arrives in Phase 3.');
  };

  const crumbs = [
    product.category && { label: product.category.name, to: `/${product.category.slug}` },
    product.subCategory && { label: product.subCategory.name, to: `/category/${product.subCategory.slug}` },
  ].filter(Boolean);
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="container pt-3">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/">Home</Link></li>
          {crumbs.map((c) => (
            <li key={c.label} className="breadcrumb-item"><Link to={c.to}>{c.label}</Link></li>
          ))}
          <li className="breadcrumb-item active text-truncate" aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <div className="row g-4 g-lg-5">
        <div className="col-md-6">
          <ProductGallery product={product} colour={selection.colour} />
        </div>

        <div className="col-md-6">
          {product.brand && <div className="text-uppercase small text-muted fw-semibold mb-1">{product.brand}</div>}
          <h1 className="h3 mb-2">{product.name}</h1>
          <a href="#reviews" className="d-inline-flex align-items-center gap-2 small mb-3">
            <Stars value={product.ratingAverage} />
            <span className="text-muted">
              {product.ratingCount ? `${product.ratingAverage.toFixed(1)} · ${product.ratingCount} reviews` : 'No reviews yet'}
            </span>
          </a>
          <Price price={price} mrp={mrp} discountPercent={discount} size="lg" />
          {mrp > price && <div className="small text-success fw-semibold mt-1">You save {formatINR(mrp - price)}</div>}
          <div className="small text-muted mb-3">Price includes all charges except delivery.</div>
          <p>{product.shortDescription}</p>

          <hr />
          <VariantPicker product={product} selection={selection} setSelection={setSelection} />
          {product.sizeChart && (
            <button type="button" className="btn btn-link p-0 small mb-3" onClick={() => setShowSizeChart(true)}>
              <i className="bi bi-rulers me-1" />Size chart
            </button>
          )}
          {showSizeChart && <SizeChartModal chart={product.sizeChart} onClose={() => setShowSizeChart(false)} />}
          <div className="mb-3">{stockMessage}</div>

          <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
            <div className="qty-control" aria-label="Quantity">
              <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
              <span>{quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => {
                  if (quantity >= maxQty) notify(`Only ${maxQty} available for this option.`);
                  else setQuantity((q) => q + 1);
                }}
              >
                +
              </button>
            </div>
            <button type="button" className="btn btn-outline-navy" aria-label="Add to wishlist" onClick={() => notify('Wishlist arrives in Phase 3.')}>
              <i className="bi bi-heart" />
            </button>
          </div>

          <div className="d-grid d-sm-flex gap-2 mb-3">
            <button type="button" className="btn btn-orange btn-lg flex-fill" disabled={!product.inStock} onClick={() => addToCart(false)}>
              <i className="bi bi-bag-plus me-2" />Add to Cart
            </button>
            <button type="button" className="btn btn-navy btn-lg flex-fill" disabled={!product.inStock} onClick={() => addToCart(true)}>
              Buy Now
            </button>
          </div>
          {settings.store.whatsappNumber && (
            <a
              className="btn btn-outline-success w-100 mb-4"
              target="_blank"
              rel="noreferrer"
              href={whatsappLink(settings.store.whatsappNumber, `Hi ${settings.store.name}, I'm interested in ${product.name} – ${pageUrl}`)}
            >
              <i className="bi bi-whatsapp me-2" />Ask about this product on WhatsApp
            </a>
          )}

          <ul className="list-unstyled info-list bg-soft rounded-3 p-3">
            <li><i className="bi bi-truck" />Free delivery above {formatINR(settings.delivery.freeDeliveryThreshold)}</li>
            <li><i className="bi bi-calendar-check" />Delivery in {settings.delivery.estimateMinDays}–{settings.delivery.estimateMaxDays} business days</li>
            {settings.cod.enabled && <li><i className="bi bi-cash-coin" />Cash on Delivery available</li>}
            <li>
              <i className="bi bi-arrow-repeat" />
              {product.isReturnable ? `${settings.orders.returnWindowDays}-day easy returns & exchange` : 'Non-returnable (hygiene product)'}
            </li>
          </ul>

          <div className="d-flex align-items-center gap-2 small">
            <span className="text-muted">Share:</span>
            <a href={`https://wa.me/?text=${encodeURIComponent(`${product.name} ${pageUrl}`)}`} target="_blank" rel="noreferrer" aria-label="Share on WhatsApp"><i className="bi bi-whatsapp fs-5" /></a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`} target="_blank" rel="noreferrer" aria-label="Share on Facebook"><i className="bi bi-facebook fs-5" /></a>
            <button
              type="button"
              className="btn btn-link p-0"
              aria-label="Copy link"
              onClick={() => navigator.clipboard?.writeText(pageUrl).then(() => notify('Link copied!')).catch(() => {})}
            >
              <i className="bi bi-link-45deg fs-5" />
            </button>
          </div>

          <DetailsAccordion product={product} settings={settings} />
        </div>
      </div>

      <ReviewsSummary product={product} />

      {related?.products?.filter((p) => p.slug !== slug).length > 0 && (
        <section className="section pb-0">
          <h2 className="section-title mb-4">You May Also Like</h2>
          <ProductGrid products={related.products.filter((p) => p.slug !== slug).slice(0, 4)} />
        </section>
      )}

      {recent.length > 0 && (
        <section className="section pb-0">
          <h2 className="section-title mb-4">Recently Viewed</h2>
          <ProductGrid products={recent} />
        </section>
      )}
    </div>
  );
}
