import { useState } from 'react';
import { api, formatDateTime, setToken, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorNote, PageTitle, Panel } from '../components/ui.jsx';

// Is the store able to send emails? (Phase 7: Gmail set up in backend/.env)
function EmailStatus() {
  const { notify } = useAuth();
  const { data, loading, reload } = useApi('/admin/email/status');
  const [busy, setBusy] = useState(false);
  const test = async () => {
    setBusy(true);
    try {
      const r = await api('/admin/email/test', { method: 'POST' });
      if (r.sent) notify(`Test email sent to ${r.to}. Check your inbox (and spam folder).`);
      else notify(r.reason || 'The test email could not be sent.', 'error');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="Store emails">
      {loading && !data ? (
        <div className="small text-muted">Checking…</div>
      ) : data?.connected ? (
        <div className="small">
          <div className="text-success fw-semibold mb-1"><i className="bi bi-check-circle-fill me-1" />Connected</div>
          <div className="text-muted mb-3">Customer emails are sent from {data.from}.</div>
          <button type="button" className="btn btn-sm btn-orange" disabled={busy} onClick={test}>{busy ? 'Sending…' : 'Send me a test email'}</button>
        </div>
      ) : (
        <div className="small">
          <div className="text-danger fw-semibold mb-1"><i className="bi bi-x-circle-fill me-1" />Not sending yet</div>
          <div className="text-muted">{data?.reason || 'Email isn’t set up yet.'} Until then, emails are only written to the server log.</div>
        </div>
      )}
    </Panel>
  );
}

function LoginSecurity() {
  const { admin, setAdmin, notify } = useAuth();
  const [mode, setMode] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reset = () => { setMode(''); setPassword(''); setEmail(''); setCode(''); setSentTo(''); setError(''); };
  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const startTwoStep = () => run(async () => { const r = await api('/admin/auth/two-step/start', { method: 'POST' }); setSentTo(r.to); setMode('enable'); });
  const confirmTwoStep = (e) => { e.preventDefault(); run(async () => { setAdmin(await api('/admin/auth/two-step/confirm', { method: 'POST', body: { code } })); notify('Two-step login is on. Next time you log in, we’ll email you a code.'); reset(); }); };
  const disableTwoStep = (e) => { e.preventDefault(); run(async () => { setAdmin(await api('/admin/auth/two-step/disable', { method: 'POST', body: { password } })); notify('Two-step login is off.'); reset(); }); };
  const changeEmail = (e) => { e.preventDefault(); run(async () => { setAdmin(await api('/admin/auth/change-email', { method: 'POST', body: { email, password } })); notify('Login email changed. Use it next time you log in.'); reset(); }); };

  return (
    <Panel title="Login security">
      <ErrorNote error={error} />
      <div className="small mb-3">
        <div className="fw-semibold">Two-step login {admin?.twoStepEnabled ? <span className="status-pill tone-green ms-1">On</span> : <span className="status-pill tone-muted ms-1">Off</span>}</div>
        <div className="text-muted">When it’s on, logging in also needs a 6-digit code we email to {admin?.email}.</div>
      </div>
      {!mode && (
        <div className="d-flex flex-wrap gap-2">
          {admin?.twoStepEnabled
            ? <button type="button" className="btn btn-sm btn-light" onClick={() => setMode('disable')}>Turn off two-step login</button>
            : <button type="button" className="btn btn-sm btn-orange" disabled={busy} onClick={startTwoStep}>{busy ? 'Sending…' : 'Turn on two-step login'}</button>}
          <button type="button" className="btn btn-sm btn-light" onClick={() => setMode('email')}>Change login email</button>
        </div>
      )}
      {mode === 'enable' && (
        <form onSubmit={confirmTwoStep} className="d-flex flex-wrap gap-2 align-items-end">
          <div>
            <label className="form-label" htmlFor="tfa-code">Code we emailed to {sentTo}</label>
            <input id="tfa-code" className="form-control" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </div>
          <button type="submit" className="btn btn-orange" disabled={busy || code.length !== 6}>Turn on</button>
          <button type="button" className="btn btn-light" onClick={reset}>Cancel</button>
        </form>
      )}
      {mode === 'disable' && (
        <form onSubmit={disableTwoStep} className="d-flex flex-wrap gap-2 align-items-end">
          <div>
            <label className="form-label" htmlFor="tfa-pass">Your password</label>
            <input id="tfa-pass" type="password" className="form-control" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-danger" disabled={busy || !password}>Turn off</button>
          <button type="button" className="btn btn-light" onClick={reset}>Cancel</button>
        </form>
      )}
      {mode === 'email' && (
        <form onSubmit={changeEmail} className="row g-2" style={{ maxWidth: 460 }}>
          <div className="col-12">
            <label className="form-label" htmlFor="ce-email">New login email</label>
            <input id="ce-email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="ce-pass">Your password</label>
            <input id="ce-pass" type="password" className="form-control" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {admin?.twoStepEnabled && <div className="form-text">Two-step login turns off when you change the email. Turn it on again afterwards.</div>}
          </div>
          <div className="col-12 d-flex gap-2">
            <button type="submit" className="btn btn-orange" disabled={busy || !email || !password}>Change email</button>
            <button type="button" className="btn btn-light" onClick={reset}>Cancel</button>
          </div>
        </form>
      )}
    </Panel>
  );
}

export default function Account() {
  const { admin, setAdmin, notify } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const strongEnough = next.length >= 8 && /[a-z]/i.test(next) && /\d/.test(next);
  const mismatch = confirm && next !== confirm;

  const submit = async (event) => {
    event.preventDefault();
    if (next !== confirm) return;
    setSaving(true);
    setError('');
    try {
      const result = await api('/admin/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      setToken(result.token);
      setAdmin(result.admin);
      setCurrent('');
      setNext('');
      setConfirm('');
      notify('Password changed. Other browsers where you were logged in have been logged out.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageTitle title="My Account" subtitle="Your admin login" />
      <div className="row g-3">
        <div className="col-lg-5">
          <Panel title="Login details">
            <dl className="mb-0 small">
              <dt>Name</dt><dd>{admin?.name}</dd>
              <dt>Email (used to log in)</dt><dd>{admin?.email}</dd>
              <dt>Last login</dt><dd className="mb-0">{formatDateTime(admin?.lastLoginAt) || '–'}</dd>
            </dl>
          </Panel>
          <div className="mt-3"><EmailStatus /></div>
          <div className="mt-3"><LoginSecurity /></div>
        </div>
        <div className="col-lg-7">
          <Panel title="Change password">
            <ErrorNote error={error} />
            <form onSubmit={submit} className="row g-3" style={{ maxWidth: 460 }}>
              <div className="col-12">
                <label className="form-label" htmlFor="p-current">Current password</label>
                <input id="p-current" type="password" className="form-control" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="p-new">New password</label>
                <input id="p-new" type="password" className="form-control" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
                <div className={`form-text ${next && !strongEnough ? 'text-danger' : ''}`}>At least 8 characters, with at least one letter and one number.</div>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="p-confirm">Type the new password again</label>
                <input id="p-confirm" type="password" className={`form-control ${mismatch ? 'is-invalid' : ''}`} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                {mismatch && <div className="invalid-feedback">The two passwords don’t match.</div>}
              </div>
              <div className="col-12">
                <button type="submit" className="btn btn-orange" disabled={saving || !current || !strongEnough || next !== confirm}>
                  {saving ? 'Saving…' : 'Change Password'}
                </button>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
