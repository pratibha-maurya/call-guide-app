export default function LoadError({ message, onRetry }) {
  return (
    <div className="load-error" role="alert">
      <p>{message} The server may still be waking up.</p>
      <button type="button" className="btn" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
