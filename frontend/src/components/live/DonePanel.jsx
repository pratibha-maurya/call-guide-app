import { Link } from 'react-router-dom';
import { useLiveCall } from '../../hooks/useLiveCall.jsx';
import { useStages } from '../../lib/StagesContext.jsx';

export default function DonePanel() {
  const { state, reset } = useLiveCall();
  const { outcomeLabel } = useStages();
  const { call } = state;

  return (
    <section className="done" aria-labelledby="done-title">
      <h1 id="done-title" className="done-title">Call with {call.prospect_name} saved</h1>
      <p className="done-detail">
        {outcomeLabel(call.outcome)}
        {call.next_step ? `. Next: ${call.next_step}` : ''}
      </p>
      <div className="done-actions">
        <button type="button" className="btn btn-primary btn-large" onClick={reset} autoFocus>
          Start next call
        </button>
        <Link to="/calls" className="btn">
          See past calls
        </Link>
      </div>
    </section>
  );
}
