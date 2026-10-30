// localStorage can throw (private mode, blocked storage), so every access is guarded.
const KEY = 'callguide.liveCall.v1';

export function loadLiveCall() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLiveCall(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: the call still works, it just won't survive a refresh */
  }
}

export function clearLiveCall() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
