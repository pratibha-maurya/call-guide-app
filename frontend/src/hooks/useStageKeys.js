// Keyboard shortcuts on the stage screen:
//   1-5            pick a "what happened" option (not while typing)
//   Enter          next stage (not while typing or on a focused control)
//   Ctrl/Cmd+Enter next stage, also from inside the textarea
import { useEffect } from 'react';

const isTyping = (el) => el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable);
const isControl = (el) => el && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SELECT');

export function useStageKeys({ taps, onTap, onNext, enabled }) {
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e) {
      const el = document.activeElement;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onNext();
        return;
      }
      if (isTyping(el) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Enter' && !isControl(el)) {
        e.preventDefault();
        onNext();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= taps.length) {
        e.preventDefault();
        onTap(taps[n - 1].key);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [taps, onTap, onNext, enabled]);
}
