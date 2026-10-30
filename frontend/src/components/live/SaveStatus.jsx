import { useLiveCall } from '../../hooks/useLiveCall.jsx';

// One quiet line: is what I tapped and typed on the server yet?
export default function SaveStatus() {
  const { saveStatus, retryUnsaved } = useLiveCall();
  if (saveStatus === 'idle') return <span className="save-status" />;

  return (
    <span className={`save-status is-${saveStatus}`} role="status">
      {saveStatus === 'saving' && 'Saving…'}
      {saveStatus === 'saved' && 'Saved ✓'}
      {saveStatus === 'failed' && (
        <>
          Not saved –{' '}
          <button type="button" className="btn-plain" onClick={retryUnsaved}>
            retry
          </button>
        </>
      )}
    </span>
  );
}
