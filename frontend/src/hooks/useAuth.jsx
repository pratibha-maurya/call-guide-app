// Who is logged in, and whether the backend accepts them. This only decides what to
// show: the backend and the database's RLS policies are what actually protect data.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, usingMock } from '../api/index.js';
import { openedFromResetLink, supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);
const MOCK_USER = { id: 'mock', email: 'demo@mock' };
const NOT_APPROVED = 'This account is not approved to use Call Guide.';

export function AuthProvider({ children }) {
  // loading | signedOut | checking | ready | unreachable
  const [status, setStatus] = useState(usingMock ? 'ready' : 'loading');
  const [user, setUser] = useState(usingMock ? MOCK_USER : null);
  const [userId, setUserId] = useState(null);
  const [resetting, setResetting] = useState(openedFromResetLink); // came from a reset email
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (usingMock) return undefined;
    // Keep this callback synchronous: awaiting Supabase inside it can deadlock.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setResetting(true);
      setUserId(session?.user?.id ?? null);
      if (!session) {
        setUser(null);
        setStatus('signedOut');
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Runs when the logged-in person changes, not on every token refresh.
  useEffect(() => {
    if (usingMock || !userId) return undefined;
    let cancelled = false;
    setStatus('checking');
    api.getMe()
      .then(({ user: me }) => {
        if (cancelled) return;
        setUser(me);
        setNotice('');
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 403) {
          setNotice(NOT_APPROVED);
          supabase.auth.signOut({ scope: 'local' });
        } else if (err.status !== 401) { // 401: the API client has already signed out
          setStatus('unreachable');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  const logout = useCallback(() => supabase.auth.signOut({ scope: 'local' }), []);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const resetDone = useCallback(() => setResetting(false), []);

  return (
    <AuthContext.Provider value={{ status, user, resetting, notice, logout, retry, resetDone }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
