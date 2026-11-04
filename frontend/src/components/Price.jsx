import { formatINR } from '../utils/format.js';

export default function Price({ price, mrp, discountPercent, size = '' }) {
  const showDiscount = mrp > price;
  return (
    <div className={`d-flex align-items-baseline flex-wrap gap-2 ${size === 'lg' ? 'fs-3' : ''}`}>
      <span className="price">{formatINR(price)}</span>
      {showDiscount && <span className="price-mrp">{formatINR(mrp)}</span>}
      {showDiscount && discountPercent > 0 && <span className="price-off">{discountPercent}% OFF</span>}
    </div>
  );
}
