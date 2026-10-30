import { useLiveCall } from '../../hooks/useLiveCall.jsx';
import { useStages } from '../../lib/StagesContext.jsx';

export default function StageFooter() {
  const { state, next, endCall } = useLiveCall();
  const { stageByNo } = useStages();
  const nextStage = stageByNo(state.current + 1);

  return (
    <div className="stage-footer">
      <button type="button" className="btn btn-end" onClick={endCall}>
        End call
      </button>
      <button type="button" className="btn btn-primary btn-next" onClick={next}>
        {nextStage ? (
          <>
            <span className="btn-next-small">Next</span> {nextStage.name}
          </>
        ) : (
          'Finish and record outcome'
        )}
      </button>
      <p className="keys-hint">
        <kbd>1</kbd>-<kbd>{stageByNo(state.current).taps.length}</kbd> pick, <kbd>Enter</kbd> next, <kbd>Ctrl</kbd>+<kbd>Enter</kbd> from the text box
      </p>
    </div>
  );
}
