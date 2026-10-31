import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import TextField from '../components/TextField.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { supabase } from '../lib/supabase.js';

const MIN_LENGTH = 8;

export default function SignUpPage() {
  const { status } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | closed | error

  if (status === 'ready') return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setState('sending');
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) setState(error.code === 'signup_disabled' ? 'closed' : 'error');
    else setState('sent');
  }

  if (state === 'sent') {
    // Worded the same either way, so this page can't reveal which emails have accounts.
    return (
      <AuthLayout title="Check your email" lede="If this email can be used, a link to confirm your account is on its way. Open it to finish signing up.">
        <Link to="/login" className="auth-link">Back to log in</Link>
      </AuthLayout>
    );
  }

  const mismatch = confirm && password !== confirm;
  const incomplete = !email.trim() || password.length < MIN_LENGTH || password !== confirm;

  return (
    <AuthLayout title="Create an account" lede={`Use at least ${MIN_LENGTH} characters for your password. Only approved emails can use the app.`}>
      <form className="start-form" onSubmit={onSubmit}>
        <TextField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="username" autoFocus required />
        <TextField id="password" label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
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
        <button type="submit" className="btn btn-primary btn-large" disabled={state === 'sending' || incomplete}>
          {state === 'sending' ? 'Creating...' : 'Create account'}
        </button>
        {state === 'closed' && <p className="form-error" role="alert">New accounts are turned off right now.</p>}
        {state === 'error' && <p className="form-error" role="alert">Could not create the account. Check the details, wait a few minutes and try again.</p>}
        <Link to="/login" className="auth-link">Already have an account? Log in</Link>
      </form>
    </AuthLayout>
  );
}
