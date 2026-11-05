import { Navigate, useLocation } from 'react-router-dom';
import { useShopper } from '../context/ShopperContext.jsx';

// Pages for logged-in customers only (My Account, Wishlist, Checkout…).
// Guests are sent to the login page and come back here afterwards.
export default function RequireLogin({ children }) {
  const { user, ready } = useShopper();
  const location = useLocation();
  if (!ready) {
    return (
      <div className="container py-5 text-center text-muted">
        <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
        Loading your account…
      </div>
    );
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}
