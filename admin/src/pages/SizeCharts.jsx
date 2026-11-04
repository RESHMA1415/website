import { useState } from 'react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ImageField } from '../components/MediaPicker.jsx';
import { DataTable, ErrorNote, Modal, PageTitle, Pagination } from '../components/ui.jsx';

const TYPES = { men_clothing: 'Men’s clothing', women_clothing: 'Women’s clothing', footwear: 'Footwear', other: 'Other' };
const STARTERS = {
  men_clothing: { columns: ['Size', 'Chest (in)', 'Length (in)', 'Shoulder (in)'], rows: [['S', '38', '27', '17'], ['M', '40', '28', '18'], ['L', '42', '29', '19'], ['XL', '44', '30', '20']] },
  women_clothing: { columns: ['Size', 'Bust (in)', 'Waist (in)', 'Hip (in)'], rows: [['XS', '32', '26', '35'], ['S', '34', '28', '37'], ['M', '36', '30', '39'], ['L', '38', '32', '41']] },
  footwear: { columns: ['UK', 'EU', 'Foot length (cm)'], rows: [['4', '37', '23.5'], ['5', '38', '24.1'], ['6', '39', '24.8'], ['7', '40', '25.4']] },
  other: { columns: ['Size', 'Measurement'], rows: [['One Size', '']] },
};

function ChartEditor({ chart, onClose, onSaved }) {
  const { notify } = useAuth();
  const isNew = !chart._id;
  const start = isNew ? STARTERS.women_clothing : chart;
  const [name, setName] = useState(chart.name || '');
  const [type, setType] = useState(chart.type || 'women_clothing');
  const [imageUrl, setImageUrl] = useState(chart.imageUrl || '');
  const [columns, setColumns] = useState(start.columns?.length ? start.columns : ['Size']);
  const [rows, setRows] = useState(start.rows?.length ? start.rows : [['']]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const setCell = (r, c, value) => setRows((list) => list.map((row, i) => (i === r ? columns.map((_, j) => (j === c ? value : row[j] || '')) : row)));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(isNew ? '/admin/size-charts' : `/admin/size-charts/${chart._id}`, { method: isNew ? 'POST' : 'PUT', body: { name, type, imageUrl, columns, rows } });
      notify('Size chart saved');
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
      title={isNew ? 'Add Size Chart' : `Edit “${chart.name}”`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button type="submit" form="chart-form" className="btn btn-orange" disabled={saving}>{saving ? 'Saving…' : 'Save Size Chart'}</button>
        </>
      }
    >
      <ErrorNote error={error} />
      <form id="chart-form" onSubmit={save}>
        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label className="form-label" htmlFor="sc-name">Name *</label>
            <input id="sc-name" className="form-control" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Women’s Tops" />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="sc-type">For</label>
            <select
              id="sc-type"
              className="form-select"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                if (isNew) {
                  setColumns(STARTERS[e.target.value].columns);
                  setRows(STARTERS[e.target.value].rows);
                }
              }}
            >
              {Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-label">Size table</div>
        <div className="table-responsive mb-2">
          <table className="table table-sm table-bordered align-middle">
            <thead>
              <tr>
                {columns.map((col, c) => (
                  <th key={c} className="p-1" style={{ minWidth: 110 }}>
                    <div className="d-flex gap-1">
                      <input className="form-control form-control-sm fw-semibold" value={col} onChange={(e) => setColumns((list) => list.map((x, j) => (j === c ? e.target.value : x)))} aria-label={`Heading ${c + 1}`} />
                      {columns.length > 1 && (
                        <button type="button" className="btn btn-sm btn-light text-danger" aria-label="Remove column" onClick={() => { setColumns((list) => list.filter((_, j) => j !== c)); setRows((list) => list.map((row) => row.filter((_, j) => j !== c))); }}>×</button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="p-1" style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {columns.map((_, c) => (
                    <td key={c} className="p-1">
                      <input className="form-control form-control-sm" value={row[c] || ''} onChange={(e) => setCell(r, c, e.target.value)} aria-label={`Row ${r + 1}, ${columns[c]}`} />
                    </td>
                  ))}
                  <td className="p-1">
                    <button type="button" className="btn btn-sm btn-light text-danger" aria-label="Remove row" onClick={() => setRows((list) => list.filter((_, i) => i !== r))}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="d-flex gap-2 mb-3">
          <button type="button" className="btn btn-sm btn-light border" onClick={() => setRows((list) => [...list, columns.map(() => '')])}><i className="bi bi-plus" /> Row</button>
          <button type="button" className="btn btn-sm btn-light border" disabled={columns.length >= 10} onClick={() => setColumns((list) => [...list, 'New column'])}><i className="bi bi-plus" /> Column</button>
        </div>
        <ImageField label="Or / also a size chart photo (optional)" value={imageUrl} onChange={setImageUrl} hint="e.g. a measuring guide picture" />
      </form>
    </Modal>
  );
}

export default function SizeCharts() {
  const { notify } = useAuth();
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useApi(`/admin/size-charts?page=${page}`);
  const [editing, setEditing] = useState(null);

  const remove = async (chart) => {
    const warning = chart.productCount ? ` ${chart.productCount} product(s) use it and will no longer show a size chart.` : '';
    if (!window.confirm(`Delete the size chart “${chart.name}”?${warning}`)) return;
    try {
      await api(`/admin/size-charts/${chart._id}`, { method: 'DELETE' });
      notify('Size chart deleted');
      reload();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <>
      <PageTitle
        title="Size Charts"
        subtitle="Saved size tables you can attach to clothing and footwear products"
        actions={<button type="button" className="btn btn-orange" onClick={() => setEditing({})}><i className="bi bi-plus-lg me-1" />Add Size Chart</button>}
      />
      <div className="panel">
        <DataTable
          columns={['Name', 'For', 'Sizes', 'Used by', '']}
          rows={data?.items || []}
          empty={loading ? 'Loading…' : 'No size charts yet. Add one, then choose it on a product’s form.'}
          renderRow={(c) => (
            <tr key={c._id}>
              <td className="fw-semibold">{c.name}</td>
              <td className="small">{TYPES[c.type] || 'Other'}</td>
              <td className="small text-muted">{c.rows?.map((r) => r[0]).filter(Boolean).join(', ') || (c.imageUrl ? 'Photo' : '–')}</td>
              <td className="small">{c.productCount} product{c.productCount === 1 ? '' : 's'}</td>
              <td className="text-end text-nowrap">
                <button type="button" className="btn btn-sm btn-light" title="Edit" onClick={() => setEditing(c)}><i className="bi bi-pencil" /></button>{' '}
                <button type="button" className="btn btn-sm btn-light text-danger" title="Delete" onClick={() => remove(c)}><i className="bi bi-trash" /></button>
              </td>
            </tr>
          )}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="size charts" />}
      </div>
      {editing && <ChartEditor chart={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </>
  );
}
