// Call notes: prefilled with the drafted summary (editable) plus the mismatch flag, if the backend raised one.
export default function SummaryBox({ status, hasOutcome, summary, flag, source, onChange }) {
  const sourceLabel = source === 'llm' ? 'Drafted by AI' : source ? 'Auto summary' : null;

  return (
    <div className="summary">
      <div className="summary-head">
        <label htmlFor="summary" className="section-label">Call notes</label>
        {status === 'loading' && <span className="summary-tag" role="status">Drafting...</span>}
        {status !== 'loading' && sourceLabel && <span className="summary-tag">{sourceLabel}</span>}
      </div>

      {flag && (
        <div className="flag" role="alert">
          <strong>The outcome may not match what was said.</strong> {flag}
        </div>
      )}

      <textarea
        id="summary"
        className="textarea"
        rows={3}
        value={summary}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hasOutcome ? 'Write a two-line summary of the call.' : 'Pick an outcome and a draft appears here.'}
      />
      {status === 'error' && (
        <p className="hint">Couldn't draft a summary. Write one yourself or leave it blank; you can still save.</p>
      )}
    </div>
  );
}
