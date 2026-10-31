// Real HTTP client for the backend. See shared/API.md for the contract.
import { supabase } from '../lib/supabase.js';

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_KEY = import.meta.env.VITE_API_KEY;

async function request(path, { method = 'GET', body, isPublic = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (API_KEY) headers['x-api-key'] = API_KEY;
  if (!isPublic) {
    // getSession refreshes the token first if it has expired.
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !isPublic) await supabase.auth.signOut({ scope: 'local' }); // back to the login page
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const getHealth = () => request('/health', { isPublic: true });
export const getStages = () => request('/stages', { isPublic: true });
export const getMe = () => request('/me');
export const createCall = (prospect) => request('/calls', { method: 'POST', body: prospect });
export const saveStage = (callId, stage) =>
  request(`/calls/${callId}/stages`, { method: 'POST', body: stage });
export const draftSummary = (callId, body) =>
  request(`/calls/${callId}/summary`, { method: 'POST', body });
export const closeCall = (callId, body) =>
  request(`/calls/${callId}/close`, { method: 'POST', body });
export const getCall = (callId) => request(`/calls/${callId}`);

// v2
// listCalls({ limit, q, status }) - status is 'closed' | 'in_progress' | undefined (all)
export function listCalls({ limit = 50, q, status } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  return request(`/calls?${params}`);
}
export const getStats = () => request('/stats');
export const suggest = (callId, body) =>
  request(`/calls/${callId}/suggest`, { method: 'POST', body });
