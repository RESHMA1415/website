import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';

// One-click unsubscribe from newsletter emails (consent can be withdrawn as easily as given)
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ busy: true, message: '' });

  useEffect(() => {
    api('/newsletter/unsubscribe', { method: 'POST', body: { id: params.get('id'), t: params.get('t') } })
      .then(() => setState({ busy: false, ok: true, message: 'You’ve been unsubscribed. You won’t get newsletter emails from us any more.' }))
      .catch((err) => setState({ busy: false, ok: false, message: err.message }));
  }, [params]);

  return (
    <>
      <PageHeader title="Newsletter" crumbs={[{ label: 'Unsubscribe' }]} />
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="card-soft p-4 text-center">
          {state.busy ? (
            <p className="text-muted mb-0">One moment…</p>
          ) : (
            <>
              <i className={`bi ${state.ok ? 'bi-check-circle text-success' : 'bi-exclamation-circle text-danger'} fs-1`} />
              <p className="mt-2">{state.message}</p>
              <p className="small text-muted mb-3">Order updates (confirmation, shipping, refunds) are not affected.</p>
              <Link to="/" className="btn btn-outline-navy">Back to the shop</Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
