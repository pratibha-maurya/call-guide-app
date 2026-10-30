import { useStages } from '../../lib/StagesContext.jsx';

export default function OutcomePicker({ value, onChange }) {
  const { outcomes } = useStages();
  return (
    <fieldset className="outcomes">
      <legend className="section-label">Outcome</legend>
      <div className="outcomes-grid">
        {outcomes.map((o) => (
          <label key={o.key} className="outcome">
            <input
              type="radio"
              name="outcome"
              value={o.key}
              checked={value === o.key}
              onChange={() => onChange(o.key)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
