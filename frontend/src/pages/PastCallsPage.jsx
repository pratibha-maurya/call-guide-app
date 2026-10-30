import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/index.js';
import { useApi } from '../hooks/useApi.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import CallFilters from '../components/past/CallFilters.jsx';
import CallRow from '../components/past/CallRow.jsx';
import LoadError from '../components/LoadError.jsx';

const COLUMNS = ['Contact name', 'Role', 'Company', 'Date', 'Status', 'Outcome', 'Stage reached'];

export default function PastCallsPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(''); // '' = all
  const q = useDebouncedValue(query.trim(), 300);

  const { data, error, loading, slow, reload } = useApi(
    () => api.listCalls({ limit: 50, q: q || undefined, status: status || undefined }),
    [q, status],
  );
  const calls = data?.calls ?? [];

  return (
    <section className="past" aria-labelledby="past-title">
      <div className="past-head">
        <h1 id="past-title" className="page-title">Past calls</h1>
        <Link to="/" className="panel-link">Where calls end is on the Dashboard</Link>
      </div>

      <CallFilters query={query} onQuery={setQuery} status={status} onStatus={setStatus} />

      {loading && !data && (
        <p className="empty" role="status">
          {slow ? 'Waking the server… this can take up to a minute.' : 'Loading calls…'}
        </p>
      )}
      {error && <LoadError message="Couldn't load past calls." onRetry={reload} />}
      {data && calls.length === 0 && <EmptyList q={q} status={status} />}

      {calls.length > 0 && (
        <div className={`call-table${loading ? ' is-refreshing' : ''}`}>
          <div className="call-head" aria-hidden="true">
            {COLUMNS.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <ul className="call-list">
            {calls.map((c) => (
              <CallRow key={c.id} call={c} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function EmptyList({ q, status }) {
  if (q) return <p className="empty">No calls match '{q}'.</p>;
  if (status) return <p className="empty">No {status === 'closed' ? 'completed' : 'in-progress'} calls.</p>;
  return (
    <div className="empty-state">
      <p>No calls yet.</p>
      <Link to="/call" className="btn">Start a new call</Link>
    </div>
  );
}
