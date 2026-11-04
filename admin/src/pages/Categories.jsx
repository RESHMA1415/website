import { useState } from 'react';
import { STORE_URL, api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import CategorySelect from '../components/CategorySelect.jsx';
import { ImageField } from '../components/MediaPicker.jsx';
import { ErrorNote, Modal, PageTitle, StatusPill } from '../components/ui.jsx';

const TYPES = { '': 'Same as parent', clothing: 'Clothing', fashion: 'Fashion', beauty: 'Beauty', accessories: 'Accessories' };

function storeLink(c) {
  return c.depth === 0 && ['men', 'women'].includes(c.slug) ? `/${c.slug}` : `/category/${c.slug}`;
}

function CategoryEditor({ category, tree, onClose, onSaved }) {
  const { notify } = useAuth();
  const isNew = !category._id;
  const [form, setForm] = useState({
    name: category.name || '',
    slug: category.slug || '',
    parent: category.parent || '',
    productType: category.productType || '',
    gender: category.gender || 'women',
    imageUrl: category.imageUrl || '',
    bannerUrl: category.bannerUrl || '',
    description: category.description || '',
    displayOrder: category.displayOrder ?? 0,
    showInMenu: category.showInMenu ?? true,
    status: category.status || 'active',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // New categories get their address from the name; existing ones keep theirs unless the owner asks
  const slugLocked = !isNew && !category.parent && ['men', 'women'].includes(category.slug);
  const [editSlug, setEditSlug] = useState(false);
  const set =(key, value) => setForm((f) => ({ ...f, [key]: value }));

  // Can't move a category inside itself, and the tree is at most 3 levels deep
  const blocked = new Set();
  const collect = (node) => {
    blocked.add(node._id);
    node.children?.forEach(collect);
  };
  if (!isNew) collect(category);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(isNew ? '/admin/categories' : `/admin/categories/${category._id}`, { method: isNew ? 'POST' : 'PUT', body: form });
      notify(isNew ? 'Category added' : 'Category saved');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isNew ? 'Add Category' : `Edit “${category.name}”`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button type="submit" form="category-form" className="btn btn-orange" disabled={saving}>{saving ? 'Saving…' : 'Save Category'}</button>
        </>
      }
    >
      <ErrorNote error={error} />
      <form id="category-form" onSubmit={save} className="row g-3">
        <div className="col-md-6">
          <label className="form-label" htmlFor="c-name">Name *</label>
          <input id="c-name" className="form-control" required maxLength={60} value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="c-parent">Inside</label>
          <CategorySelect
            id="c-parent"
            tree={tree}
            value={form.parent}
            onChange={(v) => set('parent', v)}
            allLabel="— Top level (main menu) —"
            exclude={(c) => blocked.has(c._id) || c.depth >= 2}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="c-type">Product type</label>
          <select id="c-type" className="form-select" value={form.productType} onChange={(e) => set('productType', e.target.value)}>
            {Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div className="form-text">New products in this category start with this type.</div>
        </div>
        {!form.parent ? (
          <div className="col-md-6">
            <label className="form-label" htmlFor="c-gender">For</label>
            <select id="c-gender" className="form-select" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="men">Men</option>
              <option value="women">Women</option>
              <option value="unisex">Everyone</option>
            </select>
          </div>
        ) : <div className="col-md-6" />}
        <div className="col-md-6">
          <label className="form-label" htmlFor="c-slug">Web address</label>
          {editSlug ? (
            <>
              <input id="c-slug" className="form-control" value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="Leave blank to create it from the name" />
              <div className="form-text text-orange">
                This is the page’s link, not a description. Changing it breaks links customers have saved or shared, and homepage tiles that point to it.
              </div>
            </>
          ) : isNew ? (
            <div className="form-control-plaintext small text-muted">Created automatically from the name</div>
          ) : (
            <div className="form-control-plaintext small">
              <span className="text-muted">{storeLink(category)}</span>
              {slugLocked ? (
                <div className="form-text">Fixed. The store’s main menu uses this address.</div>
              ) : (
                <button type="button" className="btn btn-link btn-sm p-0 ms-2 align-baseline" onClick={() => setEditSlug(true)}>Change</button>
              )}
            </div>
          )}
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="c-order">Display order</label>
          <input id="c-order" type="number" min="0" max="999" className="form-control" value={form.displayOrder} onChange={(e) => set('displayOrder', e.target.value)} />
          <div className="form-text">Lower numbers appear first in menus.</div>
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="c-desc">Description</label>
          <textarea id="c-desc" className="form-control" rows={2} maxLength={500} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Shown at the top of the category page" />
        </div>
        <div className="col-md-6">
          <ImageField label="Tile image" value={form.imageUrl} onChange={(v) => set('imageUrl', v)} ratio="3 / 4" hint="Used on category tiles" />
        </div>
        <div className="col-md-6">
          <ImageField label="Banner image" value={form.bannerUrl} onChange={(v) => set('bannerUrl', v)} hint="Wide image at the top of the category page" />
        </div>
        <div className="col-md-6">
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="c-menu" checked={form.showInMenu} onChange={(e) => set('showInMenu', e.target.checked)} />
            <label className="form-check-label" htmlFor="c-menu">Show in the store menu</label>
          </div>
        </div>
        <div className="col-md-6">
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="c-status" checked={form.status === 'active'} onChange={(e) => set('status', e.target.checked ? 'active' : 'hidden')} />
            <label className="form-check-label" htmlFor="c-status">Active (category page is open to customers)</label>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function CategoryRows({ nodes, onEdit, onAddChild, onDelete }) {
  return nodes.map((c) => (
    <FragmentRow key={c._id} c={c} onEdit={onEdit} onAddChild={onAddChild} onDelete={onDelete} />
  ));
}

function FragmentRow({ c, onEdit, onAddChild, onDelete }) {
  return (
    <>
      <tr>
        <td style={{ paddingLeft: `${1 + c.depth * 1.6}rem` }}>
          {c.depth > 0 && <i className="bi bi-arrow-return-right text-muted me-2" />}
          <button type="button" className={`btn btn-link p-0 text-reset text-decoration-none ${c.depth === 0 ? 'fw-semibold' : ''}`} onClick={() => onEdit(c)}>
            {c.name}
          </button>
        </td>
        <td className="small"><a href={`${STORE_URL}${storeLink(c)}`} target="_blank" rel="noreferrer" className="text-muted">{c.slug}</a></td>
        <td className="small text-capitalize">{c.productType || '–'}</td>
        <td>{c.productCount}</td>
        <td>{c.showInMenu ? <i className="bi bi-check-circle text-success" title="In menu" /> : <i className="bi bi-dash text-muted" title="Not in menu" />}</td>
        <td><StatusPill status={c.status} /></td>
        <td className="text-end text-nowrap">
          {c.depth < 2 && (
            <button type="button" className="btn btn-sm btn-light" title="Add a sub-category inside" onClick={() => onAddChild(c)}><i className="bi bi-plus-lg" /></button>
          )}{' '}
          <button type="button" className="btn btn-sm btn-light" title="Edit" onClick={() => onEdit(c)}><i className="bi bi-pencil" /></button>{' '}
          <button type="button" className="btn btn-sm btn-light text-danger" title="Delete" onClick={() => onDelete(c)}><i className="bi bi-trash" /></button>
        </td>
      </tr>
      <CategoryRows nodes={c.children} onEdit={onEdit} onAddChild={onAddChild} onDelete={onDelete} />
    </>
  );
}

export default function Categories() {
  const { notify } = useAuth();
  const { data, loading, reload } = useApi('/admin/categories');
  const [editing, setEditing] = useState(null);

  const remove = async (c) => {
    if (!window.confirm(`Delete the category “${c.name}”?`)) return;
    try {
      await api(`/admin/categories/${c._id}`, { method: 'DELETE' });
      notify('Category deleted');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <>
      <PageTitle
        title="Categories"
        subtitle="Organise how products appear in the store menu (up to 3 levels, e.g. Women › Clothing › Dresses)"
        actions={<button type="button" className="btn btn-orange" onClick={() => setEditing({})}><i className="bi bi-plus-lg me-1" />Add Category</button>}
      />
      <div className="panel">
        <div className="table-responsive">
          <table className="table table-hover">
            <thead><tr><th>Name</th><th>Web address</th><th>Product type</th><th>Products</th><th>In menu</th><th>Status</th><th /></tr></thead>
            <tbody>
              {loading && !data && <tr><td colSpan={7} className="text-center text-muted py-4">Loading…</td></tr>}
              <CategoryRows nodes={data || []} onEdit={setEditing} onAddChild={(parent) => setEditing({ parent: parent._id, productType: '' })} onDelete={remove} />
            </tbody>
          </table>
        </div>
        <div className="small text-muted p-3 border-top">
          A category with products or sub-categories can’t be deleted. Move its products first, or switch it off (hidden) instead.
          Hidden categories disappear from the menu and their page closes; their products still show in search and “Shop All” unless you hide the products too.
        </div>
      </div>
      {editing && <CategoryEditor category={editing} tree={data} onClose={() => setEditing(null)} onSaved={reload} />}
    </>
  );
}
