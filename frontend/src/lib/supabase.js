// The browser's Supabase client, used only for logging in. Data still goes through
// the backend. The publishable key is public by design; the secret key never comes here.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && publishableKey);

// Read before the client clears the address bar. An email link lands here with
// #type=recovery for a password reset, or #error_code=... once it has expired.
const params = new URLSearchParams(window.location.hash.slice(1));
export const openedFromResetLink = params.get('type') === 'recovery';
export const emailLinkFailed = params.has('error_code');

export const supabase = supabaseConfigured
  ? createClient(url, publishableKey, { auth: { flowType: 'implicit' } })
  : null;
