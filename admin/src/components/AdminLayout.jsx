import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { STORE_URL } from '../api.js';
import { useAuth } from '../auth.jsx';

// Sidebar menu (PRD §14). Coupon Management is out of scope for v1.0.
const MENU = [
  { group: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: 'bi-speedometer2', end: true }] },
  {
    group: 'Catalogue',
    items: [
      { to: '/products', label: 'Products', icon: 'bi-bag' },
      { to: '/categories', label: 'Categories', icon: 'bi-diagram-3' },
      { to: '/size-charts', label: 'Size Charts', icon: 'bi-rulers' },
      { to: '/inventory', label: 'Inventory', icon: 'bi-boxes' },
      { to: '/media', label: 'Images & Banners', icon: 'bi-images' },
    ],
  },
  {
    group: 'Sales',
    items: [
      { to: '/orders', label: 'Orders', icon: 'bi-receipt' },
      { to: '/returns', label: 'Returns & Exchanges', icon: 'bi-arrow-repeat' },
      { to: '/payments', label: 'Payments', icon: 'bi-credit-card' },
      { to: '/reports', label: 'Sales Reports', icon: 'bi-graph-up' },
    ],
  },
  {
    group: 'Customers',
    items: [
      { to: '/customers', label: 'Customers', icon: 'bi-people' },
      { to: '/reviews', label: 'Reviews', icon: 'bi-star' },
      { to: '/messages', label: 'Contact Messages', icon: 'bi-envelope' },
    ],
  },
  {
    group: 'Store',
    items: [
      { to: '/settings', label: 'Business Settings', icon: 'bi-gear' },
      { to: '/account', label: 'My Account', icon: 'bi-person-lock' },
    ],
  },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { admin, logout } = useAuth();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <>
      <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
        <Link to="/" className="brand">
          SHOP<span>ME</span>
          <small>ADMIN PANEL</small>
        </Link>
        <nav aria-label="Admin menu">
          {MENU.map((section) => (
            <div key={section.group}>
              <div className="group">{section.group}</div>
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="nav-item-link">
                  <i className={`bi ${item.icon}`} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <div className="admin-main">
        <header className="admin-topbar">
          <button type="button" className="btn btn-light d-lg-none" aria-label="Open menu" onClick={() => setOpen(true)}>
            <i className="bi bi-list" />
          </button>
          <a href={STORE_URL} target="_blank" rel="noreferrer" className="small">
            <i className="bi bi-box-arrow-up-right me-1" />View store
          </a>
          <div className="ms-auto d-flex align-items-center gap-3">
            <Link to="/account" className="d-flex align-items-center gap-2 text-reset">
              <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-semibold" style={{ width: 36, height: 36, background: 'var(--shop-orange)' }}>
                {(admin?.name || 'A')[0].toUpperCase()}
              </div>
              <div className="d-none d-sm-block lh-sm">
                <div className="fw-semibold small">{admin?.name || 'Store Admin'}</div>
                <div className="small text-muted">{admin?.email}</div>
              </div>
            </Link>
            <button type="button" className="btn btn-light btn-sm" onClick={logout}>
              <i className="bi bi-box-arrow-right me-1" />Log out
            </button>
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </>
  );
}
