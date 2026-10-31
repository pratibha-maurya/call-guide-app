import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import TextField from '../components/TextField.jsx';
import { supabase } from '../lib/supabase.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error

  async function onSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setStatus(error ? 'error' : 'sent');
  }

  if (status === 'sent') {
    // Worded the same either way, so this page can't reveal which emails have accounts.
    return (
      <AuthLayout title="Check your email" lede="If that email has an account, a link to set a new password is on its way.">
        <Link to="/login" className="auth-link">Back to log in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" lede="Enter your email and we'll send a link to set a new one.">
      <form className="start-form" onSubmit={onSubmit}>
        <TextField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="username" autoFocus required />
        <button type="submit" className="btn btn-primary btn-large" disabled={status === 'sending' || !email.trim()}>
          {status === 'sending' ? 'Sending...' : 'Send reset link'}
        </button>
        {status === 'error' && (
          <p className="form-error" role="alert">Could not send the email. Wait a few minutes and try again.</p>
        )}
        <Link to="/login" className="auth-link">Back to log in</Link>
      </form>
    </AuthLayout>
  );
}
