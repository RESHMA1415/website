import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { STORE_URL, api, formatINR, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import CategorySelect from '../components/CategorySelect.jsx';
import { DataTable, PageTitle, Pagination, SearchBar, StatusPill, useDebounced } from '../components/ui.jsx';

const BULK_ACTIONS = [
  ['activate', 'Make Active (visible)'],
  ['hide', 'Hide from store'],
  ['draft', 'Move to Draft'],
  ['category', 'Change category…'],
  ['delete', 'Delete'],
];

export default function Products() {
  const { notify } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const search = useDebounced(q);
  const [status, setStatus] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [busy, setBusy] = useState(false);

  const query = new URLSearchParams({ page: String(page), q: search, status, stock, category, sort });
  const { data, loading, reload } = useApi(`/admin/products?${query}`);
  const { data: categories } = useApi('/admin/categories');
  const items = data?.items || [];
  const setFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
    setSelected([]);
  };

  const run = async (label, fn) => {
    setBusy(true);
    try {
      await fn();
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
    return label;
  };

  const duplicate = (p) =>
    run('duplicate', async () => {
      const copy = await api(`/admin/products/${p._id}/duplicate`, { method: 'POST' });
      notify('Copy created as a Draft with 0 stock. Update it and save.');
      navigate(`/products/${copy._id}`);
    });

  const toggleHidden = (p) =>
    run('hide', async () => {
      const action = p.status === 'hidden' ? 'activate' : 'hide';
      const result = await api('/admin/products/bulk', { method: 'POST', body: { ids: [p._id], action } });
      if (result.skipped.length) notify(`Couldn’t show ${result.skipped.join(', ')}.`, 'error');
      else notify(action === 'hide' ? 'Product hidden from the store' : 'Product is visible on the store');
    });

  const remove = (p) => {
    if (!window.confirm(`Delete “${p.name}”? This cannot be undone. (If it has orders, it will be hidden instead.)`)) return;
    run('delete', async () => {
      const result = await api(`/admin/products/${p._id}`, { method: 'DELETE' });
      notify(result.hidden ? 'This product has orders, so it was hidden instead of deleted.' : 'Product deleted');
    });
  };

  const applyBulk = () => {
    if (!bulkAction || !selected.length) return;
    if (bulkAction === 'category' && !bulkCategory) {
      notify('Please choose the new category.', 'error');
      return;
    }
    if (bulkAction === 'delete' && !window.confirm(`Delete ${selected.length} product(s)? Products with orders will be hidden instead.`)) return;
    run('bulk', async () => {
      const r = await api('/admin/products/bulk', { method: 'POST', body: { ids: selected, action: bulkAction, subCategory: bulkCategory } });
      const parts = [];
      if (r.updated) parts.push(`${r.updated} updated`);
      if (r.deleted) parts.push(`${r.deleted} deleted`);
      if (r.hidden) parts.push(`${r.hidden} hidden (they have orders)`);
      if (r.skipped.length) parts.push(`skipped: ${r.skipped.join(', ')}`);
      notify(parts.join(' · ') || 'Nothing changed', r.skipped.length ? 'error' : 'success');
      setSelected([]);
      setBulkAction('');
    });
  };

  const allChecked = items.length > 0 && items.every((p) => selected.includes(p._id));

  return (
    <>
      <PageTitle
        title="Products"
        subtitle={`${data?.total ?? 0} product${data?.total === 1 ? '' : 's'}${status || stock || category || search ? ' match your filters' : ' in your store'}`}
        actions={
          <Link to="/products/new" className="btn btn-orange">
            <i className="bi bi-plus-lg me-1" />Add Product
          </Link>
        }
      />
      <div className="panel">
        <SearchBar placeholder="Search name, brand, SKU or tag" value={q} onChange={setFilter(setQ)}>
          <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Filter by status" value={status} onChange={(e) => setFilter(setStatus)(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="hidden">Hidden</option>
          </select>
          <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Filter by stock" value={stock} onChange={(e) => setFilter(setStock)(e.target.value)}>
            <option value="">All stock</option>
            <option value="low">Some options low</option>
            <option value="any_out">Some options sold out</option>
            <option value="out">Completely out of stock</option>
          </select>
          <CategorySelect tree={categories} value={category} onChange={setFilter(setCategory)} allLabel="All categories" className="form-select form-select-sm w-auto" />
          <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Sort" value={sort} onChange={(e) => setFilter(setSort)(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="updated">Recently edited</option>
            <option value="name">Name A–Z</option>
            <option value="price_asc">Price low–high</option>
            <option value="price_desc">Price high–low</option>
            <option value="stock_asc">Lowest stock</option>
          </select>
        </SearchBar>

        {selected.length > 0 && (
          <div className="d-flex flex-wrap gap-2 align-items-center px-3 py-2 border-bottom" style={{ background: '#fff6ee' }}>
            <strong className="small">{selected.length} selected</strong>
            <select className="form-select form-select-sm w-auto" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} aria-label="Bulk action">
              <option value="">Choose action…</option>
              {BULK_ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {bulkAction === 'category' && (
              <CategorySelect tree={categories} value={bulkCategory} onChange={setBulkCategory} allLabel="New category…" className="form-select form-select-sm w-auto" />
            )}
            <button type="button" className="btn btn-sm btn-navy" disabled={!bulkAction || busy} onClick={applyBulk}>Apply</button>
            <button type="button" className="btn btn-sm btn-link" onClick={() => setSelected([])}>Clear</button>
          </div>
        )}

        <DataTable
          columns={[
            <input key="all" type="checkbox" className="form-check-input" aria-label="Select all" checked={allChecked} onChange={() => setSelected(allChecked ? [] : items.map((p) => p._id))} />,
            '', 'Product', 'Category', 'Price', 'Stock', 'Options', 'Status', '',
          ]}
          rows={items}
          empty={loading ? 'Loading…' : search || status || stock || category ? 'No products match these filters.' : 'No products yet. Click “Add Product” to create your first one.'}
          renderRow={(p) => (
            <tr key={p._id}>
              <td>
                <input
                  type="checkbox"
                  className="form-check-input"
                  aria-label={`Select ${p.name}`}
                  checked={selected.includes(p._id)}
                  onChange={() => setSelected((s) => (s.includes(p._id) ? s.filter((x) => x !== p._id) : [...s, p._id]))}
                />
              </td>
              <td>
                <div className="thumb">{p.thumbUrl ? <img src={p.thumbUrl} alt="" /> : <i className="bi bi-image" />}</div>
              </td>
              <td style={{ minWidth: 200 }}>
                <Link to={`/products/${p._id}`} className="fw-semibold text-reset">{p.name}</Link>
                <div className="small text-muted text-capitalize">
                  {p.productType}{p.brand ? ` · ${p.brand}` : ''}{!p.photoCount && <span className="text-danger"> · no photo</span>}
                </div>
              </td>
              <td className="small">{[p.category?.name, p.subCategory?.name].filter(Boolean).join(' › ')}</td>
              <td className="text-nowrap">
                <div className="fw-semibold">{formatINR(p.sellingPrice)}</div>
                {p.discountPercent > 0 && <div className="small text-muted"><s>{formatINR(p.mrp)}</s> <span className="text-orange">{p.discountPercent}% off</span></div>}
              </td>
              <td className="text-nowrap">
                {p.totalStock === 0 ? <span className="status-pill status-hidden">Out of stock</span> : <span className="fw-semibold">{p.totalStock}</span>}
                {p.totalStock > 0 && p.lowStockVariants > 0 && <div className="small text-orange">{p.lowStockVariants} low</div>}
                {p.totalStock > 0 && p.outOfStockVariants > 0 && <div className="small text-danger">{p.outOfStockVariants} sold out</div>}
              </td>
              <td>{p.variantCount}</td>
              <td><StatusPill status={p.status} /></td>
              <td className="text-end text-nowrap">
                <Link to={`/products/${p._id}`} className="btn btn-sm btn-light" title="Edit"><i className="bi bi-pencil" /></Link>{' '}
                <button type="button" className="btn btn-sm btn-light" title="Duplicate" disabled={busy} onClick={() => duplicate(p)}><i className="bi bi-copy" /></button>{' '}
                <button type="button" className="btn btn-sm btn-light" title={p.status === 'hidden' ? 'Show on store' : 'Hide from store'} disabled={busy} onClick={() => toggleHidden(p)}>
                  <i className={`bi ${p.status === 'hidden' ? 'bi-eye' : 'bi-eye-slash'}`} />
                </button>{' '}
                {p.status === 'active' && (
                  <><a href={`${STORE_URL}/product/${p.slug}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-light" title="View on store"><i className="bi bi-box-arrow-up-right" /></a>{' '}</>
                )}
                <button type="button" className="btn btn-sm btn-light text-danger" title="Delete" disabled={busy} onClick={() => remove(p)}><i className="bi bi-trash" /></button>
              </td>
            </tr>
          )}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="products" />}
      </div>
    </>
  );
}
