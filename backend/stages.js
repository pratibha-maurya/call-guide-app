// Loads the stage guide. ./stages.json is a committed copy of ../shared/stages.json
// (refresh it with `npm run sync-stages`), because on Render the root directory is
// backend/ and ../shared does not exist at runtime.
import { readFileSync } from 'node:fs';

export const guide = JSON.parse(
  readFileSync(new URL('./stages.json', import.meta.url), 'utf8'),
);

export const outcomeKeys = guide.outcomes.map((o) => o.key);

export function getStage(no) {
  return guide.stages.find((s) => s.no === no);
}

export function tapLabel(stageNo, tapKey) {
  return getStage(stageNo)?.taps.find((t) => t.key === tapKey)?.label ?? tapKey;
}
