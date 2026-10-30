// Keyboard shortcuts on the stage screen:
//   1-5            pick a "what happened" option (not while typing)
//   Enter          next stage (not while typing or on a focused control)
//   Ctrl/Cmd+Enter next stage, also from inside the textarea
//   Alt+Left/Right previous / next stage (not while typing)
//   A              ask AI for a suggestion (not while typing)
import { useEffect } from 'react';

const isTyping = (el) => el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable);
const isControl = (el) => el && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SELECT');

export function useStageKeys({ taps, onTap, onNext, onPrev, onSuggest, enabled }) {
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e) {
      const el = document.activeElement;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onNext();
        return;
      }
      if (isTyping(el)) return;
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault(); // otherwise the browser goes back/forward in history
        if (e.key === 'ArrowLeft') onPrev();
        else onNext();
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Enter' && !isControl(el)) {
        e.preventDefault();
        onNext();
        return;
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        onSuggest();
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
  }, [taps, onTap, onNext, onPrev, onSuggest, enabled]);
}
