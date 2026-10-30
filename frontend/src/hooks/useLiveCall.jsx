// The live call: reducer state + the side effects (saving to the API, mirroring
// to localStorage). Lives above the router so switching to Past calls and back
// keeps the call exactly where it was.
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { api } from '../api/index.js';
import { callReducer, initialState, stagePayload } from '../lib/callReducer.js';
import { clearLiveCall, loadLiveCall, saveLiveCall } from '../lib/storage.js';

const LiveCallContext = createContext(null);

function restore() {
  const saved = loadLiveCall();
  if (saved?.call && (saved.phase === 'live' || saved.phase === 'closing')) {
    return { ...initialState, ...saved };
  }
  return initialState;
}

export function LiveCallProvider({ children }) {
  const [state, dispatch] = useReducer(callReducer, undefined, restore);
  const [toast, setToast] = useState(null); // { message, retry? }
  const [inFlight, setInFlight] = useState(0); // saves waiting for the server
  const [savedOnce, setSavedOnce] = useState(false);

  // Async saves need the latest state, not the one captured when they started.
  const stateRef = useRef(state);
  stateRef.current = state;
  const pendingSaves = useRef(new Set());

  // Mirror the in-progress call so a refresh resumes it.
  useEffect(() => {
    if (state.phase === 'live' || state.phase === 'closing') saveLiveCall(state);
    else clearLiveCall();
  }, [state]);

  const saveStage = useCallback(async (stageNo) => {
    const { call } = stateRef.current;
    const payload = stagePayload(stateRef.current, stageNo);
    const request = api.saveStage(call.id, payload);
    pendingSaves.current.add(request);
    setInFlight((n) => n + 1);
    try {
      await request;
      dispatch({ type: 'saveOk', stageNo });
      setSavedOnce(true);
      return true;
    } catch {
      dispatch({ type: 'saveFailed', stageNo });
      return false;
    } finally {
      pendingSaves.current.delete(request);
      setInFlight((n) => n - 1);
    }
  }, []);

  const retryUnsaved = useCallback(async () => {
    setToast(null);
    const results = await Promise.all(stateRef.current.unsaved.map(saveStage));
    if (results.includes(false)) {
      setToast({ message: 'Still not saved. Your notes are kept on this screen.', retry: true });
    }
  }, [saveStage]);

  const saveInBackground = useCallback(
    (stageNo) => {
      saveStage(stageNo).then((ok) => {
        if (!ok) setToast({ message: `Stage ${stageNo} didn't save. Your notes are kept on this screen.`, retry: true });
      });
    },
    [saveStage],
  );

  // Wait for in-flight saves and retry failed ones, so the summary sees everything.
  const flushSaves = useCallback(async () => {
    await Promise.allSettled([...pendingSaves.current]);
    if (stateRef.current.unsaved.length) {
      await Promise.all(stateRef.current.unsaved.map(saveStage));
    }
  }, [saveStage]);

  const actions = {
    async start(prospect) {
      const { call } = await api.createCall(prospect);
      dispatch({ type: 'started', call, startedAt: Date.now() });
    },
    tap: (tap) => dispatch({ type: 'tap', tap }),
    setWords: (words) => dispatch({ type: 'words', words }),
    // Optimistic: move on at once, save behind the scenes.
    next() {
      const stageNo = stateRef.current.current;
      dispatch({ type: 'advance', endedAt: Date.now() });
      saveInBackground(stageNo);
    },
    // Same as Next, backwards: save what's on screen, then move.
    previous() {
      const { current } = stateRef.current;
      if (current <= 1) return;
      saveInBackground(current);
      dispatch({ type: 'goTo', stageNo: current - 1 });
    },
    goTo(stageNo) {
      const { current } = stateRef.current;
      if (stageNo === current) return;
      saveInBackground(current); // keep any edit made before jumping
      dispatch({ type: 'goTo', stageNo });
    },
    endCall() {
      const { current, entries } = stateRef.current;
      const entry = entries[current];
      if (entry && (entry.tap || entry.words.trim())) saveInBackground(current);
      dispatch({ type: 'endCall', endedAt: Date.now() });
    },
    resumeCall: () => dispatch({ type: 'resumeCall' }),
    setClose: (fields) => dispatch({ type: 'closeField', fields }),
    async draftSummary(outcome, { replace = false } = {}) {
      await flushSaves();
      const draft = await api.draftSummary(stateRef.current.call.id, { outcome });
      if (replace) dispatch({ type: 'closeField', fields: { summaryEdited: false } });
      dispatch({ type: 'summaryDrafted', ...draft });
      return draft;
    },
    async close() {
      await flushSaves();
      const s = stateRef.current;
      const { call } = await api.closeCall(s.call.id, {
        outcome: s.close.outcome,
        stage_no: s.furthest,
        next_step: s.close.nextStep.trim() || null,
        summary: s.close.summary.trim() || null,
        outcome_flag: s.close.flag || null,
      });
      dispatch({ type: 'closed', call });
    },
    reset() {
      setToast(null);
      setSavedOnce(false);
      dispatch({ type: 'reset' });
    },
    retryUnsaved,
    dismissToast: () => setToast(null),
  };

  // For the small "Saved / Saving / Not saved" line by the footer.
  const saveStatus = inFlight > 0 ? 'saving' : state.unsaved.length ? 'failed' : savedOnce ? 'saved' : 'idle';

  return (
    <LiveCallContext.Provider value={{ state, toast, saveStatus, ...actions }}>{children}</LiveCallContext.Provider>
  );
}

export function useLiveCall() {
  const ctx = useContext(LiveCallContext);
  if (!ctx) throw new Error('useLiveCall must be used inside LiveCallProvider');
  return ctx;
}
