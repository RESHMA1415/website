import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Loads data from the API and re-loads whenever `path` changes
export function useApi(path) {
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: null });

  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => {
      cancelled = true;
    };
  }, [path]);

  return state;
}
