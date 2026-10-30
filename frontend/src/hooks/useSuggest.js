// "Ask AI" for the stage on screen. Nothing is saved; the result is cleared
// whenever the stage changes, and a late answer for an old stage is ignored.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/index.js';

const idle = { status: 'idle', result: null }; // status: idle | loading | done | error

export function useSuggest(callId, stageNo) {
  const [state, setState] = useState(idle);
  const latest = useRef(0); // id of the newest request

  useEffect(() => {
    latest.current += 1; // drop anything still in flight
    setState(idle);
  }, [callId, stageNo]);

  async function ask({ tap, words }) {
    const id = ++latest.current;
    setState({ status: 'loading', result: null });
    try {
      const result = await api.suggest(callId, {
        stage_no: stageNo,
        tap: tap || null,
        prospect_words: words.trim() || null,
      });
      if (id === latest.current) setState({ status: 'done', result });
    } catch {
      if (id === latest.current) setState({ status: 'error', result: null });
    }
  }

  return { ...state, ask };
}
