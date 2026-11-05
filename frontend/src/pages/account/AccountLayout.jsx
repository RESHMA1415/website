import { NavLink } from 'react-router-dom';
import PageHeader from '../../components/PageHeader.jsx';
import { useShopper } from '../../context/ShopperContext.jsx';

const LINKS = [
  { to: '/account', label: 'Profile', icon: 'bi-person', end: true },
  { to: '/account/addresses', label: 'Saved Addresses', icon: 'bi-geo-alt' },
  { to: '/account/orders', label: 'My Orders', icon: 'bi-box-seam' },
  { to: '/wishlist', label: 'Wishlist', icon: 'bi-heart' },
  { to: '/account/reviews', label: 'My Reviews', icon: 'bi-star' },
];

export default function AccountLayout({ title, crumbs, children }) {
  const { user, logout } = useShopper();
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: 'My Account', to: '/account' }, ...crumbs]}>
        {user && <p className="text-muted mb-0 mt-1">Hello, {user.name.split(' ')[0]}!</p>}
      </PageHeader>
      <div className="container">
        <div className="row g-4">
          <aside className="col-lg-3">
            <nav className="card-soft p-2 account-nav">
              {LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end}>
                  <i className={`bi ${link.icon}`} /> {link.label}
                </NavLink>
              ))}
              <button type="button" className="account-nav-button" onClick={logout}>
                <i className="bi bi-box-arrow-right" /> Logout
              </button>
            </nav>
          </aside>
          <div className="col-lg-9">{children}</div>
        </div>
      </div>
    </>
  );
}
