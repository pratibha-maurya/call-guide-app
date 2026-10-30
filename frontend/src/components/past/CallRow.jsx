import { Link } from 'react-router-dom';
import { useStages } from '../../lib/StagesContext.jsx';
import { formatWhen } from '../../lib/format.js';
import StatusBadge from '../StatusBadge.jsx';

// One row of the past-calls table. On phones the columns stack into a card (see styles.css).
export default function CallRow({ call }) {
  const { stageByNo, outcomeLabel } = useStages();
  const stage = stageByNo(call.stage_reached);

  return (
    <li>
      <Link to={`/calls/${call.id}`} className="call-row">
        <span className="col-name">{call.prospect_name}</span>
        <span className="col-role">{call.prospect_role || '-'}</span>
        <span className="col-company">{call.company || '-'}</span>
        <time className="col-date" dateTime={call.started_at}>{formatWhen(call.started_at)}</time>
        <span className="col-status"><StatusBadge status={call.status} /></span>
        <span className="col-outcome">{call.outcome ? outcomeLabel(call.outcome) : <span className="muted">-</span>}</span>
        <span className="col-stage">
          <span className="pill" title={`Reached stage ${call.stage_reached}: ${stage?.name}`}>
            {call.stage_reached} · {stage?.name}
          </span>
        </span>
        <span className="col-words">
          {call.need_words ? <q className="quote">{call.need_words}</q> : <span className="muted">No stage-5 words</span>}
        </span>
      </Link>
    </li>
  );
}
