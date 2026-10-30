import { useEffect, useRef } from 'react';

// "Ask AI" for the current stage. Secondary to the taps: it never blocks the call,
// and static guidance is never dressed up as AI.
export default function SuggestBox({ status, result, onAsk }) {
  const loading = status === 'loading';

  return (
    <div className="suggest">
      <button type="button" className="btn btn-small btn-suggest" onClick={onAsk} disabled={loading}>
        {loading && <span className="spinner" aria-hidden="true" />}
        {loading ? 'Thinking...' : 'Suggest what to say'}
        <kbd aria-hidden="true">A</kbd>
      </button>

      {status === 'error' && (
        <p className="suggest-error" role="status">No suggestion right now. Carry on; try again in a moment.</p>
      )}
      {status === 'done' && result && <SuggestionCard result={result} />}
    </div>
  );
}

function SuggestionCard({ result }) {
  const isAi = result.source === 'llm';
  const LABELS = {
    llm: `AI suggestion · Groq · ${result.model ?? 'model'}`,
    mock: 'Sample suggestion – mock API, not AI',
  };
  const label = LABELS[result.source] ?? 'Static guidance – AI unavailable';
  const ref = useRef(null);

  // If the sticky footer covers the answer, scroll just enough to show it.
  useEffect(() => {
    const footer = document.querySelector('.stage-footer');
    if (!ref.current || !footer) return;
    const hidden = ref.current.getBoundingClientRect().bottom - footer.getBoundingClientRect().top;
    if (hidden > 0) window.scrollBy({ top: hidden + 16, behavior: 'smooth' });
  }, [result]);

  return (
    <div ref={ref} className={`suggest-card${isAi ? '' : ' is-static'}`} role="status">
      <p className="suggest-source">{label}</p>
      <p className="suggest-line">
        <span className="suggest-tag">Say:</span> {result.say}
      </p>
      {result.follow_up && (
        <p className="suggest-line">
          <span className="suggest-tag">Then ask:</span> {result.follow_up}
        </p>
      )}
    </div>
  );
}
