import { useLiveCall } from '../../hooks/useLiveCall.jsx';
import CallTimer from '../CallTimer.jsx';

export default function ProspectBar() {
  const { state } = useLiveCall();
  const { call, current, phase, startedAt, endedAt } = state;
  const detail = [call.prospect_role, call.company].filter(Boolean).join(', ');

  return (
    <div className="prospect">
      <div className="prospect-who">
        <p className="prospect-name">{call.prospect_name}</p>
        {detail && <p className="prospect-detail">{detail}</p>}
      </div>
      <div className="prospect-meta">
        <CallTimer startedAt={startedAt} endedAt={phase === 'closing' ? endedAt : null} />
        <span className="prospect-step">{phase === 'closing' ? 'Wrapping up' : `Stage ${current} of 8`}</span>
      </div>
    </div>
  );
}
