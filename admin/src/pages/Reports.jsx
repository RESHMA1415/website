import { useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadFile, formatDateTime, formatINR, useApi } from '../api.js';
import { BarList, DateRange, SalesLine, SplitBar, useRange, useRangeQuery } from '../components/charts.jsx';
import { DataTable, ErrorNote, PageTitle, Panel, StatCard } from '../components/ui.jsx';

const REPORTS = [
  ['summary', 'Sales Summary'],
  ['products', 'By Product'],
  ['categories', 'By Category'],
  ['payments', 'Payment Methods'],
  ['returns', 'Returns'],
  ['customers', 'Customers'],
  ['inventory', 'Inventory'],
  ['cancellations', 'Cancellations'],
];

const n = (v) => Number(v || 0).toLocaleString('en-IN');

function Summary({ data, by, setBy }) {
  const s = data.summary;
  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-graph-up-arrow" label="Gross Sales" value={formatINR(s.grossSales)} /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-arrow-counterclockwise" label="Refunds" value={formatINR(s.refunds)} tone="red" /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-currency-rupee" label="Net Sales" value={formatINR(s.netSales)} tone="green" /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-receipt" label="Orders" value={n(s.orders)} /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-calculator" label="Average Order Value" value={formatINR(s.averageOrderValue)} /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-truck" label="Delivery Charges Collected" value={formatINR(s.deliveryCharges)} /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-cash" label="COD Charges Collected" value={formatINR(s.codCharges)} /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-cash-coin" label="COD Collected (delivered)" value={formatINR(s.codCollected)} /></div>
      </div>
      <Panel
        title="Net Sales over Time"
        actions={
          <div className="btn-group btn-group-sm" role="group" aria-label="Group by">
            {[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([k, l]) => (
              <button key={k} type="button" className={`btn ${by === k ? 'btn-navy' : 'btn-light'}`} onClick={() => setBy(k)}>{l}</button>
            ))}
          </div>
        }
      >
        <SalesLine points={data.series} />
        <details className="mt-3">
          <summary className="small">Show as a table</summary>
          <DataTable columns={['Period', 'Orders', 'Net sales']} rows={data.series} renderRow={(r) => <tr key={r.period}><td>{r.period}</td><td>{r.orders}</td><td>{formatINR(r.sales)}</td></tr>} />
        </details>
      </Panel>
    </>
  );
}

function Products({ data }) {
  return (
    <div className="row g-3">
      <div className="col-lg-5">
        <Panel title="Top Products by Revenue">
          <BarList rows={data.products.slice(0, 10).map((p) => ({ label: p.name, value: p.revenue, sub: `${p.units} sold` }))} empty="No sales in this period." />
        </Panel>
      </div>
      <div className="col-lg-7">
        <Panel title="By Size / Colour (variant)" bodyClass="">
          <DataTable
            columns={['Product', 'Option', 'SKU', 'Units', 'Revenue']}
            rows={data.variants}
            empty="No sales in this period."
            renderRow={(v) => <tr key={v.sku}><td className="small">{v.name}</td><td className="small">{v.option}</td><td className="small text-muted">{v.sku}</td><td>{v.units}</td><td>{formatINR(v.revenue)}</td></tr>}
          />
        </Panel>
      </div>
    </div>
  );
}

function Categories({ data }) {
  return (
    <div className="row g-3">
      <div className="col-lg-6"><Panel title="Revenue by Category"><BarList rows={data.categories.map((c) => ({ label: c.category, value: c.revenue, sub: `${c.units} sold` }))} empty="No sales in this period." /></Panel></div>
      <div className="col-lg-6">
        <Panel title="Table" bodyClass="">
          <DataTable columns={['Category', 'Units', 'Revenue']} rows={data.categories} empty="No sales in this period." renderRow={(c) => <tr key={c.category}><td>{c.category}</td><td>{c.units}</td><td>{formatINR(c.revenue)}</td></tr>} />
        </Panel>
      </div>
    </div>
  );
}

