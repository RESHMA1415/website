import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext.jsx';
import StoreMap from '../StoreMap.jsx';

const SOCIAL_ICONS = {
  instagram: 'bi-instagram',
  facebook: 'bi-facebook',
  youtube: 'bi-youtube',
  x: 'bi-twitter-x',
  pinterest: 'bi-pinterest',
};

export default function Footer() {
  const { settings } = useStore();
  const { store, social } = settings;

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="row g-4">
          <div className="col-12 col-lg-4">
            <div className="brand-logo text-white mb-3">
              SHOP<span>ME</span>
            </div>
            <p>
              Modern clothing for men and women, plus women’s fashion, beauty and accessories, delivered anywhere
              in India.
            </p>
            <div className="social-icons mt-3">
              {Object.entries(SOCIAL_ICONS).map(
                ([key, icon]) =>
                  social?.[key] && (
                    <a key={key} href={social[key]} target="_blank" rel="noreferrer" aria-label={key}>
                      <i className={`bi ${icon}`} />
                    </a>
                  ),
              )}
            </div>
          </div>
          <div className="col-6 col-md-4 col-lg-2">
            <h6>Shop</h6>
            <ul>
              <li><Link to="/men">Men</Link></li>
              <li><Link to="/women">Women</Link></li>
              <li><Link to="/category/women-fashion">Fashion</Link></li>
              <li><Link to="/category/women-beauty">Beauty</Link></li>
              <li><Link to="/category/women-accessories">Accessories</Link></li>
              <li><Link to="/new-arrivals">New Arrivals</Link></li>
            </ul>
          </div>
          <div className="col-6 col-md-4 col-lg-2">
            <h6>Help</h6>
            <ul>
              <li><Link to="/account">My Account</Link></li>
              <li><Link to="/account/orders">My Orders</Link></li>
              <li><Link to="/track-order">Track Order</Link></li>
              <li><Link to="/policies/faq">FAQ</Link></li>
              <li><Link to="/contact">Contact Us</Link></li>
              <li><Link to="/about">About Us</Link></li>
            </ul>
          </div>
          <div className="col-6 col-md-4 col-lg-2">
            <h6>Policies</h6>
            <ul>
              <li><Link to="/policies/shipping">Shipping Policy</Link></li>
              <li><Link to="/policies/returns">Return & Refund</Link></li>
              <li><Link to="/policies/cancellation">Cancellation</Link></li>
              <li><Link to="/policies/privacy">Privacy Policy</Link></li>
              <li><Link to="/policies/terms">Terms & Conditions</Link></li>
            </ul>
          </div>
          <div className="col-6 col-md-12 col-lg-2">
            <h6>Contact</h6>
            <ul>
              {store.phone && <li><i className="bi bi-telephone me-2" />{store.phone}</li>}
              {store.email && <li><i className="bi bi-envelope me-2" />{store.email}</li>}
              {store.address && <li><i className="bi bi-geo-alt me-2" />{store.address}</li>}
            </ul>
            <StoreMap store={store} height={130} className="mb-2" />
            {store.mapLink && (
              <a className="footer-directions" href={store.mapLink} target="_blank" rel="noopener noreferrer">
                <i className="bi bi-sign-turn-right me-1" />Get Directions
              </a>
            )}
          </div>
        </div>
        <hr className="border-secondary my-4" />
        <div className="small">© {new Date().getFullYear()} {store.name}. All rights reserved.</div>
      </div>
    </footer>
  );
}
