import { useEffect, useState } from 'react';
import { api } from '../services/api';
const cache = new Map();
export function useSuggestions(endpoint, query, enabled = true) {
  const term = query.trim();
  const key = `${endpoint}?q=${encodeURIComponent(term.toLocaleLowerCase())}`;
  const [state, setState] = useState({ key: '', items: [], error: '', loading: false });
  useEffect(() => {
    if (!enabled || !term) { setState({ key, items: [], error: '', loading: false }); return; }
    const stored = cache.get(key);
    if (stored && stored.expires > Date.now()) { setState({ key, items: stored.items, error: '', loading: false }); return; }
    const controller = new AbortController();
    setState({ key, items: [], error: '', loading: true });
    const timer = setTimeout(() => {
      api(key, controller.signal).then(items => {
        if (controller.signal.aborted) return;
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(key, { items, expires: Date.now() + 5 * 60000 });
        setState({ key, items, error: '', loading: false });
      }).catch(error => { if (!controller.signal.aborted) setState({ key, items: [], error: error.message, loading: false }); });
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, enabled]);
  return state.key === key ? state : { items: [], error: '', loading: Boolean(enabled && term) };
}
