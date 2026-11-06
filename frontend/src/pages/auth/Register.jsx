import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import ConsentCheckbox from '../../components/ConsentCheckbox.jsx';
import OtpStep from '../../components/OtpStep.jsx';
import { useShopper } from '../../context/ShopperContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import AuthCard from './AuthCard.jsx';
import { PASSWORD_HINT, PASSWORD_RULE, safeNext } from './authHelpers.js';

export default function Register() {
  const { notify } = useStore();
  const { user, ready, startSession } = useShopper();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(searchParams);
  const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '', confirmPassword: '', agreeTerms: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null); // SMS code sent to the mobile number
  const [code, setCode] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  if (ready && user && !busy) return <Navigate to={next} replace />;

  // Step 1: check the details, then send a code to confirm the mobile number
  const sendCode = async (event) => {
    event?.preventDefault();
    if (!PASSWORD_RULE.test(form.password)) {
      setError(`Password must be ${PASSWORD_HINT.toLowerCase()}`);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setSent(await api('/auth/otp/request', { method: 'POST', body: { mobile: form.mobile, purpose: 'register' } }));
      setCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Step 2: create the account with the code
  const submit = async (event) => {
    event.preventDefault();
    if (!sent) {
      sendCode();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const session = await api('/auth/register', { method: 'POST', body: { ...form, otp: code, remember: true } });
      startSession(session, true);
      notify(`Welcome to SHOPME, ${session.user.name.split(' ')[0]}!`);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const loginLink = `/login${searchParams.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`;
  return (
    <AuthCard
      title="Create your account"
      subtitle="Join SHOPME for faster checkout and order tracking."
      footer={<>Already have an account? <Link to={loginLink} className="fw-semibold">Log in</Link></>}
    >
      <form onSubmit={submit}>
        {/* Details can't change while a code is out; "Change details" goes back */}
        <fieldset disabled={Boolean(sent)} className="register-details">
        <div className="mb-3">
          <label className="form-label" htmlFor="reg-name">Full name *</label>
          <input id="reg-name" className="form-control" required maxLength={80} autoComplete="name" value={form.name} onChange={set('name')} />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="reg-email">Email *</label>
          <input id="reg-email" type="email" className="form-control" required autoComplete="email" value={form.email} onChange={set('email')} />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="reg-mobile">Mobile number *</label>
          <div className="input-group">
            <span className="input-group-text">+91</span>
            <input id="reg-mobile" className="form-control" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} title="10-digit Indian mobile number" autoComplete="tel-national" value={form.mobile} onChange={set('mobile')} />
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="reg-password">Password *</label>
          <input id="reg-password" type="password" className="form-control" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
          <div className="form-text">{PASSWORD_HINT}</div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="reg-confirm">Confirm password *</label>
          <input id="reg-confirm" type="password" className="form-control" required autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} />
        </div>
        <ConsentCheckbox id="reg-terms" checked={form.agreeTerms} onChange={(value) => setForm((f) => ({ ...f, agreeTerms: value }))} />
        </fieldset>
        {sent && (
          <div className="card-soft p-3 mb-3">
            <OtpStep id="reg-otp" sent={sent} code={code} onCode={setCode} onResend={sendCode} onChangeNumber={() => { setSent(null); setError(''); }} busy={busy} />
          </div>
        )}
        {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
        {sent ? (
          <button type="submit" className="btn btn-orange w-100" disabled={busy || code.length !== 6}>{busy ? 'Creating your account…' : 'Verify & Create Account'}</button>
        ) : (
          <button type="submit" className="btn btn-orange w-100" disabled={busy}>{busy ? 'Sending code…' : 'Continue: verify mobile'}</button>
        )}
      </form>
    </AuthCard>
  );
}
