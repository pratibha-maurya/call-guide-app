// Fires GET /health once on load. Its real job is to wake the Render backend
// early so the first "Start call" doesn't wait ~50 seconds. Also reports
// whether the LLM is configured (llm, llm_model).
import { useEffect, useState } from 'react';
import { api } from '../api/index.js';

export function useHealth() {
  const [health, setHealth] = useState({ status: 'waking', llm: false, model: null });

  useEffect(() => {
    let cancelled = false;
    api
      .getHealth()
      .then((h) => {
        if (cancelled) return;
        setHealth({ status: h?.ok ? 'ok' : 'down', llm: Boolean(h?.llm), model: h?.llm_model ?? null });
      })
      .catch(() => !cancelled && setHealth({ status: 'down', llm: false, model: null }));
    return () => {
      cancelled = true;
    };
  }, []);

  return health;
}
