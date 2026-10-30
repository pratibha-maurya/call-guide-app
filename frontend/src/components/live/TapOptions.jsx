// "What happened": one option can be selected. Keys 1-5 work too (see useStageKeys).
export default function TapOptions({ taps, selected, onTap }) {
  return (
    <div className="taps" role="group" aria-labelledby="taps-label">
      <h2 id="taps-label" className="section-label">What happened</h2>
      <div className="taps-grid">
        {taps.map((t, i) => (
          <button
            key={t.key}
            type="button"
            className="tap"
            aria-pressed={selected === t.key}
            onClick={() => onTap(t.key)}
          >
            <kbd className="tap-key" aria-hidden="true">{i + 1}</kbd>
            <span className="tap-label">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
