import { Link } from 'react-router-dom';
import { useStages } from '../../lib/StagesContext.jsx';
import { formatWhen } from '../../lib/format.js';

export default function CallRow({ call }) {
  const { stageByNo, outcomeLabel } = useStages();
  const stage = stageByNo(call.stage_reached);
  const inProgress = call.status === 'in_progress';
  const who = [call.prospect_name, call.company].filter(Boolean).join(', ');

  return (
    <li>
      <Link to={`/calls/${call.id}`} className="call-row">
        <span className="call-who">{who}</span>
        <span className="call-line">
          {call.need_words ? (
            <q className="quote">{call.need_words}</q>
          ) : (
            <span className="muted">{inProgress ? 'Call in progress' : outcomeLabel(call.outcome)}</span>
          )}
        </span>
        <span className="call-meta">
          <span className="pill" title={`Reached stage ${call.stage_reached}`}>
            {call.stage_reached} {stage?.name}
          </span>
          {inProgress ? (
            <span className="pill pill-live">In progress</span>
          ) : (
            call.outcome && <span className="call-outcome">{outcomeLabel(call.outcome)}</span>
          )}
          <time className="call-time" dateTime={call.started_at}>
            {formatWhen(call.started_at)}
          </time>
        </span>
      </Link>
    </li>
  );
}
