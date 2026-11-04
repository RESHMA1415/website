import { Link } from 'react-router-dom';

export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="container py-5">
      <div className="mx-auto card-soft p-4 p-md-5" style={{ maxWidth: 480 }}>
        <Link to="/" className="brand-logo d-block text-center mb-3">
          SHOP<span>ME</span>
        </Link>
        <h1 className="h4 text-center mb-1">{title}</h1>
        {subtitle && <p className="text-muted text-center small mb-4">{subtitle}</p>}
        {children}
        {footer && <div className="text-center small mt-4">{footer}</div>}
      </div>
    </div>
  );
}
