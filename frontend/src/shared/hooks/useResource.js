import { useEffect, useState } from 'react';
import { api } from '../services/api';
export function useResource(path) {
  const [state, setState] = useState({ data: null, loading: false, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!path) { setState({ data: null, loading: false, error: '' }); return; }
    const controller = new AbortController();
    setState({ data: null, loading: true, error: '' });
    api(path, controller.signal).then(data => { if (!controller.signal.aborted) setState({ data, loading: false, error: '' }); })
      .catch(error => { if (!controller.signal.aborted) setState({ data: null, loading: false, error: error.message }); });
    return () => controller.abort();
  }, [path, attempt]);
  return { ...state, retry: () => setAttempt(value => value + 1) };
}
