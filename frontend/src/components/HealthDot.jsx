import { useHealth } from '../hooks/useHealth.js';
import { usingMock } from '../api/index.js';

const TEXT = {
  waking: 'Connecting to server',
  ok: 'Server ready',
  down: 'Server not reachable',
};

export default function HealthDot() {
  const { status, llm, model } = useHealth();
  const server = usingMock ? `${TEXT[status]} (mock)` : TEXT[status];
  const ai = usingMock ? 'AI: mock' : llm ? `AI on · ${model ?? 'model'}` : 'AI off';

  return (
    <span className={`health health-${status}`} role="status" title={`${server}. ${ai}`}>
      <span className="health-dot" aria-hidden="true" />
      <span className="health-text">{server}</span>
      {status === 'ok' && <span className={`health-ai${llm ? ' is-on' : ''}`}>{ai}</span>}
    </span>
  );
}
