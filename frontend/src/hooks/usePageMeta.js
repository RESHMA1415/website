import { useEffect } from 'react';
import { useStore } from '../context/StoreContext.jsx';

function setMeta(selector, attrs, content) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Page title and description for search engines (PRD §17.4).
 * `jsonLd` adds structured data (e.g. a Product for Google Shopping results).
 */
export default function usePageMeta({ title, description, jsonLd } = {}) {
  const { settings } = useStore();
  const storeName = settings.store?.name || 'SHOPME';
  const fallbackTitle = settings.seo?.title || storeName;
  const fallbackDescription = settings.seo?.description || '';
  const ld = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    const fullTitle = title ? `${title} | ${storeName}` : fallbackTitle;
    const text = (description || fallbackDescription).replace(/\s+/g, ' ').trim().slice(0, 160);
    document.title = fullTitle;
    setMeta('meta[name="description"]', { name: 'description' }, text);
    setMeta('meta[property="og:title"]', { property: 'og:title' }, fullTitle);
    setMeta('meta[property="og:description"]', { property: 'og:description' }, text);
    let script;
    if (ld) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.pageMeta = 'true';
      script.textContent = ld;
      document.head.appendChild(script);
    }
    return () => {
      if (script) script.remove();
      document.title = fallbackTitle;
    };
  }, [title, description, ld, storeName, fallbackTitle, fallbackDescription]);
}
