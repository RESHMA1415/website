import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import AuthCard from './AuthCard.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      setResult(await api('/auth/forgot-password', { method: 'POST', body: { email } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your email and we’ll send you a link to reset it. The link is valid for 30 minutes."
      footer={<Link to="/login"><i className="bi bi-arrow-left me-1" />Back to login</Link>}
    >
      {result ? (
        <>
          <div className="alert alert-success small" role="status">
            <i className="bi bi-envelope-check me-2" />
            {result.message}
          </div>
          {result.devResetLink && (
            // Development only: no email service is connected yet, so the link is shown here
            <div className="alert alert-warning small">
              <strong>Testing mode:</strong> emails aren’t sent yet, so here is the link the customer would receive:
              <div className="mt-2"><a href={result.devResetLink} className="fw-semibold">Open the reset link</a></div>
            </div>
          )}
          <button type="button" className="btn btn-link w-100" onClick={() => setResult(null)}>Use a different email</button>
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="mb-4">
            <label className="form-label" htmlFor="fp-email">Email</label>
            <input id="fp-email" type="email" className="form-control" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
          <button type="submit" className="btn btn-orange w-100" disabled={busy}>{busy ? 'Sending…' : 'Send Reset Link'}</button>
        </form>
      )}
    </AuthCard>
  );
}
