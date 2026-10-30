import { useLiveCall } from '../../hooks/useLiveCall.jsx';
import { useStages } from '../../lib/StagesContext.jsx';

// The 8 stages as a strip. Visited stages are buttons so the caller can go back and edit.
export default function StageRail() {
  const { state, goTo } = useLiveCall();
  const { stages } = useStages();

  return (
    <nav className="rail" aria-label="Call stages">
      <ol className="rail-list">
        {stages.map((s) => {
          const isCurrent = s.no === state.current;
          const visited = s.no <= state.furthest;
          const entry = state.entries[s.no];
          const done = visited && !isCurrent && (entry?.tap || entry?.words);
          const unsaved = state.unsaved.includes(s.no);
          const cls = ['rail-step', isCurrent && 'is-current', done && 'is-done', visited && 'is-visited', unsaved && 'is-unsaved']
            .filter(Boolean)
            .join(' ');
          return (
            <li key={s.no} className={cls}>
              <button
                type="button"
                className="rail-btn"
                onClick={() => goTo(s.no)}
                disabled={!visited || isCurrent}
                aria-current={isCurrent ? 'step' : undefined}
                title={unsaved ? `${s.name} (not saved yet)` : s.name}
              >
                <span className="rail-no">{s.no}</span>
                <span className="rail-name">{s.name}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
