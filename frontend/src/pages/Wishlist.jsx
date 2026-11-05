import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Price from '../components/Price.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { useShopper } from '../context/ShopperContext.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { formatINR } from '../utils/format.js';

// "Move to Cart" asks for the size/colour/shade when a product has several (PRD §13.6)
function ChooseOption({ item, onClose, onAdded }) {
  const { notify } = useStore();
  const { addToCart } = useShopper();
  const [variantId, setVariantId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const add = async () => {
    setBusy(true);
    try {
      await addToCart(item.productId, variantId, 1);
      onAdded();
    } catch (err) {
      notify(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="shop-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="shop-modal" role="dialog" aria-modal="true" aria-label={`Choose an option for ${item.name}`} style={{ maxWidth: 440 }}>
        <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
          <h2 className="h6 mb-0">Choose {item.productType === 'beauty' ? 'a shade' : 'your size'}: {item.name}</h2>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </div>
        <div className="p-3">
          <div className="d-flex flex-wrap gap-2 mb-3">
            {item.variants.map((v) => (
              <button
                key={v._id}
                type="button"
                className={`option-btn ${variantId === v._id ? 'selected' : ''}`}
                disabled={v.stock === 0}
                aria-pressed={variantId === v._id}
                onClick={() => setVariantId(v._id)}
                title={v.stock === 0 ? 'Sold out' : undefined}
              >
                {v.optionLabel}
                {v.price !== item.price && <span className="d-block small text-muted">{formatINR(v.price)}</span>}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-orange w-100" disabled={!variantId || busy} onClick={add}>
            {busy ? 'Adding…' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}

function WishlistCard({ item, onRemove, onMove }) {
  if (!item.available) {
    return (
      <div className="product-card h-100 p-3 d-flex flex-column justify-content-between">
        <div>
          <div className="fw-semibold">{item.name}</div>
          <div className="small text-muted mt-1">This product is no longer available.</div>
        </div>
        <button type="button" className="btn btn-sm btn-outline-danger mt-3" onClick={onRemove}>Remove</button>
      </div>
    );
  }
  const url = `/product/${item.slug}`;
  return (
    <div className="product-card h-100">
      <div className="media">
        <div className="badges">{!item.inStock && <span className="badge-shop badge-oos">OUT OF STOCK</span>}</div>
        <button type="button" className="wishlist-btn active" aria-label={`Remove ${item.name} from wishlist`} onClick={onRemove}>
          <i className="bi bi-heart-fill" />
        </button>
        <Link to={url} aria-label={item.name}>
          <ProductImage product={{ productType: item.productType, images: item.image ? [item.image] : [] }} />
        </Link>
      </div>
      <div className="body">
        {item.brand && <div className="brand">{item.brand}</div>}
        <Link to={url} className="name">{item.name}</Link>
        <Price price={item.price} mrp={item.mrp} discountPercent={item.discountPercent} />
        {item.priceDropped > 0 && (
          <div className="small text-success fw-semibold"><i className="bi bi-arrow-down-circle me-1" />Price dropped by {formatINR(item.priceDropped)} since you saved it</div>
        )}
        <div className="small mt-1">{item.inStock ? <span className="text-success">In stock</span> : <span className="text-danger">Out of stock</span>}</div>
        <div className="d-flex gap-2 mt-2">
          <button type="button" className="btn btn-sm btn-orange flex-fill" disabled={!item.inStock} onClick={onMove}>
            <i className="bi bi-bag-plus me-1" />Move to Cart
          </button>
          <button type="button" className="btn btn-sm btn-light" onClick={onRemove} aria-label="Remove"><i className="bi bi-trash" /></button>
        </div>
      </div>
    </div>
  );
}

export default function Wishlist() {
  const { notify } = useStore();
  const { toggleWishlist, addToCart, loadWishlist } = useShopper();
  const [items, setItems] = useState(null);
  const [choosing, setChoosing] = useState(null);

  const load = useCallback(() => api('/wishlist').then(setItems).catch((err) => { setItems([]); notify(err.message); }), [notify]);
  useEffect(() => { load(); }, [load]);

  const remove = async (item) => {
    await toggleWishlist(item.productId);
    setItems((list) => list.filter((i) => i.productId !== item.productId));
  };

  // After adding to the cart, the product leaves the wishlist ("move")
  const moved = async (item) => {
    await api(`/wishlist/${item.productId}`, { method: 'DELETE' }).catch(() => {});
    loadWishlist();
    setItems((list) => list.filter((i) => i.productId !== item.productId));
    setChoosing(null);
    notify(`${item.name} moved to your cart`);
  };

  const move = async (item) => {
    const inStock = item.variants.filter((v) => v.stock > 0);
    if (item.variants.length === 1 && inStock.length === 1) {
      try {
        await addToCart(item.productId, inStock[0]._id, 1);
        await moved(item);
      } catch (err) {
        notify(err.message);
      }
      return;
    }
    setChoosing(item);
  };

  return (
    <>
      <PageHeader title="My Wishlist" crumbs={[{ label: 'Wishlist' }]}>
        {items?.length > 0 && <p className="text-muted mb-0 mt-1">{items.length} saved item{items.length === 1 ? '' : 's'}</p>}
      </PageHeader>
      <div className="container">
        {!items ? (
          <div className="text-center text-muted py-5">Loading your wishlist…</div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="bi-heart"
            title="Your wishlist is empty"
            text="Tap the heart on any product to save it here. We’ll show you if the price drops."
            actionLabel="Discover products"
          />
        ) : (
          <div className="row g-3 row-cols-2 row-cols-md-3 row-cols-lg-4">
            {items.map((item) => (
              <div key={item.productId} className="col">
                <WishlistCard item={item} onRemove={() => remove(item)} onMove={() => move(item)} />
              </div>
            ))}
          </div>
        )}
      </div>
      {choosing && <ChooseOption item={choosing} onClose={() => setChoosing(null)} onAdded={() => moved(choosing)} />}
    </>
  );
}
