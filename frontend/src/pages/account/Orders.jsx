import EmptyState from '../../components/EmptyState.jsx';
import AccountLayout from './AccountLayout.jsx';

export default function Orders() {
  return (
    <AccountLayout title="My Orders" crumbs={[{ label: 'Orders' }]}>
      <div className="card-soft">
        <EmptyState
          icon="bi-box-seam"
          title="No orders yet"
          text="When you place an order, you can track it, cancel it before shipping, or request a return here."
          actionLabel="Start Shopping"
        />
      </div>
    </AccountLayout>
  );
}
