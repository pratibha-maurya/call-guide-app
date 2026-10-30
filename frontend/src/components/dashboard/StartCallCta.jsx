import { Link } from 'react-router-dom';
import { useLiveCall } from '../../hooks/useLiveCall.jsx';

// The main action. If a call is still open (it lives in localStorage), offer to resume it instead.
export default function StartCallCta() {
  const { state } = useLiveCall();
  const onCall = state.phase === 'live' || state.phase === 'closing';

  if (onCall) {
    return (
      <div className="cta">
        <Link to="/call" className="btn btn-primary btn-large">
          Resume call with {state.call.prospect_name}
        </Link>
        <span className="hint">Stage {state.current} of 8. End it to start a new one.</span>
      </div>
    );
  }
  return (
    <div className="cta">
      <Link to="/call" className="btn btn-primary btn-large">
        Start a new call
      </Link>
    </div>
  );
}
