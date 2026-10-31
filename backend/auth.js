// Checks a Supabase access token and the approved-email list. Fails closed: with
// no list every login is refused, and without Supabase env nothing gets through.
// ALLOWED_EMAILS=* opens the app to anyone with a confirmed account.
import { createClient } from '@supabase/supabase-js';
import { HttpError } from './validate.js';

// "A@x.com, b@y.com" -> Set { a@x.com, b@y.com }
export function parseAllowedEmails(value = '') {
  return new Set(value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
}

// getUser is injectable so tests need no network.
export function createAuth({ url, publishableKey, allowedEmails, getUser } = {}) {
  const allowed = parseAllowedEmails(allowedEmails);
  let check = getUser;
  if (!check && url && publishableKey) {
    const sb = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    check = (token) => sb.auth.getUser(token);
  }

  return {
    async verify(token) {
      if (!check) throw new HttpError(503, 'authentication not configured');

      // Asks Supabase itself, so expired, forged and revoked tokens all fail here.
      const { data, error } = await check(token);
      const user = data?.user;
      if (error || !user) {
        // A Supabase outage is not a bad token: don't log the caller out over it.
        const rejected = error?.status >= 400 && error.status < 500;
        throw error && !rejected
          ? new HttpError(503, 'could not verify login, try again')
          : new HttpError(401, 'invalid or expired login');
      }

      const approved = allowed.has('*') || allowed.has(user.email?.toLowerCase());
      if (!user.email_confirmed_at || !approved) {
        throw new HttpError(403, 'this account is not approved');
      }
      return { id: user.id, email: user.email };
    },
  };
}