function Payments({ data }) {
  return (
    <div className="row g-3">
      <div className="col-lg-6">
        <Panel title="Online vs Cash on Delivery (net sales)">
          <SplitBar parts={data.split.map((p) => ({ label: p.method, value: p.sales, sub: `${p.orders} orders` }))} />
        </Panel>
      </div>
      <div className="col-lg-6">
        <Panel title="Online Payments by Type">
          <BarList rows={data.online.map((p) => ({ label: p.type, value: p.amount, sub: `${p.payments} payments` }))} empty="No online payments in this period." />
        </Panel>
      </div>
    </div>
  );
}

function Returns({ data }) {
  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-arrow-repeat" label="Return Requests" value={n(data.requests)} /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-percent" label="Return Rate" value={`${data.returnRate}%`} tone="orange" /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-arrow-counterclockwise" label="Refunded for Returns" value={formatINR(data.refunded)} tone="red" /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-x-circle" label="Rejected Requests" value={n(data.rejected)} /></div>
      </div>
      <p className="small text-muted">Return rate = {n(data.returnedUnits)} units returned ÷ {n(data.deliveredUnits)} units delivered in this period × 100.</p>
      <div className="row g-3">
        <div className="col-lg-7"><Panel title="Reasons"><BarList rows={data.byReason.map((r) => ({ label: r.reason, value: r.requests }))} format={(v) => `${v} request${v === 1 ? '' : 's'}`} empty="No return requests in this period." /></Panel></div>
        <div className="col-lg-5"><Panel title="Return or Exchange"><BarList rows={data.byType.map((r) => ({ label: r.type, value: r.requests }))} format={(v) => String(v)} empty="No requests." /></Panel></div>
      </div>
    </>
  );
}

function Customers({ data }) {
  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-person-plus" label="New Registrations" value={n(data.newCustomers)} tone="orange" /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-bag" label="Customers Who Ordered" value={n(data.buyers)} /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-1-circle" label="First-time Buyers" value={n(data.firstTimeBuyers)} /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-arrow-repeat" label="Returning Buyers" value={n(data.returningBuyers)} tone="green" /></div>
      </div>
      <Panel title="Top Customers by Spend" bodyClass="">
        <DataTable
          columns={['Customer', 'Email', 'Orders', 'Spent']}
          rows={data.top}
          empty="No orders in this period."
          renderRow={(c) => <tr key={c.customerId}><td><Link to={`/customers/${c.customerId}`}>{c.name}</Link></td><td className="small">{c.email}</td><td>{c.orders}</td><td className="fw-semibold">{formatINR(c.spent)}</td></tr>}
        />
      </Panel>
    </>
  );
}

function Inventory({ data }) {
  const rows = [...data.out.map((r) => ({ ...r, state: 'Sold out' })), ...data.low.map((r) => ({ ...r, state: 'Low' }))];
  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-boxes" label="Stock Value (at selling price)" value={formatINR(data.stockValue)} tone="green" /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-box" label="Units in Stock" value={n(data.units)} /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-exclamation-triangle" label="Running Low" value={n(data.lowCount)} tone="orange" /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-x-octagon" label="Sold Out" value={n(data.outCount)} tone="red" /></div>
      </div>
      <p className="small text-muted">Stock value = each size/colour’s stock × its selling price (hidden products not counted). This report shows today’s stock; the date range doesn’t apply.</p>
      <Panel title="Sold Out and Running Low" bodyClass="">
        <DataTable
          columns={['Product', 'Option', 'SKU', 'Stock', 'Alert level', '']}
          rows={rows}
          empty="Nothing is low. Well stocked!"
          renderRow={(r) => (
            <tr key={r.variantId}>
              <td className="small">{r.product}</td><td className="small">{r.option}</td><td className="small text-muted">{r.sku}</td>
              <td className={r.stock === 0 ? 'text-danger fw-semibold' : 'fw-semibold'}>{r.stock}</td><td>{r.level}</td>
              <td><Link to={`/inventory?q=${encodeURIComponent(r.sku)}`} className="btn btn-sm btn-light text-nowrap">Update stock</Link></td>
            </tr>
          )}
        />
      </Panel>
    </>
  );
}

