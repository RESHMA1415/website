import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api, isRemembered, setToken } from '../../api/client.js';
import AddressForm, { EMPTY_ADDRESS } from '../../components/AddressForm.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { useShopper } from '../../context/ShopperContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { formatDate } from '../../utils/format.js';
import { PASSWORD_HINT, PASSWORD_RULE } from '../auth/authHelpers.js';
import AccountLayout from './AccountLayout.jsx';

const toInputDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

function Profile() {
  const { notify } = useStore();
  const { user, setUser } = useShopper();
  const [form, setForm] = useState(() => ({
    name: user.name, email: user.email, mobile: user.mobile, gender: user.gender || '', dateOfBirth: toInputDate(user.dateOfBirth),
  }));
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setP = (key) => (e) => setPw((f) => ({ ...f, [key]: e.target.value }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy('profile');
    setErrors({});
    try {
      setUser(await api('/account/profile', { method: 'PUT', body: form }));
      notify('Your details have been saved.');
    } catch (err) {
      setErrors({ profile: err.message });
    } finally {
      setBusy('');
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!PASSWORD_RULE.test(pw.newPassword)) return setErrors({ password: `New password must be ${PASSWORD_HINT.toLowerCase()}` });
    if (pw.newPassword !== pw.confirm) return setErrors({ password: 'The new passwords do not match.' });
    setBusy('password');
    setErrors({});
    try {
      const remember = isRemembered();
      const session = await api('/account/password', { method: 'PUT', body: { ...pw, remember } });
      setToken(session.token, remember); // other devices are signed out; this one stays in
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      notify('Password updated. You’ve been logged out on your other devices.');
    } catch (err) {
      setErrors({ password: err.message });
    } finally {
      setBusy('');
    }
    return undefined;
  };

  return (
    <>
      <form className="card-soft p-4 mb-4" onSubmit={saveProfile}>
        <h2 className="h5 mb-3">Personal Details</h2>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label" htmlFor="p-name">Full name</label>
            <input id="p-name" className="form-control" required maxLength={80} value={form.name} onChange={set('name')} autoComplete="name" />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="p-email">Email</label>
            <input id="p-email" type="email" className="form-control" required value={form.email} onChange={set('email')} autoComplete="email" />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="p-mobile">Mobile number</label>
            <input id="p-mobile" className="form-control" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} required value={form.mobile} onChange={set('mobile')} title="10-digit Indian mobile number" autoComplete="tel-national" />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="p-gender">Gender</label>
            <select id="p-gender" className="form-select" value={form.gender} onChange={set('gender')}>
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="p-dob">Date of birth</label>
            <input id="p-dob" type="date" className="form-control" value={form.dateOfBirth} onChange={set('dateOfBirth')} max={new Date().toISOString().slice(0, 10)} />
          </div>
        </div>
        {errors.profile && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{errors.profile}</div>}
        <button type="submit" className="btn btn-orange mt-4" disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save Changes'}</button>
      </form>
      <form className="card-soft p-4" onSubmit={savePassword}>
        <h2 className="h5 mb-3">Change Password</h2>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label" htmlFor="p-current">Current password</label>
            <input id="p-current" type="password" className="form-control" required autoComplete="current-password" value={pw.currentPassword} onChange={setP('currentPassword')} />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="p-new">New password</label>
            <input id="p-new" type="password" className="form-control" required minLength={8} autoComplete="new-password" value={pw.newPassword} onChange={setP('newPassword')} />
            <div className="form-text">{PASSWORD_HINT}</div>
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="p-confirm">Confirm new password</label>
            <input id="p-confirm" type="password" className="form-control" required autoComplete="new-password" value={pw.confirm} onChange={setP('confirm')} />
          </div>
        </div>
        {errors.password && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{errors.password}</div>}
        <button type="submit" className="btn btn-navy mt-4" disabled={busy === 'password'}>{busy === 'password' ? 'Updating…' : 'Update Password'}</button>
      </form>
      <PrivacyAndData />
    </>
  );
}

