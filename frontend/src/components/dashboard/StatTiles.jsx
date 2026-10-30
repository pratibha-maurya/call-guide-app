// Four headline numbers from GET /stats.
export default function StatTiles({ stats }) {
  const tiles = [
    { label: 'Total calls', value: stats.total },
    { label: 'Completed', value: stats.closed },
    { label: 'In progress', value: stats.in_progress },
    { label: 'Their own words captured', value: stats.with_need_words, note: 'stage 5', key: true },
  ];

  return (
    <dl className="tiles">
      {tiles.map((t) => (
        <div key={t.label} className={`tile${t.key ? ' tile-key' : ''}`}>
          <dt className="tile-label">
            {t.label}
            {t.note && <span className="tile-note"> · {t.note}</span>}
          </dt>
          <dd className="tile-value">{t.value}</dd>
        </div>
      ))}
    </dl>
  );
}
