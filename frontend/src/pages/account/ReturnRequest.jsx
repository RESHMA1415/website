import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, getToken } from '../../api/client.js';
import AddressForm from '../../components/AddressForm.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { formatDate, formatINR } from '../../utils/format.js';
import AccountLayout from './AccountLayout.jsx';

const MAX_PHOTOS = 5;

// Photos are sent as files, so this call doesn't use the JSON helper
async function uploadPhotos(files) {
  const body = new FormData();
  files.forEach((f) => body.append('photos', f));
  const token = getToken();
  const response = await fetch('/api/returns/photos', { method: 'POST', body, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'We couldn’t upload the photo. Please try again.');
  return data.urls;
}

// Return / exchange request form (PRD §10.3)
export default function ReturnRequest() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const { notify } = useStore();
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [type, setType] = useState('return');
  const [chosen, setChosen] = useState({}); // orderItemId -> { quantity, exchangeVariantId }
  const [reason, setReason] = useState('');
  const [comments, setComments] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [payout, setPayout] = useState('upi');
  const [refund, setRefund] = useState({ upiId: '', accountHolder: '', accountNumber: '', ifsc: '' });
  const [editAddress, setEditAddress] = useState(false);
  const [address, setAddress] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef();
  const itemsRef = useRef();

  useEffect(() => {
    api(`/orders/${orderNumber}/return-options`)
      .then((data) => {
        setOptions(data);
        setAddress(data.pickupAddress);
        // A one-item order: tick that item for the customer
        if (data.items.length === 1 && data.items[0].available > 0 && data.items[0].isReturnable) setChosen({ [data.items[0].orderItemId]: { quantity: 1, exchangeVariantId: '' } });
      })
      .catch((err) => setLoadError(err.message));
  }, [orderNumber]);

  const reasonInfo = options?.reasons.find((r) => r.value === reason);
  const ourMistake = Boolean(reasonInfo?.photosRequired);
  const lines = Object.entries(chosen).filter(([, c]) => c.quantity > 0);
  const toggleItem = (item) =>
    setChosen((c) => {
      const next = { ...c };
      if (next[item.orderItemId]) delete next[item.orderItemId];
      else next[item.orderItemId] = { quantity: 1, exchangeVariantId: '' };
      return next;
    });
  const update = (id, patch) => setChosen((c) => ({ ...c, [id]: { ...c[id], ...patch } }));

  // Money back shown to the customer (the server works out the final amount)
  const itemById = new Map((options?.items || []).map((i) => [String(i.orderItemId), i]));
  const estimate = lines.reduce((sum, [id, c]) => {
    const item = itemById.get(id);
    if (!item) return sum;
    if (type === 'return') return sum + item.price * c.quantity;
    const to = item.exchangeOptions.find((o) => String(o.variantId) === c.exchangeVariantId);
    return to && to.price < item.price ? sum + (item.price - to.price) * c.quantity : sum;
  }, 0);
  const needsPayout = options?.paymentMethod === 'cod' && estimate > 0;

  const addPhotos = async (e) => {
    const files = [...e.target.files].slice(0, MAX_PHOTOS - photos.length);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      const urls = await uploadPhotos(files);
      setPhotos((p) => [...p, ...urls].slice(0, MAX_PHOTOS));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!lines.length) {
      setError('Please tick the item you want to return or exchange under “Which items?” above.');
      itemsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (ourMistake && !photos.length) return setError('Please add at least one photo of the item.');
    setBusy(true);
    try {
      await api(`/orders/${orderNumber}/returns`, {
        method: 'POST',
        body: {
          type,
          reason,
          comments,
          photos,
          items: lines.map(([orderItemId, c]) => ({ orderItemId, quantity: c.quantity, exchangeVariantId: c.exchangeVariantId || undefined })),
          refundDetails: needsPayout ? (payout === 'upi' ? { upiId: refund.upiId } : { accountHolder: refund.accountHolder, accountNumber: refund.accountNumber, ifsc: refund.ifsc }) : undefined,
          pickupAddress: editAddress ? address : undefined,
        },
      });
      notify(`Your ${type} request has been sent. We’ll reply within 2 business days.`);
      navigate(`/account/orders/${orderNumber}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AccountLayout
      title="Return or Exchange"
      crumbs={[{ label: 'Orders', to: '/account/orders' }, { label: orderNumber, to: `/account/orders/${orderNumber}` }, { label: 'Return / Exchange' }]}
    >
      {loadError && <div className="alert alert-danger">{loadError} <Link to={`/account/orders/${orderNumber}`}>Back to the order</Link></div>}
      {!options && !loadError && <div className="card-soft p-4 text-muted">Loading…</div>}
      {options && (
        <form onSubmit={submit} className="card-soft p-4">
          <p className="small text-muted">Order {options.orderNumber} · You can request a return or exchange until <strong>{formatDate(options.windowEndsAt)}</strong>.</p>

          <fieldset className="mb-4">
            <legend className="h6">What would you like?</legend>
            <div className="d-flex gap-3">
              {[['return', 'Return for a refund'], ['exchange', 'Exchange for another size/colour']].map(([value, label]) => (
                <div key={value} className="form-check">
                  <input className="form-check-input" type="radio" name="ret-type" id={`ret-type-${value}`} checked={type === value} onChange={() => setType(value)} />
                  <label className="form-check-label" htmlFor={`ret-type-${value}`}>{label}</label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="mb-4" ref={itemsRef}>
            <legend className="h6">Which items?</legend>
            <p className="small text-muted mb-2">Tick each item you want to {type === 'exchange' ? 'exchange' : 'return'}.</p>
            <div className="d-grid gap-2">
              {options.items.map((item) => {
                const c = chosen[item.orderItemId];
                const blocked = item.available <= 0 || (!item.isReturnable && !ourMistake);
                return (
                  <div key={item.orderItemId} className={`return-item ${c ? 'selected' : ''}`}>
                    <div className="d-flex gap-3 align-items-center">
                      <input
                        type="checkbox"
                        className="form-check-input mt-0"
                        id={`ret-item-${item.orderItemId}`}
                        checked={Boolean(c)}
                        disabled={blocked}
                        onChange={() => toggleItem(item)}
                      />
                      <div className="cart-line-image" style={{ width: 48, height: 60 }}>
                        {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <i className="bi bi-image text-muted" />}
                      </div>
                      <label htmlFor={`ret-item-${item.orderItemId}`} className="small flex-grow-1">
                        <div className="fw-semibold">{item.name}</div>
                        <div className="text-muted">{item.optionLabel} · {formatINR(item.price)} each · bought {item.quantity}</div>
                        {item.available <= 0 && <div className="text-muted">Already requested</div>}
                        {!item.isReturnable && <div className="text-danger">Non-returnable (hygiene), unless it arrived damaged or was the wrong item</div>}
                      </label>
                      {c && item.available > 1 && (
                        <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label={`Quantity of ${item.name}`} value={c.quantity} onChange={(e) => update(item.orderItemId, { quantity: Number(e.target.value) })}>
                          {Array.from({ length: item.available }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Qty {n}</option>)}
                        </select>
                      )}
                    </div>
                    {c && type === 'exchange' && (
                      <div className="mt-2">
                        <label className="form-label small mb-1" htmlFor={`ret-ex-${item.orderItemId}`}>Exchange for *</label>
                        <select id={`ret-ex-${item.orderItemId}`} className="form-select form-select-sm" required value={c.exchangeVariantId} onChange={(e) => update(item.orderItemId, { exchangeVariantId: e.target.value })}>
                          <option value="">Choose size / colour</option>
                          {item.exchangeOptions.map((o) => (
                            <option key={o.variantId} value={o.variantId} disabled={!o.allowed}>{o.optionLabel}{o.note ? ` (${o.note})` : ''}</option>
                          ))}
                        </select>
                        {item.exchangeOptions.every((o) => !o.allowed) && <div className="small text-muted mt-1">No other size or colour is available right now. You can choose a return for a refund instead.</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <label className="form-label" htmlFor="ret-reason">Reason *</label>
              <select id="ret-reason" className="form-select" required value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Choose a reason</option>
                {options.reasons.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="ret-comments">Comments{reason === 'other' ? ' *' : ''}</label>
              <input id="ret-comments" className="form-control" maxLength={1000} required={reason === 'other'} value={comments} onChange={(e) => setComments(e.target.value)} />
            </div>
          </div>

          <div className="mb-4">
            <div className="form-label">Photos of the item {ourMistake ? '*' : '(optional)'}</div>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              {photos.map((src) => (
                <div key={src} className="position-relative">
                  <img src={src} alt="Your photo" className="return-photo" />
                  <button type="button" className="btn btn-sm btn-light position-absolute top-0 end-0 p-0 px-1" aria-label="Remove photo" onClick={() => setPhotos((p) => p.filter((x) => x !== src))}>×</button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button type="button" className="btn btn-outline-navy btn-sm" disabled={uploading} onClick={() => fileInput.current.click()}>
                  <i className="bi bi-camera me-1" />{uploading ? 'Uploading…' : 'Add photos'}
                </button>
              )}
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos} />
            </div>
            <div className="form-text">Up to {MAX_PHOTOS} photos (JPG, PNG or WebP). Required if the item is damaged or wrong.</div>
          </div>

          {needsPayout && (
            <fieldset className="mb-4">
              <legend className="h6">Where should we send your refund?</legend>
              <p className="small text-muted">You paid cash on delivery, so we’ll send the refund to your UPI ID or bank account.</p>
              <div className="d-flex gap-3 mb-2">
                {[['upi', 'UPI ID'], ['bank', 'Bank account']].map(([value, label]) => (
                  <div key={value} className="form-check">
                    <input className="form-check-input" type="radio" name="ret-payout" id={`ret-payout-${value}`} checked={payout === value} onChange={() => setPayout(value)} />
                    <label className="form-check-label" htmlFor={`ret-payout-${value}`}>{label}</label>
                  </div>
                ))}
              </div>
              {payout === 'upi' ? (
                <input className="form-control" required placeholder="yourname@okbank" aria-label="UPI ID" value={refund.upiId} onChange={(e) => setRefund((r) => ({ ...r, upiId: e.target.value }))} />
              ) : (
                <div className="row g-2">
                  <div className="col-md-4"><input className="form-control" required placeholder="Account holder name" aria-label="Account holder name" value={refund.accountHolder} onChange={(e) => setRefund((r) => ({ ...r, accountHolder: e.target.value }))} /></div>
                  <div className="col-md-4"><input className="form-control" required inputMode="numeric" placeholder="Account number" aria-label="Account number" value={refund.accountNumber} onChange={(e) => setRefund((r) => ({ ...r, accountNumber: e.target.value }))} /></div>
                  <div className="col-md-4"><input className="form-control text-uppercase" required placeholder="IFSC code" aria-label="IFSC code" value={refund.ifsc} onChange={(e) => setRefund((r) => ({ ...r, ifsc: e.target.value }))} /></div>
                </div>
              )}
            </fieldset>
          )}

          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center">
              <div className="form-label mb-0">Pickup address</div>
              <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setEditAddress((v) => !v)}>{editAddress ? 'Use the delivery address' : 'Change'}</button>
            </div>
            {editAddress ? (
              <div className="mt-2"><AddressForm idPrefix="pickup" value={address} onChange={setAddress} /></div>
            ) : (
              <div className="small text-muted">
                {options.pickupAddress.fullName}, {options.pickupAddress.house}, {options.pickupAddress.street}, {options.pickupAddress.city} – {options.pickupAddress.pincode} · {options.pickupAddress.mobile}
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <div className="alert alert-light small">
              {type === 'return'
                ? <>Refund for the items: <strong>{formatINR(estimate)}</strong>{ourMistake ? ' (plus the delivery charge, as it was our mistake)' : '. Delivery and COD charges aren’t refunded'}.</>
                : estimate > 0 ? <>The new size/colour costs less: <strong>{formatINR(estimate)}</strong> comes back to you.</> : 'No extra cost for the exchange.'}
            </div>
          )}
          {error && <div className="alert alert-danger small py-2" role="alert">{error}</div>}
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-orange" disabled={busy || uploading}>{busy ? 'Sending…' : `Request ${type === 'exchange' ? 'Exchange' : 'Return'}`}</button>
            <Link to={`/account/orders/${orderNumber}`} className="btn btn-outline-navy">Back</Link>
          </div>
        </form>
      )}
    </AccountLayout>
  );
}
