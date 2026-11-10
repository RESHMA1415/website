export default function Stars({ value = 0, className = '' }) {
  return (
    <span className={`stars ${className}`} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={`bi ${value >= n ? 'bi-star-fill' : value >= n - 0.5 ? 'bi-star-half' : 'bi-star'}`} />
      ))}
    </span>
  );
}
