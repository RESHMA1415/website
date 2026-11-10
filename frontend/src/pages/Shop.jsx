import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ProductGrid from '../components/ProductGrid.jsx';
import ShopFilters, { ActiveFilters, FILTER_KEYS } from '../components/ShopFilters.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { sizedSrcSet } from '../components/ProductImage.jsx';
import usePageMeta from '../hooks/usePageMeta.js';
import { useApi } from '../hooks/useApi.js';

const SORT_OPTIONS = [
  ['newest', 'Newest'],
  ['price_asc', 'Price: Low to High'],
  ['price_desc', 'Price: High to Low'],
  ['best_selling', 'Best Selling'],
  ['top_rated', 'Top Rated'],
  ['discount', 'Biggest Discount'],
];
const PAGE_SIZE = 24;

const categoryLink = (c) => (c.slug === 'men' || c.slug === 'women' ? `/${c.slug}` : `/category/${c.slug}`);

// Shown when a search finds nothing (PRD §13.4)
function PopularProducts() {
  const { data } = useApi('/products?sort=best_selling&limit=8');
  if (!data?.products?.length) return null;
  return (
    <section className="mt-4">
      <h2 className="h5 mb-3">Popular right now</h2>
      <ProductGrid products={data.products} />
    </section>
  );
}

