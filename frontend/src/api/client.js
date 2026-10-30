// Real HTTP client for the Render backend. See shared/API.md for the contract.
const BASE_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

async function request(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (API_KEY) headers['x-api-key'] = API_KEY;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const getHealth = () => request('/health');
export const getStages = () => request('/stages');
export const createCall = (prospect) => request('/calls', { method: 'POST', body: prospect });
export const saveStage = (callId, stage) =>
  request(`/calls/${callId}/stages`, { method: 'POST', body: stage });
export const draftSummary = (callId, body) =>
  request(`/calls/${callId}/summary`, { method: 'POST', body });
export const closeCall = (callId, body) =>
  request(`/calls/${callId}/close`, { method: 'POST', body });
export const listCalls = (limit = 50) => request(`/calls?limit=${limit}`);
export const getCall = (callId) => request(`/calls/${callId}`);
