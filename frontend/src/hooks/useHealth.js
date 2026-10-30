// Fires GET /health once on load. Its real job is to wake the Render backend
// early so the first "Start call" doesn't wait ~50 seconds.
import { useEffect, useState } from 'react';
import { api } from '../api/index.js';

export function useHealth() {
  const [status, setStatus] = useState('waking'); // 'waking' | 'ok' | 'down'

  useEffect(() => {
    let cancelled = false;
    api
      .getHealth()
      .then((h) => !cancelled && setStatus(h?.ok ? 'ok' : 'down'))
      .catch(() => !cancelled && setStatus('down'));
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