function Cancellations({ data }) {
  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-x-circle" label="Cancelled Orders" value={n(data.count)} tone="red" /></div>
        <div className="col-sm-6 col-xl-3"><StatCard icon="bi-currency-rupee" label="Value of Cancelled Orders" value={formatINR(data.amount)} /></div>
      </div>
      <div className="row g-3 mb-3">
        <div className="col-lg-6"><Panel title="Reasons"><BarList rows={data.byReason.map((r) => ({ label: r.reason, value: r.orders }))} format={(v) => `${v} order${v === 1 ? '' : 's'}`} empty="No cancellations in this period." /></Panel></div>
        <div className="col-lg-6"><Panel title="Who Cancelled"><BarList rows={data.byWho.map((r) => ({ label: r.who, value: r.orders, sub: formatINR(r.amount) }))} format={(v) => `${v} order${v === 1 ? '' : 's'}`} empty="No cancellations." /></Panel></div>
      </div>
      <Panel title="Cancelled Orders" bodyClass="">
        <DataTable
          columns={['Order', 'Customer', 'Cancelled', 'By', 'Reason', 'Total']}
          rows={data.orders}
          empty="No cancellations in this period."
          renderRow={(o) => <tr key={o.orderNumber}><td><Link to={`/orders/${o.orderNumber}`} className="text-nowrap">{o.orderNumber}</Link></td><td className="small">{o.customer}</td><td className="small text-nowrap">{formatDateTime(o.date)}</td><td className="small">{o.by}</td><td className="small">{o.reason}</td><td className="small">{formatINR(o.total)} {o.paymentMethod}</td></tr>}
        />
      </Panel>
    </>
  );
}

const VIEWS = { summary: Summary, products: Products, categories: Categories, payments: Payments, returns: Returns, customers: Customers, inventory: Inventory, cancellations: Cancellations };

// Sales Reports (PRD §14.10)
export default function Reports() {
  const [report, setReport] = useState('summary');
  const [range, setRange] = useRange('30d');
  const [by, setBy] = useState('day');
  const query = useRangeQuery(range, report === 'summary' ? { by } : {});
  const { data, error, loading } = useApi(`/admin/reports/${report}?${query}`);
  const View = VIEWS[report];
  // Only draw a report with its own data (while switching tabs the previous report's data is still loaded)
  const shown = data && !loading && data.report === report ? data : null;

  return (
    <>
      <PageTitle
        title="Sales Reports"
        subtitle="Choose a date range, then download any report for Excel"
        actions={
          <button type="button" className="btn btn-navy btn-sm" onClick={() => downloadFile(`/admin/reports/${report}/export?${query}`, `shopme-${report}.csv`)}>
            <i className="bi bi-file-earmark-excel me-1" />Download for Excel
          </button>
        }
      />
      <div className="panel mb-3">
        <ul className="nav nav-tabs px-3 pt-2">
          {REPORTS.map(([key, label]) => (
            <li key={key} className="nav-item">
              <button type="button" className={`nav-link ${report === key ? 'active' : ''}`} onClick={() => setReport(key)}>{label}</button>
            </li>
          ))}
        </ul>
        <div className="p-3 border-bottom d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <DateRange value={range} onChange={setRange} presets={[['7d', 'Last 7 days'], ['month', 'This month'], ['30d', 'Last 30 days']]} />
          {data?.range && <span className="small text-muted">{data.range.from} to {data.range.to}</span>}
        </div>
      </div>
      <ErrorNote error={error} />
      {shown ? <View data={shown} by={by} setBy={setBy} /> : <div className="text-muted small p-3">Loading…</div>}
    </>
  );
}
