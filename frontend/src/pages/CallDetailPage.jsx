import { Link, useParams } from 'react-router-dom';
import { api } from '../api/index.js';
import { useApi } from '../hooks/useApi.js';
import { useStages } from '../lib/StagesContext.jsx';
import { formatDuration, formatWhen } from '../lib/format.js';
import LoadError from '../components/LoadError.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function CallDetailPage() {
  const { id } = useParams();
  const { data, error, loading, slow, reload } = useApi(() => api.getCall(id), [id]);
  const { stages: stageDefs, tapLabel, outcomeLabel } = useStages();

  if (loading) return <p className="empty" role="status">{slow ? 'Waking the server…' : 'Loading call…'}</p>;
  if (error) return <LoadError message="Couldn't load this call." onRetry={reload} />;

  const { call, stages } = data;
  const byNo = Object.fromEntries(stages.map((s) => [s.stage_no, s]));
  const detail = [call.prospect_role, call.company].filter(Boolean).join(', ');
  const duration = call.ended_at
    ? formatDuration((new Date(call.ended_at) - new Date(call.started_at)) / 1000)
    : null;

  const facts = [
    ['Status', <StatusBadge key="s" status={call.status} />],
    ['Outcome', call.outcome ? outcomeLabel(call.outcome) : '-'],
    ['Ended at', `Stage ${call.stage_reached}: ${stageDefs[call.stage_reached - 1]?.name}`],
    ['Started', formatWhen(call.started_at)],
    ['Finished', call.ended_at ? formatWhen(call.ended_at) : '-'],
    ['Duration', duration ?? '-'],
  ];

  return (
    <article className="detail" aria-labelledby="detail-title">
      <Link to="/calls" className="back-link">← Past calls</Link>
      <h1 id="detail-title" className="page-title">{call.prospect_name}</h1>
      {detail && <p className="detail-sub">{detail}</p>}

      <dl className="detail-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {call.outcome_flag && (
        <div className="flag" role="note">
          <strong>The outcome may not match what was said.</strong> {call.outcome_flag}
        </div>
      )}

      <div className="detail-notes">
        <section>
          <h2 className="section-label">Call notes</h2>
          {call.summary ? <p className="detail-summary">{call.summary}</p> : <p className="muted">No notes.</p>}
        </section>
        <section>
          <h2 className="section-label">Next step</h2>
          <p className="detail-next">{call.next_step || <span className="muted">None recorded.</span>}</p>
        </section>
      </div>

      <h2 className="section-label">Stages</h2>
      <ol className="detail-stages">
        {stageDefs.map((def) => {
          const row = byNo[def.no];
          const reached = def.no <= call.stage_reached;
          return (
            <li key={def.no} className={`detail-stage${reached ? '' : ' is-unreached'}${def.wordsRequired ? ' is-key' : ''}`}>
              <span className="detail-no">{def.no}</span>
              <div>
                <p className="detail-name">{def.name}</p>
                {row?.tap && <p className="detail-tap">{tapLabel(def.no, row.tap)}</p>}
                {row?.prospect_words && <q className="quote">{row.prospect_words}</q>}
                {reached && !row && <p className="muted">Nothing recorded</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
