import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { formatINR } from '../utils/format.js';

export default function About() {
  const { settings } = useStore();
  const { data } = useApi('/pages/about');
  const reasons = [
    { icon: 'bi-patch-check', title: 'Quality you can trust', text: 'Every product is checked before it ships.' },
    { icon: 'bi-truck', title: 'Delivery across India', text: `Free on orders above ${formatINR(settings.delivery.freeDeliveryThreshold)}.` },
    { icon: 'bi-arrow-repeat', title: 'Easy returns', text: `Return or exchange within ${settings.orders.returnWindowDays} days.` },
    { icon: 'bi-chat-heart', title: 'Real reviews', text: 'Only verified buyers can review our products.' },
  ];

  return (
    <>
      <PageHeader title="About SHOPME" crumbs={[{ label: 'About Us' }]} />
      <div className="container">
        <div className="row g-4 align-items-center mb-5">
          <div className="col-lg-6">
            <h2 className="section-title">Our Story</h2>
            <p className="text-muted" style={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>{data?.content}</p>
            <Link to="/shop" className="btn btn-orange mt-2">Explore the Collection</Link>
          </div>
          <div className="col-lg-6">
            <div className="hero" style={{ minHeight: 300 }}>
              <div className="hero-content">
                <h2 className="h1">Style that speaks for you.</h2>
                <p className="mb-0">Men · Women · Fashion · Beauty · Accessories</p>
              </div>
            </div>
          </div>
        </div>
        <h2 className="section-title">Why Shop With Us</h2>
        <p className="section-subtitle">What makes SHOPME different</p>
        <div className="row g-3">
          {reasons.map((r) => (
            <div key={r.title} className="col-sm-6 col-lg-3">
              <div className="card-soft p-4 h-100">
                <i className={`bi ${r.icon} fs-2 text-orange`} />
                <h3 className="h6 mt-3">{r.title}</h3>
                <p className="small text-muted mb-0">{r.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
