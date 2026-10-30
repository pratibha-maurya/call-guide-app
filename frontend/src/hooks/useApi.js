// Tiny fetch helper: { data, error, loading, slow, reload }.
// Keeps the previous data while refetching (no flicker when a search changes).
// `slow` turns true after 2.5s of loading: Render's free tier may be waking up.
import { useCallback, useEffect, useState } from 'react';

const SLOW_MS = 2500;

export function useApi(fetcher, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    setSlow(false);
    const timer = setTimeout(() => !cancelled && setSlow(true), SLOW_MS);
    fetcher()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }))
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, slow: state.loading && slow, reload };
}
