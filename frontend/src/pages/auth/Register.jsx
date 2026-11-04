import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext.jsx';
import AuthCard from './AuthCard.jsx';

export default function Register() {
  const { notify } = useStore();
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = form.get('password');
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
      setError('Password must be at least 8 characters with at least 1 letter and 1 number.');
      return;
    }
    if (password !== form.get('confirm')) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    notify('Account registration starts working in Phase 3.');
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Join SHOPME for faster checkout and order tracking."
      footer={<>Already have an account? <Link to="/login" className="fw-semibold">Log in</Link></>}
    >
      <form onSubmit={submit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="reg-name">Full name *</label>
          <input id="reg-name" name="name" className="form-control" required autoComplete="name" />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="reg-email">Email *</label>
          <input id="reg-email" name="email" type="email" className="form-control" required autoComplete="email" />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="reg-mobile">Mobile number *</label>
          <div className="input-group">
            <span className="input-group-text">+91</span>
            <input id="reg-mobile" name="mobile" className="form-control" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} title="10-digit Indian mobile number" autoComplete="tel-national" />
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="reg-password">Password *</label>
          <input id="reg-password" name="password" type="password" className="form-control" required minLength={8} autoComplete="new-password" />
          <div className="form-text">At least 8 characters, with 1 letter and 1 number.</div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="reg-confirm">Confirm password *</label>
          <input id="reg-confirm" name="confirm" type="password" className="form-control" required autoComplete="new-password" />
        </div>
        <div className="form-check mb-3">
          <input className="form-check-input" type="checkbox" id="reg-terms" required />
          <label className="form-check-label small" htmlFor="reg-terms">
            I agree to the <Link to="/policies/terms">Terms & Conditions</Link> and <Link to="/policies/privacy">Privacy Policy</Link>
          </label>
        </div>
        {error && <div className="alert alert-danger small py-2">{error}</div>}
        <button type="submit" className="btn btn-orange w-100">Create Account</button>
      </form>
    </AuthCard>
  );
}
