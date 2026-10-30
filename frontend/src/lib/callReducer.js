// All state for the live call lives here, so typed words survive any re-render,
// failed save or route change. The whole state is mirrored to localStorage.
//
// phase: 'start'  -> prospect form
//        'live'   -> walking the 8 stages
//        'closing'-> close panel (outcome, summary, next step)
//        'done'   -> saved, offer the next call

export const initialState = {
  phase: 'start',
  call: null, // the `call` object from the backend
  startedAt: null, // ms timestamp when the call started
  endedAt: null, // ms timestamp when End call was pressed
  current: 1, // stage on screen
  furthest: 1, // highest stage reached; the call "ended" here
  entries: {}, // { [stageNo]: { tap, words } }
  unsaved: [], // stage numbers whose last save failed
  close: { outcome: '', summary: '', summaryEdited: false, flag: null, source: null, nextStep: '' },
};

export const emptyEntry = { tap: null, words: '' };

export function callReducer(state, action) {
  switch (action.type) {
    case 'started':
      // startedAt is the caller's own clock, so the timer is not skewed by server time.
      return { ...initialState, phase: 'live', call: action.call, startedAt: action.startedAt };

    case 'tap': {
      const entry = state.entries[state.current] ?? emptyEntry;
      // Tapping the selected option again clears it.
      const tap = entry.tap === action.tap ? null : action.tap;
      return withEntry(state, state.current, { ...entry, tap });
    }

    case 'words': {
      const entry = state.entries[state.current] ?? emptyEntry;
      return withEntry(state, state.current, { ...entry, words: action.words });
    }

    case 'goTo': // jump back to a stage already visited
      if (action.stageNo < 1 || action.stageNo > state.furthest) return state;
      return { ...state, current: action.stageNo };

    case 'advance': {
      if (state.current >= 8) return { ...state, phase: 'closing', endedAt: action.endedAt };
      const next = state.current + 1;
      return { ...state, current: next, furthest: Math.max(state.furthest, next) };
    }

    case 'saveFailed':
      return state.unsaved.includes(action.stageNo)
        ? state
        : { ...state, unsaved: [...state.unsaved, action.stageNo] };

    case 'saveOk':
      return { ...state, unsaved: state.unsaved.filter((n) => n !== action.stageNo) };

    case 'endCall':
      return { ...state, phase: 'closing', endedAt: state.endedAt ?? action.endedAt };

    case 'resumeCall': // back from the close panel to the stages
      return { ...state, phase: 'live', endedAt: null };

    case 'closeField':
      return { ...state, close: { ...state.close, ...action.fields } };

    case 'summaryDrafted':
      return {
        ...state,
        close: {
          ...state.close,
          // Never overwrite a summary the caller has edited by hand.
          summary: state.close.summaryEdited ? state.close.summary : action.summary,
          flag: action.flag ?? null,
          source: action.source ?? null,
        },
      };

    case 'closed':
      return { ...state, phase: 'done', call: action.call };

    case 'reset':
      return initialState;

    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

function withEntry(state, stageNo, entry) {
  return { ...state, entries: { ...state.entries, [stageNo]: entry } };
}

// What we POST for one stage. Empty words are sent as null.
export function stagePayload(state, stageNo) {
  const entry = state.entries[stageNo] ?? emptyEntry;
  return { stage_no: stageNo, tap: entry.tap || null, prospect_words: entry.words.trim() || null };
}
