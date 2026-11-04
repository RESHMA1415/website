import { Link } from 'react-router-dom';

export default function EmptyState({ icon = 'bi-bag', title, text, actionLabel, actionTo = '/shop' }) {
  return (
    <div className="empty-state">
      <i className={`bi ${icon}`} />
      <h3 className="h4 mt-3">{title}</h3>
      {text && <p className="text-muted mx-auto" style={{ maxWidth: 440 }}>{text}</p>}
      {actionLabel && (
        <Link to={actionTo} className="btn btn-orange mt-2">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
