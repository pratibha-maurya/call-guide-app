import { useState } from 'react';
import { useLiveCall } from '../../hooks/useLiveCall.jsx';
import { usingMock } from '../../api/index.js';

// After this long without an answer, assume Render is waking up and say so.
const SLOW_MS = 2500;

export default function StartPanel() {
  const { start } = useLiveCall();
  const [form, setForm] = useState({ prospect_name: '', prospect_role: '', company: '' });
  const [status, setStatus] = useState('idle'); // idle | starting | waking | error
  const [error, setError] = useState('');

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.prospect_name.trim()) return;
    setStatus('starting');
    setError('');
    const slow = setTimeout(() => setStatus('waking'), SLOW_MS);
    try {
      await start({
        prospect_name: form.prospect_name.trim(),
        prospect_role: form.prospect_role.trim() || undefined,
        company: form.company.trim() || undefined,
      });
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Could not start the call.');
    } finally {
      clearTimeout(slow);
    }
  }

  const busy = status === 'starting' || status === 'waking';

  return (
    <section className="start" aria-labelledby="start-title">
      <h1 id="start-title" className="start-title">Who are you calling?</h1>
      <p className="start-lede">The guide walks you through the eight stages while you talk.</p>

      <form className="start-form" onSubmit={onSubmit}>
        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="input"
            value={form.prospect_name}
            onChange={update('prospect_name')}
            required
            autoFocus
            autoComplete="off"
            placeholder="Ritu Agarwal"
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Role <span className="optional">optional</span></span>
            <input className="input" value={form.prospect_role} onChange={update('prospect_role')} autoComplete="off" placeholder="Founder" />
          </label>
          <label className="field">
            <span className="field-label">Company <span className="optional">optional</span></span>
            <input className="input" value={form.company} onChange={update('company')} autoComplete="off" placeholder="Agarwal Spices" />
          </label>
        </div>

        <button type="submit" className="btn btn-primary btn-large" disabled={busy || !form.prospect_name.trim()}>
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
        {usingMock && <p className="hint">Running on the built-in mock API. Set VITE_API_URL to use the real backend.</p>}
      </form>
    </section>
  );
}
