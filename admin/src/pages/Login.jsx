import { useState } from 'react';
import { api } from '../api.js';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { admin, login, finishLogin, notice } = useAuth();
  const [step, setStep] = useState(null); // { challenge, to } after the password, when two-step login is on
  const [code, setCode] = useState('');
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
      if (step) {
        await finishLogin(step.challenge, code);
        navigate(goTo, { replace: true });
        return;
      }
      const result = await login(email, password);
      if (result?.twoStep) {
        setStep({ challenge: result.challenge, to: result.to });
        return;
      }
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
        {step ? (
          <form onSubmit={submit} noValidate>
            <p className="small">We emailed a 6-digit code to <strong>{step.to}</strong>. It works for 10 minutes.</p>
            <div className="mb-3">
              <label className="form-label" htmlFor="a-code">Login code</label>
              <input id="a-code" className="form-control text-center fs-4" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus />
            </div>
            {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
            <button type="submit" className="btn btn-orange w-100" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Log In'}</button>
            <div className="d-flex justify-content-between mt-3 small">
              <button type="button" className="btn btn-link btn-sm p-0" onClick={async () => { try { await api('/admin/auth/login-code/resend', { method: 'POST', body: { challenge: step.challenge } }); setError(''); } catch (err) { setError(err.message); } }}>Send a new code</button>
              <button type="button" className="btn btn-link btn-sm p-0" onClick={() => { setStep(null); setCode(''); setError(''); }}>Start again</button>
            </div>
          </form>
        ) : (
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
        )}
        <p className="small text-muted text-center mt-3 mb-0">
          For your security, login is locked for 15 minutes after 5 wrong attempts, and you are logged out after 2 hours without activity.
        </p>
      </div>
    </div>
  );
}
