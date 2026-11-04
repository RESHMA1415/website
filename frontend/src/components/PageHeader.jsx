import { Link } from 'react-router-dom';

// Title band with breadcrumb. `crumbs` = [{ label, to? }]; Home is added automatically.
export default function PageHeader({ title, crumbs = [], children }) {
  const trail = [{ label: 'Home', to: '/' }, ...crumbs];
  return (
    <div className="page-header">
      <div className="container">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb">
            {trail.map((crumb, i) =>
              i === trail.length - 1 || !crumb.to ? (
                <li key={crumb.label} className="breadcrumb-item active" aria-current="page">
                  {crumb.label}
                </li>
              ) : (
                <li key={crumb.label} className="breadcrumb-item">
                  <Link to={crumb.to}>{crumb.label}</Link>
                </li>
              ),
            )}
          </ol>
        </nav>
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  );
}
