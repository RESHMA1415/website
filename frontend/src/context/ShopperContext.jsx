import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SESSION_ENDED_EVENT, api, clearToken, getToken, isRemembered, setToken } from '../api/client.js';
import { useStore } from './StoreContext.jsx';

// The shopper: login, cart and wishlist (PRD Phase 3). All prices and totals
// in the cart come from the server.
const ShopperContext = createContext(null);

const EMPTY_CART = { items: [], count: 0, summary: null, canCheckout: false };

export function ShopperProvider({ children }) {
  const { notify } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getToken());
  const [cart, setCart] = useState(EMPTY_CART);
  const [wishlist, setWishlist] = useState(() => new Set());

  const loadCart = useCallback(() => api('/cart').then(setCart).catch(() => {}), []);
  const loadWishlist = useCallback(() => api('/wishlist/ids').then((ids) => setWishlist(new Set(ids))).catch(() => {}), []);

  // On first load: restore the login (if any), then the cart and wishlist
  useEffect(() => {
    if (!getToken()) {
      loadCart();
      return;
    }
    api('/auth/me')
      .then((me) => {
        setUser(me);
        loadWishlist();
      })
      .catch(() => {})
      .finally(() => {
        setReady(true);
        loadCart();
      });
  }, [loadCart, loadWishlist]);

  // The server says the login ended (expired, password changed, blocked)
  useEffect(() => {
    const ended = (event) => {
      setUser(null);
      setWishlist(new Set());
      loadCart();
      notify(event.detail || 'Your login has ended. Please log in again.');
    };
    window.addEventListener(SESSION_ENDED_EVENT, ended);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, ended);
  }, [loadCart, notify]);

  const startSession = useCallback(
    ({ token, user: me }, remember) => {
      setToken(token, remember);
      setUser(me);
      setReady(true);
      loadCart(); // the guest cart has been joined to the account
      loadWishlist();
    },
    [loadCart, loadWishlist],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setWishlist(new Set());
    setCart(EMPTY_CART);
    loadCart();
    notify('You have been logged out.');
    navigate('/');
  }, [loadCart, navigate, notify]);

  // Sends a guest to the login page, then back to where they were
  const goToLogin = useCallback(
    (message) => {
      if (message) notify(message);
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    },
    [location.pathname, location.search, navigate, notify],
  );

  const cartAction = useCallback(async (request) => {
    const next = await request;
    setCart(next);
    return next;
  }, []);

  const addToCart = useCallback(
    (productId, variantId, quantity = 1) => cartAction(api('/cart/items', { method: 'POST', body: { productId, variantId, quantity } })),
    [cartAction],
  );
  const updateCartItem = useCallback((itemId, quantity) => cartAction(api(`/cart/items/${itemId}`, { method: 'PATCH', body: { quantity } })), [cartAction]);
  const removeCartItem = useCallback((itemId) => cartAction(api(`/cart/items/${itemId}`, { method: 'DELETE' })), [cartAction]);
  const moveToWishlist = useCallback(
    async (itemId) => {
      const result = await api(`/cart/items/${itemId}/move-to-wishlist`, { method: 'POST' });
      setCart(result.cart);
      setWishlist(new Set(result.wishlist));
    },
    [],
  );

  const inWishlist = useCallback((productId) => wishlist.has(String(productId)), [wishlist]);
  const toggleWishlist = useCallback(
    async (productId) => {
      if (!user) {
        goToLogin('Please log in to save items to your wishlist.');
        return;
      }
      const saved = wishlist.has(String(productId));
      try {
        const ids = await api(`/wishlist/${productId}`, { method: saved ? 'DELETE' : 'POST' });
        setWishlist(new Set(ids));
        notify(saved ? 'Removed from your wishlist' : 'Saved to your wishlist');
      } catch (err) {
        notify(err.message);
      }
    },
    [goToLogin, notify, user, wishlist],
  );

  const value = useMemo(
    () => ({
      user,
      setUser,
      ready,
      remembered: isRemembered(),
      startSession,
      logout,
      goToLogin,
      cart,
      loadCart,
      addToCart,
      updateCartItem,
      removeCartItem,
      moveToWishlist,
      wishlistCount: wishlist.size,
      inWishlist,
      toggleWishlist,
      loadWishlist,
    }),
    [user, ready, startSession, logout, goToLogin, cart, loadCart, addToCart, updateCartItem, removeCartItem, moveToWishlist, wishlist, inWishlist, toggleWishlist, loadWishlist],
  );

  return <ShopperContext.Provider value={value}>{children}</ShopperContext.Provider>;
}

export function useShopper() {
  return useContext(ShopperContext);
}
