import { NavLink } from 'react-router-dom';
import PageHeader from '../../components/PageHeader.jsx';
import PhaseNotice from '../../components/PhaseNotice.jsx';

const LINKS = [
  { to: '/account', label: 'Profile', icon: 'bi-person', end: true },
  { to: '/account/addresses', label: 'Saved Addresses', icon: 'bi-geo-alt' },
  { to: '/account/orders', label: 'My Orders', icon: 'bi-box-seam' },
  { to: '/wishlist', label: 'Wishlist', icon: 'bi-heart' },
  { to: '/account/reviews', label: 'My Reviews', icon: 'bi-star' },
];

export default function AccountLayout({ title, crumbs, children }) {
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: 'My Account', to: '/account' }, ...crumbs]} />
      <div className="container">
        <PhaseNotice phase={3}>
          Customers will need to log in to see this area. Accounts start working in Phase 3.
        </PhaseNotice>
        <div className="row g-4">
          <aside className="col-lg-3">
            <nav className="card-soft p-2 account-nav">
              {LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end}>
                  <i className={`bi ${link.icon}`} /> {link.label}
                </NavLink>
              ))}
              <NavLink to="/login">
                <i className="bi bi-box-arrow-right" /> Logout
              </NavLink>
            </nav>
          </aside>
          <div className="col-lg-9">{children}</div>
        </div>
      </div>
    </>
  );
}
