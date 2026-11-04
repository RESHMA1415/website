import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext.jsx';
import Price from './Price.jsx';
import ProductImage from './ProductImage.jsx';

export function isNewArrival(product, days = 30) {
  return product.isNewArrival || Date.now() - new Date(product.createdAt).getTime() < days * 86400000;
}

export default function ProductCard({ product }) {
  const { notify } = useStore();
  const url = `/product/${product.slug}`;

  return (
    <div className="product-card">
      <div className="media">
        <div className="badges">
          {isNewArrival(product) && <span className="badge-shop badge-new">NEW</span>}
          {!product.inStock && <span className="badge-shop badge-oos">OUT OF STOCK</span>}
        </div>
        <button
          type="button"
          className="wishlist-btn"
          aria-label="Add to wishlist"
          onClick={() => notify('Wishlist arrives in Phase 3 (customer accounts).')}
        >
          <i className="bi bi-heart" />
        </button>
        <Link to={url} aria-label={product.name} className={product.images?.length > 1 ? 'has-hover-image' : ''}>
          <ProductImage product={product} />
          {/* Second photo appears on hover (PRD §13.3) */}
          {product.images?.length > 1 && <ProductImage product={product} index={1} className="hover-image" />}
        </Link>
        {product.inStock && (
          <Link to={url} className="btn btn-navy btn-sm quick-add">
            <i className="bi bi-bag-plus me-1" /> {product.productType === 'beauty' ? 'Choose shade' : 'Choose size'}
          </Link>
        )}
      </div>
      <div className="body">
        {product.brand && <div className="brand">{product.brand}</div>}
        <Link to={url} className="name">
          {product.name}
        </Link>
        <Price price={product.sellingPrice} mrp={product.mrp} discountPercent={product.discountPercent} />
        {product.ratingCount > 0 && (
          <div className="small">
            <span className="rating-pill">
              {product.ratingAverage.toFixed(1)} <i className="bi bi-star-fill" />
            </span>
            <span className="text-muted ms-1">({product.ratingCount})</span>
          </div>
        )}
      </div>
    </div>
  );
}
