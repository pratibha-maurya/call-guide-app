import { Link } from 'react-router-dom';
import { useStages } from '../../lib/StagesContext.jsx';
import { formatWhen } from '../../lib/format.js';
import StatusBadge from '../StatusBadge.jsx';

// The last few calls, each linking to its detail page.
export default function RecentCalls({ calls }) {
  const { outcomeLabel } = useStages();

  return (
    <section className="panel" aria-labelledby="recent-title">
      <div className="panel-head">
        <h2 id="recent-title" className="panel-title">Recent calls</h2>
        <Link to="/calls" className="panel-link">All past calls</Link>
      </div>
      <ul className="recent">
        {calls.map((c) => (
          <li key={c.id}>
            <Link to={`/calls/${c.id}`} className="recent-row">
              <span className="recent-who">
                <strong>{c.prospect_name}</strong>
                <span className="muted">{c.company}</span>
              </span>
              <span className="recent-meta">
                {c.status === 'in_progress' ? <StatusBadge status={c.status} /> : outcomeLabel(c.outcome)}
                <time className="muted" dateTime={c.started_at}>{formatWhen(c.started_at)}</time>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
