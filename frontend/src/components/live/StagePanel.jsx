import { useLiveCall } from '../../hooks/useLiveCall.jsx';
import { useStages } from '../../lib/StagesContext.jsx';
import { useStageKeys } from '../../hooks/useStageKeys.js';
import TheyMaySay from './TheyMaySay.jsx';
import TapOptions from './TapOptions.jsx';
import WordsBox from './WordsBox.jsx';
import StageFooter from './StageFooter.jsx';

export default function StagePanel() {
  const { state, tap, setWords, next } = useLiveCall();
  const { stageByNo } = useStages();
  const stage = stageByNo(state.current);
  const entry = state.entries[state.current] ?? { tap: null, words: '' };

  useStageKeys({ taps: stage.taps, onTap: tap, onNext: next, enabled: true });

  return (
    <section className={`stage${stage.wordsRequired ? ' stage-key' : ''}`} aria-labelledby="stage-title">
      <h1 id="stage-title" className="stage-title">
        <span className="stage-no">{stage.no}</span>
        {stage.name}
      </h1>
      <p className="purpose">{stage.purpose}</p>

      <div className="stage-body">
        <TheyMaySay lines={stage.maySay} />
        <TapOptions taps={stage.taps} selected={entry.tap} onTap={tap} />
      </div>

      <WordsBox stage={stage} value={entry.words} onChange={setWords} />
      <StageFooter />
    </section>
  );
}
