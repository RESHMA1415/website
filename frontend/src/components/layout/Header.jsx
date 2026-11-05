import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useShopper } from '../../context/ShopperContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { formatINR } from '../../utils/format.js';

// Search with suggestions while typing: top 5 products (PRD §13.4)
function SearchBox({ onDone }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api(`/products/suggest?q=${encodeURIComponent(q)}`)
        .then((list) => {
          if (!cancelled) {
            setSuggestions(list);
            setActive(-1);
          }
        })
        .catch(() => {});
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const finish = (path) => {
    setOpen(false);
    setQuery('');
    navigate(path);
    onDone?.();
  };
  const submit = (event) => {
    event.preventDefault();
    if (active >= 0 && suggestions[active]) return finish(`/product/${suggestions[active].slug}`);
    const q = query.trim();
    if (q) finish(`/search?q=${encodeURIComponent(q)}`);
    return undefined;
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };
  const showList = open && query.trim().length >= 2;

  return (
    <form className="header-search" role="search" onSubmit={submit} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <i className="bi bi-search" />
      <input
        type="search"
        className="form-control"
        placeholder="Search for t-shirts, dresses, lipsticks…"
        aria-label="Search products"
        aria-autocomplete="list"
        aria-expanded={showList}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <div className="search-suggestions" role="listbox">
          {suggestions.map((p, i) => (
            <Link
              key={p._id}
              to={`/product/${p.slug}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                finish(`/product/${p.slug}`);
              }}
            >
              <span className="thumb">{p.thumbUrl ? <img src={p.thumbUrl} alt="" /> : <i className="bi bi-image" />}</span>
              <span className="flex-grow-1 text-truncate">
                <span className="d-block text-truncate">{p.name}</span>
                {p.brand && <small className="text-muted">{p.brand}</small>}
              </span>
              <span className="fw-semibold text-navy text-nowrap">{formatINR(p.sellingPrice)}</span>
            </Link>
          ))}
          {!suggestions.length && <div className="px-3 py-2 small text-muted">Press Enter to search for “{query.trim()}”</div>}
          {suggestions.length > 0 && (
            <button type="submit" className="see-all">
              See all results for “{query.trim()}” <i className="bi bi-arrow-right" />
            </button>
          )}
        </div>
      )}
    </form>
  );
}

function HeaderIcons() {
  const { cart, wishlistCount, user } = useShopper();
  const cartCount = cart.count;
  return (
    <div className="d-flex align-items-center gap-2 gap-md-3">
      <Link to="/account" className="header-icon d-none d-md-inline-flex" aria-label="My account">
        <i className="bi bi-person" />
        <small>{user ? user.name.split(' ')[0].slice(0, 12) : 'Account'}</small>
      </Link>
      <Link to="/wishlist" className="header-icon d-none d-sm-inline-flex" aria-label="Wishlist">
        <i className="bi bi-heart" />
        {wishlistCount > 0 && <span className="count">{wishlistCount}</span>}
        <small className="d-none d-md-block">Wishlist</small>
      </Link>
      <Link to="/cart" className="header-icon" aria-label="Shopping cart">
        <i className="bi bi-bag" />
        {cartCount > 0 && <span className="count">{cartCount}</span>}
        <small className="d-none d-md-block">Cart</small>
      </Link>
    </div>
  );
}

// Categories the owner switched to "Show in menu"
const inMenu = (list) => (list || []).filter((c) => c.showInMenu !== false);

function WomenMenu({ women }) {
  return (
    <div className="nav-dropdown-menu">
      {inMenu(women?.children).map((group) => (
        <div key={group.slug}>
          <h6>
            <Link to={`/category/${group.slug}`}>{group.name}</Link>
          </h6>
          {inMenu(group.children).map((child) => (
            <Link key={child.slug} to={`/category/${child.slug}`}>
              {child.name}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}

function MobileMenu({ categories, onClose }) {
  const [open, setOpen] = useState(null);
  const { user, logout } = useShopper();
  const toggle = (slug) => setOpen((current) => (current === slug ? null : slug));
  return (
    <>
      <div className="mobile-menu-backdrop" onClick={onClose} />
      <nav className="mobile-menu" aria-label="Mobile menu">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span className="brand-logo">
            SHOP<span>ME</span>
          </span>
          <button type="button" className="btn-close" aria-label="Close menu" onClick={onClose} />
        </div>
        <Link to="/">Home</Link>
        {inMenu(categories).map((top) => (
          <div key={top.slug}>
            <button type="button" className="menu-toggle" onClick={() => toggle(top.slug)}>
              {top.name}
              <i className={`bi ${open === top.slug ? 'bi-chevron-up' : 'bi-chevron-down'}`} />
            </button>
            {open === top.slug && (
              <div className="sub">
                <Link to={`/${top.slug}`}>All {top.name}</Link>
                {inMenu(top.children).map((child) => (
                  <Link key={child.slug} to={`/category/${child.slug}`}>
                    {child.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        <Link to="/new-arrivals">New Arrivals</Link>
        <Link to="/shop">Shop All</Link>
        <Link to="/wishlist">Wishlist</Link>
        <Link to="/account">My Account</Link>
        <Link to="/account/orders">My Orders</Link>
        <Link to="/track-order">Track Order</Link>
        <Link to="/about">About Us</Link>
        <Link to="/contact">Contact Us</Link>
        {user ? (
          <button type="button" className="mobile-menu-button" onClick={() => { onClose(); logout(); }}>Log out</button>
        ) : (
          <Link to="/login">Log in / Register</Link>
        )}
      </nav>
    </>
  );
}

export default function Header() {
  const { settings, categories } = useStore();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [womenOpen, setWomenOpen] = useState(false);
  const women = categories.find((c) => c.slug === 'women');

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    setWomenOpen(false);
  }, [location.pathname, location.search]);

  return (
    <>
      <div className="announcement">
        <i className="bi bi-truck me-1" /> Free delivery on orders above{' '}
        {formatINR(settings.delivery.freeDeliveryThreshold)}
        <span className="d-none d-md-inline">
          {' '}
          · <i className="bi bi-arrow-repeat mx-1" /> Easy {settings.orders.returnWindowDays}-day returns ·{' '}
          <i className="bi bi-cash-coin mx-1" /> Cash on Delivery available
        </span>
      </div>
      <header className="site-header">
        <div className="container">
          <div className="d-flex align-items-center gap-3 py-2 py-lg-3">
            <button
              type="button"
              className="header-icon d-lg-none"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <i className="bi bi-list" />
            </button>
            <Link to="/" className="brand-logo me-lg-4">
              SHOP<span>ME</span>
            </Link>
            <div className="flex-grow-1 d-none d-lg-flex justify-content-center">
              <SearchBox />
            </div>
            <div className="ms-auto d-flex align-items-center gap-2">
              <button
                type="button"
                className="header-icon d-lg-none"
                aria-label="Search"
                onClick={() => setSearchOpen((v) => !v)}
              >
                <i className="bi bi-search" />
              </button>
              <HeaderIcons />
            </div>
          </div>
          {searchOpen && (
            <div className="pb-3 d-lg-none">
              <SearchBox onDone={() => setSearchOpen(false)} />
            </div>
          )}
          <nav className="d-none d-lg-flex main-nav" aria-label="Main menu">
            <NavLink to="/" end className="nav-link">
              Home
            </NavLink>
            <NavLink to="/men" className="nav-link">
              Men
            </NavLink>
            <div
              className="nav-dropdown"
              onMouseEnter={() => setWomenOpen(true)}
              onMouseLeave={() => setWomenOpen(false)}
            >
              <NavLink to="/women" className="nav-link" aria-haspopup="true" aria-expanded={womenOpen}>
                Women <i className="bi bi-chevron-down small" />
              </NavLink>
              {womenOpen && <WomenMenu women={women} />}
            </div>
            <NavLink to="/new-arrivals" className="nav-link">
              New Arrivals
            </NavLink>
            <NavLink to="/shop" className="nav-link">
              Shop
            </NavLink>
            <NavLink to="/about" className="nav-link">
              About Us
            </NavLink>
            <NavLink to="/contact" className="nav-link">
              Contact
            </NavLink>
            <NavLink to="/track-order" className="nav-link ms-auto">
              <i className="bi bi-geo-alt me-1" />
              Track Order
            </NavLink>
          </nav>
        </div>
      </header>
      {menuOpen && <MobileMenu categories={categories} onClose={() => setMenuOpen(false)} />}
    </>
  );
}
