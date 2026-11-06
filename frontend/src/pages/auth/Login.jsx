import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import OtpStep from '../../components/OtpStep.jsx';
import { useShopper } from '../../context/ShopperContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import AuthCard from './AuthCard.jsx';
import { safeNext } from './authHelpers.js';

// Login with an SMS code (default) or with email/mobile + password
export default function Login() {
  const { notify } = useStore();
  const { user, ready, startSession } = useShopper();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(searchParams);
  const [method, setMethod] = useState(searchParams.get('method') === 'password' ? 'password' : 'otp');
  const [form, setForm] = useState({ identifier: '', password: '', remember: false });
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  if (ready && user && !busy) return <Navigate to={next} replace />;

  const finish = (session) => {
    startSession(session, form.remember);
    notify(`Welcome back, ${session.user.name.split(' ')[0]}!`);
    navigate(next, { replace: true });
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      finish(await api('/auth/login', { method: 'POST', body: form }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const sendCode = async (event) => {
    event?.preventDefault();
    setBusy(true);
    setError('');
    try {
      setSent(await api('/auth/otp/request', { method: 'POST', body: { mobile, purpose: 'login' } }));
      setCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      finish(await api('/auth/otp/login', { method: 'POST', body: { mobile, code, remember: form.remember } }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const switchTo = (m) => {
    setMethod(m);
    setError('');
  };

  const registerLink = `/register${searchParams.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`;
  const remember = (
    <div className="form-check">
      <input className="form-check-input" type="checkbox" id="remember" checked={form.remember} onChange={set('remember')} />
      <label className="form-check-label small" htmlFor="remember">Remember me</label>
    </div>
  );

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to track orders, save your wishlist and check out faster."
      footer={<>New to SHOPME? <Link to={registerLink} className="fw-semibold">Create an account</Link></>}
    >
      {method === 'otp' ? (
        <>
          {!sent ? (
            <form onSubmit={sendCode}>
              <label className="form-label" htmlFor="otp-mobile">Mobile number</label>
              <div className="input-group mb-3">
                <span className="input-group-text">+91</span>
                <input id="otp-mobile" className="form-control" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} title="10-digit Indian mobile number" autoComplete="tel-national" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} autoFocus />
              </div>
              {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
              <button type="submit" className="btn btn-orange w-100" disabled={busy}>{busy ? 'Sending…' : 'Send OTP'}</button>
            </form>
          ) : (
            <form onSubmit={verifyCode}>
              <OtpStep sent={sent} code={code} onCode={setCode} onResend={sendCode} onChangeNumber={() => { setSent(null); setError(''); }} busy={busy} />
              <div className="my-3">{remember}</div>
              {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
              <button type="submit" className="btn btn-orange w-100" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Verify & Log In'}</button>
            </form>
          )}
          <div className="text-center small mt-3">
            <button type="button" className="btn btn-link btn-sm p-0" onClick={() => switchTo('password')}>Use password instead</button>
          </div>
        </>
      ) : (
        <>
          <form onSubmit={submitPassword}>
            <div className="mb-3">
              <label className="form-label" htmlFor="login-id">Email or mobile number</label>
              <input id="login-id" className="form-control" required autoComplete="username" value={form.identifier} onChange={set('identifier')} autoFocus />
            </div>
            <div className="mb-2">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input id="login-password" type="password" className="form-control" required autoComplete="current-password" value={form.password} onChange={set('password')} />
            </div>
            <div className="d-flex justify-content-between align-items-center mb-4">
              {remember}
              <Link to="/forgot-password" className="small">Forgot password?</Link>
            </div>
            {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
            <button type="submit" className="btn btn-orange w-100" disabled={busy}>{busy ? 'Logging in…' : 'Log In'}</button>
          </form>
          <div className="text-center small mt-3">
            <button type="button" className="btn btn-link btn-sm p-0" onClick={() => switchTo('otp')}>Login with OTP instead</button>
          </div>
        </>
      )}
    </AuthCard>
  );
}
