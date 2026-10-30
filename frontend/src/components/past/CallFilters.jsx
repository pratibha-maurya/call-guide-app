// Search box plus status chips for the past-calls list.
const STATUSES = [
  { value: '', label: 'All' },
  { value: 'closed', label: 'Completed' },
  { value: 'in_progress', label: 'In progress' },
];

export default function CallFilters({ query, onQuery, status, onStatus }) {
  return (
    <div className="filters">
      <label className="search">
        <span className="visually-hidden">Search calls</span>
        <input
          type="search"
          className="input"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search name, role or company"
        />
      </label>
      <div className="chips" role="group" aria-label="Status">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            className="chip"
            aria-pressed={status === s.value}
            onClick={() => onStatus(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
