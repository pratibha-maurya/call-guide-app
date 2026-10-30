import { useLiveCall } from '../hooks/useLiveCall.jsx';
import StartPanel from '../components/live/StartPanel.jsx';
import ProspectBar from '../components/live/ProspectBar.jsx';
import StageRail from '../components/live/StageRail.jsx';
import StagePanel from '../components/live/StagePanel.jsx';
import ClosePanel from '../components/live/ClosePanel.jsx';
import DonePanel from '../components/live/DonePanel.jsx';

// One page, four phases: start -> live -> closing -> done.
export default function LiveCallPage() {
  const { state } = useLiveCall();

  if (state.phase === 'start') return <StartPanel />;
  if (state.phase === 'done') return <DonePanel />;

  return (
    <div className="live">
      <ProspectBar />
      {state.phase === 'live' ? (
        <>
          <StageRail />
          <StagePanel />
        </>
      ) : (
        <ClosePanel />
      )}
    </div>
  );
}
