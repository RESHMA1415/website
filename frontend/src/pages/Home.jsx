import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import ConsentCheckbox from '../components/ConsentCheckbox.jsx';
import { sizedSrcSet, smallerUrl } from '../components/ProductImage.jsx';
import ProductGrid from '../components/ProductGrid.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { formatINR } from '../utils/format.js';

// A tile shows its category's cover image (set in admin → Categories) when one exists
const CATEGORY_TILES = [
  { label: 'Men', slug: 'men', to: '/men', icon: 'bi-person-standing', bg: 'linear-gradient(160deg, #22335c, #14213d)' },
  { label: 'Women', slug: 'women', to: '/women', icon: 'bi-person-standing-dress', bg: 'linear-gradient(160deg, #ff9a3d, #ff7a00)' },
  { label: 'Fashion', slug: 'women-fashion', to: '/category/women-fashion', icon: 'bi-bag-heart', bg: 'linear-gradient(160deg, #3d4f7c, #22335c)' },
  { label: 'Beauty', slug: 'women-beauty', to: '/category/women-beauty', icon: 'bi-stars', bg: 'linear-gradient(160deg, #e86a8f, #c94770)' },
  { label: 'Accessories', slug: 'women-accessories', to: '/category/women-accessories', icon: 'bi-gem', bg: 'linear-gradient(160deg, #8a7bd8, #5f50b8)' },
];

