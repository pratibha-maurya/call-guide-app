import { Link, useParams } from 'react-router-dom';
import { api } from '../api/index.js';
import { useApi } from '../hooks/useApi.js';
import { useStages } from '../lib/StagesContext.jsx';
import { formatWhen } from '../lib/format.js';
import LoadError from '../components/LoadError.jsx';

export default function CallDetailPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(() => api.getCall(id), [id]);
  const { stages: stageDefs, tapLabel, outcomeLabel } = useStages();

  if (loading) return <p className="empty" role="status">Loading call...</p>;
  if (error) return <LoadError message="Couldn't load this call." onRetry={reload} />;

  const { call, stages } = data;
  const byNo = Object.fromEntries(stages.map((s) => [s.stage_no, s]));
  const detail = [call.prospect_role, call.company].filter(Boolean).join(', ');

  return (
    <article className="detail" aria-labelledby="detail-title">
      <Link to="/calls" className="back-link">Past calls</Link>
      <h1 id="detail-title" className="page-title">{call.prospect_name}</h1>
      <p className="detail-sub">
        {detail && <>{detail}. </>}
        {formatWhen(call.started_at)}
      </p>

      <dl className="detail-facts">
        <div>
          <dt>Outcome</dt>
          <dd>{call.status === 'in_progress' ? 'In progress' : outcomeLabel(call.outcome)}</dd>
        </div>
        <div>
          <dt>Ended at</dt>
          <dd>Stage {call.stage_reached}: {stageDefs[call.stage_reached - 1]?.name}</dd>
        </div>
        {call.next_step && (
          <div>
            <dt>Next step</dt>
            <dd>{call.next_step}</dd>
          </div>
        )}
      </dl>

      {call.outcome_flag && (
        <div className="flag" role="note">
          <strong>The outcome may not match what was said.</strong> {call.outcome_flag}
        </div>
      )}
      {call.summary && <p className="detail-summary">{call.summary}</p>}

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
