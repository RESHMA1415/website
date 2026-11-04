import { useState } from 'react';
import { api, formatDateTime, setToken } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorNote, PageTitle, Panel } from '../components/ui.jsx';

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
