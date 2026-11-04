import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { SESSION_ENDED_EVENT, api, getToken, setToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = still checking, null = logged out
  const [admin, setAdmin] = useState(getToken() ? undefined : null);
  const [notice, setNotice] = useState('');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) return;
    api('/admin/auth/me')
      .then(setAdmin)
      .catch(() => setAdmin(null));
  }, []);

  useEffect(() => {
    const ended = () => {
      setAdmin(null);
      setNotice('Your session ended after 2 hours without activity. Please log in again.');
    };
    window.addEventListener(SESSION_ENDED_EVENT, ended);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, ended);
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await api('/admin/auth/login', { method: 'POST', body: { email, password } });
    setToken(result.token);
    setNotice('');
    setAdmin(result.admin);
  }, []);

  const logout = useCallback(() => {
    setToken('');
    setAdmin(null);
    setNotice('You have logged out.');
    navigate('/login');
  }, [navigate]);

  // Small pop-up message, e.g. "Product saved"
  const notify = useCallback((message, tone = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const value = useMemo(() => ({ admin, setAdmin, login, logout, notice, notify }), [admin, login, logout, notice, notify]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {toast && (
        <div className={`admin-toast ${toast.tone}`} role="status">
          <i className={`bi ${toast.tone === 'error' ? 'bi-exclamation-circle' : 'bi-check-circle'}`} />
          {toast.message}
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Every admin screen sits behind this: logged-out visitors go to the login page
export function RequireAdmin({ children }) {
  const { admin } = useAuth();
  const location = useLocation();
  if (admin === undefined) {
    return <div className="login-page"><div className="text-white-50">Checking your login…</div></div>;
  }
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
