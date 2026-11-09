import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { INDIAN_STATES } from '../utils/format.js';

const PINCODE = /^[1-9][0-9]{5}$/;

export const EMPTY_ADDRESS = {
  fullName: '', mobile: '', alternateMobile: '', pincode: '', house: '', street: '', landmark: '', city: '', state: '', type: 'home',
};

// Delivery address fields (PRD §13.8). Validation patterns match the backend.
// Controlled when `value` and `onChange` are given (My Account); otherwise the
// fields keep their own state (Checkout preview until Phase 4).
export default function AddressForm({ idPrefix = 'addr', value, onChange }) {
  const id = (name) => `${idPrefix}-${name}`;
  const controlled = Boolean(value && onChange);
  const bind = (key) => (controlled ? { value: value[key] ?? '', onChange: (e) => onChange({ ...value, [key]: e.target.value }) } : {});
  const typeProps = (type) =>
    controlled ? { checked: (value.type || 'home') === type, onChange: () => onChange({ ...value, type }) } : { defaultChecked: type === 'home' };

  // City and state fill in from the pincode (India Post lookup through our server).
  // Only fields that are empty, or that we filled ourselves, are changed, so a
  // customer's own typing is never overwritten.
  const [pinNote, setPinNote] = useState(null);
  const filled = useRef({ city: '', state: '' });
  const latest = useRef(value);
  latest.current = value;
  const pincode = controlled ? String(value.pincode || '').trim() : '';
  useEffect(() => {
    if (!PINCODE.test(pincode)) {
      setPinNote(null);
      return undefined;
    }
    let cancelled = false;
    setPinNote({ tone: 'muted', text: 'Looking up your pincode…' });
    api(`/pincode/${pincode}`)
      .then((r) => {
        if (cancelled) return;
        if (!r.found) {
          setPinNote(r.unavailable ? null : { tone: 'warning', text: 'We couldn’t find this pincode. Please check it, or type your city and state.' });
          return;
        }
        const now = latest.current;
        const patch = {};
        if (r.city && (!now.city || now.city === filled.current.city)) patch.city = r.city;
        if (r.state && (!now.state || now.state === filled.current.state)) patch.state = r.state;
        // A saved address that already matches counts as filled by us, so a new pincode can update it
        filled.current = {
          city: patch.city ?? (now.city === r.city ? r.city : filled.current.city),
          state: patch.state ?? (now.state === r.state ? r.state : filled.current.state),
        };
        if (Object.keys(patch).length) onChange({ ...now, ...patch });
        setPinNote({ tone: 'success', text: `${[r.city, r.state].filter(Boolean).join(', ')}` });
      })
      .catch(() => !cancelled && setPinNote(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode]);

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('name')}>Full name *</label>
        <input id={id('name')} className="form-control" required maxLength={80} autoComplete="name" {...bind('fullName')} />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('mobile')}>Mobile number *</label>
        <input id={id('mobile')} className="form-control" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit mobile" autoComplete="tel-national" title="10-digit Indian mobile number" {...bind('mobile')} />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('alt')}>Alternate mobile</label>
        <input id={id('alt')} className="form-control" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} title="10-digit Indian mobile number" {...bind('alternateMobile')} />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('pincode')}>Pincode *</label>
        <input id={id('pincode')} className="form-control" required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} placeholder="6-digit pincode" autoComplete="postal-code" title="6-digit pincode" {...bind('pincode')} />
        {pinNote && (
          <div className={`form-text ${pinNote.tone === 'warning' ? 'text-danger' : pinNote.tone === 'success' ? 'text-success' : ''}`} aria-live="polite">
            {pinNote.tone === 'success' && <i className="bi bi-geo-alt-fill me-1" />}{pinNote.text}
          </div>
        )}
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor={id('house')}>House / Flat / Building *</label>
        <input id={id('house')} className="form-control" required maxLength={120} autoComplete="address-line1" {...bind('house')} />
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor={id('street')}>Street / Area *</label>
        <input id={id('street')} className="form-control" required maxLength={160} autoComplete="address-line2" {...bind('street')} />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('landmark')}>Landmark</label>
        <input id={id('landmark')} className="form-control" maxLength={120} {...bind('landmark')} />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('city')}>City *</label>
        <input id={id('city')} className="form-control" required maxLength={60} autoComplete="address-level2" {...bind('city')} />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('state')}>State *</label>
        <select id={id('state')} className="form-select" required {...(controlled ? bind('state') : { defaultValue: '' })}>
          <option value="" disabled>Select state</option>
          {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="col-md-6">
        <span className="form-label d-block">Address type</span>
        <div className="d-flex gap-3 pt-1">
          <div className="form-check">
            <input className="form-check-input" type="radio" name={id('type')} id={id('home')} {...typeProps('home')} />
            <label className="form-check-label" htmlFor={id('home')}>Home</label>
          </div>
          <div className="form-check">
            <input className="form-check-input" type="radio" name={id('type')} id={id('work')} {...typeProps('work')} />
            <label className="form-check-label" htmlFor={id('work')}>Work</label>
          </div>
        </div>
      </div>
    </div>
  );
}
