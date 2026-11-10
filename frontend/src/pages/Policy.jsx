import { Navigate, useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import MarkdownText from '../components/MarkdownText.jsx';
import PageHeader from '../components/PageHeader.jsx';
import usePageMeta from '../hooks/usePageMeta.js';
import { useApi } from '../hooks/useApi.js';

const TITLES = {
  privacy: 'Privacy Policy',
  terms: 'Terms & Conditions',
  shipping: 'Shipping Policy',
  refunds: 'Refund & Cancellation Policy',
  faq: 'Frequently Asked Questions',
};
// Older links: returns and cancellation now share one policy
const MOVED = { returns: 'refunds', cancellation: 'refunds' };

export default function Policy() {
  const { page } = useParams();
  const title = TITLES[page];
  const { data, loading } = useApi(title ? `/pages/${page}` : null);
  usePageMeta({ title: title || undefined });

  if (MOVED[page]) return <Navigate to={`/policies/${MOVED[page]}`} replace />;
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
      <div className="container" style={{ maxWidth: 860 }}>
        <article className="card-soft p-4 p-md-5">
          {loading ? <div className="skeleton" style={{ height: 120 }} /> : <MarkdownText text={data?.content || 'Content coming soon.'} skipTitle />}
        </article>
      </div>
    </>
  );
}
