import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useShopper } from '../../context/ShopperContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import AuthCard from './AuthCard.jsx';
import { PASSWORD_HINT, PASSWORD_RULE } from './authHelpers.js';

// Opened from the reset link in the email (valid 30 minutes, once)
export default function ResetPassword() {
  const { notify } = useStore();
  const { startSession } = useShopper();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!PASSWORD_RULE.test(password)) {
      setError(`Password must be ${PASSWORD_HINT.toLowerCase()}`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const session = await api('/auth/reset-password', { method: 'POST', body: { token, password } });
      startSession(session, false);
      notify('Your password has been changed. You are now logged in.');
      navigate('/account', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="After saving, you’ll be logged out on your other devices."
      footer={<Link to="/forgot-password">Need a new link?</Link>}
    >
      {!token ? (
        <div className="alert alert-warning small">This reset link is incomplete. Please open the link from your email again, or request a new one.</div>
      ) : (
        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="form-label" htmlFor="rp-password">New password</label>
            <input id="rp-password" type="password" className="form-control" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            <div className="form-text">{PASSWORD_HINT}</div>
          </div>
          <div className="mb-4">
            <label className="form-label" htmlFor="rp-confirm">Confirm new password</label>
            <input id="rp-confirm" type="password" className="form-control" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
          <button type="submit" className="btn btn-orange w-100" disabled={busy}>{busy ? 'Saving…' : 'Save New Password'}</button>
        </form>
      )}
    </AuthCard>
  );
}
