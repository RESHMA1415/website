import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatINR, useApi } from '../api.js';
import { DataTable, PageTitle, Panel, PhaseNotice, StatCard } from '../components/ui.jsx';

const RANGES = ['Today', 'Last 7 days', 'This Month', 'Custom'];

export default function Dashboard() {
  const [range, setRange] = useState('Today');
  const { data: counts } = useApi('/admin/inventory/counts');
  const { data: out } = useApi('/admin/inventory?stock=out&limit=8');
  const { data: low } = useApi('/admin/inventory?stock=low&limit=8');
  const alerts = [...(out?.items || []), ...(low?.items || [])].slice(0, 8);
  const { data: waiting } = useApi('/admin/reviews?tab=pending&limit=5');
  const { data: inbox } = useApi('/admin/messages?tab=new&limit=5');

  return (
    <>
      <PageTitle
        title="Dashboard"
        subtitle="Your store at a glance"
        actions={
          <div className="btn-group btn-group-sm">
            {RANGES.map((r) => (
              <button key={r} type="button" className={`btn ${range === r ? 'btn-navy' : 'btn-outline-secondary'}`} onClick={() => setRange(r)}>
                {r}
              </button>
            ))}
          </div>
        }
      />
      <PhaseNotice phase={8}>
        Sales, orders and customer numbers fill in automatically once orders start (Phases 4–8). Stock alerts below already use your real stock and each product’s low-stock level.
      </PhaseNotice>

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3"><StatCard icon="bi-currency-rupee" label="Total Sales" value={formatINR(0)} tone="green" /></div>
        <div className="col-6 col-xl-3"><StatCard icon="bi-receipt" label="Orders" value="0" /></div>
        <div className="col-6 col-xl-3"><StatCard icon="bi-calculator" label="Average Order Value" value={formatINR(0)} /></div>
        <div className="col-6 col-xl-3"><StatCard icon="bi-person-plus" label="New Customers" value="0" tone="orange" /></div>
        <div className="col-6 col-xl-3"><StatCard icon="bi-box-seam" label="Waiting to be Packed" value="0" tone="orange" /></div>
        <div className="col-6 col-xl-3"><StatCard icon="bi-truck" label="Shipped, Not Delivered" value="0" /></div>
        <div className="col-6 col-xl-3"><StatCard icon="bi-arrow-repeat" label="Pending Returns" value="0" tone="red" /></div>
        <div className="col-6 col-xl-3"><Link to="/reviews" className="text-reset d-block h-100"><StatCard icon="bi-star" label="Reviews to Approve" value={String(waiting?.counts?.pending ?? 0)} tone="orange" /></Link></div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <Panel title="Sales Over Time">
            <div className="chart-placeholder">Daily sales chart appears here once you have orders</div>
          </Panel>
        </div>
        <div className="col-lg-4">
          <Panel title="Online vs Cash on Delivery">
            <div className="chart-placeholder">Payment split chart</div>
          </Panel>
        </div>
        <div className="col-lg-6">
          <Panel title="Orders by Status">
            <div className="chart-placeholder">Confirmed · Packed · Shipped · Delivered · Cancelled</div>
          </Panel>
        </div>
        <div className="col-lg-6">
          <Panel title="Sales by Category">
            <div className="chart-placeholder">Men · Women Clothing · Fashion · Beauty · Accessories</div>
          </Panel>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <Panel
            title={`Stock Alerts (${counts?.low ?? 0} low, ${counts?.out ?? 0} out)`}
            actions={<Link to="/inventory" className="small">Manage inventory</Link>}
            bodyClass=""
          >
            <DataTable
              columns={['Product', 'Option', 'Stock', '']}
              rows={alerts}
              empty="All products are well stocked."
              renderRow={(v) => (
                <tr key={v.variantId}>
                  <td className="small">{v.productName}</td>
                  <td className="small text-muted">{v.optionLabel}</td>
                  <td>
                    <span className={`status-pill ${v.stock === 0 ? 'status-hidden' : 'status-low'}`}>
                      {v.stock === 0 ? 'Out of stock' : `${v.stock} left`}
                    </span>
                  </td>
                  <td className="text-end"><Link to="/inventory" className="btn btn-sm btn-light">Update stock</Link></td>
                </tr>
              )}
            />
          </Panel>
        </div>
        <div className="col-lg-6">
          <Panel title="Latest Orders" actions={<Link to="/orders" className="small">View all</Link>} bodyClass="">
            <DataTable columns={['Order', 'Customer', 'Total', 'Status']} empty="No orders yet." />
          </Panel>
        </div>
        <div className="col-lg-4">
          <Panel title="Top Selling Products" bodyClass="">
            <DataTable columns={['Product', 'Units', 'Revenue']} empty="Appears after your first sales." />
          </Panel>
        </div>
        <div className="col-lg-4">
          <Panel title="Reviews Waiting for Approval" actions={<Link to="/reviews" className="small">Open</Link>} bodyClass="">
            <DataTable
              columns={['Product', 'Rating']}
              rows={waiting?.items || []}
              empty="No reviews waiting."
              renderRow={(r) => (
                <tr key={r.id}>
                  <td className="small"><Link to="/reviews">{r.product?.name || 'Product'}</Link><div className="text-muted">{r.author}</div></td>
                  <td className="small text-warning text-nowrap">{'★'.repeat(r.rating)}</td>
                </tr>
              )}
            />
          </Panel>
        </div>
        <div className="col-lg-4">
          <Panel title="Latest Contact Messages" actions={<Link to="/messages" className="small">Open</Link>} bodyClass="">
            <DataTable
              columns={['From', 'Subject']}
              rows={inbox?.items || []}
              empty="No new messages."
              renderRow={(m) => (
                <tr key={m._id}>
                  <td className="small"><Link to="/messages">{m.name}</Link><div className="text-muted">{new Date(m.createdAt).toLocaleDateString('en-IN')}</div></td>
                  <td className="small">{m.subjectLabel}</td>
                </tr>
              )}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
