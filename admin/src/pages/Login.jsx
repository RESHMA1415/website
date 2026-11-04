import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { admin, login, notice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const goTo = location.state?.from && location.state.from !== '/login' ? location.state.from : '/';
  if (admin) return <Navigate to={goTo} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate(goTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="panel p-4 p-md-5 w-100" style={{ maxWidth: 420 }}>
        <div className="text-center mb-4">
          <div className="h3 mb-0" style={{ fontWeight: 700 }}>
            SHOP<span className="text-orange">ME</span>
          </div>
          <div className="small text-muted">Admin Panel</div>
        </div>
        {notice && !error && <div className="alert alert-info small py-2">{notice}</div>}
        <form onSubmit={submit} noValidate>
          <div className="mb-3">
            <label className="form-label" htmlFor="a-email">Email</label>
            <input id="a-email" type="email" className="form-control" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="a-password">Password</label>
            <div className="input-group">
              <input
                id="a-password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="btn btn-light border" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
            </div>
          </div>
          {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
          <button type="submit" className="btn btn-orange w-100" disabled={busy || !email || !password}>
            {busy ? 'Logging in…' : 'Log In'}
          </button>
        </form>
        <p className="small text-muted text-center mt-3 mb-0">
          For your security, login is locked for 15 minutes after 5 wrong attempts, and you are logged out after 2 hours without activity.
        </p>
      </div>
    </div>
  );
}
