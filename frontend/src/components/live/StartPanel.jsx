import { useState } from 'react';
import { useLiveCall } from '../../hooks/useLiveCall.jsx';
import { usingMock } from '../../api/index.js';
import TextField from '../TextField.jsx';

// After this long without an answer, assume Render is waking up and say so.
const SLOW_MS = 2500;

const FIELDS = [
  { name: 'prospect_name', label: 'Contact name', placeholder: 'Ritu Agarwal' },
  { name: 'prospect_role', label: 'Contact role', placeholder: 'Founder' },
  { name: 'company', label: 'Company name', placeholder: 'Agarwal Spices' },
];

// All three are required. Returns { field: message } for the empty ones.
function validate(form) {
  const errors = {};
  for (const f of FIELDS) {
    if (!form[f.name].trim()) errors[f.name] = `Enter the ${f.label.toLowerCase()}.`;
  }
  return errors;
}

export default function StartPanel() {
  const { start } = useLiveCall();
  const [form, setForm] = useState({ prospect_name: '', prospect_role: '', company: '' });
  const [touched, setTouched] = useState({}); // show a field's error only after the caller leaves it
  const [status, setStatus] = useState('idle'); // idle | starting | waking | error
  const [error, setError] = useState('');

  const errors = validate(form);
  const valid = Object.keys(errors).length === 0;
  const busy = status === 'starting' || status === 'waking';

  async function onSubmit(e) {
    e.preventDefault();
    if (!valid || busy) return;
    setStatus('starting');
    setError('');
    const slow = setTimeout(() => setStatus('waking'), SLOW_MS);
    try {
      await start({
        prospect_name: form.prospect_name.trim(),
        prospect_role: form.prospect_role.trim(),
        company: form.company.trim(),
      });
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Could not start the call.');
    } finally {
      clearTimeout(slow);
    }
  }

  return (
    <section className="start" aria-labelledby="start-title">
      <h1 id="start-title" className="start-title">Who are you calling?</h1>
      <p className="start-lede">The guide walks you through the eight stages while you talk.</p>

      <form className="start-form" onSubmit={onSubmit} noValidate>
        {FIELDS.map((f, i) => (
          <TextField
            key={f.name}
            id={f.name}
            label={f.label}
            placeholder={f.placeholder}
            value={form[f.name]}
            error={touched[f.name] ? errors[f.name] : ''}
            autoFocus={i === 0}
            onChange={(value) => setForm({ ...form, [f.name]: value })}
            onBlur={() => setTouched({ ...touched, [f.name]: true })}
          />
        ))}

        <button type="submit" className="btn btn-primary btn-large" disabled={busy || !valid}>
          {busy ? 'Starting...' : 'Start call'}
        </button>

        {status === 'waking' && (
          <p className="waking" role="status">
            <span className="waking-pulse" aria-hidden="true" />
            Waking the server... the first call of the day can take up to a minute. You can start talking; the guide opens as soon as it answers.
          </p>
        )}
        {status === 'error' && (
          <p className="form-error" role="alert">
            {error} Check the connection and press Start call again.
          </p>
        )}
        {usingMock && <p className="hint">Demo mode: built-in mock API (VITE_USE_MOCK=true). Nothing is saved to the database.</p>}
      </form>
    </section>
  );
}
