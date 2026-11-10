import { Link } from 'react-router-dom';
import { formatDateTime, formatINR, useApi } from '../api.js';
import { BarList, DateRange, SalesLine, SplitBar, useRange, useRangeQuery } from '../components/charts.jsx';
import { DataTable, ErrorNote, PageTitle, Panel, StatCard } from '../components/ui.jsx';
import { ORDER_STATUS, Pill } from '../orderLabels.jsx';

// Order statuses in the order a parcel moves (for the status chart)
const STATUS_ORDER = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'return_requested', 'return_approved', 'returned', 'refunded', 'exchanged', 'delivery_failed', 'cancelled'];

function Tile({ to, ...props }) {
  return to ? <Link to={to} className="stat-link"><StatCard {...props} /></Link> : <StatCard {...props} />;
}

// Dashboard (PRD §14.1)
export default function Dashboard() {
  const [range, setRange] = useRange('today');
  const query = useRangeQuery(range);
  const { data: d, error, loading } = useApi(`/admin/dashboard?${query}`);
  const { data: low } = useApi('/admin/inventory?stock=low&limit=6');
  const { data: out } = useApi('/admin/inventory?stock=out&limit=6');
  const { data: waiting } = useApi('/admin/reviews?tab=pending&limit=5');
  const { data: inbox } = useApi('/admin/messages?tab=new&limit=5');
  const alerts = [...(out?.items || []), ...(low?.items || [])].slice(0, 8);
  const s = d?.summary;

  return (
    <>
      <PageTitle title="Dashboard" subtitle="Your store at a glance" actions={<DateRange value={range} onChange={setRange} />} />
      <ErrorNote error={error} />
      <div className="row g-3 mb-4" aria-busy={loading}>
        <div className="col-6 col-xl-3"><Tile to="/reports" icon="bi-currency-rupee" label="Total Sales" value={formatINR(s?.netSales)} tone="green" /></div>
        <div className="col-6 col-xl-3"><Tile to="/orders?tab=all" icon="bi-receipt" label="Orders" value={String(s?.orders ?? '–')} /></div>
        <div className="col-6 col-xl-3"><Tile icon="bi-calculator" label="Average Order Value" value={formatINR(s?.averageOrderValue)} /></div>
        <div className="col-6 col-xl-3"><Tile to="/customers" icon="bi-person-plus" label="New Customers" value={String(d?.newCustomers ?? '–')} tone="orange" /></div>
        <div className="col-6 col-xl-3"><Tile to="/orders" icon="bi-box-seam" label="Waiting to be Packed" value={String(d?.toPack ?? '–')} tone="orange" /></div>
        <div className="col-6 col-xl-3"><Tile to="/orders" icon="bi-truck" label="Shipped, Not Delivered" value={String(d?.inTransit ?? '–')} /></div>
        <div className="col-6 col-xl-3"><Tile to="/returns" icon="bi-arrow-repeat" label="Pending Returns" value={String(d?.pendingReturns ?? '–')} tone="red" /></div>
        <div className="col-6 col-xl-3"><Tile to="/reviews" icon="bi-star" label="Reviews to Approve" value={String(d?.pendingReviews ?? '–')} tone="orange" /></div>
        <div className="col-6 col-xl-3"><Tile to="/inventory" icon="bi-exclamation-triangle" label="Low Stock / Sold Out" value={d ? `${d.lowStock} / ${d.outOfStock}` : '–'} tone="red" /></div>
        <div className="col-6 col-xl-3"><Tile to="/payments" icon="bi-cash-coin" label="COD Collected (delivered)" value={formatINR(s?.codCollected)} /></div>
        <div className="col-6 col-xl-3"><Tile to="/messages" icon="bi-envelope" label="New Contact Messages" value={String(d?.newMessages ?? '–')} /></div>
        <div className="col-6 col-xl-3"><Tile icon="bi-arrow-counterclockwise" label="Refunds in this period" value={formatINR(s?.refunds)} /></div>
      </div>
      <p className="small text-muted mt-n2 mb-4">
        Sales = orders confirmed in this period, without cancelled orders, minus refunds. “Waiting to be packed” and the other to-do numbers count all open orders.
      </p>

      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <Panel title="Net Sales by Day">
            <SalesLine points={d?.salesByDay || []} />
          </Panel>
        </div>
        <div className="col-lg-4">
          <div className="d-flex flex-column gap-3 h-100">
            <Panel title="Online vs Cash on Delivery">
              <SplitBar parts={(d?.paymentSplit || []).map((p) => ({ label: p.method, value: p.sales, sub: `${p.orders} order${p.orders === 1 ? '' : 's'}` }))} />
            </Panel>
            <Panel title="Sales by Category">
              <BarList rows={(d?.salesByCategory || []).map((c) => ({ label: c.category, value: c.revenue }))} empty="No sales in this period yet." />
            </Panel>
          </div>
        </div>
        <div className="col-lg-4">
          <Panel title="Orders by Status (all time)">
            <BarList
              rows={STATUS_ORDER.filter((st) => d?.ordersByStatus?.[st]).map((st) => ({ label: ORDER_STATUS[st]?.[0] || st, value: d.ordersByStatus[st] }))}
              format={(n) => String(n)}
              empty="No orders yet."
            />
          </Panel>
        </div>
        <div className="col-lg-4">
          <Panel title="Best Sellers (units)">
            <BarList rows={(d?.topByUnits || []).map((p) => ({ label: p.name, value: p.units, sub: formatINR(p.revenue) }))} format={(n) => `${n} sold`} empty="No sales in this period yet." />
          </Panel>
        </div>
        <div className="col-lg-4">
          <Panel title="Best Sellers (revenue)">
            <BarList rows={(d?.topByRevenue || []).map((p) => ({ label: p.name, value: p.revenue, sub: `${p.units} sold` }))} empty="No sales in this period yet." />
          </Panel>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <Panel title="Latest Orders" actions={<Link to="/orders?tab=all" className="small">All orders</Link>} bodyClass="">
            <DataTable
              columns={['Order', 'Date', 'Customer', 'Items', 'Total', 'Status']}
              rows={d?.latestOrders || []}
              empty="No orders yet."
              renderRow={(o) => (
                <tr key={o.orderNumber}>
                  <td><Link to={`/orders/${o.orderNumber}`} className="fw-semibold text-nowrap">{o.orderNumber}</Link></td>
                  <td className="small text-nowrap">{formatDateTime(o.createdAt)}</td>
                  <td className="small">{o.customer}</td>
                  <td>{o.items}</td>
                  <td className="small">{formatINR(o.total)} <span className="text-muted">{o.paymentMethod === 'cod' ? 'COD' : 'Online'}</span></td>
                  <td><Pill map={ORDER_STATUS} value={o.status} /></td>
                </tr>
              )}
            />
          </Panel>
        </div>
        <div className="col-lg-4">
          <Panel title="Low-Stock Alerts" actions={<Link to="/inventory" className="small">Inventory</Link>} bodyClass="">
            <DataTable
              columns={['Product', 'Left', '']}
              rows={alerts}
              empty="All good: nothing is low."
              renderRow={(r) => (
                <tr key={r.variantId}>
                  <td className="small">{r.productName}<div className="text-muted">{r.optionLabel}</div></td>
                  <td className={`fw-semibold ${r.stock === 0 ? 'text-danger' : ''}`}>{r.stock}</td>
                  <td><Link to={`/inventory?q=${encodeURIComponent(r.sku)}`} className="btn btn-sm btn-light text-nowrap">Update stock</Link></td>
                </tr>
              )}
            />
          </Panel>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
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
        <div className="col-lg-6">
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
