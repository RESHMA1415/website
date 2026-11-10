import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';

const StoreContext = createContext(null);

// Used until the backend responds, so the layout never renders empty
const fallbackSettings = {
  store: { name: 'SHOPME', email: '', phone: '', whatsappNumber: '', address: '', businessHours: '' },
  delivery: { freeDeliveryThreshold: 500, deliveryCharge: 50, estimateMinDays: 4, estimateMaxDays: 7 },
  cod: { enabled: true, charge: 50, maxOrderValue: 5000 },
  orders: { maxQtyPerItem: 5, returnWindowDays: 7 },
  social: {},
};

export function StoreProvider({ children }) {
  const [settings, setSettings] = useState(fallbackSettings);
  const [categories, setCategories] = useState([]);
  const [whatsappMessage, setWhatsappMessage] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();

  // Site title, description and tab icon from Business Settings (PRD §14.11 SEO)
  useEffect(() => {
    const { seo = {}, store = {} } = settings;
    if (seo.title) document.title = seo.title;
    const meta = (selector, attrs) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement(attrs.tag || 'meta');
        Object.entries(attrs).forEach(([k, v]) => k !== 'tag' && el.setAttribute(k, v));
        document.head.appendChild(el);
      }
      return el;
    };
    if (seo.description) meta('meta[name="description"]', { name: 'description' }).setAttribute('content', seo.description);
    if (store.faviconUrl) meta('link[rel="icon"]', { tag: 'link', rel: 'icon' }).setAttribute('href', store.faviconUrl);
  }, [settings]);

  useEffect(() => {
    api('/settings').then(setSettings).catch(() => {});
    api('/categories').then(setCategories).catch(() => {});
  }, []);

  const notify = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const findCategory = useCallback(
    (slug) => {
      const walk = (nodes, trail) => {
        for (const node of nodes) {
          const path = [...trail, node];
          if (node.slug === slug) return { category: node, path };
          const found = walk(node.children || [], path);
          if (found) return found;
        }
        return null;
      };
      return walk(categories, []);
    },
    [categories],
  );

  const value = useMemo(
    () => ({ settings, categories, findCategory, whatsappMessage, setWhatsappMessage, notify }),
    [settings, categories, findCategory, whatsappMessage, notify],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      {toast && (
        <div className="shop-toast" role="status">
          <i className="bi bi-info-circle text-orange" />
          {toast}
        </div>
      )}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