// One page for Shop, Men, Women, any category, New Arrivals and Search (PRD §13.3)
export default function Shop({ categorySlug, newArrivals = false, search = false }) {
  const params = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { findCategory, categories } = useStore();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const slug = categorySlug || params.slug;
  const q = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'newest';
  const page = Number(searchParams.get('page')) || 1;

  // The collection being browsed (decides which filter choices exist)
  const base = new URLSearchParams();
  if (slug) base.set('category', slug);
  if (newArrivals) base.set('newArrivals', 'true');
  if (search) base.set('q', q);
  const blockedSearch = search && !q;

  const query = new URLSearchParams(base);
  query.set('sort', sort);
  query.set('page', String(page));
  query.set('limit', String(PAGE_SIZE));
  for (const key of FILTER_KEYS) if (searchParams.get(key)) query.set(key, searchParams.get(key));

  const { data, loading } = useApi(blockedSearch ? null : `/products?${query}`);
  const { data: facets } = useApi(blockedSearch ? null : `/products/filters?${base}`);

  useEffect(() => {
    setFiltersOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = filtersOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [filtersOpen]);

  const found = slug ? findCategory(slug) : null;
  let title = 'Shop All';
  let crumbs = [{ label: 'Shop' }];
  if (search) {
    title = q ? `Results for “${q}”` : 'Search';
    crumbs = [{ label: 'Search' }];
  } else if (newArrivals) {
    title = 'New Arrivals';
    crumbs = [{ label: 'New Arrivals' }];
  } else if (found) {
    title = found.path.length === 2 && found.path[0].slug === 'women' ? `Women’s ${found.category.name}` : found.category.name;
    crumbs = found.path.map((c) => ({ label: c.name, to: categoryLink(c) }));
  } else if (slug) {
    title = 'Collection';
  }

  const sideCategories = (found ? found.category.children : categories).filter((c) => c.showInMenu !== false);
  const parent = found?.path.length > 1 ? found.path[found.path.length - 2] : null;

  const update = (changes) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next, { replace: !('page' in changes) });
    if ('page' in changes) window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    FILTER_KEYS.forEach((key) => next.delete(key));
    next.delete('page');
    setSearchParams(next);
  };
  const activeCount = FILTER_KEYS.filter((key) => searchParams.get(key)).length;

  const products = data?.products || [];
  const total = data?.total || 0;
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(total, page * PAGE_SIZE);
  usePageMeta({ title: typeof title === 'string' ? title : undefined, description: found?.category.description || (typeof title === 'string' ? `Shop ${title} at SHOPME: clothing, fashion, beauty and accessories delivered across India.` : undefined) });

  const sidebar = (
    <>
      <div className="filter-section">
        <h6 className="mb-2">Categories</h6>
        {parent && (
          <Link to={categoryLink(parent)}>
            <i className="bi bi-chevron-left small" /> {parent.name}
          </Link>
        )}
        {sideCategories?.length ? (
          sideCategories.map((c) => <Link key={c.slug} to={categoryLink(c)}>{c.name}</Link>)
        ) : (
          <span className="small text-muted">No sub-categories</span>
        )}
      </div>
      <ShopFilters facets={facets} params={searchParams} onChange={update} />
    </>
  );

  return (
    <>
      <PageHeader title={title} crumbs={crumbs}>
        {found?.category.description && <p className="text-muted mb-0 mt-1">{found.category.description}</p>}
      </PageHeader>
      <div className="container">
        {found?.category.bannerUrl && (
          <img src={found.category.bannerUrl} srcSet={sizedSrcSet(found.category.bannerUrl)} sizes="(max-width: 991px) 100vw, 1200px" alt="" className="category-banner mb-4" fetchpriority="high" decoding="async" />
        )}
        <div className="row g-4">
          <aside className="col-lg-3 d-none d-lg-block">
            <div className="card-soft p-3 p-lg-4 shop-sidebar">{sidebar}</div>
          </aside>
          <div className="col-lg-9">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div className="text-muted small">
                {loading ? 'Loading…' : total ? `Showing ${from}–${to} of ${total} product${total === 1 ? '' : 's'}` : ''}
              </div>
              <div className="d-flex align-items-center gap-2">
                <button type="button" className="btn btn-outline-navy btn-sm d-lg-none" onClick={() => setFiltersOpen(true)}>
                  <i className="bi bi-sliders me-1" />Filters{activeCount ? ` (${activeCount})` : ''}
                </button>
                <label htmlFor="sort" className="small text-muted text-nowrap d-none d-sm-inline">Sort by</label>
                <select id="sort" className="form-select form-select-sm" value={sort} onChange={(e) => update({ sort: e.target.value })}>
                  {SORT_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <ActiveFilters params={searchParams} onChange={update} onClear={clearFilters} />

            {blockedSearch ? (
              <EmptyState icon="bi-search" title="What are you looking for?" text="Type in the search bar above to find products." />
            ) : !loading && !products.length ? (
              <>
                <EmptyState
                  icon="bi-search"
                  title="No products found"
                  text={
                    activeCount
                      ? 'No products match all of these filters. Try removing one.'
                      : search
                        ? 'Try a different word, check the spelling, or browse our collections.'
                        : 'New products are coming soon to this collection.'
                  }
                  actionLabel={activeCount ? undefined : 'Browse all products'}
                />
                {activeCount > 0 && (
                  <div className="text-center mb-4">
                    <button type="button" className="btn btn-orange" onClick={clearFilters}>Clear all filters</button>
                  </div>
                )}
                {search && <PopularProducts />}
              </>
            ) : (
              <ProductGrid products={products} loading={loading && !data} />
            )}

            {data?.pages > 1 && (
              <nav className="d-flex justify-content-center mt-4" aria-label="Pages">
                <ul className="pagination">
                  <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                    <button type="button" className="page-link" onClick={() => update({ page: String(page - 1) })} aria-label="Previous page">‹</button>
                  </li>
                  {Array.from({ length: data.pages }, (_, i) => i + 1)
                    .filter((n) => n === 1 || n === data.pages || Math.abs(n - page) <= 2)
                    .map((n) => (
                      <li key={n} className={`page-item ${n === page ? 'active' : ''}`}>
                        <button type="button" className="page-link" onClick={() => update({ page: String(n) })}>{n}</button>
                      </li>
                    ))}
                  <li className={`page-item ${page >= data.pages ? 'disabled' : ''}`}>
                    <button type="button" className="page-link" onClick={() => update({ page: String(page + 1) })} aria-label="Next page">›</button>
                  </li>
                </ul>
              </nav>
            )}
          </div>
        </div>
      </div>

      {filtersOpen && (
        <>
          <div className="filters-backdrop" onClick={() => setFiltersOpen(false)} />
          <div className="filters-sheet" role="dialog" aria-modal="true" aria-label="Filters">
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
              <h2 className="h6 mb-0">Filters</h2>
              <button type="button" className="btn-close" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />
            </div>
            <div className="filters-sheet-body px-3">{sidebar}</div>
            <div className="d-flex gap-2 p-3 border-top">
              <button type="button" className="btn btn-outline-navy flex-fill" onClick={clearFilters}>Clear all</button>
              <button type="button" className="btn btn-orange flex-fill" onClick={() => setFiltersOpen(false)}>
                Show {loading ? '…' : total} product{total === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
