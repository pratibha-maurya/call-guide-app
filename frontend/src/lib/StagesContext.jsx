// Stage definitions: render immediately from the bundled copy, then swap in
// the backend's version once GET /stages answers (it may be asleep on Render).
import { createContext, useContext, useEffect, useState } from 'react';
import bundled from '../stages.json';
import { api } from '../api/index.js';

const StagesContext = createContext(bundled);

export function StagesProvider({ children }) {
  const [data, setData] = useState(bundled);

  useEffect(() => {
    let cancelled = false;
    api
      .getStages()
      .then((remote) => {
        if (!cancelled && Array.isArray(remote?.stages) && remote.stages.length === 8) setData(remote);
      })
      .catch(() => {
        /* keep the bundled copy */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <StagesContext.Provider value={data}>{children}</StagesContext.Provider>;
}

export function useStages() {
  const { stages, outcomes } = useContext(StagesContext);
  const stageByNo = (no) => stages.find((s) => s.no === no);
  const tapLabel = (no, key) => stageByNo(no)?.taps.find((t) => t.key === key)?.label ?? key;
  const outcomeLabel = (key) => outcomes.find((o) => o.key === key)?.label ?? key;
  return { stages, outcomes, stageByNo, tapLabel, outcomeLabel };
}
