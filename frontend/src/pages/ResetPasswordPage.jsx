import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import TextField from '../components/TextField.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { emailLinkFailed, supabase } from '../lib/supabase.js';

const MIN_LENGTH = 8;

export default function ResetPasswordPage() {
  const { status, resetting, resetDone } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (status === 'loading' || status === 'checking') {
    return <AuthLayout title="Set a new password" lede="Checking your link..." />;
  }

  // A reset needs a fresh email link, so an open session alone can't change the password.
  if (emailLinkFailed || !resetting || status !== 'ready') {
    return (
      <AuthLayout title="This link doesn't work" lede="Reset links expire and can only be used once. Ask for a new one.">
        <Link to="/forgot-password" className="auth-link">Send a new reset link</Link>
      </AuthLayout>
    );
  }

  const tooShort = password.length < MIN_LENGTH;
  const mismatch = confirm && password !== confirm;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: failed } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (failed) {
      setError(failed.message || 'Could not change the password. Try again.');
      return;
    }
    resetDone();
    navigate('/', { replace: true });
  }

  return (
    <AuthLayout title="Set a new password" lede={`Use at least ${MIN_LENGTH} characters.`}>
      <form className="start-form" onSubmit={onSubmit}>
        <TextField id="password" label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" autoFocus required />
        <TextField
          id="confirm"
          label="Type it again"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={mismatch ? "The passwords don't match." : ''}
          required
        />
        <button type="submit" className="btn btn-primary btn-large" disabled={busy || tooShort || password !== confirm}>
          {busy ? 'Saving...' : 'Save new password'}
        </button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </AuthLayout>
  );
}
