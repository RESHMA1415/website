import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatDateTime, formatINR, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DataTable, ErrorNote, Modal, PageTitle, Panel, StatCard } from '../components/ui.jsx';
import { ORDER_STATUS, Pill, RETURN_STATUS } from '../orderLabels.jsx';

const REVIEW_STATUS = { pending: ['Pending', 'orange'], approved: ['Published', 'green'], rejected: ['Rejected', 'red'], hidden: ['Hidden', 'muted'] };

// One customer: profile, addresses, orders, reviews, returns, block/unblock (PRD §14.6)
export default function CustomerDetail() {
  const { id } = useParams();
  const { notify } = useAuth();
  const { data, error, reload } = useApi(`/admin/customers/${id}`);
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [c, setC] = useState(null);
  const d = c || data;

  const setBlocked = async (blocked) => {
    setBusy(true);
    try {
      setC(await api(`/admin/customers/${id}/block`, { method: 'POST', body: { blocked, reason } }));
      notify(blocked ? 'Customer blocked: they can’t log in or order' : 'Customer unblocked');
      setBlocking(false);
      setReason('');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (error && !d) return <><PageTitle title="Customer" /><ErrorNote error={error} /><Link to="/customers">Back to customers</Link></>;
  if (!d) return <div className="text-muted">Loading…</div>;
  const p = d.profile;

  return (
    <>
      <PageTitle
        title={<>{p.name} {p.isBlocked ? <span className="status-pill tone-red">Blocked</span> : <span className="status-pill tone-green">Active</span>}</>}
        subtitle={`Customer since ${new Date(p.createdAt).toLocaleDateString('en-IN')}`}
        actions={
          <>
            <Link to="/customers" className="btn btn-light"><i className="bi bi-arrow-left me-1" />Customers</Link>
            {p.isBlocked
              ? <button type="button" className="btn btn-outline-navy" disabled={busy} onClick={() => setBlocked(false)}>Unblock</button>
              : <button type="button" className="btn btn-outline-danger" onClick={() => setBlocking(true)}>Block customer</button>}
          </>
        }
      />
      {p.isBlocked && <div className="alert alert-danger small">Blocked {formatDateTime(p.blockedAt)}{p.blockedReason ? `: ${p.blockedReason}` : ''}. They can’t log in or place orders.</div>}

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3"><StatCard icon="bi-receipt" label="Orders" value={String(d.stats.orders)} /></div>
        <div className="col-6 col-xl-3"><StatCard icon="bi-currency-rupee" label="Total Spent" value={formatINR(d.stats.spent)} tone="green" /></div>
        <div className="col-6 col-xl-3"><StatCard icon="bi-clock-history" label="Last Order" value={d.stats.lastOrderAt ? new Date(d.stats.lastOrderAt).toLocaleDateString('en-IN') : '–'} /></div>
        <div className="col-6 col-xl-3"><StatCard icon="bi-arrow-repeat" label="Returns" value={String(d.returns.length)} tone="orange" /></div>
      </div>

      <div className="row g-3">
        <div className="col-lg-4">
          <Panel title="Profile">
            <dl className="small mb-0">
              <dt>Email</dt><dd><a href={`mailto:${p.email}`}>{p.email}</a></dd>
              <dt>Mobile</dt><dd>{p.mobile}{p.mobileVerifiedAt ? <span className="text-success ms-1" title="Verified by SMS code"><i className="bi bi-patch-check-fill" /></span> : null}</dd>
              {p.gender && <><dt>Gender</dt><dd className="text-capitalize">{p.gender}</dd></>}
              {p.dateOfBirth && <><dt>Date of birth</dt><dd>{new Date(p.dateOfBirth).toLocaleDateString('en-IN')}</dd></>}
              <dt>Last login</dt><dd>{p.lastLoginAt ? formatDateTime(p.lastLoginAt) : '–'}</dd>
              <dt>Agreed to policies</dt><dd className="mb-0">{p.consent?.termsAndPrivacyAcceptedAt ? `${formatDateTime(p.consent.termsAndPrivacyAcceptedAt)} (version ${p.consent.policyVersion})` : '–'}</dd>
            </dl>
          </Panel>
          <div className="mt-3">
            <Panel title={`Saved addresses (${d.addresses.length})`}>
              {d.addresses.length ? d.addresses.map((a) => (
                <div key={a._id} className="small mb-2">
                  <strong>{a.fullName}</strong>{a.isDefault && <span className="status-pill tone-navy ms-1">Default</span>}
                  <div className="text-muted">{a.house}, {a.street}, {a.city}, {a.state} – {a.pincode} · {a.mobile}</div>
                </div>
              )) : <div className="small text-muted">No saved addresses.</div>}
            </Panel>
          </div>
        </div>
        <div className="col-lg-8">
          <Panel title="Orders" bodyClass="">
            <DataTable
              columns={['Order', 'Date', 'Items', 'Total', 'Status']}
              rows={d.orders}
              empty="No orders yet."
              renderRow={(o) => (
                <tr key={o.orderNumber}>
                  <td><Link to={`/orders/${o.orderNumber}`} className="fw-semibold text-nowrap">{o.orderNumber}</Link></td>
                  <td className="small text-nowrap">{formatDateTime(o.createdAt)}</td>
                  <td className="small">{o.items.join(', ')}</td>
                  <td className="small text-nowrap">{formatINR(o.total)}{o.refundedAmount > 0 && <div className="text-danger">−{formatINR(o.refundedAmount)}</div>}<div className="text-muted">{o.paymentMethod === 'cod' ? 'COD' : 'Online'}</div></td>
                  <td><Pill map={ORDER_STATUS} value={o.status} /></td>
                </tr>
              )}
            />
          </Panel>
          <div className="row g-3 mt-0">
            <div className="col-md-6">
              <Panel title="Reviews" bodyClass="">
                <DataTable columns={['Product', 'Stars', 'Status']} rows={d.reviews} empty="No reviews." renderRow={(r) => <tr key={r.id}><td className="small">{r.product}</td><td className="small text-warning">{'★'.repeat(r.rating)}</td><td><Pill map={REVIEW_STATUS} value={r.status} /></td></tr>} />
              </Panel>
            </div>
            <div className="col-md-6">
              <Panel title="Returns & exchanges" bodyClass="">
                <DataTable columns={['Order', 'Type', 'Status']} rows={d.returns} empty="No returns." renderRow={(r) => <tr key={r.id}><td className="small"><Link to={`/returns?open=${r.id}`}>{r.orderNumber}</Link></td><td className="small text-capitalize">{r.type}</td><td><Pill map={RETURN_STATUS} value={r.status} /></td></tr>} />
              </Panel>
            </div>
          </div>
        </div>
      </div>

      {blocking && (
        <Modal
          title={`Block ${p.name}?`}
          onClose={() => setBlocking(false)}
          footer={<><button type="button" className="btn btn-light" onClick={() => setBlocking(false)}>Cancel</button><button type="button" className="btn btn-danger" disabled={busy || !reason.trim()} onClick={() => setBlocked(true)}>Block customer</button></>}
        >
          <p className="small">They will be logged out and won’t be able to log in or place orders. Their past orders stay as they are. You can unblock them any time.</p>
          <label className="form-label" htmlFor="block-reason">Reason (only you see this) *</label>
          <input id="block-reason" className="form-control" maxLength={300} placeholder="e.g. Repeated fake COD orders" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Modal>
      )}
      {error && <button type="button" className="btn btn-link" onClick={reload}>Reload</button>}
    </>
  );
}
