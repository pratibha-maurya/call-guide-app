import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import TextField from '../components/TextField.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { emailLinkFailed, supabase } from '../lib/supabase.js';

export default function LoginPage() {
  const { status, resetting, notice } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (resetting) return <Navigate to="/reset-password" replace />;
  if (status === 'ready') return <Navigate to={location.state?.from ?? '/'} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: failed } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (failed) {
      setError(failed.status === 400
        ? 'Email or password is incorrect.' // never say which one
        : 'Could not log in right now. Check the connection and try again.');
    }
  }

  const checking = busy || status === 'checking';

  return (
    <AuthLayout title="Log in" lede="Only approved accounts can use Call Guide.">
      <form className="start-form" onSubmit={onSubmit}>
        <TextField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="username" autoFocus required />
        <TextField id="password" label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
        <button type="submit" className="btn btn-primary btn-large" disabled={checking || !email.trim() || !password}>
          {checking ? 'Logging in...' : 'Log in'}
        </button>
        {(error || notice) && <p className="form-error" role="alert">{error || notice}</p>}
        {emailLinkFailed && !error && !notice && (
          <p className="form-error" role="alert">That email link has expired or was already used. Try logging in.</p>
        )}
        <Link to="/forgot-password" className="auth-link">Forgot your password?</Link>
        <Link to="/sign-up" className="auth-link">Create an account</Link>
      </form>
    </AuthLayout>
  );
}
