// localStorage can throw (private mode, blocked storage), so every access is guarded.
// One key per user, so an unfinished call never appears for someone else on this browser.
const OLD_KEY = 'callguide.liveCall.v1'; // from before logins; the server has what it saved
const keyFor = (userId) => `callguide.liveCall.v2.${userId}`;

export function loadLiveCall(userId) {
  try {
    localStorage.removeItem(OLD_KEY);
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLiveCall(userId, state) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(state));
  } catch {
    /* storage unavailable: the call still works, it just won't survive a refresh */
  }
}

export function clearLiveCall(userId) {
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    /* ignore */
  }
}
