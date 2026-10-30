import { useHealth } from '../hooks/useHealth.js';
import { usingMock } from '../api/index.js';

const TEXT = {
  waking: 'Connecting to server',
  ok: 'Server ready',
  down: 'Server not reachable',
};

export default function HealthDot() {
  const status = useHealth();
  const label = usingMock ? `${TEXT[status]} (mock)` : TEXT[status];
  return (
    <span className={`health health-${status}`} role="status" title={label}>
      <span className="health-dot" aria-hidden="true" />
      <span className="health-text">{label}</span>
    </span>
  );
}
