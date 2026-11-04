import { useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { useApi } from '../hooks/useApi.js';

const TITLES = {
  privacy: 'Privacy Policy',
  terms: 'Terms & Conditions',
  shipping: 'Shipping Policy',
  returns: 'Return, Exchange & Refund Policy',
  cancellation: 'Cancellation Policy',
  faq: 'Frequently Asked Questions',
};

export default function Policy() {
  const { page } = useParams();
  const title = TITLES[page];
  const { data, loading } = useApi(title ? `/pages/${page}` : null);

  if (!title) {
    return (
      <div className="container">
        <EmptyState icon="bi-file-earmark-x" title="Page not found" actionLabel="Go to shop" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title={title} crumbs={[{ label: title }]} />
      <div className="container" style={{ maxWidth: 820 }}>
        <div className="card-soft p-4 p-md-5" style={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>
          {loading ? <div className="skeleton" style={{ height: 120 }} /> : data?.content || 'Content coming soon.'}
        </div>
      </div>
    </>
  );
}
