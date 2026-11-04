import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext.jsx';
import AuthCard from './AuthCard.jsx';

export default function ForgotPassword() {
  const { notify } = useStore();
  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your email and we’ll send you a link to reset it. The link is valid for 30 minutes."
      footer={<Link to="/login"><i className="bi bi-arrow-left me-1" />Back to login</Link>}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          notify('Password reset emails start working in Phase 3.');
        }}
      >
        <div className="mb-4">
          <label className="form-label" htmlFor="fp-email">Email</label>
          <input id="fp-email" type="email" className="form-control" required autoComplete="email" />
        </div>
        <button type="submit" className="btn btn-orange w-100">Send Reset Link</button>
      </form>
    </AuthCard>
  );
}
