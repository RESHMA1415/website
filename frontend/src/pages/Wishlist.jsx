import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PhaseNotice from '../components/PhaseNotice.jsx';

export default function Wishlist() {
  return (
    <>
      <PageHeader title="My Wishlist" crumbs={[{ label: 'Wishlist' }]} />
      <div className="container">
        <PhaseNotice phase={3}>
          Saving products to the wishlist starts working once customer accounts are added.
        </PhaseNotice>
        <EmptyState
          icon="bi-heart"
          title="Your wishlist is empty"
          text="Tap the heart on any product to save it here. We’ll let you know if the price drops."
          actionLabel="Discover products"
        />
      </div>
    </>
  );
}
