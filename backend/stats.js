// Counts for GET /stats, from the raw rows db.statsData() returns.
// Every stage (1-8) and every outcome key is present, zeros included, so the
// frontend can draw a fixed set of bars without filling gaps itself.
import { guide, outcomeKeys } from './stages.js';

export function aggregateStats({ calls, withNeedWords }) {
  const by_stage = Object.fromEntries(guide.stages.map((s) => [String(s.no), 0]));
  const by_outcome = Object.fromEntries(outcomeKeys.map((k) => [k, 0]));
  let closed = 0;

  for (const c of calls) {
    if (c.status === 'closed') closed += 1;
    const stage = String(c.stage_reached);
    if (Object.hasOwn(by_stage, stage)) by_stage[stage] += 1;
    // Only known keys: an outcome removed from stages.json should not add a bar.
    if (Object.hasOwn(by_outcome, c.outcome ?? '')) by_outcome[c.outcome] += 1;
  }

  return {
    total: calls.length,
    closed,
    in_progress: calls.length - closed,
    by_stage,
    by_outcome,
    with_need_words: withNeedWords,
  };
}
