import { useParams } from 'react-router-dom';
import OrderTimeline from '../../components/OrderTimeline.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { whatsappLink } from '../../utils/format.js';
import AccountLayout from './AccountLayout.jsx';

export default function OrderDetail() {
  const { orderNumber } = useParams();
  const { settings } = useStore();
  return (
    <AccountLayout title={`Order ${orderNumber}`} crumbs={[{ label: 'Orders', to: '/account/orders' }, { label: orderNumber }]}>
      <div className="row g-4">
        <div className="col-md-7">
          <div className="card-soft p-4 mb-4">
            <h2 className="h5 mb-3">Items</h2>
            <p className="text-muted small mb-0">Items, sizes, colours and prices of this order appear here.</p>
          </div>
          <div className="card-soft p-4">
            <h2 className="h5 mb-3">Actions</h2>
            <div className="d-flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline-navy btn-sm" disabled>Cancel Order</button>
              <button type="button" className="btn btn-outline-navy btn-sm" disabled>Return / Exchange</button>
              <button type="button" className="btn btn-outline-navy btn-sm" disabled>Write a Review</button>
              <button type="button" className="btn btn-outline-navy btn-sm" disabled>Download Receipt</button>
              {settings.store.whatsappNumber && (
                <a
                  className="btn btn-outline-success btn-sm"
                  href={whatsappLink(settings.store.whatsappNumber, `Hi, I need help with my order ${orderNumber}`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <i className="bi bi-whatsapp me-1" />Need help?
                </a>
              )}
            </div>
            <p className="small text-muted mt-3 mb-0">
              Cancel is available before shipping. Return/Exchange is available for {settings.orders.returnWindowDays} days after delivery.
            </p>
          </div>
        </div>
        <div className="col-md-5">
          <div className="card-soft p-4">
            <h2 className="h5 mb-3">Tracking</h2>
            <OrderTimeline />
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
