import ProductCard from './ProductCard.jsx';

// 2 per row on mobile, 3 on tablet, 4 on desktop (PRD §16)
export default function ProductGrid({ products, loading, skeletonCount = 8 }) {
  if (loading) {
    return (
      <div className="row g-3 g-md-4">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <div key={i} className="col-6 col-md-4 col-xl-3">
            <div className="skeleton" style={{ aspectRatio: '3 / 4' }} />
            <div className="skeleton mt-2" style={{ height: 14, width: '80%' }} />
            <div className="skeleton mt-2" style={{ height: 14, width: '40%' }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="row g-3 g-md-4">
      {products.map((product) => (
        <div key={product._id} className="col-6 col-md-4 col-xl-3">
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  );
}
