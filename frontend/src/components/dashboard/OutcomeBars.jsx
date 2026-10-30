import { useStages } from '../../lib/StagesContext.jsx';

// stats.by_outcome as horizontal bars, in the order outcomes are listed in stages.json.
export default function OutcomeBars({ byOutcome }) {
  const { outcomes } = useStages();
  const rows = outcomes.map((o) => ({ ...o, count: byOutcome?.[o.key] ?? 0 }));
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <section className="panel" aria-labelledby="outcomes-title">
      <h2 id="outcomes-title" className="panel-title">Outcomes</h2>
      <ul className="hbars">
        {rows.map((r) => (
          <li key={r.key} className="hbar">
            <span className="hbar-label">{r.label}</span>
            <span className="hbar-track" aria-hidden="true">
              <span className="hbar-fill" style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <span className="hbar-count">{r.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
