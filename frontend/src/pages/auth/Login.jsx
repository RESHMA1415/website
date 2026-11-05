import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useShopper } from '../../context/ShopperContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import AuthCard from './AuthCard.jsx';
import { safeNext } from './authHelpers.js';

export default function Login() {
  const { notify } = useStore();
  const { user, ready, startSession } = useShopper();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(searchParams);
  const [form, setForm] = useState({ identifier: '', password: '', remember: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  if (ready && user && !busy) return <Navigate to={next} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = await api('/auth/login', { method: 'POST', body: form });
      startSession(session, form.remember);
      notify(`Welcome back, ${session.user.name.split(' ')[0]}!`);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const registerLink = `/register${searchParams.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`;
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to track orders, save your wishlist and check out faster."
      footer={<>New to SHOPME? <Link to={registerLink} className="fw-semibold">Create an account</Link></>}
    >
      <form onSubmit={submit} noValidate={false}>
        <div className="mb-3">
          <label className="form-label" htmlFor="login-id">Email or mobile number</label>
          <input id="login-id" className="form-control" required autoComplete="username" value={form.identifier} onChange={set('identifier')} autoFocus />
        </div>
        <div className="mb-2">
          <label className="form-label" htmlFor="login-password">Password</label>
          <input id="login-password" type="password" className="form-control" required autoComplete="current-password" value={form.password} onChange={set('password')} />
        </div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="form-check">
            <input className="form-check-input" type="checkbox" id="remember" checked={form.remember} onChange={set('remember')} />
            <label className="form-check-label small" htmlFor="remember">Remember me</label>
          </div>
          <Link to="/forgot-password" className="small">Forgot password?</Link>
        </div>
        {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
        <button type="submit" className="btn btn-orange w-100" disabled={busy}>{busy ? 'Logging in…' : 'Log In'}</button>
      </form>
    </AuthCard>
  );
}