// Your data & privacy: consent record and "Delete my account" (DPDP Act right to erasure)
function PrivacyAndData() {
  const { user, logout } = useShopper();
  const { settings } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ password: '', confirmText: '', reason: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const remove = async (e) => {
    e.preventDefault();
    if (!window.confirm('Delete your SHOPME account permanently? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    try {
      await api('/account/delete', { method: 'POST', body: form });
      logout('Your account and personal data have been deleted. We’re sorry to see you go.');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="card-soft p-4 mt-4">
      <h2 className="h5 mb-2">Your Data & Privacy</h2>
      <p className="small text-muted mb-3">
        {user.consentAt
          ? <>You agreed to our <Link to="/policies/terms" target="_blank" rel="noopener">Terms & Conditions</Link> and <Link to="/policies/privacy" target="_blank" rel="noopener">Privacy Policy</Link> on {formatDate(user.consentAt)}.</>
          : <>Read how we handle your data in our <Link to="/policies/privacy" target="_blank" rel="noopener">Privacy Policy</Link>.</>}
        {' '}You can correct your details above at any time. For a copy of your data or any privacy question, email <a href={`mailto:${settings.store.email}`}>{settings.store.email}</a>.
      </p>
      {!open ? (
        <button type="button" className="btn btn-outline-danger" onClick={() => setOpen(true)}>
          <i className="bi bi-trash me-1" />Delete my account
        </button>
      ) : (
        <form onSubmit={remove} className="border border-danger-subtle rounded-3 p-3">
          <h3 className="h6 text-danger">Delete my account and personal data</h3>
          <ul className="small mb-3">
            <li><strong>Deleted:</strong> your profile, saved addresses, wishlist and cart. You’ll be logged out and can’t log in again with this account.</li>
            <li><strong>Kept:</strong> records of past orders and payments, only as long as tax and consumer laws require (see our <Link to="/policies/privacy" target="_blank" rel="noopener">Privacy Policy</Link>).</li>
            <li>If an order is still on its way or a return is open, please wait until it’s finished.</li>
          </ul>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small" htmlFor="del-password">Your password</label>
              <input id="del-password" type="password" className="form-control" required autoComplete="current-password" value={form.password} onChange={set('password')} />
            </div>
            <div className="col-md-6">
              <label className="form-label small" htmlFor="del-confirm">Type <strong>DELETE</strong> to confirm</label>
              <input id="del-confirm" className="form-control" required value={form.confirmText} onChange={set('confirmText')} autoComplete="off" />
            </div>
            <div className="col-12">
              <label className="form-label small" htmlFor="del-reason">Why are you leaving? (optional)</label>
              <input id="del-reason" className="form-control" maxLength={300} value={form.reason} onChange={set('reason')} />
            </div>
          </div>
          {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error}</div>}
          <div className="d-flex flex-wrap gap-2 mt-3">
            <button type="submit" className="btn btn-danger" disabled={busy || form.confirmText.trim().toUpperCase() !== 'DELETE'}>
              {busy ? 'Deleting…' : 'Permanently delete my account'}
            </button>
            <button type="button" className="btn btn-light" onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function AddressCard({ address, onEdit, onDelete, onDefault }) {
  return (
    <div className="card-soft p-3 h-100 d-flex flex-column">
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div className="fw-semibold text-navy">{address.fullName}</div>
        <div className="d-flex gap-1">
          <span className="badge rounded-pill text-bg-light text-uppercase">{address.type}</span>
          {address.isDefault && <span className="badge rounded-pill bg-orange">Default</span>}
        </div>
      </div>
      <div className="small text-muted flex-grow-1">
        {address.house}, {address.street}
        {address.landmark ? `, near ${address.landmark}` : ''}
        <br />
        {address.city}, {address.state} – {address.pincode}
        <br />
        Mobile: {address.mobile}
        {address.alternateMobile ? ` / ${address.alternateMobile}` : ''}
      </div>
      <div className="d-flex flex-wrap gap-2 mt-3">
        <button type="button" className="btn btn-sm btn-outline-navy" onClick={onEdit}><i className="bi bi-pencil me-1" />Edit</button>
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDelete}><i className="bi bi-trash me-1" />Delete</button>
        {!address.isDefault && <button type="button" className="btn btn-sm btn-link" onClick={onDefault}>Make default</button>}
      </div>
    </div>
  );
}

function Addresses() {
  const { notify } = useStore();
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, address = edit
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [makeDefault, setMakeDefault] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/account/addresses').then(setList).catch((err) => { setList([]); notify(err.message); });
  }, [notify]);

  const open = (address) => {
    setEditing(address);
    setForm({ ...EMPTY_ADDRESS, ...(address || {}) });
    setMakeDefault(Boolean(address?.isDefault));
    setError('');
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const isNew = !editing._id;
      const body = { ...form, isDefault: makeDefault };
      setList(await api(isNew ? '/account/addresses' : `/account/addresses/${editing._id}`, { method: isNew ? 'POST' : 'PUT', body }));
      notify(isNew ? 'Address saved.' : 'Address updated.');
      setEditing(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (request, message) => {
    try {
      setList(await request);
      notify(message);
    } catch (err) {
      notify(err.message);
    }
  };

  if (!list) return <div className="card-soft p-4 text-muted">Loading your addresses…</div>;

  return (
    <>
      {list.length === 0 && !editing && (
        <div className="card-soft mb-4">
          <EmptyState icon="bi-geo-alt" title="No saved addresses" text="Addresses you save here appear at checkout for one-tap delivery." />
        </div>
      )}
      {list.length > 0 && (
        <div className="row g-3 mb-4">
          {list.map((a) => (
            <div key={a._id} className="col-md-6">
              <AddressCard
                address={a}
                onEdit={() => open(a)}
                onDelete={() => window.confirm('Delete this address?') && act(api(`/account/addresses/${a._id}`, { method: 'DELETE' }), 'Address deleted.')}
                onDefault={() => act(api(`/account/addresses/${a._id}/default`, { method: 'PUT' }), 'Default address updated.')}
              />
            </div>
          ))}
        </div>
      )}
      {editing ? (
        <form className="card-soft p-4" onSubmit={save}>
          <h2 className="h5 mb-3">{editing._id ? 'Edit Address' : 'Add a New Address'}</h2>
          <AddressForm idPrefix="account" value={form} onChange={setForm} />
          <div className="form-check mt-3">
            <input className="form-check-input" type="checkbox" id="default-address" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} disabled={Boolean(editing.isDefault) || list.length === 0} />
            <label className="form-check-label" htmlFor="default-address">
              {list.length === 0 ? 'This will be your default address' : 'Make this my default address'}
            </label>
          </div>
          {error && <div className="alert alert-danger small py-2 mt-3 mb-0" role="alert">{error}</div>}
          <div className="d-flex gap-2 mt-3">
            <button type="submit" className="btn btn-orange" disabled={busy}>{busy ? 'Saving…' : 'Save Address'}</button>
            <button type="button" className="btn btn-light" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      ) : (
        list.length < 10 && (
          <button type="button" className="btn btn-orange" onClick={() => open({})}>
            <i className="bi bi-plus-lg me-1" />Add a New Address
          </button>
        )
      )}
    </>
  );
}

const REVIEW_STATUS = {
  pending: ['Waiting for approval', 'warning'],
  approved: ['Published', 'success'],
  rejected: ['Not published', 'secondary'],
  hidden: ['Not shown', 'secondary'],
};

// My Reviews (PRD §13.10): written reviews and delivered products to review
function Reviews() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/reviews/mine').then(setData).catch((err) => setError(err.message));
  }, []);
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return <div className="card-soft p-4 text-muted">Loading…</div>;
  if (!data.reviews.length && !data.toReview.length) {
    return (
      <div className="card-soft">
        <EmptyState icon="bi-star" title="No reviews yet" text="After your order is delivered, you can review each product with stars, a comment, photos or a video." />
      </div>
    );
  }
  return (
    <>
      {data.toReview.length > 0 && (
        <div className="card-soft p-4 mb-4">
          <h2 className="h5 mb-3">Waiting for your review</h2>
          <div className="d-grid gap-2">
            {data.toReview.map((p) => (
              <div key={`${p.orderNumber}-${p.productId}`} className="d-flex align-items-center gap-3">
                <div className="cart-line-image" style={{ width: 48, height: 60 }}>{p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" /> : <i className="bi bi-image text-muted" />}</div>
                <div className="small flex-grow-1">
                  <div className="fw-semibold">{p.name}</div>
                  <div className="text-muted">Order {p.orderNumber}{p.deliveredAt ? ` · delivered ${formatDate(p.deliveredAt)}` : ''}</div>
                </div>
                <Link className="btn btn-orange btn-sm" to={`/account/orders/${p.orderNumber}/review/${p.productId}`}>Write a review</Link>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.reviews.length > 0 && (
        <div className="d-grid gap-3">
          {data.reviews.map((r) => {
            const [label, tone] = REVIEW_STATUS[r.status] || [r.status, 'secondary'];
            return (
              <div key={r.id} className="card-soft p-3">
                <div className="d-flex gap-3">
                  <div className="cart-line-image" style={{ width: 48, height: 60 }}>{r.imageUrl ? <img src={r.imageUrl} alt="" loading="lazy" /> : <i className="bi bi-image text-muted" />}</div>
                  <div className="flex-grow-1 small" style={{ minWidth: 0 }}>
                    <div className="d-flex flex-wrap justify-content-between gap-2">
                      {r.productSlug ? <Link to={`/product/${r.productSlug}#reviews`} className="fw-semibold text-navy">{r.productName}</Link> : <span className="fw-semibold">{r.productName}</span>}
                      <span className={`badge rounded-pill text-bg-${tone}`}>{label}</span>
                    </div>
                    <div className="text-warning">{'★'.repeat(r.rating)}<span className="text-muted">{'★'.repeat(5 - r.rating)}</span>{r.title && <span className="text-body fw-semibold ms-2">{r.title}</span>}</div>
                    <p className="mb-1 mt-1">{r.text}</p>
                    {r.adminReply && <div className="review-reply"><div className="fw-semibold text-navy">Response from SHOPME</div>{r.adminReply.text}</div>}
                    <div className="text-muted mt-1">
                      Posted {formatDate(r.createdAt)}{r.editedAt ? ` · edited ${formatDate(r.editedAt)}` : ''}
                      {r.canEdit && r.orderNumber && <> · <Link to={`/account/orders/${r.orderNumber}/review/${r.productId}`}>Edit</Link></>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

const TABS = {
  profile: { title: 'My Account', crumb: 'Profile', Component: Profile },
  addresses: { title: 'Saved Addresses', crumb: 'Addresses', Component: Addresses },
  reviews: { title: 'My Reviews', crumb: 'Reviews', Component: Reviews },
};

export default function Account() {
  const { tab } = useParams();
  const config = TABS[tab || 'profile'];
  if (!config) return <Navigate to="/account" replace />;
  const { title, crumb, Component } = config;
  return (
    <AccountLayout title={title} crumbs={tab ? [{ label: crumb }] : []}>
      <Component />
    </AccountLayout>
  );
}
