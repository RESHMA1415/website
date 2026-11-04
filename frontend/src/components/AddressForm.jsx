import { INDIAN_STATES } from '../utils/format.js';

// Delivery address fields (PRD §13.8). Validation patterns match the backend.
export default function AddressForm({ idPrefix = 'addr' }) {
  const id = (name) => `${idPrefix}-${name}`;
  return (
    <div className="row g-3">
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('name')}>Full name *</label>
        <input id={id('name')} className="form-control" required autoComplete="name" />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('mobile')}>Mobile number *</label>
        <input id={id('mobile')} className="form-control" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit mobile" autoComplete="tel-national" />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('alt')}>Alternate mobile</label>
        <input id={id('alt')} className="form-control" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('pincode')}>Pincode *</label>
        <input id={id('pincode')} className="form-control" required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} placeholder="6-digit pincode" autoComplete="postal-code" />
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor={id('house')}>House / Flat / Building *</label>
        <input id={id('house')} className="form-control" required autoComplete="address-line1" />
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor={id('street')}>Street / Area *</label>
        <input id={id('street')} className="form-control" required autoComplete="address-line2" />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('landmark')}>Landmark</label>
        <input id={id('landmark')} className="form-control" />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('city')}>City *</label>
        <input id={id('city')} className="form-control" required autoComplete="address-level2" />
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={id('state')}>State *</label>
        <select id={id('state')} className="form-select" required defaultValue="">
          <option value="" disabled>Select state</option>
          {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="col-md-6">
        <span className="form-label d-block">Address type</span>
        <div className="d-flex gap-3 pt-1">
          <div className="form-check">
            <input className="form-check-input" type="radio" name={id('type')} id={id('home')} defaultChecked />
            <label className="form-check-label" htmlFor={id('home')}>Home</label>
          </div>
          <div className="form-check">
            <input className="form-check-input" type="radio" name={id('type')} id={id('work')} />
            <label className="form-check-label" htmlFor={id('work')}>Work</label>
          </div>
        </div>
      </div>
    </div>
  );
}