function HeroSlider() {
  const { data: banners } = useApi('/banners');
  const [active, setActive] = useState(0);
  const count = banners?.length || 0;

  useEffect(() => {
    if (count < 2) return undefined;
    const timer = setInterval(() => setActive((i) => (i + 1) % count), 5000);
    return () => clearInterval(timer);
  }, [count]);

  if (!banners) return <div className="hero skeleton" />;
  const banner = banners[active] || {
    heading: 'Welcome to SHOPME',
    subHeading: 'Fashion for everyone',
    buttonText: 'Shop Now',
    buttonLink: '/shop',
  };

  return (
    <section className="hero" aria-roledescription="carousel">
      {banner.desktopImageUrl && (
        <picture>
          {banner.mobileImageUrl && <source media="(max-width: 767px)" srcSet={banner.mobileImageUrl} />}
          <img src={banner.desktopImageUrl} srcSet={sizedSrcSet(banner.desktopImageUrl)} sizes="100vw" alt="" className="hero-image" fetchpriority="high" decoding="async" />
        </picture>
      )}
      {banner.desktopImageUrl && <div className="hero-shade" aria-hidden="true" />}
      <div className="hero-content">
        <span className="badge rounded-pill mb-3" style={{ background: 'rgba(255,255,255,0.15)' }}>
          SHOPME
        </span>
        <h1>{banner.heading}</h1>
        {banner.subHeading && <p className="mb-4">{banner.subHeading}</p>}
        {banner.buttonText && (
          <Link to={banner.buttonLink || '/shop'} className="btn btn-orange btn-lg">
            {banner.buttonText} <i className="bi bi-arrow-right ms-1" />
          </Link>
        )}
      </div>
      {count > 1 && (
        <div className="hero-dots">
          {banners.map((b, i) => (
            <button
              key={b._id}
              type="button"
              className={i === active ? 'active' : ''}
              aria-label={`Show banner ${i + 1}`}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProductRow({ title, subtitle, query, link }) {
  const { data, loading } = useApi(`/products?limit=8&${query}`);
  if (!loading && !data?.products?.length) return null;
  return (
    <section className="section">
      <div className="container">
        <div className="d-flex justify-content-between align-items-end mb-1">
          <div>
            <h2 className="section-title">{title}</h2>
            <p className="section-subtitle mb-4">{subtitle}</p>
          </div>
          <Link to={link} className="fw-semibold mb-4 text-nowrap">
            View all <i className="bi bi-arrow-right" />
          </Link>
        </div>
        <ProductGrid products={data?.products || []} loading={loading} skeletonCount={4} />
      </div>
    </section>
  );
}

function Newsletter() {
  const { notify } = useStore();
  const [contact, setContact] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const subscribe = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('/newsletter', { method: 'POST', body: { contact, agree, source: 'homepage' } });
      setDone(r.already ? 'You’re already on our list. Thank you!' : 'You’re subscribed! Watch out for new arrivals and offers.');
      setContact('');
      setAgree(false);
    } catch (err) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="section pt-0">
      <div className="container">
        <div className="rounded-4 p-4 p-md-5 text-center text-white bg-navy">
          <h2 className="text-white section-title">Get style updates & early access</h2>
          <p className="opacity-75 mb-4">New arrivals and offers straight to your inbox or WhatsApp.</p>
          <form
            className="mx-auto"
            style={{ maxWidth: 480 }}
            onSubmit={subscribe}
          >
            {done && <div className="alert alert-light py-2 small" role="status">{done}</div>}
            <div className="d-flex flex-column flex-sm-row gap-2">
              <input type="text" className="form-control" placeholder="Email or WhatsApp number" aria-label="Email or WhatsApp number" required maxLength={120} value={contact} onChange={(e) => setContact(e.target.value)} />
              <button type="submit" className="btn btn-orange text-nowrap" disabled={busy}>
                {busy ? '…' : 'Subscribe'}
              </button>
            </div>
            <ConsentCheckbox id="nl-consent" purpose="updates" className="consent-on-dark text-start mt-3 mb-0" checked={agree} onChange={setAgree} />
          </form>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { settings, categories, findCategory } = useStore();
  const features = [
    { icon: 'bi-truck', title: 'Free Delivery', text: `On orders above ${formatINR(settings.delivery.freeDeliveryThreshold)}` },
    { icon: 'bi-arrow-repeat', title: `Easy ${settings.orders.returnWindowDays}-Day Returns`, text: 'Hassle-free returns & exchanges' },
    { icon: 'bi-cash-coin', title: 'Cash on Delivery', text: 'Pay when your order arrives' },
    { icon: 'bi-shield-check', title: 'Secure Payments', text: 'UPI, cards, net banking & wallets' },
  ];

  return (
    <>
      <div className="container pt-3 pt-md-4">
        <HeroSlider />
      </div>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Shop by Category</h2>
          <p className="section-subtitle">Find exactly what you’re looking for</p>
          <div className="row g-3 row-cols-2 row-cols-md-3 row-cols-lg-5">
            {CATEGORY_TILES.map((tile) => {
              const found = findCategory(tile.slug);
              // Skip a tile whose category was removed or renamed, rather than linking to the wrong page
              if (categories.length && !found) return null;
              const cover = found?.category.imageUrl;
              return (
              <div key={tile.label} className="col">
                <Link to={tile.to} className="category-tile">
                  <div className="tile-bg" style={{ background: tile.bg }}>
                    {cover ? <img src={smallerUrl(cover)} alt="" className="tile-img" loading="lazy" decoding="async" /> : <i className={`bi ${tile.icon}`} />}
                  </div>
                  <div className="tile-label">
                    {tile.label} <i className="bi bi-arrow-right-short" />
                  </div>
                </Link>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      <ProductRow title="New Arrivals" subtitle="Fresh styles just landed" query="newArrivals=true" link="/new-arrivals" />

      <section className="pb-2">
        <div className="container">
          <div className="features p-4">
            <div className="row g-4">
              {features.map((f) => (
                <div key={f.title} className="col-12 col-sm-6 col-lg-3">
                  <div className="feature">
                    <div className="icon">
                      <i className={`bi ${f.icon}`} />
                    </div>
                    <div>
                      <div className="fw-semibold text-navy">{f.title}</div>
                      <div className="small text-muted">{f.text}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ProductRow title="Featured Picks" subtitle="Our customers’ favourites" query="featured=true" link="/shop?sort=best_selling" />

      <section className="section pt-0">
        <div className="container">
          <h2 className="section-title">What Our Customers Say</h2>
          <p className="section-subtitle">Real reviews from verified buyers</p>
          <div className="card-soft p-4 text-center text-muted">
            <i className="bi bi-chat-heart fs-1 text-orange" />
            <p className="mb-0 mt-2">Customer reviews will appear here once your first buyers share their experience.</p>
          </div>
        </div>
      </section>

      <Newsletter />
    </>
  );
}
