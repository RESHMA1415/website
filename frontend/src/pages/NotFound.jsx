import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container py-5 text-center">
      <div className="display-1 fw-bold text-orange font-heading">404</div>
      <h1 className="h3">Oops! This page doesn’t exist.</h1>
      <p className="text-muted">The link may be broken, or the page may have moved.</p>
      <div className="d-flex flex-wrap gap-2 justify-content-center mt-3">
        <Link to="/" className="btn btn-orange">Go to Home</Link>
        <Link to="/shop" className="btn btn-outline-navy">Browse Products</Link>
      </div>
    </div>
  );
}
