import { useEffect, useState } from 'react';
import { formatDuration } from '../lib/format.js';

// Running clock from startedAt (ms). Freezes at endedAt once the call ends.
export default function CallTimer({ startedAt, endedAt }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endedAt]);

  const seconds = ((endedAt ?? now) - startedAt) / 1000;
  return (
    <span className="timer" aria-label={`Call time ${formatDuration(seconds)}`}>
      {formatDuration(seconds)}
    </span>
  );
}
