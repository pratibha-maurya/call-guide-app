import { useStages } from '../../lib/StagesContext.jsx';

// How many calls stopped at each stage. Plain CSS bars, scaled to the busiest stage.
export default function WhereCallsEnd({ calls }) {
  const { stages } = useStages();
  const counts = stages.map((s) => calls.filter((c) => c.stage_reached === s.no).length);
  const max = Math.max(1, ...counts);
  const peak = counts.indexOf(Math.max(...counts));

  return (
    <figure className="ends" aria-labelledby="ends-title">
      <figcaption id="ends-title" className="ends-title">
        Where calls end
        <span className="ends-sub">{calls.length} calls, by the last stage reached</span>
      </figcaption>
      <ol className="ends-bars">
        {stages.map((s, i) => (
          <li key={s.no} className={`ends-col${i === peak && counts[i] > 0 ? ' is-peak' : ''}`}>
            <span className="ends-count">{counts[i]}</span>
            <span className="ends-track" aria-hidden="true">
              <span className="ends-bar" style={{ height: `${(counts[i] / max) * 100}%` }} />
            </span>
            <span className="ends-name" title={s.name}>
              <span className="ends-no">{s.no}</span> <span className="ends-label">{s.name}</span>
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
