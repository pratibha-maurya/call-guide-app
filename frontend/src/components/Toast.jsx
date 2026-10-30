import { useLiveCall } from '../hooks/useLiveCall.jsx';

// Non-blocking notice for failed saves. The call keeps going underneath.
export default function Toast() {
  const { toast, retryUnsaved, dismissToast } = useLiveCall();
  if (!toast) return null;
  return (
    <div className="toast" role="alert">
      <span>{toast.message}</span>
      {toast.retry && (
        <button type="button" className="btn btn-small" onClick={retryUnsaved}>
          Retry save
        </button>
      )}
      <button type="button" className="btn-plain" onClick={dismissToast} aria-label="Dismiss">
        Dismiss
      </button>
    </div>
  );
}
