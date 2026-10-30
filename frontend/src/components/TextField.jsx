// Labelled text input with an inline error message under it.
export default function TextField({ id, label, value, error, onChange, onBlur, ...rest }) {
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        className={`input${error ? ' is-invalid' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
