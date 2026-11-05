import { Link } from 'react-router-dom';

// Mandatory consent (DPDP Act): a clear, unticked box the person must tick
// themselves, linking to the policies. Links open in a new tab so nothing
// typed in the form is lost.
const policyLink = (to, label) => (
  <Link to={to} target="_blank" rel="noopener">{label}</Link>
);

export default function ConsentCheckbox({ id, checked, onChange, purpose = 'account', className = 'mb-3' }) {
  const controlled = typeof onChange === 'function';
  return (
    <div className={`form-check consent-check ${className}`}>
      <input
        className="form-check-input"
        type="checkbox"
        id={id}
        required
        {...(controlled ? { checked: Boolean(checked), onChange: (e) => onChange(e.target.checked) } : {})}
      />
      <label className="form-check-label small" htmlFor={id}>
        {purpose === 'order' && (
          <>I agree to the {policyLink('/policies/terms', 'Terms & Conditions')}, {policyLink('/policies/refunds', 'Refund & Cancellation Policy')} and {policyLink('/policies/privacy', 'Privacy Policy')}. *</>
        )}
        {purpose === 'account' && (
          <>I agree to the {policyLink('/policies/terms', 'Terms & Conditions')} and {policyLink('/policies/privacy', 'Privacy Policy')}, and consent to SHOPME using my details as described there. *</>
        )}
        {purpose === 'message' && (
          <>I agree that SHOPME may use these details to reply to me, as described in the {policyLink('/policies/privacy', 'Privacy Policy')}. *</>
        )}
        {purpose === 'updates' && (
          <>I agree to receive offers and updates, and to the {policyLink('/policies/privacy', 'Privacy Policy')}. I can unsubscribe any time. *</>
        )}
      </label>
    </div>
  );
}
