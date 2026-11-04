// Flattens the admin category tree into "Women › Clothing › Dresses" choices
export function flattenCategories(tree = [], trail = []) {
  return (tree || []).flatMap((c) => {
    const path = [...trail, c.name];
    return [{ ...c, label: path.join(' › '), isLeaf: !c.children?.length }, ...flattenCategories(c.children, path)];
  });
}

export default function CategorySelect({ tree, value, onChange, allLabel = 'Choose category', className = 'form-select', id, required, exclude }) {
  const options = flattenCategories(tree).filter((c) => !exclude || !exclude(c));
  return (
    <select id={id} className={className} value={value || ''} onChange={(e) => onChange(e.target.value)} required={required} aria-label={allLabel}>
      <option value="">{allLabel}</option>
      {options.map((c) => (
        <option key={c._id} value={c._id}>
          {c.label}{c.status === 'hidden' ? ' (hidden)' : ''}
        </option>
      ))}
    </select>
  );
}
