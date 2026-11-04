import { Navigate, useParams } from 'react-router-dom';
import AddressForm from '../../components/AddressForm.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import AccountLayout from './AccountLayout.jsx';

function Profile() {
  const { notify } = useStore();
  const save = (e) => {
    e.preventDefault();
    notify('Saving your profile starts working in Phase 3.');
  };
  return (
    <>
      <form className="card-soft p-4 mb-4" onSubmit={save}>
        <h2 className="h5 mb-3">Personal Details</h2>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label" htmlFor="p-name">Full name</label>
            <input id="p-name" className="form-control" required />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="p-email">Email</label>
            <input id="p-email" type="email" className="form-control" required />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="p-mobile">Mobile number</label>
            <input id="p-mobile" className="form-control" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} required />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="p-gender">Gender</label>
            <select id="p-gender" className="form-select" defaultValue="">
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="p-dob">Date of birth</label>
            <input id="p-dob" type="date" className="form-control" />
          </div>
        </div>
        <button type="submit" className="btn btn-orange mt-4">Save Changes</button>
      </form>
      <form className="card-soft p-4" onSubmit={save}>
        <h2 className="h5 mb-3">Change Password</h2>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label" htmlFor="p-current">Current password</label>
            <input id="p-current" type="password" className="form-control" required autoComplete="current-password" />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="p-new">New password</label>
            <input id="p-new" type="password" className="form-control" required minLength={8} autoComplete="new-password" />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="p-confirm">Confirm new password</label>
            <input id="p-confirm" type="password" className="form-control" required autoComplete="new-password" />
          </div>
        </div>
        <button type="submit" className="btn btn-navy mt-4">Update Password</button>
      </form>
    </>
  );
}

function Addresses() {
  const { notify } = useStore();
  return (
    <>
      <div className="card-soft mb-4">
        <EmptyState icon="bi-geo-alt" title="No saved addresses" text="Addresses you save here appear at checkout for one-tap delivery." />
      </div>
      <form
        className="card-soft p-4"
        onSubmit={(e) => {
          e.preventDefault();
          notify('Saving addresses starts working in Phase 3.');
        }}
      >
        <h2 className="h5 mb-3">Add a New Address</h2>
        <AddressForm idPrefix="account" />
        <div className="form-check mt-3">
          <input className="form-check-input" type="checkbox" id="default-address" />
          <label className="form-check-label" htmlFor="default-address">Make this my default address</label>
        </div>
        <button type="submit" className="btn btn-orange mt-3">Save Address</button>
      </form>
    </>
  );
}

function Reviews() {
  return (
    <div className="card-soft">
      <EmptyState
        icon="bi-star"
        title="No reviews yet"
        text="After your order is delivered, you can review each product with stars, a comment, photos or a video."
      />
    </div>
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
