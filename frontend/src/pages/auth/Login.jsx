import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext.jsx';
import AuthCard from './AuthCard.jsx';

export default function Login() {
  const { notify } = useStore();
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to track orders, save your wishlist and check out faster."
      footer={<>New to SHOPME? <Link to="/register" className="fw-semibold">Create an account</Link></>}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          notify('Customer login starts working in Phase 3.');
        }}
      >
        <div className="mb-3">
          <label className="form-label" htmlFor="login-id">Email or mobile number</label>
          <input id="login-id" className="form-control" required autoComplete="username" />
        </div>
        <div className="mb-2">
          <label className="form-label" htmlFor="login-password">Password</label>
          <input id="login-password" type="password" className="form-control" required autoComplete="current-password" />
        </div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="form-check">
            <input className="form-check-input" type="checkbox" id="remember" />
            <label className="form-check-label small" htmlFor="remember">Remember me</label>
          </div>
          <Link to="/forgot-password" className="small">Forgot password?</Link>
        </div>
        <button type="submit" className="btn btn-orange w-100">Log In</button>
      </form>
    </AuthCard>
  );
}
