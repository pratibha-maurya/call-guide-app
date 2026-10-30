import { useEffect, useState } from 'react';
import { useLiveCall } from '../../hooks/useLiveCall.jsx';
import { useStages } from '../../lib/StagesContext.jsx';
import OutcomePicker from './OutcomePicker.jsx';
import SummaryBox from './SummaryBox.jsx';

export default function ClosePanel() {
  const { state, setClose, draftSummary, close, resumeCall } = useLiveCall();
  const { stageByNo } = useStages();
  const [draftStatus, setDraftStatus] = useState('idle'); // idle | loading | error
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const endedAt = stageByNo(state.furthest);
  const needWords = state.entries[5]?.words?.trim();
  const { outcome, nextStep } = state.close;

  // Draft a summary whenever the outcome changes. Failure never blocks saving.
  useEffect(() => {
    if (!outcome) return;
    let cancelled = false;
    setDraftStatus('loading');
    draftSummary(outcome)
      .then(() => !cancelled && setDraftStatus('idle'))
      .catch(() => !cancelled && setDraftStatus('error'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      await close();
    } catch (err) {
      setSaveError(`${err.message || 'Could not save.'} Everything you wrote is still here; press Save and close again.`);
      setSaving(false);
    }
  }

  return (
    <form className="close" onSubmit={onSave} aria-labelledby="close-title">
      <h1 id="close-title" className="close-title">
        Ended at Stage {endedAt.no}: {endedAt.name}
      </h1>

      {needWords ? (
        <figure className="need-quote">
          <blockquote>{needWords}</blockquote>
          <figcaption>Their need, in their words (stage 5)</figcaption>
        </figure>
      ) : (
        <p className="need-missing">Their need wasn't written down at stage 5.</p>
      )}

      <OutcomePicker value={outcome} onChange={(key) => setClose({ outcome: key })} />

      <SummaryBox
        status={draftStatus}
        hasOutcome={Boolean(outcome)}
        summary={state.close.summary}
        flag={state.close.flag}
        source={state.close.source}
        onChange={(text) => setClose({ summary: text, summaryEdited: true })}
      />

      <label className="field">
        <span className="field-label">Next step</span>
        <input
          className="input"
          value={nextStep}
          onChange={(e) => setClose({ nextStep: e.target.value })}
          placeholder="e.g. WhatsApp the deck today, call Thursday 4 pm"
        />
      </label>

      {saveError && <p className="form-error" role="alert">{saveError}</p>}

      <div className="close-actions">
        <button type="button" className="btn" onClick={resumeCall}>
          Back to the call
        </button>
        <button type="submit" className="btn btn-primary btn-large" disabled={!outcome || saving}>
          {saving ? 'Saving...' : 'Save and close'}
        </button>
      </div>
      {!outcome && <p className="hint close-hint">Pick an outcome to save the call.</p>}
    </form>
  );
}
