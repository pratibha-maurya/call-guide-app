import { useNavigate } from 'react-router-dom';
import { useLiveCall } from '../../hooks/useLiveCall.jsx';
import { useStages } from '../../lib/StagesContext.jsx';

// Shown after Save and close. Every way out clears the finished call first.
export default function DonePanel() {
  const { state, reset } = useLiveCall();
  const { outcomeLabel } = useStages();
  const navigate = useNavigate();
  const { call } = state;

  const leaveTo = (path) => () => {
    reset();
    navigate(path);
  };

  return (
    <section className="done" aria-labelledby="done-title">
      <p className="done-check" aria-hidden="true">✓</p>
      <h1 id="done-title" className="done-title">Call with {call.prospect_name} saved</h1>
      <p className="done-detail">
        {outcomeLabel(call.outcome)}
        {call.next_step ? `. Next: ${call.next_step}` : ''}
      </p>
      <div className="done-actions">
        <button type="button" className="btn btn-primary btn-large" onClick={reset} autoFocus>
          Start next call
        </button>
        <button type="button" className="btn" onClick={leaveTo(`/calls/${call.id}`)}>
          View this call
        </button>
        <button type="button" className="btn" onClick={leaveTo('/')}>
          Back to dashboard
        </button>
      </div>
    </section>
  );
}
